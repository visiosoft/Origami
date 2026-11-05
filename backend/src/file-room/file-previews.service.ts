import { Injectable, Logger, NotFoundException, Optional, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { FileRoomFileEntity } from '../database/entities';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
import { isPhotoMime, isStagingHost, makeVariants, MAX_TRIES, retryAfterMs } from './previews';

export const PREVIEWS_FOLDER = 'Origami previews';
/** "on" fills in existing files; "off" stops it. Unset: on for staging, off elsewhere (Odin waits for an admin). */
export const BACKFILL_KEY = 'filePreviews.backfill';
const TICK_MS = 15_000;
const BATCH = 6;
/** Bigger originals aren't pulled into memory; Drive's render is used instead. */
const MAX_PHOTO_BYTES = 40 * 1024 * 1024;
const CACHE_BYTES = 48 * 1024 * 1024;

/**
 * Makes and serves File Room thumbnails and previews (Nov 5). New uploads and
 * files found by Drive sync are marked pending; a background tick makes their
 * two small copies, retrying documents while Drive is still rendering them.
 * Files from before this existed are filled in on their own on staging, and on
 * Odin once an admin switches it on.
 */
@Injectable()
export class FilePreviewsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('FilePreviews');
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  /** Recently served thumbnails, so a busy grid doesn't go to Drive every time. */
  private cache = new Map<string, Buffer>();
  private cacheSize = 0;

  constructor(
    @InjectRepository(FileRoomFileEntity) private readonly files: Repository<FileRoomFileEntity>,
    private readonly google: GoogleService,
    @Optional() private readonly settings?: SettingsService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.DB_ENABLED === 'false' || process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => { void this.tick(); }, TICK_MS);
    this.timer.unref?.();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async backfillOn(): Promise<boolean> {
    const v = await this.settings?.get(BACKFILL_KEY).catch(() => null);
    return v === 'on' || (v !== 'off' && isStagingHost());
  }

  /** One round: due pending files first, then (if allowed) files from before thumbnails existed. */
  async tick(now = Date.now()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      if (!(await this.google.isConnected().catch(() => false))) return 0;
      const pending = (await this.files.find({ where: { previewState: In(['pending']) }, take: 200 }))
        .filter((f) => !f.previewAt || Date.parse(f.previewAt) + retryAfterMs(f.previewTries || 0) <= now)
        .slice(0, BATCH);
      let todo = pending;
      if (todo.length < BATCH && (await this.backfillOn())) {
        todo = todo.concat(await this.files.find({ where: { previewState: IsNull() }, take: BATCH - todo.length }));
      }
      for (const f of todo) await this.make(f);
      return todo.length;
    } catch (err) {
      this.log.warn(`Preview round failed: ${(err as Error).message}`);
      return 0;
    } finally {
      this.running = false;
    }
  }

  /** Make one file's thumbnail and preview, or record why not and when to try again. */
  async make(f: FileRoomFileEntity): Promise<void> {
    if (!f.driveId) { await this.files.update({ id: f.id }, { previewState: 'none', previewAt: new Date().toISOString() }); return; }
    const tries = (f.previewTries || 0) + 1;
    try {
      let source: Buffer | null = null;
      let kind: 'photo' | 'page' = 'page';
      if (isPhotoMime(f.mimeType) && Number(f.size || 0) <= MAX_PHOTO_BYTES) {
        source = await this.google.driveFileBuffer(f.driveId);
        kind = 'photo';
      }
      let made = source ? await makeVariants(source, kind).catch(() => null) : null;
      if (!made) {
        // PDFs, Office files, HEIC and anything sharp can't read: Drive's render of page 1.
        const render = await this.google.driveThumbnail(f.driveId, 1600);
        if (!render) {
          const giveUp = tries >= MAX_TRIES;
          await this.files.update({ id: f.id }, { previewState: giveUp ? 'none' : 'pending', previewTries: tries, previewAt: new Date().toISOString() });
          return;
        }
        made = await makeVariants(render, /^image\//i.test(f.mimeType || '') ? 'photo' : 'page');
      }
      const folder = await this.google.ensureFolder(PREVIEWS_FOLDER);
      const [thumb, preview] = await Promise.all([
        this.google.uploadDriveFile({ name: `${f.id}.thumb.webp`, mimeType: 'image/webp', buffer: made.thumb, parentId: folder }),
        this.google.uploadDriveFile({ name: `${f.id}.preview.webp`, mimeType: 'image/webp', buffer: made.preview, parentId: folder }),
      ]);
      const old = [f.thumbDriveId, f.previewDriveId].filter(Boolean) as string[];
      await this.files.update({ id: f.id }, { thumbDriveId: thumb.id, previewDriveId: preview.id, previewState: 'ready', previewTries: tries, previewAt: new Date().toISOString() });
      for (const id of old) await this.google.trashDriveFile(id).catch(() => undefined);
    } catch (err) {
      this.log.warn(`No preview for ${f.name}: ${(err as Error).message}`);
      await this.files.update({ id: f.id }, { previewState: tries >= MAX_TRIES ? 'failed' : 'pending', previewTries: tries, previewAt: new Date().toISOString() });
    }
  }

  /** The bytes of a ready thumbnail or preview (thumbnails are kept in memory once read). */
  async variant(f: FileRoomFileEntity, which: 'thumb' | 'preview'): Promise<Buffer> {
    const id = which === 'thumb' ? f.thumbDriveId : f.previewDriveId;
    if (f.previewState !== 'ready' || !id) throw new NotFoundException('No small copy yet.');
    const hit = this.cache.get(id);
    if (hit) { this.cache.delete(id); this.cache.set(id, hit); return hit; }
    const buf = await this.google.driveFileBuffer(id);
    if (which === 'thumb') {
      this.cache.set(id, buf);
      this.cacheSize += buf.length;
      for (const [k, v] of this.cache) { if (this.cacheSize <= CACHE_BYTES) break; this.cache.delete(k); this.cacheSize -= v.length; }
    }
    return buf;
  }

  /** When a file goes, its small copies go too. */
  async forget(f: Pick<FileRoomFileEntity, 'thumbDriveId' | 'previewDriveId'>) {
    for (const id of [f.thumbDriveId, f.previewDriveId]) if (id) { this.cache.delete(id); await this.google.trashDriveFile(id).catch(() => undefined); }
  }

  /** For Settings: how far along the fill-in is. */
  async status() {
    const all = await this.files.find({ select: { id: true, previewState: true } });
    const count = (s: string | null) => all.filter((f) => (f.previewState ?? null) === s).length;
    return { total: all.length, ready: count('ready'), pending: count('pending'), notStarted: count(null), none: count('none'), failed: count('failed'), backfill: await this.backfillOn() };
  }
}
