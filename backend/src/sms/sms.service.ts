import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

const TWILIO_API = 'https://api.twilio.com/2010-04-01';

/** A phone number as Twilio wants it: E.164, digits with a leading +. */
export function normalizeNumber(raw: string, defaultCountry = '1'): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return '+' + trimmed.slice(1).replace(/\D/g, '');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  // A bare 10-digit number is local; anything longer already carries its country.
  return digits.length === 10 ? `+${defaultCountry}${digits}` : `+${digits}`;
}

/**
 * A single SMS segment is 160 GSM characters, or 70 if any character forces
 * UCS-2. Concatenated messages lose a few characters per part to headers.
 */
export function segmentsFor(body: string) {
  const unicode = /[^\x00-\x7F]/.test(body);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const length = body.length;
  if (length === 0) return { length, unicode, segments: 0, limit: single };
  const segments = length <= single ? 1 : Math.ceil(length / multi);
  return { length, unicode, segments, limit: single };
}

@Injectable()
export class SmsService {
  private readonly log = new Logger('SmsService');

  constructor(private readonly settings: SettingsService) {}

  /** Credentials, read fresh so a change in Settings takes effect immediately. */
  private async credentials() {
    const [accountSid, authToken, fromNumber, enabled] = await Promise.all([
      this.settings.get('sms.accountSid'),
      this.settings.get('sms.authToken'),
      this.settings.get('sms.fromNumber'),
      this.settings.get('sms.enabled'),
    ]);
    return {
      accountSid: (accountSid || '').trim(),
      authToken: (authToken || '').trim(),
      fromNumber: normalizeNumber(fromNumber || ''),
      enabled: enabled !== 'false',
    };
  }

  async isConfigured() {
    const c = await this.credentials();
    return !!(c.accountSid && c.authToken && c.fromNumber);
  }

  /** What the Settings page shows, without ever returning the token. */
  async status() {
    const c = await this.credentials();
    return {
      configured: !!(c.accountSid && c.authToken && c.fromNumber),
      enabled: c.enabled,
      fromNumber: c.fromNumber,
      accountSid: c.accountSid ? `${c.accountSid.slice(0, 6)}…${c.accountSid.slice(-4)}` : '',
    };
  }

  /**
   * Send one message.
   *
   * Twilio's REST API is a form POST with basic auth, so it needs no SDK —
   * which matters here because a new dependency means an npm install on every
   * container start.
   */
  async send(opts: { to: string; body: string }) {
    const c = await this.credentials();
    if (!c.enabled) throw new BadRequestException('SMS is switched off in Settings.');
    if (!c.accountSid || !c.authToken || !c.fromNumber) {
      throw new BadRequestException('SMS is not configured. Add the account SID, auth token and sending number in Settings.');
    }

    const to = normalizeNumber(opts.to);
    if (!to || to.length < 8) throw new BadRequestException(`"${opts.to}" is not a usable phone number.`);
    const body = (opts.body || '').trim();
    if (!body) throw new BadRequestException('The message is empty.');

    const auth = Buffer.from(`${c.accountSid}:${c.authToken}`).toString('base64');
    const form = new URLSearchParams({ To: to, From: c.fromNumber, Body: body });

    const res = await fetch(`${TWILIO_API}/Accounts/${encodeURIComponent(c.accountSid)}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const payload: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Twilio's own message is far more useful than the status code.
      const reason = payload?.message || `SMS failed (${res.status})`;
      this.log.warn(`SMS to ${to} failed: ${reason}`);
      throw new BadRequestException(reason);
    }

    const meta = segmentsFor(body);
    this.log.log(`SMS sent to ${to} (${meta.segments} segment${meta.segments === 1 ? '' : 's'})`);
    return { sent: true, to, sid: payload?.sid, segments: meta.segments };
  }
}
