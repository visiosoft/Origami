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
exports.ProjectSubsService = void 0;
exports.expiryState = expiryState;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const financials_service_1 = require("./financials.service");
const money_1 = require("./money");
const todayISO = () => new Date().toISOString().slice(0, 10);
function expiryState(date, today = todayISO()) {
    const d = (date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d))
        return '';
    if (d < today)
        return 'expired';
    const soon = new Date(`${today}T12:00:00Z`);
    soon.setUTCDate(soon.getUTCDate() + 30);
    return d <= soon.toISOString().slice(0, 10) ? 'soon' : 'ok';
}
let ProjectSubsService = class ProjectSubsService {
    constructor(commitments, lines, entries, contractors, people, trades, fin) {
        this.commitments = commitments;
        this.lines = lines;
        this.entries = entries;
        this.contractors = contractors;
        this.people = people;
        this.trades = trades;
        this.fin = fin;
    }
    async list(projectId, actor) {
        const project = await this.fin.project(projectId);
        const rights = await this.fin.rights(actor);
        const money = !!(rights.viewProfitability || rights.manageCosts);
        const [cos, lines, entries, contractors, people, trades] = await Promise.all([
            this.commitments.find({ where: { projectId } }), this.lines.find({ where: { projectId } }), this.entries.find({ where: { projectId } }),
            this.contractors.find(), this.people.find(), this.trades.find(),
        ]);
        const tradeName = new Map(trades.map((t) => [t.id, `${t.code} ${t.name}`.trim()]));
        const byId = new Map(contractors.map((c) => [c.id, c]));
        const rows = new Map();
        for (const c of cos.filter((x) => x.status !== 'void')) {
            const k = c.contractorId || `vendor:${(c.vendorName || '').trim().toLowerCase()}`;
            if (!rows.has(k)) {
                const k2 = c.contractorId ? byId.get(c.contractorId) : undefined;
                rows.set(k, {
                    key: k, contractorId: k2?.id, company: k2?.companyName || c.vendorName || 'Unnamed vendor',
                    contactPerson: k2?.contactPerson, phone: k2?.phone, email: k2?.email,
                    trades: (k2?.tradeIds || []).map((id) => tradeName.get(id) || id),
                    licenseNumber: k2?.licenseNumber, licenseExpiry: k2?.licenseExpiry, licenseState: expiryState(k2?.licenseExpiry),
                    insuranceExpiry: k2?.insuranceExpiry, insuranceState: expiryState(k2?.insuranceExpiry),
                    status: k2?.status, portal: !!k2?.userId, personId: k2?.personId, subcontracts: [],
                });
            }
            const totalC = (0, money_1.sumCents)(lines.filter((l) => l.commitmentId === c.id).map((l) => (0, money_1.toCents)(l.amount)));
            const billedC = (0, money_1.sumCents)(entries.filter((e) => e.commitmentId === c.id && e.status !== 'void').map((e) => (0, money_1.toCents)(e.amount)));
            rows.get(k).subcontracts.push({
                id: c.id, number: c.number, type: c.type, title: c.title, status: c.status,
                ...(money ? { total: (0, money_1.fromCents)(totalC), billed: (0, money_1.fromCents)(billedC), remaining: (0, money_1.fromCents)(c.status === 'approved' ? Math.max(totalC - billedC, 0) : 0) } : {}),
            });
        }
        for (const r of rows.values())
            r.subcontracts.sort((a, b) => a.number.localeCompare(b.number));
        const onJob = new Set([...rows.values()].map((r) => r.personId).filter(Boolean));
        const contractorByPerson = new Map(contractors.filter((c) => c.personId).map((c) => [Number(c.personId), c]));
        const unlinked = people
            .filter((p) => p.kind === 'Sub' && (p.projects || []).includes(project.name) && !onJob.has(p.id))
            .map((p) => ({ personId: p.id, name: p.name, company: p.company, role: p.role, phone: p.phone, email: p.email, contractorId: contractorByPerson.get(p.id)?.id }));
        return {
            canSeeMoney: money, canManage: !!rights.manageCosts,
            rows: [...rows.values()].sort((a, b) => a.company.localeCompare(b.company)),
            unlinked,
        };
    }
};
exports.ProjectSubsService = ProjectSubsService;
exports.ProjectSubsService = ProjectSubsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.CommitmentEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.CommitmentLineEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.CostEntryEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.ContractorEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.PersonEntity)),
    __param(5, (0, typeorm_1.InjectRepository)(entities_1.SubcontractorTradeEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        financials_service_1.FinancialsService])
], ProjectSubsService);
//# sourceMappingURL=project-subs.service.js.map