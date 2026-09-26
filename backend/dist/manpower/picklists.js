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
exports.PicklistsController = exports.PicklistsService = exports.DEFAULT_PICKLISTS = exports.PICKLISTS_KEY = void 0;
exports.parsePicklists = parsePicklists;
const common_1 = require("@nestjs/common");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const settings_service_1 = require("../settings/settings.service");
const manpower_access_service_1 = require("./manpower-access.service");
exports.PICKLISTS_KEY = 'manpower.picklists';
exports.DEFAULT_PICKLISTS = {
    departments: ['Administration', 'Accounting', 'Design', 'Estimating', 'Project Management', 'Construction / Field', 'Safety', 'Warehouse & Logistics'],
    designations: [
        'Principal', 'Project Manager', 'Assistant Project Manager', 'Project Coordinator', 'Site Superintendent', 'Foreman', 'Lead Carpenter',
        'Carpenter', 'Carpenter Apprentice', 'Electrician', 'Plumber', 'HVAC Technician', 'Laborer', 'Equipment Operator', 'Estimator',
        'Designer', 'Drafter', 'Office Manager', 'Bookkeeper',
    ],
    skills: [
        'Framing', 'Finish carpentry', 'Cabinet installation', 'Concrete forming', 'Concrete finishing', 'Rebar', 'Masonry', 'Drywall hanging',
        'Drywall taping', 'Painting', 'Tile setting', 'Flooring', 'Roofing', 'Siding', 'Stucco', 'Insulation', 'Waterproofing', 'Windows & doors',
        'Glazing', 'Electrical rough-in', 'Electrical finish', 'Low voltage', 'Solar', 'Plumbing rough-in', 'Plumbing finish', 'HVAC install',
        'Fire sprinklers', 'Welding (MIG/TIG/ARC)', 'Demolition', 'Excavation', 'Grading', 'Landscaping', 'Fencing', 'Scaffolding',
        'Equipment operation', 'Forklift', 'Fall protection', 'First aid / CPR', 'OSHA 10', 'OSHA 30',
    ],
};
const cleanList = (v, max = 200) => {
    const seen = new Set();
    return (Array.isArray(v) ? v : [])
        .map((x) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, 60))
        .filter((x) => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()))
        .slice(0, max);
};
function parsePicklists(raw) {
    let v = raw;
    if (typeof raw === 'string') {
        try {
            v = raw.trim() ? JSON.parse(raw) : null;
        }
        catch {
            v = null;
        }
    }
    const pick = (k) => { const l = cleanList(v?.[k]); return l.length ? l : exports.DEFAULT_PICKLISTS[k]; };
    return { departments: pick('departments'), designations: pick('designations'), skills: pick('skills') };
}
let PicklistsService = class PicklistsService {
    constructor(settings, access) {
        this.settings = settings;
        this.access = access;
    }
    async get() {
        return parsePicklists(await this.settings.get(exports.PICKLISTS_KEY).catch(() => null));
    }
    async save(body, bearer) {
        await this.access.require(await this.access.actor(bearer), manpower_access_service_1.HR_MODULE, 'change the Manpower picklists');
        const clean = parsePicklists(body);
        await this.settings.set(exports.PICKLISTS_KEY, JSON.stringify(clean));
        return clean;
    }
};
exports.PicklistsService = PicklistsService;
exports.PicklistsService = PicklistsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [settings_service_1.SettingsService, manpower_access_service_1.ManpowerAccess])
], PicklistsService);
let PicklistsController = class PicklistsController {
    constructor(picklists) {
        this.picklists = picklists;
    }
    get() { return this.picklists.get(); }
    save(body, a) { return this.picklists.save(body, a); }
};
exports.PicklistsController = PicklistsController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PicklistsController.prototype, "get", null);
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PicklistsController.prototype, "save", null);
exports.PicklistsController = PicklistsController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('manpower/picklists'),
    __metadata("design:paramtypes", [PicklistsService])
], PicklistsController);
//# sourceMappingURL=picklists.js.map