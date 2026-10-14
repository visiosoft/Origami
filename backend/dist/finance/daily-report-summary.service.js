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
exports.DailyReportSummaryService = exports.ROLLUP_STATUSES = void 0;
exports.taskColumn = taskColumn;
exports.rfiColumn = rfiColumn;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const financials_service_1 = require("./financials.service");
const finance_calc_1 = require("./finance.calc");
exports.ROLLUP_STATUSES = ['To Do', 'Assigned', 'In Progress', 'On Hold', 'Complete', 'Confirmed'];
const empty = () => ({ 'To Do': 0, Assigned: 0, 'In Progress': 0, 'On Hold': 0, Complete: 0, Confirmed: 0 });
const day = (v) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '');
const plus = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
const pct = (n) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));
function taskColumn(t) {
    if (t.completed || t.status === 'Done')
        return 'Complete';
    if (t.status === 'On hold')
        return 'On Hold';
    if (t.status === 'In progress')
        return 'In Progress';
    return t.assigneeId || (t.assignee || '').trim() ? 'Assigned' : 'To Do';
}
function rfiColumn(status) {
    switch (status) {
        case 'draft': return 'To Do';
        case 'open': return 'In Progress';
        case 'answered': return 'Complete';
        case 'closed': return 'Confirmed';
        default: return null;
    }
}
let DailyReportSummaryService = class DailyReportSummaryService {
    constructor(fin, projects, tasks, rfis, cos) {
        this.fin = fin;
        this.projects = projects;
        this.tasks = tasks;
        this.rfis = rfis;
        this.cos = cos;
    }
    async summary(projectId, onDate) {
        const today = day(onDate) || new Date().toISOString().slice(0, 10);
        const [project, tasks, rfis, cos] = await Promise.all([
            this.projects.findOneBy({ id: projectId }),
            this.tasks.find({ where: { projectId } }),
            this.rfis.find({ where: { projectId } }),
            this.cos.find({ where: { projectId } }),
        ]);
        let percentInvoiced = null;
        try {
            const ctx = await this.fin.context(projectId);
            if (ctx.exists) {
                const s = (0, finance_calc_1.computeSov)(ctx.input).summary;
                percentInvoiced = s.revisedContractC > 0 ? pct((s.contractWorkInvoicedC / s.revisedContractC) * 100) : null;
            }
        }
        catch { }
        let start = '', end = '';
        for (const t of tasks) {
            if (t.parentId)
                continue;
            const s = day(t.startDate) || day(t.dueDate) || day(t.endDate);
            if (!s)
                continue;
            let e = day(t.endDate) || day(t.dueDate) || (t.durationDays ? plus(s, Math.max(0, t.durationDays - 1)) : s);
            if (e < s)
                e = s;
            if (!start || s < start)
                start = s;
            if (!end || e > end)
                end = e;
        }
        const coDays = cos.filter((c) => c.status === 'approved').reduce((n, c) => n + (Number(c.scheduleImpactDays) || 0), 0);
        if (!start && day(project?.estStart))
            start = day(project?.estStart);
        let percentDuration = null;
        let scheduleEnd = null;
        if (start && end) {
            scheduleEnd = plus(end, coDays);
            const total = daysBetween(start, scheduleEnd) + 1;
            percentDuration = total > 0 ? pct((Math.max(0, daysBetween(start, today) + 1) / total) * 100) : null;
        }
        const taskCounts = empty();
        for (const t of tasks)
            taskCounts[taskColumn(t)]++;
        const rfiCounts = empty();
        for (const r of rfis) {
            const c = rfiColumn(r.status);
            if (c)
                rfiCounts[c]++;
        }
        const coCounts = {};
        for (const c of cos)
            coCounts[c.status] = (coCounts[c.status] || 0) + 1;
        return {
            projectId, asOf: today,
            percentInvoiced, percentDuration, scheduleStart: start || null, scheduleEnd, changeOrderDays: coDays,
            tasks: taskCounts, rfis: rfiCounts, changeOrders: coCounts,
        };
    }
};
exports.DailyReportSummaryService = DailyReportSummaryService;
exports.DailyReportSummaryService = DailyReportSummaryService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.ProjectTaskEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.RfiEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.ChangeOrderEntity)),
    __metadata("design:paramtypes", [financials_service_1.FinancialsService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], DailyReportSummaryService);
//# sourceMappingURL=daily-report-summary.service.js.map