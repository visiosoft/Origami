import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeetingEntity, TaskEntity } from '../database/entities';
import { TasksService } from '../tasks/tasks.service';
import type { MeetingActionDto, MeetingDto } from './dto';

type Actor = { name: string; id?: string };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Meetings, and the actions raised in them. An action is an ordinary Request Log
 * entry (task, FYI or observation) created through TasksService -- so the
 * assignee is emailed as usual -- carrying the meeting's id, type, date and project.
 */
@Injectable()
export class MeetingsService {
  constructor(
    @InjectRepository(MeetingEntity) private readonly repo: Repository<MeetingEntity>,
    @InjectRepository(TaskEntity) private readonly tasksRepo: Repository<TaskEntity>,
    private readonly tasks: TasksService,
  ) {}

  list() {
    return this.repo.find({ order: { date: 'DESC', time: 'DESC' } });
  }

  async get(id: string) {
    const m = await this.repo.findOneBy({ id });
    if (!m) throw new NotFoundException('Meeting not found');
    return m;
  }

  async create(dto: MeetingDto, actor: Actor) {
    if (!String(dto.title || '').trim()) throw new BadRequestException('Give the meeting a title.');
    if (!ISO.test(dto.date || '')) throw new BadRequestException('Pick the meeting date.');
    const now = new Date().toISOString();
    const id = 'MTG-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
    return this.repo.save(this.repo.create({
      type: 'Internal', status: 'scheduled', attendees: [], rfiIds: [], ...dto, title: dto.title!.trim(),
      id, createdBy: actor.name, createdAt: now, updatedAt: now,
    } as Partial<MeetingEntity>));
  }

  async update(id: string, dto: MeetingDto) {
    const m = await this.get(id);
    if (dto.title !== undefined && !dto.title.trim()) throw new BadRequestException('The meeting needs a title.');
    if (dto.date !== undefined && !ISO.test(dto.date)) throw new BadRequestException('Pick the meeting date.');
    Object.assign(m, dto, { updatedAt: new Date().toISOString() });
    return this.repo.save(m);
  }

  /** Deleting a meeting keeps the actions raised in it -- they just stop pointing at it. */
  async remove(id: string) {
    const m = await this.get(id);
    await this.tasksRepo.update({ meetingId: id }, { meetingId: null as any });
    await this.repo.remove(m);
    return { ok: true };
  }

  async addAction(id: string, dto: MeetingActionDto, actor: Actor) {
    const m = await this.get(id);
    return this.tasks.create({
      topicType: dto.topicType, subject: dto.subject.trim(), description: dto.description || '',
      assignedTo: dto.assignedTo, assignedToId: dto.assignedToId, dueDate: dto.dueDate || undefined,
      project: m.project || '', meetingType: m.type || 'Internal', meetingDate: m.date, meetingId: m.id, tab: 'internal',
    }, actor as any);
  }
}
