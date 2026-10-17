import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileRoomFileEntity, ProgressPhotoEntity } from '../database/entities';
import type { UploadActor } from '../google/attachments.service';
import { FileRoomService } from './file-room.service';
import { CONSTRUCTION_CATEGORIES, DESIGN_CATEGORIES, cleanPhotoMeta, isImage, photoFolder, type PhotoTrack } from './progress-photos';

type Incoming = { originalname: string; mimetype: string; size: number; buffer: Buffer };

/**
 * Progress Photos (Construction -> Progress Photos): the project's photos,
 * stored in its File Room, with what each shows. Photos already in the File
 * Room (daily reports, uploads) without details are "unsorted" until given a
 * category.
 */
@Injectable()
export class ProgressPhotosService {
  constructor(
    @InjectRepository(ProgressPhotoEntity) private readonly repo: Repository<ProgressPhotoEntity>,
    @InjectRepository(FileRoomFileEntity) private readonly files: Repository<FileRoomFileEntity>,
    private readonly fileRoom: FileRoomService,
  ) {}

  categories() {
    return { construction: CONSTRUCTION_CATEGORIES, design: DESIGN_CATEGORIES };
  }

  private view(meta: ProgressPhotoEntity, file?: FileRoomFileEntity) {
    return {
      ...meta, tags: meta.tags || [],
      name: file?.name || '', mimeType: file?.mimeType || '', uploadedBy: file?.uploadedBy || meta.createdBy || '', folderPath: file?.folderPath || [],
    };
  }

  /** A project's photos (newest first) and, for staff, its File Room images not yet sorted. */
  async list(projectId: number, staff: boolean) {
    const [metas, files] = await Promise.all([this.repo.findBy({ projectId }), this.files.find()]);
    const fileById = new Map(files.filter((f) => Number(f.projectId) === projectId).map((f) => [f.id, f]));
    const photos = metas
      .filter((m) => fileById.has(m.id) && (staff || m.clientVisible))
      .map((m) => this.view(m, fileById.get(m.id)))
      .sort((a, b) => b.takenOn.localeCompare(a.takenOn) || String(b.createdAt).localeCompare(String(a.createdAt)));
    const sorted = new Set(metas.map((m) => m.id));
    const unsorted = staff
      ? [...fileById.values()].filter((f) => isImage(f) && !sorted.has(f.id) && f.isLatest !== false)
        .map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, uploadedBy: f.uploadedBy, updatedAt: f.updatedAt, folderPath: f.folderPath || [] }))
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      : [];
    return { photos, unsorted };
  }

  /** Upload photos into the category's folder, each with its own date taken (from the camera when known). */
  async upload(projectId: number, incoming: Incoming[], metaDto: any, dates: string[], actor: UploadActor) {
    if (!incoming?.length) throw new BadRequestException('Add at least one photo.');
    for (const f of incoming) if (!isImage({ mimeType: f.mimetype, name: f.originalname })) throw new BadRequestException(`${f.originalname} is not a photo.`);
    const meta = cleanPhotoMeta(metaDto);
    const saved = await this.fileRoom.upload(projectId, photoFolder(meta.track as PhotoTrack, meta.category!), incoming, actor);
    const now = new Date().toISOString();
    const rows: ProgressPhotoEntity[] = [];
    for (const [i, f] of saved.entries()) {
      const takenOn = /^\d{4}-\d{2}-\d{2}$/.test(dates[i] || '') ? dates[i] : meta.takenOn!;
      rows.push(await this.repo.save(this.repo.create({
        id: f.id, projectId, track: meta.track, category: meta.category, area: meta.area || '', caption: meta.caption || '', tags: meta.tags || [],
        clientVisible: !!meta.clientVisible, takenOn, createdBy: actor.name, createdAt: now, updatedAt: now,
      } as Partial<ProgressPhotoEntity>)));
    }
    return rows.length;
  }

  /** Give File Room images (unsorted) their details; each moves into its category's folder. */
  async classify(fileIds: string[], metaDto: any, actor: UploadActor) {
    const meta = cleanPhotoMeta(metaDto);
    const now = new Date().toISOString();
    let n = 0;
    for (const id of fileIds || []) {
      const file = await this.files.findOneBy({ id: String(id) });
      if (!file || !isImage(file)) continue;
      await this.fileRoom.move(file.id, photoFolder(meta.track as PhotoTrack, meta.category!));
      const existing = await this.repo.findOneBy({ id: file.id });
      // A sorted photo keeps the date it was taken unless one is given; a new one takes its upload date.
      const takenOn = metaDto?.takenOn ? meta.takenOn : existing?.takenOn || String(file.updatedAt || now).slice(0, 10);
      await this.repo.save(this.repo.create({
        ...(existing || {}), id: file.id, projectId: Number(file.projectId), track: meta.track, category: meta.category, area: meta.area ?? existing?.area ?? '',
        caption: meta.caption ?? existing?.caption ?? '', tags: meta.tags ?? existing?.tags ?? [], clientVisible: meta.clientVisible ?? existing?.clientVisible ?? false,
        takenOn, createdBy: existing?.createdBy || actor.name, createdAt: existing?.createdAt || now, updatedAt: now,
      } as Partial<ProgressPhotoEntity>));
      n++;
    }
    return { sorted: n };
  }

  /** Edit a photo's details; a new track or category moves the file to that folder. */
  async update(id: string, dto: any) {
    const row = await this.repo.findOneBy({ id });
    if (!row) throw new NotFoundException('Photo not found.');
    const patch = cleanPhotoMeta(dto, true);
    const next = { ...row, ...patch, updatedAt: new Date().toISOString() } as ProgressPhotoEntity;
    if (next.track !== row.track || next.category !== row.category) await this.fileRoom.move(id, photoFolder(next.track as PhotoTrack, next.category));
    const saved = await this.repo.save(next);
    return this.view(saved, (await this.files.findOneBy({ id })) || undefined);
  }

  /** Delete the photo (and its file). */
  async remove(id: string) {
    await this.fileRoom.remove(id);
    await this.repo.delete({ id });
    return { id, deleted: true };
  }

  async projectOf(id: string) {
    const row = await this.repo.findOneBy({ id });
    if (row) return row.projectId;
    const f = await this.files.findOneBy({ id });
    return f ? Number(f.projectId) : null;
  }
}
