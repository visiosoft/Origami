import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { AppSettingEntity } from '../database/entities';

/** Keys that hold secrets — masked whenever settings are read by the UI. */
export const SECRET_KEYS = ['google.clientSecret', 'google.refreshToken', 'auth.jwtSecret', 'reminders.triggerToken'];

/** Settings the Settings UI may read/write. Anything else is rejected. */
export const PUBLIC_KEYS = [
  'google.clientId',
  'google.clientSecret',
  'app.baseUrl',
  'google.senderEmail',
  'google.allowSignup',
  'google.hostedDomain',
  'google.attachmentsFolder',
  'reminders.enabled',
  'reminders.hour',
  'reminders.timezone',
  'reminders.triggerToken',
  'tasks.labels',
  // Workspace kill switch for assignment emails; per-user opt-out lives on the user row.
  'notifications.assignmentEmail',
  // --- Branding: letterhead, footer and signature used on generated documents ---
  'brand.companyName',
  'brand.tagline',
  'brand.logoDataUrl',
  'brand.accentColor',
  'brand.address',
  'brand.phone',
  'brand.email',
  'brand.website',
  'brand.footerNote',
  'brand.signatureName',
  'brand.signatureTitle',
  'brand.signatureDataUrl',
];

export const MASK = '••••••••';

@Injectable()
export class SettingsService {
  private readonly log = new Logger('SettingsService');

  constructor(
    @InjectRepository(AppSettingEntity) private readonly repo: Repository<AppSettingEntity>,
  ) {}

  async get(key: string): Promise<string | null> {
    const row = await this.repo.findOneBy({ key });
    return row?.value ?? null;
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
