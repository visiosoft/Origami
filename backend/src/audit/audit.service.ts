import { pageArgs } from '../common/paging';
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

  /**
   * One page of the log, newest first, with the total and the record types to
   * filter by. Unfiltered (dates and project only), each page reads just enough
   * rows from each table and the total is counted. With a type, person or
   * search, those are applied before paging (up to the newest SCAN_CAP rows of
   * each table), so older matches aren't missed.
   */
  async page(q: Record<string, string>) {
    const { page, size } = pageArgs(q.page, q.size);
    const from = /^\d{4}-\d{2}-\d{2}/.test(q.from || '') ? q.from!.slice(0, 10) : '0000';
    const to = /^\d{4}-\d{2}-\d{2}/.test(q.to || '') ? q.to!.slice(0, 10) + 'T99' : '9999';
    const projectId = Number(q.projectId) || null;
    const where = { at: Between(from, to), ...(projectId ? { projectId } : {}) };
    const filtered = !!((q.type || '').trim() || (q.user || '').trim() || (q.q || '').trim());
    const take = filtered ? AuditService.SCAN_CAP : page * size;
    const [app, fin, projects, appTotal, finTotal, types] = await Promise.all([
      this.events.find({ where, order: { at: 'DESC' }, take }),
      this.finance.find({ where, order: { at: 'DESC' }, take }),
      this.projects.find({ select: { id: true, name: true } }),
      filtered ? Promise.resolve(0) : this.events.count({ where }),
      filtered ? Promise.resolve(0) : this.finance.count({ where }),
      this.types(),
    ]);
    const rows = this.merge(app, fin, new Map(projects.map((p) => [p.id, p.name])), q);
    const total = filtered ? rows.length : appTotal + finTotal;
    const pages = Math.max(1, Math.ceil(total / size));
    const p = Math.min(page, pages);
    return {
      rows: rows.slice((p - 1) * size, p * size), total, page: p, size, pages, types,
      capped: filtered && (app.length >= AuditService.SCAN_CAP || fin.length >= AuditService.SCAN_CAP),
    };
  }
  static readonly SCAN_CAP = 20_000;

  /** Every record type in the log, for the filter. */
  private async types(): Promise<string[]> {
    const [a, f] = await Promise.all([
      this.events.createQueryBuilder('e').select('DISTINCT e.entityType', 't').getRawMany().catch(() => []),
      this.finance.createQueryBuilder('f').select('DISTINCT f.entityType', 't').getRawMany().catch(() => []),
    ]);
    return [...new Set([...a.map((r: any) => String(r.t || '')), ...f.map((r: any) => `Finance · ${r.t || ''}`)].filter((t) => t && t !== 'Finance · '))].sort();
  }

  /** Both logs as one list, newest first, with the type / person / search filters. */
  private merge(app: AuditEventEntity[], fin: any[], names: Map<number, string>, q: Record<string, string>): AuditRow[] {
    const rows: AuditRow[] = [
      ...app.map((r) => ({ ...r, changes: r.changes || [], source: 'app' as const })),
      ...fin.map((r) => ({
        id: 'fin-' + r.id, at: r.at, userId: r.byId || null, userName: r.byName || null, entityType: `Finance · ${r.entityType}`, entityId: r.entityId, label: r.reason ? `Reason: ${r.reason}`.slice(0, 200) : null,
        action: r.action, projectId: r.projectId, source: 'finance' as const,
        changes: Object.entries(r.changes || {}).map(([field, c]: [string, any]) => ({ field, from: show(c?.from), to: show(c?.to) })),
      })),
    ] as AuditRow[];
    const needle = (q.q || '').trim().toLowerCase();
    const type = (q.type || '').trim().toLowerCase();
    const user = (q.user || '').trim().toLowerCase();
    return rows
      .map((r) => ({ ...r, projectName: r.projectId ? names.get(r.projectId) || `Project ${r.projectId}` : null }))
      .filter((r) => !type || r.entityType.toLowerCase().startsWith(type))
      .filter((r) => !user || (r.userName || '').toLowerCase().includes(user) || r.userId === q.user)
      .filter((r) => !needle || [r.label, r.entityId, r.entityType, r.action, r.userName, r.projectName, ...r.changes.map((c) => `${c.field} ${c.from} ${c.to}`)].join(' ').toLowerCase().includes(needle))
      .sort((a, b) => b.at.localeCompare(a.at));
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
