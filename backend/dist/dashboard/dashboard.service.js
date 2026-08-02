"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
let DashboardService = class DashboardService {
    getKpis() {
        return {
            activeProjects: 6,
            leadPipeline: { total: 9, won: 3, lost: 1, live: 5 },
            contractValue: 4_820_000,
            outstandingInvoices: 312_450,
        };
    }
    getBudgetVsSpend() {
        return [
            {
                name: 'Meridian Residence',
                exec: 'DB',
                contractType: 'Fixed',
                phase: 'Construction',
                base: 1_200_000,
                co: 85_000,
                reimb: 42_000,
                baseUsed: 890_000,
                coUsed: 62_000,
                reimbUsed: 38_000,
                timePct: 72,
            },
            {
                name: 'Civic Center Renovation',
                exec: 'DBB',
                contractType: 'T&M',
                phase: 'Design',
                base: 3_100_000,
                co: 210_000,
                reimb: 95_000,
                baseUsed: 2_950_000,
                coUsed: 195_000,
                reimbUsed: 88_000,
                timePct: 85,
            },
            {
                name: 'Harbor Office Build',
                exec: 'D',
                contractType: 'Cost+',
                phase: 'Preconstruction',
                base: 520_000,
                co: 0,
                reimb: 15_000,
                baseUsed: 180_000,
                coUsed: 0,
                reimbUsed: 5_000,
                timePct: 30,
            },
        ];
    }
    getRevenueByMonth() {
        return [
            { month: '2026-01', collected: 320_000, outstanding: 45_000 },
            { month: '2026-02', collected: 410_000, outstanding: 62_000 },
            { month: '2026-03', collected: 380_000, outstanding: 28_000 },
            { month: '2026-04', collected: 295_000, outstanding: 91_000 },
            { month: '2026-05', collected: 450_000, outstanding: 33_000 },
            { month: '2026-06', collected: 370_000, outstanding: 53_450 },
        ];
    }
    getLeadFunnel() {
        return [
            { stage: 'Inquiry', count: 24, conversionPct: 100 },
            { stage: 'Qualified', count: 18, conversionPct: 75 },
            { stage: 'Proposal', count: 12, conversionPct: 50 },
            { stage: 'Negotiation', count: 7, conversionPct: 29 },
            { stage: 'Won', count: 3, conversionPct: 13 },
        ];
    }
    getWorkload() {
        return [
            { name: 'Sarah Chen', tasks: 5 },
            { name: 'Marcus Rivera', tasks: 8 },
            { name: 'James Park', tasks: 12 },
            { name: 'Emily Nguyen', tasks: 4 },
            { name: 'David Kim', tasks: 9 },
        ];
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)()
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map