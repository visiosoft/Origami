"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhasesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const project_phases_1 = require("../seed-data/project-phases");
const sections_service_1 = require("./sections.service");
const task_types_1 = require("../database/task.types");
const DEMO_PROJECT_ID = 1;
const SECTION_FOR_STATUS = {
    'Not started': 0,
    'In progress': 1,
    Blocked: 1,
    Done: 3,
};
let PhasesService = class PhasesService {
    constructor(repo, tasks, projects, sections) {
        this.repo = repo;
        this.tasks = tasks;
        this.projects = projects;
        this.sections = sections;
        this.log = new common_1.Logger('PhasesService');
    }
    async onApplicationBootstrap() {
        try {
            const stale = await this.repo.find();
            const retired = stale.filter((ph) => project_phases_1.RETIRED_PHASE_KEYS.includes(ph.key));
            if (!retired.length)
                return;
            const ids = retired.map((ph) => ph.id);
            const orphans = (await this.tasks.find()).filter((t) => t.phaseId && ids.includes(t.phaseId));
            if (orphans.length) {
                for (const task of orphans)
                    task.phaseId = null;
                await this.tasks.save(orphans);
                this.log.log(`Unfiled ${orphans.length} task(s) from retired phases`);
            }
            await this.repo.remove(retired);
            this.log.log(`Removed ${retired.length} retired phase row(s)`);
        }
        catch (err) {
            this.log.warn('Retired phase cleanup failed: ' + err.message);
        }
    }
    async overview() {
        const [projects, phases, tasks] = await Promise.all([
            this.projects.find({ order: { id: 'ASC' } }),
            this.repo.find({ order: { order: 'ASC' } }),
            this.tasks.find(),
        ]);
        const byPhase = new Map();
        for (const task of tasks) {
            if (!task.phaseId || task.parentId)
                continue;
            const bucket = byPhase.get(task.phaseId) || { total: 0, done: 0 };
            bucket.total += 1;
            if (task.completed || task.status === 'Done')
                bucket.done += 1;
            byPhase.set(task.phaseId, bucket);
        }
        return projects.map((project) => {
            const rows = phases.filter((ph) => Number(ph.projectId) === Number(project.id) && !project_phases_1.RETIRED_PHASE_KEYS.includes(ph.key));
            const byKey = new Map(rows.map((ph) => [ph.key, ph]));
            const source = [
                ...project_phases_1.PHASE_DEFINITIONS.map((d) => {
                    const row = byKey.get(d.key);
                    return row ?? { id: `PH-${project.id}-${d.key}`, key: d.key, name: d.name, color: d.color, order: d.order };
                }),
                ...rows.filter((ph) => !project_phases_1.PHASE_DEFINITIONS.some((d) => d.key === ph.key)),
            ].sort((a, b) => a.order - b.order);
            const own = source
                .map((ph) => {
                const c = byPhase.get(ph.id) || { total: 0, done: 0 };
                return {
                    id: ph.id, key: ph.key, name: ph.name, color: ph.color, order: ph.order,
                    total: c.total, done: c.done,
                    progress: c.total ? Math.round((c.done / c.total) * 100) : 0,
                    complete: c.total > 0 && c.done === c.total,
                };
            });
            const pinned = own.find((ph) => ph.key === project.designPhase);
            const started = own.filter((ph) => ph.total > 0);
            const current = pinned
                ?? started.find((ph) => !ph.complete)
                ?? started[started.length - 1]
                ?? own[0];
            const total = own.reduce((sum, ph) => sum + ph.total, 0);
            const done = own.reduce((sum, ph) => sum + ph.done, 0);
            return {
                projectId: Number(project.id),
                name: project.name,
                stage: project.stage,
                priority: project.priority,
                contractAmt: project.contractAmt,
                location: project.location,
                typeOfWork: project.typeOfWork,
                imgColor: project.imgColor,
                contractType: project.contractType,
                estStart: project.estStart,
                duration: project.duration,
                scope: project.scope,
                referral: project.referral,
                projectProgress: project.progress,
                currentPhaseKey: current?.key ?? null,
                phases: own,
                taskTotal: total,
                taskDone: done,
                progress: total ? Math.round((done / total) * 100) : 0,
            };
        });
    }
    async forProject(projectId) {
        if (!Number.isFinite(projectId))
            return [];
        if (!(await this.projects.findOneBy({ id: projectId })))
            return [];
        const existing = await this.repo.find({ where: { projectId }, order: { order: 'ASC' } });
        if (existing.length) {
            const missing = project_phases_1.PHASE_DEFINITIONS.filter((d) => !existing.some((ph) => ph.key === d.key));
            if (missing.length) {
                const added = await this.repo.save(missing.map((d) => this.repo.create({
                    id: `PH-${projectId}-${d.key}`, projectId, key: d.key, name: d.name, color: d.color, order: d.order,
                })));
                this.log.log(`Added ${added.length} new phase(s) to project ${projectId}`);
                existing.push(...added);
                existing.sort((a, b) => a.order - b.order);
            }
            await this.seedDemoTasks(projectId, existing);
            return existing;
        }
        const created = project_phases_1.PHASE_DEFINITIONS.map((d) => this.repo.create({
            id: `PH-${projectId}-${d.key}`,
            projectId,
            key: d.key,
            name: d.name,
            color: d.color,
            order: d.order,
        }));
        await this.repo.save(created);
        this.log.log(`Created ${created.length} phases for project ${projectId}`);
        await this.seedDemoTasks(projectId, created);
        return this.repo.find({ where: { projectId }, order: { order: 'ASC' } });
    }
    async board(projectId) {
        const phases = await this.forProject(projectId);
        const rows = await this.tasks.find({ order: { order: 'ASC' } });
        const tasks = rows.filter((t) => Number(t.projectId) === projectId && !!t.phaseId);
        return { phases, tasks };
    }
    create(dto) {
        const projectId = Number(dto.projectId);
        const id = dto.id || `PH-${projectId}-${(0, task_types_1.subId)('p')}`;
        return this.repo.save(this.repo.create({
            color: '#173326',
            order: 0,
            key: id,
            name: 'New Phase',
            ...dto,
            projectId,
            id,
        }));
    }
    async update(id, dto) {
        const phase = await this.repo.findOneBy({ id });
        if (!phase)
            throw new common_1.NotFoundException(`Phase ${id} not found`);
        Object.assign(phase, dto, { id });
        return this.repo.save(phase);
    }
    async remove(id) {
        const phase = await this.repo.findOneBy({ id });
        if (!phase)
            return { id, deleted: true };
        await this.tasks.update({ phaseId: id }, { phaseId: null });
        await this.repo.remove(phase);
        return { id, deleted: true };
    }
    async seedDemoTasks(projectId, phases) {
        if (projectId !== DEMO_PROJECT_ID)
            return;
        if (!(await this.projects.findOneBy({ id: projectId })))
            return;
        const already = await this.tasks.count({ where: { projectId, phaseId: phases[0]?.id } });
        if (already > 0)
            return;
        const anyPhaseTask = (await this.tasks.find({ where: { projectId } })).some((t) => !!t.phaseId);
        if (anyPhaseTask)
            return;
        const start = await this.projectStart(projectId);
        const sections = await this.sections.forProject(projectId);
        const phaseByKey = new Map(phases.map((p) => [p.key, p]));
        const byTitle = new Map();
        const rows = [];
        project_phases_1.DEMO_PHASE_TASKS.forEach((tpl, index) => {
            const phase = phaseByKey.get(tpl.phaseKey);
            if (!phase)
                return;
            const status = project_phases_1.TEMPLATE_STATUS[tpl.status] || 'Not started';
            const sectionIdx = SECTION_FOR_STATUS[status] ?? 0;
            const startDate = this.addDays(start, tpl.offsetDays);
            const endDate = tpl.durationDays == null ? '' : this.addDays(start, tpl.offsetDays + Math.max(0, tpl.durationDays - 1));
            const id = `T-${projectId}-${String(index + 1).padStart(3, '0')}`;
            byTitle.set(tpl.title, id);
            rows.push(this.tasks.create({
                id,
                projectId,
                sectionId: (sections[sectionIdx] ?? sections[0])?.id ?? `S-${projectId}-0`,
                phaseId: phase.id,
                title: tpl.title,
                status,
                completed: status === 'Done',
                team: tpl.team,
                auto: tpl.auto,
                autoLabel: tpl.autoLabel ?? '',
                startDate,
                endDate,
                durationDays: tpl.durationDays ?? null,
                order: index,
                parentId: null,
                attachments: [],
                comments: [],
                checklist: [],
                labels: [],
                activity: [(0, task_types_1.event)('created', { name: 'Origami' }, { text: 'created from the project programme' })],
                createdAt: new Date().toISOString().slice(0, 10),
            }));
        });
        for (const row of rows) {
            const tpl = project_phases_1.DEMO_PHASE_TASKS.find((t) => t.title === row.title);
            row.dependsOn = (tpl?.deps ?? []).map((d) => byTitle.get(d)).filter(Boolean);
        }
        await this.tasks.save(rows);
        await this.stampPhaseDates(phases, rows);
        this.log.log(`Seeded ${rows.length} programme tasks for the demo project`);
    }
    async stampPhaseDates(phases, rows) {
        for (const phase of phases) {
            const mine = rows.filter((r) => r.phaseId === phase.id && r.startDate);
            if (!mine.length)
                continue;
            phase.startDate = mine.map((r) => r.startDate).sort()[0];
            phase.endDate = mine.map((r) => r.endDate || r.startDate).sort().slice(-1)[0];
        }
        await this.repo.save(phases);
    }
    async projectStart(projectId) {
        const project = await this.projects.findOneBy({ id: projectId });
        const raw = (project?.estStart || '').trim();
        const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
        if (iso)
            return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
        const monthYear = /^([A-Za-z]{3,})\s+(\d{4})$/.exec(raw);
        if (monthYear) {
            const month = new Date(`${monthYear[1]} 1, 2000`).getMonth();
            if (!Number.isNaN(month))
                return new Date(Date.UTC(+monthYear[2], month, 1));
        }
        const now = new Date();
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    }
    addDays(from, days) {
        const d = new Date(from.getTime());
        d.setUTCDate(d.getUTCDate() + days);
        return d.toISOString().slice(0, 10);
    }
};
exports.PhasesService = PhasesService;
exports.PhasesService = PhasesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ProjectPhaseEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.ProjectTaskEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        sections_service_1.SectionsService])
], PhasesService);
//# sourceMappingURL=phases.service.js.map