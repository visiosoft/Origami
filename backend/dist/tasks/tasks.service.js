"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const create_task_dto_1 = require("./dto/create-task.dto");
let TasksService = class TasksService {
    constructor() {
        this.taskCounter = 5;
        this.tasks = [
            { id: '20260715-01', description: 'Confirm structural steel delivery schedule', assignedTo: 'Marcus Rivera', originator: 'Sarah Chen', meetingType: 'OAC', meetingDate: '2026-07-15', status: 'Open', category: 'internal', project: 'Meridian Residence' },
            { id: '20260715-02', description: 'Submit revised MEP drawings', assignedTo: 'James Park', originator: 'David Kim', meetingType: 'Design', meetingDate: '2026-07-15', status: 'In Progress', category: 'subcontractor', project: 'Harbor Office Build' },
            { id: '20260718-01', description: 'Review change order #4 pricing', assignedTo: 'Sarah Chen', originator: 'Emily Nguyen', meetingType: 'OAC', meetingDate: '2026-07-18', status: 'Open', category: 'owner', project: 'Civic Center Renovation' },
            { id: '20260720-01', description: 'Schedule final inspection with city', assignedTo: 'Marcus Rivera', originator: 'Sarah Chen', meetingType: 'Internal', meetingDate: '2026-07-20', status: 'Closed', category: 'internal', project: 'Hillcrest ADU' },
            { id: '20260722-01', description: 'Provide updated insurance certificate', assignedTo: 'James Park', originator: 'Marcus Rivera', meetingType: 'Safety', meetingDate: '2026-07-22', status: 'Open', category: 'subcontractor', project: 'Lakeview Custom Home' },
        ];
    }
    findAll(tab, project) {
        let result = this.tasks;
        if (tab)
            result = result.filter((t) => t.category === tab);
        if (project)
            result = result.filter((t) => t.project === project);
        return result;
    }
    findOne(id) {
        const task = this.tasks.find((t) => t.id === id);
        if (!task)
            throw new common_1.NotFoundException(`Task ${id} not found`);
        return task;
    }
    create(dto) {
        this.taskCounter++;
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const task = {
            id: `${dateStr}-${String(this.taskCounter).padStart(2, '0')}`,
            status: dto.status || create_task_dto_1.TaskStatus.Open,
            meetingDate: dto.meetingDate || now.toISOString().slice(0, 10),
            ...dto,
        };
        this.tasks.push(task);
        return task;
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)()
], TasksService);
//# sourceMappingURL=tasks.service.js.map