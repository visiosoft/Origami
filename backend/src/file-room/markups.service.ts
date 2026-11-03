import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { FileRoomFileEntity, MarkupLayerEntity, MarkupSymbolEntity, PdfMarkupEntity, PersonEntity } from '../database/entities';
import type { SessionClaims } from '../auth/crypto.util';
import { FileRoomService } from './file-room.service';
import { MAX_PIN_PHOTOS, canEditMarkup, cleanSheetNames, cleanSymbolImage, cleanSymbolName, isMarkable, isPhotoName, leadsMarkups, photoToPdf, cleanLayer, cleanMarkup, cleanPhotos, flattenPdf, layerKey, cleanLayerRule, visibleWithLayers, type LayerAudience, type LayerRule, type LayerViewer, type MarkupData } from './markups';

/** Where photos pinned to a drawing are kept in the project's File Room. */
export const PIN_PHOTO_FOLDER = ['Markup photos'];

/** Markups on File Room PDFs: a layer per person over the drawing, which never changes. */
@Injectable()
export class MarkupsService {
  constructor(
    @InjectRepository(PdfMarkupEntity) private readonly repo: Repository<PdfMarkupEntity>,
    @InjectRepository(FileRoomFileEntity) private readonly files: Repository<FileRoomFileEntity>,
    private readonly fileRoom: FileRoomService,
    @Optional() private readonly settings?: SettingsService,
    @Optional() @InjectRepository(MarkupSymbolEntity) private readonly symbolRepo?: Repository<MarkupSymbolEntity>,
    @Optional() @InjectRepository(MarkupLayerEntity) private readonly layerRepo?: Repository<MarkupLayerEntity>,
    @Optional() @InjectRepository(PersonEntity) private readonly people?: Repository<PersonEntity>,
  ) {}

  // ---------------------------------------------------------------- layer access (Oct 30 sync)
  private async rulesFor(fileId: string): Promise<LayerRule[]> {
    const rows = (await this.layerRepo?.find({ where: { fileId } })) || [];
    return rows.map((r) => ({ layerKey: r.layerKey, audience: r.audience as LayerAudience, people: r.people }));
  }
  private async viewer(claims: SessionClaims | null): Promise<LayerViewer> {
    const internal = !!claims && (claims.roleKey === 'admin' || claims.tier === 'internal');
    let company: string | null = null;
    if (claims && !internal && this.people) {
      const email = String(claims.email || '').trim().toLowerCase();
      const p = (await this.people.find()).find((x) => (x.userId && x.userId === claims.sub) || (!!email && String(x.email || '').trim().toLowerCase() === email));
      company = p?.company || null;
    }
    return { userId: claims?.sub, roleKey: claims?.roleKey, internal, company };
  }
  /** The markups this person may see on a drawing: private drafts and layer access applied. */
  private async visible<T extends PdfMarkupEntity>(fileId: string, rows: T[], claims: SessionClaims | null): Promise<T[]> {
    return visibleWithLayers(rows, await this.rulesFor(fileId), await this.viewer(claims));
  }

  /** Each layer's audience on a drawing (only the ones that aren't Everyone). */
  async layerAccess(fileId: string) {
    return (await this.rulesFor(fileId)).filter((r) => r.audience !== 'everyone');
  }

  /**
   * Choose who sees a layer: Everyone, Internal only, or picked people and
   * companies. Its authors, admins and principals may change it.
   */
  async setLayerAccess(fileId: string, key: string, raw: unknown, claims: SessionClaims | null) {
    this.assertCanDraw(claims);
    if (!this.layerRepo) throw new BadRequestException('Layer access isn’t available.');
    const rows = (await this.list(fileId, claims)).filter((m) => layerKey(m) === key);
    if (!rows.length) throw new NotFoundException('That layer has no markups.');
    if (!leadsMarkups(claims!.roleKey) && !rows.some((m) => m.authorId === claims!.sub)) throw new ForbiddenException('Only someone with markups on this layer (or an admin or principal) can change who sees it.');
    let rule;
    try { rule = cleanLayerRule(raw); } catch (e) { throw new BadRequestException((e as Error).message); }
    const id = `${fileId}|${key}`;
    if (rule.audience === 'everyone') { await this.layerRepo.delete({ id }); return { layerKey: key, audience: 'everyone', people: [] }; }
    await this.layerRepo.save(this.layerRepo.create({ id, fileId, layerKey: key, audience: rule.audience, people: rule.people, updatedBy: claims!.name, updatedAt: new Date().toISOString() }));
    return { layerKey: key, ...rule };
  }

  // ---------------------------------------------------------------- symbols (Oct 31)
  /** The shared symbol library, in order. */
  async symbols() {
    const rows = (await this.symbolRepo?.find()) || [];
    return rows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)).map(({ id, name, image }) => ({ id, name, image }));
  }
  /** Admins keep the library: add, rename, delete. */
  private assertSymbolAdmin(claims: SessionClaims | null) {
    if (claims?.roleKey !== 'admin') throw new ForbiddenException('Only admins add or change symbols.');
  }
  async addSymbol(body: any, claims: SessionClaims | null) {
    this.assertSymbolAdmin(claims);
    let name: string, image: string;
    try { name = cleanSymbolName(body?.name); image = cleanSymbolImage(body?.image); } catch (e) { throw new BadRequestException((e as Error).message); }
    const n = (await this.symbolRepo!.find()).length;
    const row = await this.symbolRepo!.save(this.symbolRepo!.create({ id: 'SYM-' + randomUUID(), name, image, sortOrder: n, createdBy: claims!.name, createdAt: new Date().toISOString() }));
    return { id: row.id, name: row.name, image: row.image };
  }
  async renameSymbol(id: string, body: any, claims: SessionClaims | null) {
    this.assertSymbolAdmin(claims);
    const row = await this.symbolRepo!.findOneBy({ id });
    if (!row) throw new NotFoundException('Symbol not found');
    try { row.name = cleanSymbolName(body?.name); } catch (e) { throw new BadRequestException((e as Error).message); }
    await this.symbolRepo!.save(row);
    return { id: row.id, name: row.name, image: row.image };
  }
  /** Deleting a symbol leaves the ones already placed as a labelled box. */
  async removeSymbol(id: string, claims: SessionClaims | null) {
    this.assertSymbolAdmin(claims);
    await this.symbolRepo!.delete({ id });
    return { id, deleted: true };
  }

  /** A link may only point at a file in the drawing's own project. */
  private async assertLinkTarget(drawing: { projectId?: unknown }, data: MarkupData) {
    if (data.target?.type !== 'file') return;
    const f = await this.files.findOneBy({ id: data.target.fileId });
    if (!f || String(f.projectId ?? '') !== String(drawing.projectId ?? '')) throw new BadRequestException('Link to a file in this project.');
  }

  async file(fileId: string) {
    const f = await this.files.findOneBy({ id: fileId });
    if (!f) throw new NotFoundException('File not found');
    return f;
  }

  async markup(id: string) {
    const m = await this.repo.findOneBy({ id });
    if (!m) throw new NotFoundException('Markup not found');
    return m;
  }

  /** Clients look; staff and consultants mark up. */
  private assertCanDraw(claims: SessionClaims | null) {
    if (!claims) throw new ForbiddenException('Sign in first.');
    if (claims.tier === 'client') throw new ForbiddenException('Markups are added by the team and consultants.');
  }

  async list(fileId: string, claims: SessionClaims | null) {
    const rows = await this.repo.find({ where: { fileId } });
    return (await this.visible(fileId, rows, claims)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async create(fileId: string, raw: unknown, claims: SessionClaims | null) {
    this.assertCanDraw(claims);
    const f = await this.file(fileId);
    if (!isMarkable(f)) throw new BadRequestException('Only PDFs and photos (JPG, PNG) can be marked up.');
    let clean;
    try { clean = cleanMarkup(raw); } catch (e) { throw new BadRequestException((e as Error).message); }
    await this.assertLinkTarget(f, clean.data);
    const now = new Date().toISOString();
    // One scale per page: the newest replaces any earlier one.
    if (clean.kind === 'scale') {
      for (const old of (await this.repo.find({ where: { fileId, page: clean.page, kind: 'scale' } }))) await this.repo.delete({ id: old.id });
    }
    return this.repo.save(this.repo.create({
      id: 'MK-' + randomUUID(), fileId, page: clean.page, kind: clean.kind, data: clean.data as any, private: clean.private, layer: clean.layer,
      authorId: claims!.sub, authorName: claims!.name || 'Someone', linkType: null, linkId: null, createdAt: now, updatedAt: now,
    }));
  }

  private async own(id: string, claims: SessionClaims | null) {
    const m = await this.repo.findOneBy({ id });
    if (!m) throw new NotFoundException('Markup not found');
    if (!canEditMarkup(m, { id: claims?.sub, isAdmin: leadsMarkups(claims?.roleKey) })) throw new ForbiddenException('Only whoever drew it (or an admin or principal) can change it.');
    return m;
  }

  /** Move or reshape it, change its text, colour or privacy, or link it to the RFI / task made from it. */
  async update(id: string, raw: any, claims: SessionClaims | null) {
    const m = await this.repo.findOneBy({ id });
    if (!m) throw new NotFoundException('Markup not found');
    // Anyone who can see it may link it to the RFI or task they made from it.
    const linkOnly = raw && Object.keys(raw).every((k) => k === 'linkType' || k === 'linkId');
    if (!linkOnly) await this.own(id, claims);
    else this.assertCanDraw(claims);
    if (raw?.data !== undefined || raw?.private !== undefined) {
      let clean;
      try { clean = cleanMarkup({ kind: m.kind, page: m.page, data: raw?.data ?? m.data, private: raw?.private ?? m.private }); } catch (e) { throw new BadRequestException((e as Error).message); }
      await this.assertLinkTarget(await this.file(m.fileId), clean.data);
      m.data = clean.data as any;
      m.private = clean.private;
    }
    if (raw?.layer !== undefined) m.layer = cleanLayer(raw.layer);
    // What the markup was turned into: an RFI, a task, a change order or a FOR RECORD item.
    if (raw?.linkType !== undefined) m.linkType = ['rfi', 'task', 'co', 'record'].includes(String(raw.linkType)) ? raw.linkType : null;
    if (raw?.linkId !== undefined) m.linkId = raw.linkId ? String(raw.linkId).slice(0, 80) : null;
    m.updatedAt = new Date().toISOString();
    return this.repo.save(m);
  }

  async remove(id: string, claims: SessionClaims | null) {
    await this.own(id, claims);
    await this.repo.delete({ id });
    return { id, deleted: true };
  }

  /**
   * Rename a layer for everyone (Oct 27 sync). A named layer is just a label,
   * so anyone on the team may rename it; turning someone's own unnamed layer
   * into a named one is theirs (or an admin's) to do.
   */
  async renameLayer(fileId: string, raw: { from?: string | null; authorId?: string | null; to?: string }, claims: SessionClaims | null) {
    this.assertCanDraw(claims);
    const to = cleanLayer(raw?.to);
    if (!to) throw new BadRequestException('Give the layer a name.');
    const from = cleanLayer(raw?.from);
    const key = from ? layerKey({ layer: from }) : layerKey({ authorId: raw?.authorId || claims!.sub });
    if (!from && (raw?.authorId || claims!.sub) !== claims!.sub && !leadsMarkups(claims!.roleKey)) throw new ForbiddenException('Only its owner (or an admin or principal) can name someone’s own layer.');
    const rows = (await this.list(fileId, claims)).filter((m) => layerKey(m) === key);
    if (!rows.length) throw new NotFoundException('That layer has no markups.');
    const now = new Date().toISOString();
    for (const m of rows) { m.layer = to; m.updatedAt = now; await this.repo.save(m); }
    // Who sees it goes with the layer.
    const rule = await this.layerRepo?.findOneBy({ id: `${fileId}|${key}` });
    if (rule && this.layerRepo) {
      const nk = layerKey({ layer: to });
      await this.layerRepo.delete({ id: rule.id });
      await this.layerRepo.save({ ...rule, id: `${fileId}|${nk}`, layerKey: nk });
    }
    return { layer: to, updated: rows.length };
  }

  /** Photos taken on site, pinned to a spot on the drawing; kept in the project's "Markup photos" folder. */
  async addPhotos(mid: string, incoming: Array<{ originalname: string; mimetype: string; size: number; buffer: Buffer }>, claims: SessionClaims | null) {
    this.assertCanDraw(claims);
    const m = await this.repo.findOneBy({ id: mid });
    if (!m) throw new NotFoundException('Markup not found');
    if (!(await this.visible(m.fileId, [m], claims)).length) throw new NotFoundException('Markup not found');
    if (m.kind !== 'pin') throw new BadRequestException('Photos go on a pin.');
    const images = (incoming || []).filter((f) => /^image\//i.test(f.mimetype || ''));
    if (!images.length) throw new BadRequestException('Pick a photo.');
    const data = m.data as unknown as MarkupData;
    const have = data.photos?.length || 0;
    if (have + images.length > MAX_PIN_PHOTOS) throw new BadRequestException(`A pin holds up to ${MAX_PIN_PHOTOS} photos.`);
    const f = await this.file(m.fileId);
    if (!f.projectId) throw new BadRequestException('Photos can only be pinned to drawings in a project.');
    const saved = await this.fileRoom.upload(Number(f.projectId), PIN_PHOTO_FOLDER, images, { name: claims!.name, id: claims!.sub } as any);
    m.data = { ...data, photos: cleanPhotos([...(data.photos || []), ...saved.map((s: any) => ({ fileId: s.id, name: s.name }))]) } as any;
    m.updatedAt = new Date().toISOString();
    return this.repo.save(m);
  }

  /** Take a photo off a pin (the file stays in the File Room). */
  async removePhoto(mid: string, fileId: string, claims: SessionClaims | null) {
    this.assertCanDraw(claims);
    const m = await this.repo.findOneBy({ id: mid });
    if (!m) throw new NotFoundException('Markup not found');
    if (!(await this.visible(m.fileId, [m], claims)).length) throw new NotFoundException('Markup not found');
    const data = m.data as unknown as MarkupData;
    m.data = { ...data, photos: (data.photos || []).filter((p) => p.fileId !== fileId) } as any;
    m.updatedAt = new Date().toISOString();
    return this.repo.save(m);
  }

  /** Which markups a download keeps: chosen layers (by key) or people (all visible ones by default). */
  private pick<T extends { authorId?: string | null; layer?: string | null; authorName?: string | null }>(rows: T[], authors?: string[], layers?: string[]) {
    if (layers?.length) return rows.filter((m) => layers.includes(layerKey(m)));
    return rows.filter((m) => !authors?.length || authors.includes(m.authorId || ''));
  }

  /** The PDF with the chosen layers drawn in (all visible ones by default). */
  async flatten(fileId: string, claims: SessionClaims | null, authors?: string[], layers?: string[]) {
    const marks = this.pick(await this.list(fileId, claims), authors, layers);
    const { file, body } = await this.fileRoom.content(fileId);
    let buf: Uint8Array = Buffer.from(await new Response(body as any).arrayBuffer());
    // A photo becomes a one-page PDF first, so its markups draw in the same way.
    if (isPhotoName(file)) {
      try { buf = await photoToPdf(buf, file.name); } catch (e) { throw new BadRequestException((e as Error).message); }
    }
    const base = (await this.settings?.baseUrl().catch(() => '')) || '';
    const pdf = await flattenPdf(buf, marks.map((m) => ({ page: m.page, kind: m.kind, data: m.data as unknown as MarkupData })), {
      fileUrl: base ? (id) => `${base}/planroom?file=${encodeURIComponent(id)}` : undefined,
      sheetNames: (await this.file(fileId)).sheetNames,
      symbols: Object.fromEntries((await this.symbols()).map((s) => [s.id, s])),
    });
    return { file, pdf: Buffer.from(pdf), count: marks.length };
  }

  /** A drawing's sheet names by page (Oct 31): read from its title blocks by the viewer, correctable by the team. */
  async sheetNames(fileId: string) {
    return cleanSheetNames((await this.file(fileId)).sheetNames);
  }

  /** Save sheet names: `names` merges page by page (an empty name clears that page); `replace` swaps the whole set. */
  async setSheetNames(fileId: string, body: { names?: unknown; replace?: boolean }, claims: SessionClaims | null) {
    this.assertCanDraw(claims);
    const f = await this.file(fileId);
    const incoming = (body?.names && typeof body.names === 'object' ? body.names : {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = body?.replace ? { ...incoming } : { ...(f.sheetNames || {}), ...incoming };
    const names = cleanSheetNames(merged);
    await this.files.update({ id: fileId }, { sheetNames: names });
    return names;
  }

  /** Keep a marked-up copy next to the drawing ("<name> — markup <date>.pdf"); the drawing stays Current. */
  async saveCopy(fileId: string, claims: SessionClaims | null, authors?: string[], layers?: string[]) {
    this.assertCanDraw(claims);
    const { file, pdf, count } = await this.flatten(fileId, claims, authors, layers);
    if (!count) throw new BadRequestException('There are no markups to save.');
    const base = file.name.replace(/\.(pdf|jpe?g|png|webp|gif)$/i, '');
    const name = `${base} — markup ${new Date().toISOString().slice(0, 10)}.pdf`;
    const [saved] = await this.fileRoom.upload(Number(file.projectId), file.folderPath || [], [{ originalname: name, mimetype: 'application/pdf', size: pdf.length, buffer: pdf }], { name: claims!.name, id: claims!.sub });
    return saved;
  }
}
