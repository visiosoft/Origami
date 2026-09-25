import { Injectable, Logger, NotFoundException, ConflictException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadEntity, ProjectEntity } from '../database/entities';
import { leadStreetAddress } from './lead-address';
import { LEAD_DROPDOWN_OPTIONS } from '../seed-data/leads';
import { TasksService } from '../tasks/tasks.service';

const HOMEWORK_TASK_LABEL = 'kind:homework-collection';
const HOMEWORK_EMPTY_TEXT = 'No homework items selected yet.';

@Injectable()
export class LeadsService implements OnApplicationBootstrap {
    private readonly log = new Logger('LeadsService');

    constructor(
        @InjectRepository(LeadEntity) private readonly repo: Repository<LeadEntity>,
        private readonly tasks: TasksService,
        @InjectRepository(ProjectEntity) private readonly projects?: Repository<ProjectEntity>,
    ) { }

    /** The lead's street address is its project's location -- kept in step, so the project shows where to drive. */
    private async syncProjectAddress(lead: LeadEntity) {
        if (!this.projects) return;
        const address = leadStreetAddress(lead);
        if (!address) return;
        const project = await this.projects.findOneBy({ leadId: lead.id });
        if (project && project.location !== address) await this.projects.update({ id: project.id }, { location: address });
    }

    /** Projects made from a lead before this existed still say "San Jose, County of ..." -- fill them in once. */
    async onApplicationBootstrap() {
        if (!this.projects) return;
        try {
            const linked = (await this.projects.find()).filter((p) => p.leadId);
            let n = 0;
            for (const p of linked) {
                const address = leadStreetAddress(await this.repo.findOneBy({ id: p.leadId }));
                if (address && p.location !== address) { await this.projects.update({ id: p.id }, { location: address }); n++; }
            }
            if (n) this.log.log(`Project addresses filled from their leads: ${n}`);
        } catch (err) {
            this.log.warn(`Project address backfill skipped: ${(err as Error).message}`);
        }
    }

    /**
     * Keeps a single task per lead listing whichever homework items are
     * checked -- created the first time one is, updated in place afterward
     * rather than duplicated. Mirrors ProjectsService.ensureForLead's
     * find-by-natural-key pattern; the lookup key here is the task's
     * `project` (the lead id, by the same convention DealTasksPanel already
     * relies on) plus a reserved label.
     */
    private async syncHomeworkTask(leadId: string, homeworkCompleted: string[]) {
        const existing = ((await this.tasks.findAll(undefined, leadId)) as any[])
            .find((t) => (t.labels || []).includes(HOMEWORK_TASK_LABEL));

        if (!homeworkCompleted.length) {
            // Nothing checked (yet, or unchecked back down) -- leave a task
            // that already existed open with a neutral description rather
            // than deleting it; don't create a new one over nothing.
            if (existing && existing.description !== HOMEWORK_EMPTY_TEXT) {
                await this.tasks.update(existing.id, { description: HOMEWORK_EMPTY_TEXT }, { name: 'System' });
            }
            return;
        }

        const description = `Collect from client: ${homeworkCompleted.join(', ')}`;
        if (existing) {
            if (existing.description !== description) {
                await this.tasks.update(existing.id, { description }, { name: 'System' });
            }
        } else {
            await this.tasks.create({
                project: leadId, description, labels: [HOMEWORK_TASK_LABEL], topicType: 'Task', tab: 'internal',
            }, { name: 'System' });
        }
    }

    getOptions() {
        return LEAD_DROPDOWN_OPTIONS; // static dropdown config, not row data
    }

    findAll() {
        return this.repo.find({ order: { createdAt: 'DESC' } });
    }

    async findOne(id: string) {
        const lead = await this.repo.findOneBy({ id });
        if (!lead) throw new NotFoundException(`Lead ${id} not found`);
        return lead;
    }

    async create(dto: any) {
        // Prefer a caller-supplied id so a lead links 1:1 with its pipeline deal
        // (PL-…). Fall back to an LD- id only for standalone leads. The old
        // `% 10000` truncation gave only 10,000 possible values -- collision-
        // prone under normal use, and save() upserts by primary key, so a
        // collision would silently merge onto an unrelated existing lead.
        const id = dto.id || 'LD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
        // Guard explicitly rather than relying on ids never colliding -- see above.
        if (await this.repo.findOneBy({ id })) {
            throw new ConflictException(`A lead with id ${id} already exists`);
        }
        const lead = { ...dto, id, createdAt: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString() };
        const saved = await this.repo.save(this.repo.create(lead as Partial<LeadEntity>));
        if ('homeworkCompleted' in dto) {
            this.syncHomeworkTask(id, dto.homeworkCompleted || []).catch((err) =>
                this.log.warn(`Homework task sync failed for ${id}: ${(err as Error).message}`));
        }
        return saved;
    }

    // Upsert: "Save Lead Details" targets the deal id, which may not have a
    // leads row yet — create it in that case instead of 404-ing.
    //
    // expectedUpdatedAt, when sent, guards against a save that started from a
    // stale copy overwriting a newer one -- only enforced when the row
    // already has its own updatedAt stamp, so a lead saved before this
    // existed doesn't start failing every save.
    async update(id: string, dto: any) {
        let lead = await this.repo.findOneBy({ id });
        const now = new Date().toISOString();
        let saved: LeadEntity;
        if (!lead) {
            const { expectedUpdatedAt, ...patch } = dto;
            lead = this.repo.create({ ...patch, id, createdAt: new Date().toISOString().slice(0, 10), updatedAt: now } as Partial<LeadEntity>);
            saved = await this.repo.save(lead);
        } else {
            if (dto.expectedUpdatedAt && lead.updatedAt && dto.expectedUpdatedAt !== lead.updatedAt) {
                throw new ConflictException('This lead was updated by someone else since you loaded it. Reload and reapply your changes.');
            }
            const { expectedUpdatedAt, ...patch } = dto;
            Object.assign(lead, patch, { updatedAt: now });
            saved = await this.repo.save(lead);
        }
        if ('homeworkCompleted' in dto) {
            this.syncHomeworkTask(id, dto.homeworkCompleted || []).catch((err) =>
                this.log.warn(`Homework task sync failed for ${id}: ${(err as Error).message}`));
        }
        await this.syncProjectAddress(saved).catch((err) => this.log.warn(`Project address for ${id} not updated: ${(err as Error).message}`));
        return saved;
    }

    async remove(id: string) {
        const lead = await this.repo.findOneBy({ id });
        if (lead) await this.repo.remove(lead);
        return { id, deleted: true };
    }
}
