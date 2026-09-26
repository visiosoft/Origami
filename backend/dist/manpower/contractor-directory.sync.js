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
exports.ContractorDirectorySync = exports.isSubCompany = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const blank = (v) => !v || !v.trim() || v.trim() === '—';
const val = (v) => (blank(v) ? '' : v.trim());
const same = (a, b) => !!val(a) && val(a).toLowerCase() === val(b).toLowerCase();
function complianceToPerson(c, p) {
    if (val(c.licenseNumber) || val(c.licenseExpiry)) {
        const list = Array.isArray(p.licenses) ? [...p.licenses] : [];
        const i = list.findIndex((l) => (l?.discipline || 'CSLB') === 'CSLB');
        const cur = i >= 0 ? list[i] : { id: 'L-' + Math.random().toString(36).slice(2, 9), discipline: 'CSLB', licenseType: '', state: 'CA', notes: '' };
        const next = { ...cur, number: val(c.licenseNumber) || cur.number || '', expiresOn: val(c.licenseExpiry) || cur.expiresOn || '' };
        if (i >= 0)
            list[i] = next;
        else
            list.push(next);
        p.licenses = list;
    }
    if (val(c.insuranceProvider) || val(c.insurancePolicyNumber) || val(c.insuranceExpiry)) {
        const ins = p.insurance && typeof p.insurance === 'object' ? { ...p.insurance } : {};
        const gl = ins.generalLiability || { carrier: '', policy: '', expiresOn: '', notApplicable: false };
        ins.generalLiability = { ...gl, carrier: val(c.insuranceProvider) || gl.carrier, policy: val(c.insurancePolicyNumber) || gl.policy, expiresOn: val(c.insuranceExpiry) || gl.expiresOn, notApplicable: false };
        if (!ins.workersComp)
            ins.workersComp = { carrier: '', policy: '', expiresOn: '', notApplicable: false };
        p.insurance = ins;
    }
}
function complianceToContractor(p) {
    const out = {};
    const lic = (Array.isArray(p.licenses) ? p.licenses : []).find((l) => (l?.discipline || 'CSLB') === 'CSLB');
    if (lic) {
        out.licenseNumber = val(lic.number);
        out.licenseExpiry = val(lic.expiresOn);
    }
    const gl = p.insurance?.generalLiability;
    if (gl && !gl.notApplicable) {
        out.insuranceProvider = val(gl.carrier);
        out.insurancePolicyNumber = val(gl.policy);
        out.insuranceExpiry = val(gl.expiresOn);
    }
    return out;
}
const isSubCompany = (p) => p.kind === 'Sub' && !p.employeeId;
exports.isSubCompany = isSubCompany;
let ContractorDirectorySync = class ContractorDirectorySync {
    constructor(people, contractors, employees) {
        this.people = people;
        this.contractors = contractors;
        this.employees = employees;
        this.log = new common_1.Logger('ContractorDirectorySync');
    }
    async nextPersonId() {
        const rows = await this.people.find({ select: { id: true } });
        return rows.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1;
    }
    async syncContractor(c, candidates) {
        const all = candidates || (await this.people.find());
        let p = all.find((x) => x.id === Number(c.personId) && (0, exports.isSubCompany)(x))
            || all.find((x) => x.contractorId === c.id)
            || all.find((x) => (0, exports.isSubCompany)(x) && !x.contractorId && (same(x.email, c.email) || same(x.name, c.companyName) || same(x.company, c.companyName)));
        const fields = {
            kind: 'Sub', name: c.companyName, company: c.companyName, contact: val(c.contactPerson),
            phone: val(c.phone) || '—', email: val(c.email) || '—', contractorId: c.id, ...(c.userId ? { userId: c.userId } : {}),
        };
        if (!p) {
            p = this.people.create({
                id: await this.nextPersonId(), ...fields, role: 'Subcontractor', tier: 'Consultant', categories: ['Sub'],
                projects: [], openTasks: 0, comply: null, since: 'Added today', last: 'Just added',
            });
        }
        else {
            Object.assign(p, fields);
        }
        complianceToPerson(c, p);
        const saved = await this.people.save(p);
        if (candidates && !candidates.includes(saved))
            candidates.push(saved);
        const back = {};
        if (Number(c.personId) !== saved.id)
            back.personId = saved.id;
        if (!c.userId && saved.userId)
            back.userId = saved.userId;
        if (Object.keys(back).length)
            await this.contractors.update({ id: c.id }, back);
        return saved;
    }
    async contractorForPerson(p) {
        if (!(0, exports.isSubCompany)(p) || p.contractorId)
            return null;
        const now = new Date().toISOString();
        const c = await this.contractors.save(this.contractors.create({
            id: 'CTR-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
            companyName: val(p.company) || p.name, contactPerson: val(p.contact), phone: val(p.phone), email: val(p.email),
            personId: p.id, status: 'active', attachments: [], tradeIds: [], createdAt: now, updatedAt: now, ...(p.userId ? { userId: p.userId } : {}),
            ...complianceToContractor(p),
        }));
        p.contractorId = c.id;
        await this.people.save(p);
        return c;
    }
    async personChanged(p, dto) {
        if (!(0, exports.isSubCompany)(p))
            return;
        if (!p.contractorId) {
            await this.contractorForPerson(p);
            return;
        }
        const patch = {};
        if ('name' in dto || 'company' in dto)
            patch.companyName = p.name || val(p.company);
        if ('contact' in dto)
            patch.contactPerson = val(p.contact);
        if ('phone' in dto)
            patch.phone = val(p.phone);
        if ('email' in dto)
            patch.email = val(p.email);
        if ('userId' in dto)
            patch.userId = (p.userId || null);
        if ('licenses' in dto || 'insurance' in dto)
            Object.assign(patch, complianceToContractor(p));
        if (Object.keys(patch).length)
            await this.contractors.update({ id: p.contractorId }, { ...patch, updatedAt: new Date().toISOString() });
        if ('name' in dto && !('company' in dto) && p.company !== p.name) {
            p.company = p.name;
            await this.people.save(p);
        }
    }
    async removeForPerson(p) {
        if (!p.contractorId)
            return;
        const workers = await this.employees.count({ where: { contractorId: p.contractorId } });
        if (workers)
            throw new common_1.BadRequestException(`${p.name} still has ${workers} worker${workers === 1 ? '' : 's'} on file in Manpower -> Contractors -- move or remove them first.`);
        await this.contractors.delete({ id: p.contractorId });
    }
    async removeContractor(contractorId) {
        const linked = (await this.people.find()).filter((p) => p.contractorId === contractorId && (0, exports.isSubCompany)(p));
        if (linked.length)
            await this.people.remove(linked);
    }
    async backfill() {
        const [contractors, people] = await Promise.all([this.contractors.find(), this.people.find()]);
        let linked = 0, created = 0;
        for (const c of contractors) {
            const before = people.length;
            await this.syncContractor(c, people);
            if (people.length > before)
                created++;
            else
                linked++;
        }
        for (const p of people.filter((x) => (0, exports.isSubCompany)(x) && !x.contractorId)) {
            if (await this.contractorForPerson(p))
                created++;
        }
        if (created)
            this.log.log(`Subcontractors: ${linked} linked, ${created} created on the other side`);
    }
    async onApplicationBootstrap() {
        try {
            await this.backfill();
        }
        catch (err) {
            this.log.warn('Subcontractor sync skipped: ' + err.message);
        }
    }
};
exports.ContractorDirectorySync = ContractorDirectorySync;
exports.ContractorDirectorySync = ContractorDirectorySync = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.PersonEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.ContractorEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ContractorDirectorySync);
//# sourceMappingURL=contractor-directory.sync.js.map