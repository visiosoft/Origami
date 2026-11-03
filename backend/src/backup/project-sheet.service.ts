import { BadRequestException, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChangeOrderEntity, MeetingEntity, ProjectEntity, ProjectTaskEntity, RfiEntity, TaskEntity } from '../database/entities';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
import { DRIVE_ROOT } from '../file-room/file-room.service';
import { buildTabs, TAB_TITLES, type Tab } from './sheet-rows';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const KEY_ON = 'backup.sheets.enabled';
const KEY_LAST = 'backup.sheets.lastRun';
const KEY_RESULT = 'backup.sheets.lastResult';
const DEFAULT_TZ = 'America/Los_Angeles';
const CLOSED = /closed|archiv|cancel|lost|complete/i;

/**
 * A backup Google Sheet per project (Oct 30 sync): Tasks, RFIs, change orders,
 * FOR RECORD and meetings, rewritten every night, in the project's Drive
 * folder -- so work can carry on if the system is down. Off until switched on
 * (Settings -> Google); "Refresh now" runs it at once.
 */
@Injectable()
export class ProjectSheetService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('BackupSheets');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(ProjectTaskEntity) private readonly boardTasks: Repository<ProjectTaskEntity>,
    @InjectRepository(TaskEntity) private readonly logTasks: Repository<TaskEntity>,
    @InjectRepository(RfiEntity) private readonly rfis: Repository<RfiEntity>,
    @InjectRepository(ChangeOrderEntity) private readonly cos: Repository<ChangeOrderEntity>,
    @InjectRepository(MeetingEntity) private readonly meetings: Repository<MeetingEntity>,
    private readonly google: GoogleService,
    private readonly settings: SettingsService,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => { void this.tick(); }, 3600_000);
    this.timer.unref?.();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async status() {
    const [on, last, result] = await Promise.all([this.settings.get(KEY_ON), this.settings.get(KEY_LAST), this.settings.get(KEY_RESULT)]);
    let parsed: any = null;
    try { parsed = result ? JSON.parse(result) : null; } catch { parsed = null; }
    return { enabled: on === '1', lastRun: last || null, lastResult: parsed, connected: await this.google.isConnected() };
  }
  async setEnabled(on: boolean) {
    await this.settings.set(KEY_ON, on ? '1' : '0');
    return this.status();
  }

  /** Hourly: once a night, at the reminder hour, when switched on. */
  async tick() {
    try {
      if ((await this.settings.get(KEY_ON)) !== '1') return;
      const tz = (await this.settings.get('reminders.timezone')) || DEFAULT_TZ;
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(new Date()).map((p) => [p.type, p.value]));
      const today = `${parts.year}-${parts.month}-${parts.day}`;
      // 2am local: quiet, and before anyone starts the day.
      if (parseInt(parts.hour, 10) % 24 !== 2) return;
      if (String(await this.settings.get(KEY_LAST) || '').slice(0, 10) === today) return;
      await this.runAll();
    } catch (e) { this.log.warn('Backup sheets: ' + (e as Error).message); }
  }

  /** Every active project, or just one. */
  async runAll(projectId?: number) {
    if (!(await this.google.isConnected())) throw new BadRequestException('Connect Google Workspace first (Settings → Google).');
    if (this.running) throw new BadRequestException('Backup sheets are already being refreshed.');
    this.running = true;
    const done: { project: string; ok: boolean; error?: string }[] = [];
    try {
      const list = (await this.projects.find()).filter((p) => (projectId ? p.id === projectId : !CLOSED.test(String(p.stage || ''))));
      for (const p of list) {
        try { await this.refresh(p); done.push({ project: p.name, ok: true }); }
        catch (e) { done.push({ project: p.name, ok: false, error: (e as Error).message.slice(0, 200) }); this.log.warn(`Backup sheet for ${p.name}: ${(e as Error).message}`); }
      }
    } finally { this.running = false; }
    const at = new Date().toISOString();
    await this.settings.set(KEY_LAST, at);
    await this.settings.set(KEY_RESULT, JSON.stringify({ at, projects: done.length, failed: done.filter((d) => !d.ok) }));
    return { at, projects: done.length, failed: done.filter((d) => !d.ok) };
  }

  async tabsFor(p: ProjectEntity): Promise<Tab[]> {
    const [boardTasks, logTasks, rfis, changeOrders, meetings] = await Promise.all([
      this.boardTasks.find({ where: { projectId: p.id } as any }),
      this.logTasks.find({ where: { project: p.name } as any }),
      this.rfis.find({ where: { projectId: p.id } as any }),
      this.cos.find({ where: { projectId: p.id } as any }),
      this.meetings.find({ where: { projectId: p.id } as any }),
    ]);
    return buildTabs({ boardTasks, logTasks, rfis, changeOrders, meetings });
  }

  /** Make the sheet once, then rewrite every tab. */
  async refresh(p: ProjectEntity) {
    const token = await this.google.workspaceToken();
    const call = async (url: string, init: RequestInit = {}) => {
      const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
      if (!res.ok) throw new Error(`Google ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return res.json() as Promise<any>;
    };
    let id = p.backupSheetId;
    if (id) {
      // Deleted or trashed in Drive since: make a new one.
      const meta = await call(`${DRIVE_FILES}/${encodeURIComponent(id)}?fields=id,trashed&supportsAllDrives=true`).catch(() => null);
      if (!meta || meta.trashed) id = null;
    }
    if (!id) {
      const folder = await this.google.folderForPath(DRIVE_ROOT, [p.name]);
      const made = await call(`${DRIVE_FILES}?supportsAllDrives=true`, { method: 'POST', body: JSON.stringify({ name: `${p.name} — backup`, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [folder] }) });
      id = made.id as string;
      await this.projects.update({ id: p.id }, { backupSheetId: id } as any);
    }
    const sheet = await call(`${SHEETS}/${id}?fields=sheets.properties(sheetId,title)`);
    const have: { sheetId: number; title: string }[] = (sheet.sheets || []).map((x: any) => x.properties);
    const requests: any[] = TAB_TITLES.filter((t) => !have.some((h) => h.title === t)).map((title) => ({ addSheet: { properties: { title } } }));
    // A new sheet starts with "Sheet1"; once ours are there it goes.
    for (const h of have) if (!(TAB_TITLES as readonly string[]).includes(h.title) && /^Sheet\d+$/.test(h.title)) requests.push({ deleteSheet: { sheetId: h.sheetId } });
    if (requests.length) await call(`${SHEETS}/${id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests }) });
    const tabs = await this.tabsFor(p);
    await call(`${SHEETS}/${id}/values:batchClear`, { method: 'POST', body: JSON.stringify({ ranges: TAB_TITLES.map((t) => `'${t}'`) }) });
    const stamp = `Backup of ${p.name} — ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Rewritten nightly by Origami; edits here are overwritten.`;
    await call(`${SHEETS}/${id}/values:batchUpdate`, { method: 'POST', body: JSON.stringify({
      valueInputOption: 'RAW',
      data: tabs.map((t) => ({ range: `'${t.title}'!A1`, values: [[stamp], [], ...t.rows] })),
    }) });
    return { sheetId: id, url: `https://docs.google.com/spreadsheets/d/${id}` };
  }
}
