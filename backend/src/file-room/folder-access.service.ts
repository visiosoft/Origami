import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SessionClaims } from '../auth/crypto.util';
import { ProjectAccessService } from '../auth/project-access.service';
import { FileRoomFolderAccessEntity, PersonEntity } from '../database/entities';
import { newId } from '../manpower/workforce.util';
import { folderOpen, type FolderRule, type Viewer } from './folder-access';

const AUDIENCES = ['everyone', 'internal', 'picked'];

/** Restricted folders (Nov 13): the rules, and the check every File Room read goes through. */
@Injectable()
export class FolderAccessService {
  constructor(
    @InjectRepository(FileRoomFolderAccessEntity) private readonly rules: Repository<FileRoomFolderAccessEntity>,
    @InjectRepository(PersonEntity) private readonly people: Repository<PersonEntity>,
    private readonly access: ProjectAccessService,
  ) {}

  private cache: { at: number; rows: FolderRule[] } | null = null;
  private async all(): Promise<FolderRule[]> {
    if (this.cache && Date.now() - this.cache.at < 10_000) return this.cache.rows;
    const rows = (await this.rules.find()).map((r) => ({ projectId: r.projectId, path: r.path || [], audience: r.audience, people: r.people }));
    this.cache = { at: Date.now(), rows };
    return rows;
  }

  /** Administrators and File Room managers see every folder. */
  async isManager(claims: SessionClaims | null) {
    if (!claims) return false;
    if (claims.roleKey === 'admin') return true;
    const perms = await this.access.permissions(claims);
    return !!(perms?.planroom?.manage || perms?.allfiles?.manage);
  }

  async viewer(claims: SessionClaims | null): Promise<Viewer> {
    if (!claims) return { sub: '', roleKey: '', staff: false, companies: [], manager: false };
    const email = String(claims.email || '').trim().toLowerCase();
    const mine = (await this.people.find({ select: { id: true, userId: true, email: true, company: true } as any }))
      .filter((p) => (p.userId && p.userId === claims.sub) || (!!email && String(p.email || '').trim().toLowerCase() === email));
    return { sub: claims.sub, roleKey: claims.roleKey, staff: this.access.isStaff(claims), companies: mine.map((p) => String(p.company || '').trim().toLowerCase()).filter(Boolean), manager: await this.isManager(claims) };
  }

  /** (projectId, folder path) -> may this caller open it? Built once per request. */
  async gate(claims: SessionClaims | null): Promise<(projectId: unknown, path?: string[] | null) => boolean> {
    const rules = await this.all();
    if (!rules.length) return () => true;
    const v = await this.viewer(claims);
    return (projectId, path) => folderOpen(rules, v, Number(projectId), path);
  }

  /** One file: "not found" if its folder is kept from this caller. */
  async assertFile(claims: SessionClaims | null, file: { projectId: number; folderPath?: string[] | null }) {
    if (!(await this.gate(claims))(file.projectId, file.folderPath)) throw new ForbiddenException('This file is in a folder you don’t have access to.');
  }

  /** Every restricted folder of a project (for the 🔒 in the tree). Names only for managers. */
  async list(projectId: number, claims: SessionClaims | null) {
    const rows = await this.rules.find({ where: { projectId } });
    const manager = await this.isManager(claims);
    return rows.map((r) => ({ path: r.path, pathKey: r.pathKey, audience: r.audience, people: manager ? r.people : null, updatedBy: manager ? r.updatedBy : null }));
  }

  /** Set who may open a folder: everyone (removes the rule), staff only, or picked people / roles / companies. */
  async set(projectId: number, dto: { path?: unknown; audience?: string; people?: unknown }, actor: { name: string }) {
    const path = Array.isArray(dto?.path) ? dto.path.map((x) => String(x).trim()).filter(Boolean) : [];
    if (!path.length) throw new BadRequestException('Pick a folder.');
    const audience = String(dto?.audience || '');
    if (!AUDIENCES.includes(audience)) throw new BadRequestException('Everyone, Internal only, or picked people.');
    const pathKey = path.join('>');
    const existing = await this.rules.findOne({ where: { projectId, pathKey } });
    this.cache = null;
    if (audience === 'everyone') { if (existing) await this.rules.remove(existing); return { projectId, path, audience }; }
    const people = audience === 'picked'
      ? (Array.isArray(dto.people) ? dto.people : []).map((p: any) => ({ type: ['user', 'role', 'company'].includes(p?.type) ? p.type : 'user', id: String(p?.id || '').trim().slice(0, 200), name: String(p?.name || p?.id || '').trim().slice(0, 200) })).filter((p: any) => p.id).slice(0, 200)
      : null;
    if (audience === 'picked' && !people!.length) throw new BadRequestException('Pick who may open it.');
    const row = existing || this.rules.create({ id: newId('FRA'), projectId, pathKey, path });
    Object.assign(row, { path, audience, people, updatedAt: new Date().toISOString(), updatedBy: actor.name });
    await this.rules.save(row);
    return { projectId, path, audience, people };
  }
}
