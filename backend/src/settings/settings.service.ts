import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { AppSettingEntity } from '../database/entities';

/** Keys that hold secrets — masked whenever settings are read by the UI. */
export const SECRET_KEYS = ['google.clientSecret', 'google.workspaceClientSecret', 'google.refreshToken', 'auth.jwtSecret', 'reminders.triggerToken', 'sms.authToken', 'sms.quoApiKey'];

/** Settings the Settings UI may read/write. Anything else is rejected. */
export const PUBLIC_KEYS = [
  'google.clientId',
  'google.clientSecret',
  'google.workspaceClientId',
  'google.workspaceClientSecret',
  'app.baseUrl',
  // A banner every signed-in page shows while it's on ("Updates 3-4 pm -- please save your work").
  'app.notice',
  'app.noticeActive',
  // Who receives each submitted daily log (PDF + Excel), comma-separated; blank = the administrators.
  'dailyLogs.backupEmails',
  'google.senderEmail',
  'google.allowSignup',
  'google.hostedDomain',
  'google.attachmentsFolder',
  // Standard folders laid out for every project's File Room (one path per line).
  'fileRoom.folderTemplate',
  'reminders.enabled',
  'reminders.hour',
  'reminders.timezone',
  'reminders.triggerToken',
  // Daily notice when an assignee's open-task count crosses this number.
  // Blank/zero disables it -- the actual figure is the office's call, not a
  // guessed default.
  'reminders.overstretchThreshold',
  // Whose calendars show up when checking availability while booking a
  // meeting -- JSON [{ name, email }], configured by the office rather than
  // hardcoded to specific people.
  'scheduling.calendars',
  'tasks.labels',
  // Named filter combinations on the Projects board -- JSON
  // [{ name, filters: { priority?, contractType?, typeOfWork?, contactedBy?, q? } }],
  // shared office-wide rather than per-user, same as the calendars list above.
  'projects.savedFilters',
  // Workspace kill switch for assignment emails; per-user opt-out lives on the user row.
  'notifications.assignmentEmail',
  // Response-time target per pipeline stage, as JSON { stageKey: days }.
  'pipeline.slaDays',
  // The phase-and-task programme new projects are built from. 'programme.templates'
  // is the current library (JSON array of { key, name, phases }); 'programme.template'
  // is the legacy single-template shape, read as a fallback and migrated on first use.
  'programme.template',
  'programme.templates',
  // --- SMS (Twilio) ---
  'sms.enabled',
  'sms.accountSid',
  'sms.authToken',
  'sms.fromNumber',
  // Texting through Quo, from the office line (Oct 27 sync): 'twilio' (default) or 'quo'.
  'sms.provider',
  'sms.quoApiKey',
  'sms.quoFrom',
  // --- Branding: letterhead, footer and signature used on generated documents ---
  'brand.companyName',
  'brand.tagline',
  'brand.logoDataUrl',
  'brand.accentColor',
  'brand.address',
  'brand.phone',
  'brand.email',
  'brand.website',
  // Our contractor licence number, printed on contracts.
  'brand.license',
  'brand.footerNote',
  'brand.signatureName',
  'brand.signatureTitle',
  'brand.signatureDataUrl',
  'brand.footerLogoDataUrl',
  'brand.aboutUsText',
  'brand.team',
  'brand.coverPhotoDataUrl',
];

export const MASK = '••••••••';

@Injectable()
export class SettingsService {
  private readonly log = new Logger('SettingsService');

  constructor(
    @InjectRepository(AppSettingEntity) private readonly repo: Repository<AppSettingEntity>,
  ) {}

  /**
   * Settings are read on nearly every request (the session's signing secret,
   * the base URL, integration switches), so they're kept in memory for a short
   * while. A change made through this service is seen at once; one made by
   * another server instance within CACHE_MS.
   */
  private readonly cache = new Map<string, { value: string | null; at: number }>();
  private static readonly CACHE_MS = 30_000;

  async get(key: string): Promise<string | null> {
    // Run-once markers ("…LastRunDate") are always read fresh, so two server instances never both run a daily job.
    const cacheable = !/run/i.test(key);
    const hit = cacheable ? this.cache.get(key) : undefined;
    if (hit && Date.now() - hit.at < SettingsService.CACHE_MS) return hit.value;
    const row = await this.repo.findOneBy({ key });
    const value = row?.value ?? null;
    this.cache.set(key, { value, at: Date.now() });
    return value;
  }

  async getMany(keys: string[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const key of keys) {
      const v = await this.get(key);
      if (v != null) out[key] = v;
    }
    return out;
  }

  async set(key: string, value: string | null): Promise<void> {
    let row = await this.repo.findOneBy({ key });
    if (!row) row = this.repo.create({ key });
    row.value = value ?? '';
    row.updatedAt = new Date().toISOString();
    await this.repo.save(row);
    this.cache.set(key, { value: row.value, at: Date.now() });
  }

  async setMany(patch: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(patch)) {
      if (!PUBLIC_KEYS.includes(key)) continue;
      // A masked value means "leave the stored secret alone".
      if (SECRET_KEYS.includes(key) && (value === MASK || value === '')) continue;
      await this.set(key, value == null ? '' : String(value));
    }
  }

  /** Settings for the UI: secrets are replaced with a mask, never sent in full. */
  async publicView(): Promise<Record<string, string>> {
    const raw = await this.getMany(PUBLIC_KEYS);
    const out: Record<string, string> = {};
    for (const key of PUBLIC_KEYS) {
      const v = raw[key] ?? '';
      out[key] = SECRET_KEYS.includes(key) ? (v ? MASK : '') : v;
    }
    return out;
  }

  /** The base URL the app is served from — used to build invite + OAuth links. */
  async baseUrl(): Promise<string> {
    const configured = (await this.get('app.baseUrl')) || process.env.APP_BASE_URL || '';
    return configured.replace(/\/+$/, '');
  }

  /** Stable secret used to sign session tokens. Generated on first use. */
  async jwtSecret(): Promise<string> {
    let secret = await this.get('auth.jwtSecret');
    if (!secret) {
      secret = randomBytes(48).toString('hex');
      await this.set('auth.jwtSecret', secret);
      this.log.log('Generated a new session signing secret');
    }
    return secret;
  }
}
