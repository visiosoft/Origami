import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTaskDto, TaskStatus } from './dto/create-task.dto';

export interface Task {
  id: string;
  description: string;
  assignedTo: string;
  originator: string;
  meetingType?: string;
  meetingDate: string;
  status: string;
  category: string;
  project: string;
  topicType?: string;
}

@Injectable()
export class TasksService {
  private taskCounter = 5;
  private tasks: Task[] = [
    { id: '20260715-01', description: 'Confirm structural steel delivery schedule', assignedTo: 'Marcus Rivera', originator: 'Sarah Chen', meetingType: 'OAC', meetingDate: '2026-07-15', status: 'Open', category: 'internal', project: 'Meridian Residence' },
    { id: '20260715-02', description: 'Submit revised MEP drawings', assignedTo: 'James Park', originator: 'David Kim', meetingType: 'Design', meetingDate: '2026-07-15', status: 'In Progress', category: 'subcontractor', project: 'Harbor Office Build' },
    { id: '20260718-01', description: 'Review change order #4 pricing', assignedTo: 'Sarah Chen', originator: 'Emily Nguyen', meetingType: 'OAC', meetingDate: '2026-07-18', status: 'Open', category: 'owner', project: 'Civic Center Renovation' },
    { id: '20260720-01', description: 'Schedule final inspection with city', assignedTo: 'Marcus Rivera', originator: 'Sarah Chen', meetingType: 'Internal', meetingDate: '2026-07-20', status: 'Closed', category: 'internal', project: 'Hillcrest ADU' },
    { id: '20260722-01', description: 'Provide updated insurance certificate', assignedTo: 'James Park', originator: 'Marcus Rivera', meetingType: 'Safety', meetingDate: '2026-07-22', status: 'Open', category: 'subcontractor', project: 'Lakeview Custom Home' },
  ];

  findAll(tab?: string, project?: string): Task[] {
    let result = this.tasks;
    if (tab) result = result.filter((t) => t.category === tab);
    if (project) result = result.filter((t) => t.project === project);
    return result;
  }

  findOne(id: string): Task {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  create(dto: CreateTaskDto): Task {
    this.taskCounter++;
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const task: Task = {
      id: `${dateStr}-${String(this.taskCounter).padStart(2, '0')}`,
      status: dto.status || TaskStatus.Open,
      meetingDate: dto.meetingDate || now.toISOString().slice(0, 10),
      ...dto,
    };
    this.tasks.push(task);
    return task;
  }
}
