import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { QUO_DEFAULT_FROM, sendViaQuo } from './quo';

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
    const [accountSid, authToken, fromNumber, enabled, provider, quoApiKey, quoFrom, quoApiBase] = await Promise.all([
      this.settings.get('sms.accountSid'),
      this.settings.get('sms.authToken'),
      this.settings.get('sms.fromNumber'),
      this.settings.get('sms.enabled'),
      this.settings.get('sms.provider'),
      this.settings.get('sms.quoApiKey'),
      this.settings.get('sms.quoFrom'),
      this.settings.get('sms.quoApiBase'),
    ]);
    return {
      provider: (provider === 'quo' ? 'quo' : 'twilio') as 'twilio' | 'quo',
      accountSid: (accountSid || '').trim(),
      authToken: (authToken || '').trim(),
      fromNumber: normalizeNumber(fromNumber || ''),
      quoApiKey: (quoApiKey || '').trim(),
      quoFrom: normalizeNumber(quoFrom || QUO_DEFAULT_FROM),
      quoApiBase: (quoApiBase || '').trim() || undefined,
      enabled: enabled !== 'false',
    };
  }

  private ready(c: Awaited<ReturnType<SmsService['credentials']>>) {
    return c.provider === 'quo' ? !!(c.quoApiKey && c.quoFrom) : !!(c.accountSid && c.authToken && c.fromNumber);
  }

  async isConfigured() {
    return this.ready(await this.credentials());
  }

  /** What the Settings page shows, without ever returning a token or key. */
  async status() {
    const c = await this.credentials();
    return {
      provider: c.provider,
      configured: this.ready(c),
      enabled: c.enabled,
      fromNumber: c.provider === 'quo' ? c.quoFrom : c.fromNumber,
      accountSid: c.accountSid ? `${c.accountSid.slice(0, 6)}…${c.accountSid.slice(-4)}` : '',
    };
  }

  /** Which provider a send would use (for the log). */
  async provider() {
    return (await this.credentials()).provider;
  }

  /**
   * Send one message, through Quo or Twilio (Settings -> SMS).
   *
   * Both are plain REST calls, so no SDK -- a new dependency means an npm
   * install on every container start.
   */
  async send(opts: { to: string; body: string }) {
    const c = await this.credentials();
    if (!c.enabled) throw new BadRequestException('SMS is switched off in Settings.');
    if (!this.ready(c)) {
      throw new BadRequestException(c.provider === 'quo'
        ? 'Texting through Quo is not set up. Add the Quo API key in Settings → SMS.'
        : 'SMS is not configured. Add the account SID, auth token and sending number in Settings.');
    }

    const to = normalizeNumber(opts.to);
    if (!to || to.length < 8) throw new BadRequestException(`"${opts.to}" is not a usable phone number.`);
    const body = (opts.body || '').trim();
    if (!body) throw new BadRequestException('The message is empty.');
    const meta = segmentsFor(body);

    if (c.provider === 'quo') {
      try {
        const r = await sendViaQuo({ apiKey: c.quoApiKey, from: c.quoFrom, base: c.quoApiBase }, to, body);
        this.log.log(`Text sent via Quo to ${to} (${meta.segments} segment${meta.segments === 1 ? '' : 's'})`);
        return { sent: true, to, sid: r.id, segments: meta.segments };
      } catch (e) {
        const reason = (e as Error).message;
        this.log.warn(`Quo text to ${to} failed: ${reason}`);
        throw new BadRequestException(reason);
      }
    }

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

    this.log.log(`SMS sent to ${to} (${meta.segments} segment${meta.segments === 1 ? '' : 's'})`);
    return { sent: true, to, sid: payload?.sid, segments: meta.segments };
  }
}
