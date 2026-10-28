import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { FileRoomFileEntity, PdfMarkupEntity } from '../database/entities';
import type { SessionClaims } from '../auth/crypto.util';
import { FileRoomService } from './file-room.service';
import { MAX_PIN_PHOTOS, canEditMarkup, cleanLayer, cleanMarkup, cleanPhotos, flattenPdf, layerKey, visibleTo, type MarkupData } from './markups';

/** Where photos pinned to a drawing are kept in the project's File Room. */
export const PIN_PHOTO_FOLDER = ['Markup photos'];

/** Markups on File Room PDFs: a layer per person over the drawing, which never changes. */
@Injectable()
export class MarkupsService {
  constructor(
    @InjectRepository(PdfMarkupEntity) private readonly repo: Repository<PdfMarkupEntity>,
    @InjectRepository(FileRoomFileEntity) private readonly files: Repository<FileRoomFileEntity>,
    private readonly fileRoom: FileRoomService,
  ) {}

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
    return visibleTo(rows, claims?.sub).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async create(fileId: string, raw: unknown, claims: SessionClaims | null) {
    this.assertCanDraw(claims);
    const f = await this.file(fileId);
    if (!/\.pdf$/i.test(f.name) && f.mimeType !== 'application/pdf') throw new BadRequestException('Only PDFs can be marked up.');
    let clean;
    try { clean = cleanMarkup(raw); } catch (e) { throw new BadRequestException((e as Error).message); }
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
    if (!canEditMarkup(m, { id: claims?.sub, isAdmin: claims?.roleKey === 'admin' })) throw new ForbiddenException('Only whoever drew it (or an admin) can change it.');
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
      m.data = clean.data as any;
      m.private = clean.private;
    }
    if (raw?.layer !== undefined) m.layer = cleanLayer(raw.layer);
    if (raw?.linkType !== undefined) m.linkType = raw.linkType === 'rfi' || raw.linkType === 'task' ? raw.linkType : null;
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
    if (!from && (raw?.authorId || claims!.sub) !== claims!.sub && claims!.roleKey !== 'admin') throw new ForbiddenException('Only its owner (or an admin) can name someone’s own layer.');
    const rows = (await this.list(fileId, claims)).filter((m) => layerKey(m) === key);
    if (!rows.length) throw new NotFoundException('That layer has no markups.');
    const now = new Date().toISOString();
    for (const m of rows) { m.layer = to; m.updatedAt = now; await this.repo.save(m); }
    return { layer: to, updated: rows.length };
  }

  /** Photos taken on site, pinned to a spot on the drawing; kept in the project's "Markup photos" folder. */
  async addPhotos(mid: string, incoming: Array<{ originalname: string; mimetype: string; size: number; buffer: Buffer }>, claims: SessionClaims | null) {
    this.assertCanDraw(claims);
    const m = await this.repo.findOneBy({ id: mid });
    if (!m) throw new NotFoundException('Markup not found');
    if (!visibleTo([m], claims!.sub).length) throw new NotFoundException('Markup not found');
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
    if (!visibleTo([m], claims!.sub).length) throw new NotFoundException('Markup not found');
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
    const buf = Buffer.from(await new Response(body as any).arrayBuffer());
    const pdf = await flattenPdf(buf, marks.map((m) => ({ page: m.page, kind: m.kind, data: m.data as unknown as MarkupData })));
    return { file, pdf: Buffer.from(pdf), count: marks.length };
  }

  /** Keep a marked-up copy next to the drawing ("<name> — markup <date>.pdf"); the drawing stays Current. */
  async saveCopy(fileId: string, claims: SessionClaims | null, authors?: string[], layers?: string[]) {
    this.assertCanDraw(claims);
    const { file, pdf, count } = await this.flatten(fileId, claims, authors, layers);
    if (!count) throw new BadRequestException('There are no markups to save.');
    const base = file.name.replace(/\.pdf$/i, '');
    const name = `${base} — markup ${new Date().toISOString().slice(0, 10)}.pdf`;
    const [saved] = await this.fileRoom.upload(Number(file.projectId), file.folderPath || [], [{ originalname: name, mimetype: 'application/pdf', size: pdf.length, buffer: pdf }], { name: claims!.name, id: claims!.sub });
    return saved;
  }
}
