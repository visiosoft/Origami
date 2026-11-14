import { BadRequestException, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GoogleService } from '../google/google.service';
import { SECRET_KEYS, SettingsService } from '../settings/settings.service';
import { scrubRow, scrubSettings, toPrune, zipFiles } from './db-export';

const KEY_ON = 'backup.db.enabled';
const KEY_LAST = 'backup.db.lastRun';
const KEY_RESULT = 'backup.db.lastResult';
const DEFAULT_TZ = 'America/Los_Angeles';
/** Its own top-level Drive folder, not inside the File Room, so File Room sharing never reaches it. */
export const BACKUP_FOLDER = 'Origami System Backups';
const KEEP = 8;

/**
 * Weekly database copy (Batch 6): every Sunday at 3am (office time), each
 * table as JSON in one zip, secrets left out, uploaded to an admin-only Drive
 * folder; only the last 8 are kept. Admins can switch it off or run it now.
 */
@Injectable()
export class DbBackupService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger(DbBackupService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly data: DataSource, private readonly google: GoogleService, private readonly settings: SettingsService) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => { void this.tick(); }, 3600_000);
    this.timer.unref?.();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async status() {
    const [on, last, result] = await Promise.all([this.settings.get(KEY_ON), this.settings.get(KEY_LAST), this.settings.get(KEY_RESULT)]);
    let parsed: any = null;
    try { parsed = result ? JSON.parse(result) : null; } catch { parsed = null; }
    // On unless switched off.
    return { enabled: on !== '0', lastRun: last || null, lastResult: parsed, folder: BACKUP_FOLDER, keep: KEEP, connected: await this.google.isConnected() };
  }
  async setEnabled(on: boolean) { await this.settings.set(KEY_ON, on ? '1' : '0'); return this.status(); }

  /** Hourly: Sunday, 3am office time, once. */
  async tick() {
    try {
      if ((await this.settings.get(KEY_ON)) === '0') return;
      const tz = (await this.settings.get('reminders.timezone')) || DEFAULT_TZ;
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short', hour12: false }).formatToParts(new Date()).map((p) => [p.type, p.value]));
      if (parts.weekday !== 'Sun' || parseInt(parts.hour, 10) % 24 !== 3) return;
      const today = `${parts.year}-${parts.month}-${parts.day}`;
      if (String((await this.settings.get(KEY_LAST)) || '').slice(0, 10) === today) return;
      if (!(await this.google.isConnected())) return;
      await this.run();
    } catch (e) { this.log.warn('Database copy: ' + (e as Error).message); }
  }

  /** The zip, built from every table. */
  async build(): Promise<{ zip: Buffer; tables: { table: string; rows: number }[] }> {
    const files: { name: string; data: Buffer }[] = [];
    const tables: { table: string; rows: number }[] = [];
    const metas = [...this.data.entityMetadatas].filter((m) => m.tableType === 'regular').sort((a, b) => a.tableName.localeCompare(b.tableName));
    for (const m of metas) {
      let rows = (await this.data.getRepository(m.target).find()) as Record<string, unknown>[];
      rows = m.tableName === 'app_settings' ? scrubSettings(rows as any, SECRET_KEYS) : rows.map(scrubRow);
      files.push({ name: `${m.tableName}.json`, data: Buffer.from(JSON.stringify(rows), 'utf8') });
      tables.push({ table: m.tableName, rows: rows.length });
    }
    const manifest = { madeAt: new Date().toISOString(), tables, note: 'Passwords, sign-in secrets, tokens and secret settings are left out.' };
    files.unshift({ name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8') });
    return { zip: zipFiles(files), tables };
  }

  async run() {
    if (!(await this.google.isConnected())) throw new BadRequestException('Connect Google Workspace first (Settings → Google).');
    if (this.running) throw new BadRequestException('A database copy is already being made.');
    this.running = true;
    const at = new Date().toISOString();
    try {
      const { zip, tables } = await this.build();
      const folderId = await this.google.ensureFolder(BACKUP_FOLDER);
      const name = `origami-db-${at.slice(0, 10)}-${at.slice(11, 16).replace(':', '')}.zip`;
      const file = await this.google.uploadDriveFile({ name, mimeType: 'application/zip', buffer: zip, parentId: folderId });
      const old = toPrune(await this.google.listChildren(folderId), KEEP);
      for (const f of old) await this.google.trashDriveFile(f.id);
      const result = { at, ok: true, name, bytes: zip.length, tables: tables.length, rows: tables.reduce((a, t) => a + t.rows, 0), removed: old.length, link: file.webViewLink || null };
      await this.settings.set(KEY_LAST, at);
      await this.settings.set(KEY_RESULT, JSON.stringify(result));
      return result;
    } catch (e) {
      const result = { at, ok: false, error: (e as Error).message.slice(0, 300) };
      await this.settings.set(KEY_RESULT, JSON.stringify(result));
      throw e;
    } finally { this.running = false; }
  }
}
