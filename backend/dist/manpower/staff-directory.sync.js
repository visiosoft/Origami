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
exports.StaffDirectorySync = void 0;
exports.splitName = splitName;
exports.personFieldsFor = personFieldsFor;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const settings_service_1 = require("../settings/settings.service");
const workforce_util_1 = require("./workforce.util");
const blank = (v) => !v || !v.trim() || v.trim() === '—';
const norm = (v) => (v || '').trim().toLowerCase();
const isWorker = (e) => !!e.contractorId || e.employmentType === 'contractor_worker';
function splitName(name) {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1)
        return { firstName: parts[0] || '', lastName: '' };
    return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}
function personFieldsFor(e, company) {
    const worker = isWorker(e);
    return {
        name: (e.name || '').trim(),
        ...splitName(e.name),
        email: blank(e.email) ? '—' : e.email.trim(),
        phone: blank(e.phone) ? '—' : e.phone.trim(),
        role: (e.designation || e.jobTitle || e.trade || (worker ? 'Worker' : 'Staff')).trim(),
        company,
        kind: worker ? 'Sub' : 'Staff',
    };
}
let StaffDirectorySync = class StaffDirectorySync {
    constructor(employees, people, contractors, settings) {
        this.employees = employees;
        this.people = people;
        this.contractors = contractors;
        this.settings = settings;
        this.log = new common_1.Logger('StaffDirectorySync');
    }
    async onApplicationBootstrap() {
        try {
            await this.backfill();
        }
        catch (e) {
            this.log.warn(`People/employee sync skipped: ${e.message}`);
        }
    }
    async companyFor(e) {
        if (e.contractorId) {
            const c = await this.contractors.findOneBy({ id: e.contractorId });
            if (c?.companyName)
                return c.companyName;
        }
        return (await this.settings.get('brand.companyName')) || 'Origami Design + Build';
    }
    async nextPersonId() {
        const rows = await this.people.find();
        return rows.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1;
    }
    async syncEmployee(e, candidates) {
        const all = candidates || (await this.people.find());
        let person = all.find((p) => p.employeeId === e.id)
            || (!blank(e.email) ? all.find((p) => !p.employeeId && !p.contractorId && norm(p.email) === norm(e.email)) : undefined)
            || all.find((p) => !p.employeeId && !p.contractorId && ['Staff', 'Sub'].includes(p.kind) && norm(p.name) === norm(e.name));
        const fields = personFieldsFor(e, await this.companyFor(e));
        if (!person) {
            person = this.people.create({
                id: await this.nextPersonId(), projects: [], openTasks: 0, comply: null, since: new Date().toISOString().slice(0, 10), last: 'Added from Manpower',
                tier: fields.kind === 'Staff' ? 'Internal' : 'Consultant', contact: null,
                categories: [fields.kind === 'Staff' ? 'Staff' : 'Sub'],
            });
        }
        Object.assign(person, fields, { employeeId: e.id });
        const saved = await this.people.save(person);
        if (candidates && !candidates.includes(saved))
            candidates.push(saved);
        return saved;
    }
    async employeeForPerson(p) {
        const all = await this.employees.find();
        const now = new Date().toISOString();
        const emp = await this.employees.save(this.employees.create({
            id: 'EMP-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
            name: p.name, email: blank(p.email) ? '' : p.email, phone: blank(p.phone) ? '' : p.phone, designation: p.role || '',
            employmentType: 'full_time', employmentStatus: 'active', status: 'active', workerId: (0, workforce_util_1.nextWorkerId)(all.map((e) => e.workerId)), createdAt: now, updatedAt: now,
        }));
        p.employeeId = emp.id;
        await this.people.save(p);
        return emp;
    }
    async personChanged(p, dto) {
        if (!p.employeeId)
            return;
        const patch = {};
        if ('name' in dto && dto.name?.trim())
            patch.name = dto.name.trim();
        if ('email' in dto)
            patch.email = blank(dto.email) ? '' : String(dto.email).trim();
        if ('phone' in dto)
            patch.phone = blank(dto.phone) ? '' : String(dto.phone).trim();
        if ('role' in dto && dto.role?.trim())
            patch.designation = dto.role.trim();
        if (Object.keys(patch).length)
            await this.employees.update({ id: p.employeeId }, { ...patch, updatedAt: new Date().toISOString() });
    }
    async removeEmployee(employeeId) {
        const linked = await this.people.find({ where: { employeeId } });
        if (linked.length)
            await this.people.remove(linked);
    }
    async backfill() {
        const [emps, people] = await Promise.all([this.employees.find(), this.people.find()]);
        const empIds = new Set(emps.map((e) => e.id));
        let linked = 0, created = 0, removed = 0;
        for (const p of people.filter((x) => x.employeeId && !empIds.has(x.employeeId))) {
            await this.people.remove(p);
            removed++;
        }
        const live = people.filter((x) => !x.employeeId || empIds.has(x.employeeId));
        for (const e of emps) {
            const before = live.find((p) => p.employeeId === e.id);
            await this.syncEmployee(e, live);
            if (!before)
                linked++;
        }
        for (const p of live.filter((x) => x.kind === 'Staff' && !x.employeeId)) {
            await this.employeeForPerson(p);
            created++;
        }
        if (linked || created || removed)
            this.log.log(`People/employee sync: ${linked} linked, ${created} employee records created, ${removed} stale entries removed`);
    }
};
exports.StaffDirectorySync = StaffDirectorySync;
exports.StaffDirectorySync = StaffDirectorySync = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.PersonEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.ContractorEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        settings_service_1.SettingsService])
], StaffDirectorySync);
//# sourceMappingURL=staff-directory.sync.js.map