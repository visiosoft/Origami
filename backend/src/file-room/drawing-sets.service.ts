import { randomUUID } from 'crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { AuditEventEntity, ChangeOrderEntity, FileRoomFileEntity, FileRoomShareEntity, MarkupLayerEntity, PdfMarkupEntity, ProjectTaskEntity, RfiEntity, TaskEntity } from '../database/entities';
import { DataSource } from 'typeorm';
import type { SessionClaims } from '../auth/crypto.util';
import { SettingsService } from '../settings/settings.service';
import { clean as plain } from '../documents/program-pdf';
import { FileRoomService } from './file-room.service';
import { MarkupsService } from './markups.service';
import { leadsMarkups } from './markups';
import { backfillPlan, canUploadBase, drawingHistory, drawingTab, drawingLogOf, isBaseArea, logEvent, nextMinor, nextUploadRev, revLabel } from './drawing-sets';
import { layerKey } from './markups';

const KEY_UPLOADERS = 'fileRoom.baseUploaders';

/** "Not city-approved" printed across the top of every page of a published copy. */
export async function stampNotApproved(pdf: Uint8Array, note: string | null): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const text = plain(`NOT CITY-APPROVED - FOR EARLY WORK ONLY${note ? ` - ${note}` : ''}`).slice(0, 140);
  for (const p of doc.getPages()) {
    const { width, height } = p.getSize();
    const size = Math.max(7, Math.min(14, (width - 40) / Math.max(1, bold.widthOfTextAtSize(text, 1))));
    p.drawRectangle({ x: 0, y: height - size - 14, width, height: size + 14, color: rgb(0.98, 0.9, 0.62), opacity: 0.92 });
    p.drawText(text, { x: 20, y: height - size - 7, size, font: bold, color: rgb(0.48, 0.29, 0) });
  }
  return doc.save();
}

/**
 * Nov 20 drawing sets: who puts base drawings in, revision numbers, publishing
 * the team's markups as the next revision, the approved set, the city-approval
 * flag, and each drawing's history.
 */
@Injectable()
export class DrawingSetsService {
  constructor(
    @InjectRepository(FileRoomFileEntity) private readonly files: Repository<FileRoomFileEntity>,
    @InjectRepository(PdfMarkupEntity) private readonly marks: Repository<PdfMarkupEntity>,
    private readonly fileRoom: FileRoomService,
    private readonly markups: MarkupsService,
    private readonly settings: SettingsService,
    @Optional() @InjectRepository(FileRoomShareEntity) private readonly shares?: Repository<FileRoomShareEntity>,
    @Optional() @InjectRepository(MarkupLayerEntity) private readonly layerRepo?: Repository<MarkupLayerEntity>,
    @Optional() private readonly data?: DataSource,
  ) {}

  // ---------------------------------------------------------------- who uploads base drawings
  async uploaders(): Promise<string[]> {
    try { const v = JSON.parse((await this.settings.get(KEY_UPLOADERS)) || '[]'); return Array.isArray(v) ? v.map(String).slice(0, 200) : []; } catch { return []; }
  }
  async setUploaders(ids: unknown, claims: SessionClaims | null) {
    if (!leadsMarkups(claims?.roleKey)) throw new ForbiddenException('Only an admin or principal chooses who uploads base drawings.');
    const list = [...new Set((Array.isArray(ids) ? ids : []).map((x) => String(x).trim()).filter(Boolean))].slice(0, 200);
    await this.settings.set(KEY_UPLOADERS, JSON.stringify(list));
    return list;
  }
  async isBase(projectId: number, folderPath: string[]) {
    return isBaseArea(folderPath, await this.fileRoom.buildSetOf(projectId));
  }
  /** Base drawings (the build set, "Base sets") are put in only by those allowed. */
  async assertBaseUpload(claims: SessionClaims | null, projectId: number, folderPath: string[]) {
    if (!(await this.isBase(projectId, folderPath))) return;
    if (!canUploadBase(claims, await this.uploaders())) throw new ForbiddenException('Only the people who keep the drawing sets can upload base drawings here (an admin or principal can add you). Upload markups and other files elsewhere.');
  }

  private async group(f: FileRoomFileEntity) {
    return f.groupId ? await this.files.find({ where: { groupId: f.groupId } }) : [f];
  }

  /** After an upload into a drawing set: number each file as the architect's next revision. */
  async stampUploads(saved: FileRoomFileEntity[], actor: { name: string }) {
    const out: FileRoomFileEntity[] = [];
    for (const f of saved) {
      if (!(await this.isBase(Number(f.projectId), f.folderPath || []))) { out.push(f); continue; }
      const others = (await this.group(f)).filter((x) => x.id !== f.id);
      const rev = nextUploadRev(others);
      const prev = others.find((x) => x.notCityApproved);
      Object.assign(f, rev, {
        notCityApproved: prev ? true : f.notCityApproved ?? null, cityNote: prev?.cityNote ?? f.cityNote ?? null,
        drawingLog: logEvent(f.drawingLog, { at: new Date().toISOString(), by: actor.name, kind: 'upload', text: `${revLabel(rev.revMajor, 0)} put in` }),
      });
      out.push(await this.files.save(f));
    }
    return out;
  }

  // ---------------------------------------------------------------- publish, approve, flag
  private lead(claims: SessionClaims | null, what: string) {
    if (!leadsMarkups(claims?.roleKey)) throw new ForbiddenException(`Only an admin or principal (i-1, i-2) can ${what}.`);
  }

  /** The team's reviewed markups (chosen layers) drawn into the drawing, saved as its next revision after the decimal. */
  async publish(fileId: string, layers: string[], claims: SessionClaims | null) {
    this.lead(claims, 'publish markups into the base drawing');
    const f = await this.markups.file(fileId);
    if (!/\.pdf$/i.test(f.name)) throw new BadRequestException('Only PDF drawings are published as revisions.');
    if (!layers?.length) throw new BadRequestException('Pick the layers to publish.');
    const group = await this.group(f);
    const major = f.revMajor ?? Math.max(0, ...group.map((x) => x.revMajor || 0));
    let minor: number;
    try { minor = nextMinor(group, major); } catch (e) { throw new BadRequestException((e as Error).message); }
    const { pdf, count } = await this.markups.flatten(fileId, claims, undefined, layers);
    if (!count) throw new BadRequestException('Those layers have no markups.');
    const out = f.notCityApproved ? await stampNotApproved(pdf, f.cityNote) : pdf;
    const actor = { name: claims!.name || 'Someone', id: claims!.sub };
    const [saved] = await this.fileRoom.upload(Number(f.projectId), f.folderPath || [], [{ originalname: f.name, mimetype: 'application/pdf', size: out.length, buffer: Buffer.from(out) }], actor as any);
    const row = await this.files.findOneBy({ id: (saved as any).id });
    if (!row) throw new NotFoundException('The new revision wasn’t saved.');
    const at = new Date().toISOString();
    const label = revLabel(major, minor);
    // Nov 22 (Edward p6): which markups went in -- "Markup1 - C-10 Electrical – Move power by Losi, approved 22 Aug 2026".
    const rules = (await this.layerRepo?.find({ where: { fileId } }).catch(() => [])) || [];
    const fileMarks = await this.marks.find({ where: { fileId } });
    const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Los_Angeles' }) : '');
    const items = layers.map((k, i) => {
      const m = fileMarks.find((x) => layerKey(x) === k);
      const r = rules.find((x) => x.layerKey === k);
      const name = m?.layer || (m?.authorName ? `${m.authorName}’s layer` : k.replace(/^[LA]:/, ''));
      const approved = r?.state === 'approved' || r?.state === 'modified' ? `, ${r.state === 'modified' ? 'modified and approved' : 'approved'} ${fmt(r.stateAt)}${r.stateBy ? ` by ${r.stateBy}` : ''}` : '';
      return `Markup ${i + 1} – ${name}${m?.authorName && !name.includes(m.authorName) ? ` (by ${m.authorName})` : ''}${approved}`;
    });
    Object.assign(row, {
      revMajor: major, revMinor: minor, sheetNames: f.sheetNames, notCityApproved: f.notCityApproved ?? null, cityNote: f.cityNote ?? null,
      drawingDate: f.drawingDate ?? null,
      drawingLog: logEvent(null, { at, by: actor.name, kind: 'publish', items, text: `${label} published from ${revLabel(f.revMajor, f.revMinor) || 'the drawing'} — layers ${layers.map((k) => { const n = k.replace(/^[LA]:/, ''); return /^[ix]\d+$/i.test(n) ? n.toUpperCase() : n; }).join(', ')}` }),
    });
    await this.files.save(row);
    f.drawingLog = logEvent(f.drawingLog, { at, by: actor.name, kind: 'publish', text: `layers published as ${label}` });
    await this.files.save(f);
    return { id: row.id, rev: label, markups: count };
  }

  /** The approved working set: one revision per document. */
  async approve(fileId: string, on: boolean, claims: SessionClaims | null) {
    this.lead(claims, 'approve a drawing set');
    const f = await this.markups.file(fileId);
    const at = new Date().toISOString();
    for (const x of await this.group(f)) {
      const was = !!x.approvedAt;
      const now = on && x.id === f.id;
      if (was === now) continue;
      x.approvedAt = now ? at : null;
      x.approvedBy = now ? claims!.name : null;
      x.drawingLog = logEvent(x.drawingLog, { at, by: claims!.name, kind: 'approve', text: now ? 'approved as the working set' : 'no longer the approved set' });
      await this.files.save(x);
    }
    return this.state(fileId);
  }

  /** The controller checks the caller manages the File Room (or is i-1 / i-2). */
  async setCity(fileId: string, body: { notCityApproved?: boolean; cityNote?: string | null }, claims: SessionClaims | null) {
    const f = await this.markups.file(fileId);
    const on = !!body?.notCityApproved;
    const note = on ? String(body?.cityNote ?? '').trim().slice(0, 300) || null : null;
    const at = new Date().toISOString();
    for (const x of await this.group(f)) {
      x.notCityApproved = on || null;
      x.cityNote = note;
      if (x.id === f.id) x.drawingLog = logEvent(x.drawingLog, { at, by: claims!.name, kind: 'city', text: on ? `marked not city-approved${note ? ` — ${note}` : ''}` : 'city approval flag cleared' });
      await this.files.save(x);
    }
    return this.state(fileId);
  }

  /** Where a drawing stands: its revision, the approved one, the flag, and the layers not yet published. */
  async state(fileId: string) {
    const f = await this.markups.file(fileId);
    const group = await this.group(f);
    const approved = group.find((x) => x.approvedAt) || null;
    return {
      fileId, rev: revLabel(f.revMajor, f.revMinor) || null, revMajor: f.revMajor ?? null, revMinor: f.revMinor ?? null,
      base: await this.isBase(Number(f.projectId), f.folderPath || []),
      approved: approved ? { id: approved.id, rev: revLabel(approved.revMajor, approved.revMinor) || approved.name, at: approved.approvedAt, by: approved.approvedBy } : null,
      isApproved: !!f.approvedAt,
      notCityApproved: !!f.notCityApproved, cityNote: f.cityNote || null,
      drawingDate: f.drawingDate || null,
      pendingSets: await Promise.all((f.pendingSetIds || []).map(async (pid) => { const p = await this.files.findOneBy({ id: pid }); return p ? { id: p.id, name: p.name, cityNote: p.cityNote || null } : null; })).then((x) => x.filter(Boolean)),
      revisions: group.sort((a, b) => (b.revMajor ?? 0) - (a.revMajor ?? 0) || (b.revMinor ?? 0) - (a.revMinor ?? 0) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
        .map((x) => ({ id: x.id, rev: revLabel(x.revMajor, x.revMinor) || null, isLatest: !!x.isLatest, approved: !!x.approvedAt, uploadedBy: x.uploadedBy, at: x.updatedAt })),
    };
  }

  /**
   * Nov 22 (Edward p8): a set that isn't city-approved yet (e.g. the structural
   * set, for early bids or work) linked to the base drawing -- not part of it.
   * Linking marks it "Not city-approved" so it opens with the warning.
   */
  async setPendingSets(fileId: string, ids: unknown, claims: SessionClaims | null) {
    this.lead(claims, 'link a pending city-approval set');
    const f = await this.markups.file(fileId);
    const list = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter((x) => x && x !== fileId))].slice(0, 20);
    const at = new Date().toISOString();
    for (const id of list) {
      const p = await this.files.findOneBy({ id });
      if (!p || Number(p.projectId) !== Number(f.projectId)) throw new BadRequestException('Link a file from the same project.');
      if (!p.notCityApproved) {
        p.notCityApproved = true;
        p.cityNote = p.cityNote || 'Pending city approval';
        p.drawingLog = logEvent(p.drawingLog, { at, by: claims!.name, kind: 'city', text: `linked to ${f.name} as a pending city-approval set` });
        await this.files.save(p);
      }
    }
    const added = list.filter((x) => !(f.pendingSetIds || []).includes(x));
    f.pendingSetIds = list.length ? list : null;
    if (added.length) f.drawingLog = logEvent(f.drawingLog, { at, by: claims!.name, kind: 'pending', text: `pending city-approval set linked (${added.length})` });
    await this.files.save(f);
    return this.state(fileId);
  }

  /** Nov 22: the architect's drawing date on the sheets (i-1 / i-2). */
  async setDrawingDate(fileId: string, date: string | null, claims: SessionClaims | null) {
    this.lead(claims, 'set the drawing date');
    const f = await this.markups.file(fileId);
    const d = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
    f.drawingDate = d;
    f.drawingLog = logEvent(f.drawingLog, { at: new Date().toISOString(), by: claims!.name, kind: 'date', text: d ? `drawing date set to ${d}` : 'drawing date cleared' });
    await this.files.save(f);
    return this.state(fileId);
  }

  /**
   * Nov 22 (Edward p6-7): the drawing log -- per revision, newest first: when
   * it was published and by whom, its drawing date, the markups that went in,
   * what happened on it, and the audit trail of the special actions raised
   * from its markups (RFIs, tasks, change orders, FOR RECORD) as they stand.
   */
  async log(fileId: string) {
    const f = await this.markups.file(fileId);
    const group = await this.group(f);
    const ids = group.map((x) => x.id);
    const marks = (await this.marks.find()).filter((m) => ids.includes(m.fileId) && m.linkType && m.linkId);
    const audit: { fileId: string; at: string; text: string }[] = [];
    const seen = new Set<string>();
    const repo = <T,>(e: new () => T) => (this.data ? this.data.getRepository(e as any) : null) as Repository<any> | null;
    for (const m of marks) {
      const k = `${m.fileId}|${m.linkType}|${m.linkId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      try {
        if (m.linkType === 'rfi') {
          const r = await repo(RfiEntity)?.findOneBy({ id: m.linkId });
          if (r) audit.push({ fileId: m.fileId, at: r.updatedAt || r.createdAt || m.createdAt, text: `${r.number || 'RFI'} ${r.subject ? `“${r.subject}” ` : ''}· ${r.status}` });
        } else if (m.linkType === 'co') {
          const c = await repo(ChangeOrderEntity)?.findOneBy({ id: m.linkId });
          if (c) audit.push({ fileId: m.fileId, at: c.updatedAt || c.createdAt || m.createdAt, text: `Change order ${c.number || ''} ${c.title ? `“${c.title}” ` : ''}· ${c.status}` });
        } else {
          const t = (await repo(TaskEntity)?.findOneBy({ id: m.linkId })) || (await repo(ProjectTaskEntity)?.findOneBy({ id: m.linkId }));
          if (t) audit.push({ fileId: m.fileId, at: t.closedAt || t.updatedAt || t.createdAt || m.createdAt, text: `${t.topicType && t.topicType !== 'Task' ? `FOR RECORD ${t.topicType}` : 'Task'} ${t.serial || ''} “${t.subject || t.title || ''}” · ${t.completed ? 'Complete' : t.status || 'open'}` });
        }
      } catch { /* a record that's gone stays out */ }
    }
    return drawingLogOf({ revisions: group, audit });
  }

  async history(fileId: string) {
    const f = await this.markups.file(fileId);
    const group = await this.group(f);
    const ids = group.map((x) => x.id);
    const marks = await this.marks.find({ where: { fileId: In(ids) } });
    const shares = this.shares ? (await this.shares.find({ where: { projectId: f.projectId } })).flatMap((s) => (s.files || []).filter((x) => ids.includes(x.id)).map((x) => ({ fileId: x.id, at: s.sentAt, by: s.sentByName, to: s.to }))) : [];
    const audit = this.data?.getRepository(AuditEventEntity);
    const opens = audit ? (await audit.find({ where: { entityType: 'drawing', action: 'opened', entityId: In(ids) } }).catch(() => [])).map((e) => ({ fileId: String(e.entityId), at: e.at, by: e.userName })) : [];
    return drawingHistory({ revisions: group, markups: marks.map((m) => ({ fileId: m.fileId, layer: m.layer, authorName: m.authorName, createdAt: m.createdAt, linkType: m.linkType, linkId: m.linkId })), shares, opens });
  }

  /**
   * Nov 27 (Weekly Sync): who opened a drawing from the Approved or the Not
   * city-approved tab -- once per person, drawing and day -- so the audit
   * trail shows the field worked from the right set.
   */
  async opened(fileId: string, claims: SessionClaims | null) {
    const audit = this.data?.getRepository(AuditEventEntity);
    if (!audit || !claims?.sub) return { logged: false };
    const f = await this.markups.file(fileId);
    const pending = new Set((await this.files.find({ where: { projectId: f.projectId } as any })).flatMap((x) => (Array.isArray(x.pendingSetIds) ? x.pendingSetIds : []).map(String)));
    const tab = drawingTab(f, { buildSet: await this.fileRoom.buildSetOf(Number(f.projectId)), pendingIds: pending });
    if (tab !== 'approved' && tab !== 'city') return { logged: false, tab };
    const day = new Date().toISOString().slice(0, 10);
    const seen = (await audit.find({ where: { entityType: 'drawing', action: 'opened', entityId: f.id, userId: claims.sub } })).some((e) => String(e.at).startsWith(day));
    if (seen) return { logged: false, tab };
    await audit.insert({ id: randomUUID(), at: new Date().toISOString(), userId: claims.sub, userName: claims.name || null, entityType: 'drawing', entityId: f.id, label: f.name.slice(0, 200), action: 'opened', projectId: Number(f.projectId) || null, method: 'POST', path: `/file-room/files/${f.id}/opened`, changes: null } as any);
    return { logged: true, tab };
  }

  // ---------------------------------------------------------------- numbering drawings already in sets (preview, then Apply)
  async backfill(projectId: number | null, apply: boolean, claims: SessionClaims | null) {
    if (claims?.roleKey !== 'admin') throw new ForbiddenException('Only an admin numbers existing drawings.');
    const all = (await this.files.find()).filter((f) => (projectId ? Number(f.projectId) === projectId : true) && /\.pdf$/i.test(f.name));
    const sets = new Map<number, string[]>();
    const base: FileRoomFileEntity[] = [];
    for (const f of all) {
      const pid = Number(f.projectId);
      if (!sets.has(pid)) sets.set(pid, await this.fileRoom.buildSetOf(pid));
      if (isBaseArea(f.folderPath, sets.get(pid)!)) base.push(f);
    }
    const plan = backfillPlan(base);
    if (!apply) return { count: plan.length, rows: plan.slice(0, 300) };
    for (const p of plan) await this.files.update({ id: p.id }, { revMajor: p.revMajor, revMinor: p.revMinor });
    // (Numbers from the earlier Rev 1 start move one lower here too.)
    return { count: plan.length, applied: true };
  }
}
