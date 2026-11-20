import type { DataSource } from 'typeorm';
import { UserEntity } from '../database/entities';
import type { SettingsService } from '../settings/settings.service';
import type { GoogleService } from '../google/google.service';
import { envName } from '../backup/db-export';

const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!));

/**
 * Email the active admins, at most once per `key` per day (the date is kept in
 * settings under `key`). Shared by the database copy and API usage alerts.
 * Never throws -- an alert that can't be sent is only logged.
 */
export async function alertAdmins(deps: { data: DataSource; settings: SettingsService; google?: GoogleService | null }, key: string, today: string, subject: string, lines: string[]): Promise<boolean> {
  try {
    if (!deps.google) return false;
    if ((await deps.settings.get(key)) === today) return false;
    await deps.settings.set(key, today);
    const admins = (await deps.data.getRepository(UserEntity).find()).filter((u) => u.roleKey === 'admin' && u.status !== 'suspended' && u.email);
    const to = [...new Set(admins.map((u) => u.email.trim().toLowerCase()))].join(', ');
    if (!to) return false;
    const env = envName(await deps.settings.get('app.baseUrl').catch(() => null));
    await deps.google.sendMail({ to, subject: `Origami (${env}): ${subject}`, html: lines.map((l) => `<p>${esc(l)}</p>`).join('') });
    return true;
  } catch { return false; }
}
