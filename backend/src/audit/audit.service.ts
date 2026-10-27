import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Between, DataSource, Repository } from 'typeorm';
import {
  AuditEventEntity, DealEntity, FinanceActivityEntity, LeadEntity, PersonEntity, ProjectEntity, ProjectTaskEntity, RfiEntity, RoleEntity, TaskEntity, UserEntity,
} from '../database/entities';
import { type AuditChange, show } from './audit-route';

/** The entity behind each tracked path segment (see TRACKED in audit-route.ts). */
const ENTITY_OF: Record<string, Function> = {
  projects: ProjectEntity, people: PersonEntity, users: UserEntity, roles: RoleEntity, 'project-tasks': ProjectTaskEntity,
  tasks: TaskEntity, leads: LeadEntity, pipeline: DealEntity, rfis: RfiEntity,
};

export interface AuditRow {
  id: string; at: string; userId: string | null; userName: string | null; entityType: string; entityId: string | null;
  label: string | null; action: string; projectId: number | null; projectName?: string | null; changes: AuditChange[]; source: 'app' | 'finance';
}

@Injectable()
export class AuditService {
  private readonly log = new Logger('Audit');

  constructor(
    @InjectRepository(AuditEventEntity) private readonly events: Repository<AuditEventEntity>,
    @InjectRepository(FinanceActivityEntity) private readonly finance: Repository<FinanceActivityEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    private readonly db: DataSource,
  ) {}

  /** The current row of a tracked record, or null. */
  async load(segment: string, id: string | null): Promise<Record<string, any> | null> {
    const entity = ENTITY_OF[segment];
    if (!entity || id == null) return null;
    const key = segment === 'roles' ? 'key' : 'id';
    const value = segment === 'projects' || segment === 'people' ? Number(id) : id;
    if (typeof value === 'number' && !Number.isFinite(value)) return null;
    try {
      return (await this.db.getRepository(entity).findOne({ where: { [key]: value } as any })) as any;
    } catch {
      return null;
    }
  }

  /** Save one entry. Never throws: the log must not break the save it describes. */
  async record(e: Omit<AuditEventEntity, 'id' | 'at'> & { at?: string }) {
    try {
      await this.events.insert({ ...e, id: randomUUID(), at: e.at || new Date().toISOString() });
    } catch (err) {
      this.log.warn(`could not record ${e.method} ${e.path}: ${(err as Error).message}`);
    }
  }

  /** The log, newest first: the app's entries and Finance's, filtered. */
  async list(q: { from?: string; to?: string; type?: string; user?: string; projectId?: string; q?: string; limit?: string }): Promise<AuditRow[]> {
    const limit = Math.min(Math.max(Number(q.limit) || 500, 1), 5000);
    const from = /^\d{4}-\d{2}-\d{2}/.test(q.from || '') ? q.from!.slice(0, 10) : '0000';
    const to = /^\d{4}-\d{2}-\d{2}/.test(q.to || '') ? q.to!.slice(0, 10) + 'T99' : '9999';
    const projectId = Number(q.projectId) || null;
    const [app, fin, projects] = await Promise.all([
      this.events.find({ where: { at: Between(from, to), ...(projectId ? { projectId } : {}) }, order: { at: 'DESC' }, take: limit }),
      this.finance.find({ where: { at: Between(from, to), ...(projectId ? { projectId } : {}) }, order: { at: 'DESC' }, take: limit }),
      this.projects.find({ select: { id: true, name: true } }),
    ]);
    const names = new Map(projects.map((p) => [p.id, p.name]));
    const rows: AuditRow[] = [
      ...app.map((r) => ({ ...r, changes: r.changes || [], source: 'app' as const })),
      ...fin.map((r) => ({
        id: 'fin-' + r.id, at: r.at, userId: r.byId || null, userName: r.byName || null, entityType: `Finance · ${r.entityType}`, entityId: r.entityId, label: r.reason ? `Reason: ${r.reason}`.slice(0, 200) : null,
        action: r.action, projectId: r.projectId, source: 'finance' as const,
        changes: Object.entries(r.changes || {}).map(([field, c]) => ({ field, from: show(c?.from), to: show(c?.to) })),
      })),
    ];
    const needle = (q.q || '').trim().toLowerCase();
    const type = (q.type || '').trim().toLowerCase();
    const user = (q.user || '').trim().toLowerCase();
    return rows
      .map((r) => ({ ...r, projectName: r.projectId ? names.get(r.projectId) || `Project ${r.projectId}` : null }))
      .filter((r) => !type || r.entityType.toLowerCase().startsWith(type))
      .filter((r) => !user || (r.userName || '').toLowerCase().includes(user) || r.userId === q.user)
      .filter((r) => !needle || [r.label, r.entityId, r.entityType, r.action, r.userName, r.projectName, ...r.changes.map((c) => `${c.field} ${c.from} ${c.to}`)].join(' ').toLowerCase().includes(needle))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, limit);
  }
}
