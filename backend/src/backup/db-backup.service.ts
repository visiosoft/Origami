import { BadRequestException, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GoogleService } from '../google/google.service';
import { SECRET_KEYS, SettingsService } from '../settings/settings.service';
import { alertAdmins } from '../common/admin-alert';
import { envName, filesIndex, scrubRow, scrubSettings, toTrash, verifyZip, ZIP_LIMIT, zipFiles } from './db-export';
import { UserEntity } from '../database/entities';

const KEY_ON = 'backup.db.enabled';
const KEY_LAST = 'backup.db.lastRun';
const KEY_RESULT = 'backup.db.lastResult';
const DEFAULT_TZ = 'America/Los_Angeles';
/** Its own top-level Drive folder, not inside the File Room, so File Room sharing never reaches it. */
export const BACKUP_FOLDER = 'Origami System Backups';
const KEY_BAD = 'backup.db.badIds';
const KEY_ALERT = 'backup.db.alertRunDate';
const HOUR = 3;
/** Nov 19: 14 nightly, 8 weekly, 12 monthly -- about a year back. */
const KEEP = { daily: 14, weekly: 8, monthly: 12 };
/** No good copy for this long: tell the admins. */
const MISSED_HOURS = 36;

/**
 * Database copy to Google Drive. Batch 6 made it weekly; Nov 19 made it
 * nightly at 3am (office time): each table as JSON in one zip, secrets left
 * out, plus a list of where every uploaded file sits in Drive; uploaded to an
 * admin-only folder per environment (staging / Prod). Each copy is read back
 * and checked; 14 nightly, 8 weekly and 12 monthly are kept. Admins are
 * emailed when a copy fails or none has been made for 36 hours.
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
    const env = await this.env();
    return { enabled: on !== '0', lastRun: last || null, lastResult: parsed, folder: `${BACKUP_FOLDER} / ${env}`, env, keep: KEEP, schedule: `Every night at ${HOUR}am`, connected: await this.google.isConnected() };
  }
  async setEnabled(on: boolean) { await this.settings.set(KEY_ON, on ? '1' : '0'); return this.status(); }

  private async env() { return envName(await this.settings.get('app.baseUrl').catch(() => null)); }

  /** Hourly: 3am office time, once a night; and the "no copy for 36 hours" alert. */
  async tick(now = new Date()) {
    try {
      if ((await this.settings.get(KEY_ON)) === '0') return;
      const tz = (await this.settings.get('reminders.timezone')) || DEFAULT_TZ;
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(now).map((p) => [p.type, p.value]));
      const today = `${parts.year}-${parts.month}-${parts.day}`;
      if (!(await this.google.isConnected())) return;
      if (parseInt(parts.hour, 10) % 24 === HOUR) {
        // Claim tonight's run first, so a second server instance doesn't make another copy.
        const marker = `run:${today}`;
        if ((await this.settings.get(KEY_LAST + 'Date')) !== marker) {
          await this.settings.set(KEY_LAST + 'Date', marker);
          await this.run().catch((e) => this.alert(`The database copy failed: ${(e as Error).message}`, today));
          return;
        }
      }
      await this.checkMissed(now, today);
    } catch (e) { this.log.warn('Database copy: ' + (e as Error).message); }
  }

  /** No good copy for 36 hours: one email a day to the admins. */
  async checkMissed(now: Date, today: string) {
    let last: any = null;
    try { last = JSON.parse((await this.settings.get(KEY_RESULT)) || 'null'); } catch { last = null; }
    const goodAt = last?.ok && last?.verified !== false ? Date.parse(last.at) : Date.parse(String((await this.settings.get('backup.db.lastGoodAt')) || ''));
    if (Number.isFinite(goodAt) && now.getTime() - goodAt < MISSED_HOURS * 3600_000) return;
    if (!Number.isFinite(goodAt) && !last) return; // never run yet -- nothing has been missed
    await this.alert(`No good database copy has been saved for more than ${MISSED_HOURS} hours${last?.error ? ` (last try: ${last.error})` : ''}.`, today);
  }

  /** Email the admins, at most once a day (Nov 20: the shared helper, also used for API credit alerts). */
  async alert(message: string, today: string) {
    const sent = await alertAdmins({ data: this.data, settings: this.settings, google: this.google }, KEY_ALERT, today, 'database copy needs attention',
      [message, 'Open Settings → Google → Database copy to see the last result, or press “Make a copy now”.']);
    if (!sent) this.log.debug?.('Database copy alert not sent (already sent today, no admins, or mail failed).');
  }

  /** The zip, built from every table. */
  async build(): Promise<{ zip: Buffer; tables: { table: string; rows: number }[] }> {
    const files: { name: string; data: Buffer }[] = [];
    const tables: { table: string; rows: number }[] = [];
    const forIndex: { table: string; rows: Record<string, unknown>[] }[] = [];
    let bytes = 0;
    const metas = [...this.data.entityMetadatas].filter((m) => m.tableType === 'regular').sort((a, b) => a.tableName.localeCompare(b.tableName));
    for (const m of metas) {
      let rows = (await this.data.getRepository(m.target).find()) as Record<string, unknown>[];
      rows = m.tableName === 'app_settings' ? scrubSettings(rows as any, SECRET_KEYS) : rows.map(scrubRow);
      const data = Buffer.from(JSON.stringify(rows), 'utf8');
      bytes += data.length;
      if (bytes > ZIP_LIMIT) throw new BadRequestException('The database is too big for one copy (over 3.5 GB). Ask the developer to split the copy.');
      files.push({ name: `${m.tableName}.json`, data });
      tables.push({ table: m.tableName, rows: rows.length });
      forIndex.push({ table: m.tableName, rows });
    }
    // Where each uploaded file sits in Drive -- the files themselves stay there.
    const index = filesIndex(forIndex);
    const manifest = {
      madeAt: new Date().toISOString(), tables, files: index.length,
      note: 'Passwords, sign-in secrets, tokens and secret settings are left out. Uploaded files are not in this zip: they stay in Google Drive -- files-index.json says where each one is.',
      restore: 'Each <table>.json is that table\'s rows. To restore, a developer loads them into an empty database of the same version (TypeORM creates the tables), table by table.',
    };
    files.unshift({ name: 'files-index.json', data: Buffer.from(JSON.stringify(index), 'utf8') });
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
      const env = await this.env();
      const rootId = await this.google.ensureFolder(BACKUP_FOLDER);
      const folderId = await this.google.ensureFolder(env, rootId);
      const name = `origami-db-${env}-${at.slice(0, 10)}-${at.slice(11, 16).replace(':', '')}.zip`;
      const file = await this.google.uploadDriveFile({ name, mimeType: 'application/zip', buffer: zip, parentId: folderId });
      // Read it back from Drive and check it opens and holds every row.
      let check: { ok: boolean; problems: string[] };
      try { check = verifyZip(await this.google.driveFileBuffer(file.id), tables); } catch (e) { check = { ok: false, problems: ['Could not read it back from Drive: ' + (e as Error).message] }; }
      let bad: string[] = [];
      try { bad = JSON.parse((await this.settings.get(KEY_BAD)) || '[]'); } catch { bad = []; }
      if (!check.ok) bad = [...bad, file.id].slice(-50);
      await this.settings.set(KEY_BAD, JSON.stringify(bad));
      // Older copies: this environment's folder, plus older unnamed ones in the top folder.
      const old = [
        ...toTrash(await this.google.listChildren(folderId), env, new Set(bad), KEEP),
        ...toTrash((await this.google.listChildren(rootId)).filter((f) => !/^origami-db-[a-z]/.test(f.name)), env, new Set(bad), KEEP),
      ];
      for (const f of old) await this.google.trashDriveFile(f.id);
      const result = { at, ok: true, verified: check.ok, problems: check.problems, name, env, bytes: zip.length, tables: tables.length, rows: tables.reduce((a, t) => a + t.rows, 0), removed: old.length, link: file.webViewLink || null };
      await this.settings.set(KEY_LAST, at);
      if (check.ok) await this.settings.set('backup.db.lastGoodAt', at);
      await this.settings.set(KEY_RESULT, JSON.stringify(result));
      if (!check.ok) void this.alert(`Tonight’s database copy (${name}) failed its check: ${check.problems.join('; ')}`, at.slice(0, 10));
      return result;
    } catch (e) {
      const result = { at, ok: false, error: (e as Error).message.slice(0, 300) };
      await this.settings.set(KEY_RESULT, JSON.stringify(result));
      throw e;
    } finally { this.running = false; }
  }
}
