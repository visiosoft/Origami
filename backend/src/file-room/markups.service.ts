import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { FileRoomFileEntity, PdfMarkupEntity } from '../database/entities';
import type { SessionClaims } from '../auth/crypto.util';
import { FileRoomService } from './file-room.service';
import { canEditMarkup, cleanMarkup, flattenPdf, visibleTo, type MarkupData } from './markups';

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
      id: 'MK-' + randomUUID(), fileId, page: clean.page, kind: clean.kind, data: clean.data as any, private: clean.private,
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

  /** The PDF with the chosen people's markups drawn in (all visible ones by default). */
  async flatten(fileId: string, claims: SessionClaims | null, authors?: string[]) {
    const marks = (await this.list(fileId, claims)).filter((m) => !authors?.length || authors.includes(m.authorId || ''));
    const { file, body } = await this.fileRoom.content(fileId);
    const buf = Buffer.from(await new Response(body as any).arrayBuffer());
    const pdf = await flattenPdf(buf, marks.map((m) => ({ page: m.page, kind: m.kind, data: m.data as unknown as MarkupData })));
    return { file, pdf: Buffer.from(pdf), count: marks.length };
  }

  /** Keep a marked-up copy next to the drawing ("<name> — markup <date>.pdf"); the drawing stays Current. */
  async saveCopy(fileId: string, claims: SessionClaims | null, authors?: string[]) {
    this.assertCanDraw(claims);
    const { file, pdf, count } = await this.flatten(fileId, claims, authors);
    if (!count) throw new BadRequestException('There are no markups to save.');
    const base = file.name.replace(/\.pdf$/i, '');
    const name = `${base} — markup ${new Date().toISOString().slice(0, 10)}.pdf`;
    const [saved] = await this.fileRoom.upload(Number(file.projectId), file.folderPath || [], [{ originalname: name, mimetype: 'application/pdf', size: pdf.length, buffer: pdf }], { name: claims!.name, id: claims!.sub });
    return saved;
  }
}
