import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';

/** Scopes for the workspace account that sends mail and owns Drive files. */
export const WORKSPACE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive',
];

/** Scopes for "Sign in with Google" — identity only. */
export const LOGIN_SCOPES = ['openid', 'email', 'profile'];

export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
}

@Injectable()
export class GoogleService {
  private readonly log = new Logger('GoogleService');
  /** Cached workspace access token (they last an hour). */
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly settings: SettingsService) {}

  // ---------------------------------------------------------------- config

  async credentials(): Promise<{ clientId: string; clientSecret: string; redirectUri: string }> {
    const clientId = (await this.settings.get('google.clientId')) || '';
    const clientSecret = (await this.settings.get('google.clientSecret')) || '';
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Google is not configured. Add the Client ID and Client Secret under Settings -> Integrations -> Google Workspace.',
      );
    }
    return { clientId, clientSecret, redirectUri: await this.redirectUri() };
  }

  async isConfigured(): Promise<boolean> {
    return !!(await this.settings.get('google.clientId')) && !!(await this.settings.get('google.clientSecret'));
  }

  /** The single redirect URI to register in the Google Cloud console. */
  async redirectUri(): Promise<string> {
    const base = await this.settings.baseUrl();
    if (!base) {
      throw new BadRequestException(
        'App base URL is not set. Add it under Settings -> Integrations -> Google Workspace so Google knows where to send users back.',
      );
    }
    return `${base}/api/google/callback`;
  }

  /** Where the browser should be sent to start a consent flow. */
  async consentUrl(mode: 'connect' | 'login', state: string): Promise<string> {
    const { clientId, redirectUri } = await this.credentials();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: (mode === 'connect' ? WORKSPACE_SCOPES : LOGIN_SCOPES).join(' '),
      state,
      include_granted_scopes: 'true',
    });
    if (mode === 'connect') {
      // Offline + forced consent is the only way Google hands back a refresh token.
      params.set('access_type', 'offline');
      params.set('prompt', 'consent');
    } else {
      params.set('prompt', 'select_account');
    }
    const hd = await this.settings.get('google.hostedDomain');
    if (hd) params.set('hd', hd);
    return `${AUTH_URL}?${params.toString()}`;
  }

  // ----------------------------------------------------------------- OAuth

  async exchangeCode(code: string): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
    const { clientId, clientSecret, redirectUri } = await this.credentials();
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.log.error(`Token exchange failed: ${JSON.stringify(body)}`);
      throw new BadRequestException(body?.error_description || 'Google rejected the sign-in.');
    }
    return body;
  }

  async profile(accessToken: string): Promise<GoogleProfile> {
    const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new BadRequestException('Could not read the Google profile.');
    return (await res.json()) as GoogleProfile;
  }

  /** Store the workspace refresh token so the server can send mail on its own. */
  async saveConnection(refreshToken: string | undefined, profile: GoogleProfile) {
    if (refreshToken) await this.settings.set('google.refreshToken', refreshToken);
    await this.settings.set('google.connectedEmail', profile.email);
    if (!(await this.settings.get('google.senderEmail'))) {
      await this.settings.set('google.senderEmail', profile.email);
    }
    await this.settings.set('google.connectedAt', new Date().toISOString());
    this.accessToken = null;
  }

  async disconnect() {
    await this.settings.set('google.refreshToken', '');
    await this.settings.set('google.connectedEmail', '');
    await this.settings.set('google.connectedAt', '');
    this.accessToken = null;
  }

  async status() {
    const connectedEmail = (await this.settings.get('google.connectedEmail')) || '';
    const hasRefresh = !!(await this.settings.get('google.refreshToken'));
    let redirectUri = '';
    try { redirectUri = await this.redirectUri(); } catch { /* base URL not set yet */ }
    return {
      configured: await this.isConfigured(),
      connected: hasRefresh && !!connectedEmail,
      connectedEmail,
      connectedAt: (await this.settings.get('google.connectedAt')) || '',
      senderEmail: (await this.settings.get('google.senderEmail')) || connectedEmail,
      redirectUri,
      scopes: WORKSPACE_SCOPES,
    };
  }

  /** A live access token for the connected workspace account. */
  async workspaceToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) return this.accessToken.value;
    const refreshToken = await this.settings.get('google.refreshToken');
    if (!refreshToken) {
      throw new BadRequestException(
        'No Google account is connected. Connect one under Settings -> Integrations -> Google Workspace.',
      );
    }
    const { clientId, clientSecret } = await this.credentials();
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }).toString(),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.log.error(`Refresh failed: ${JSON.stringify(body)}`);
      throw new BadRequestException('The Google connection expired. Reconnect it in Settings.');
    }
    this.accessToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
    return this.accessToken.value;
  }

  // ------------------------------------------------------------------ mail

  /** Send an HTML email through Gmail as the connected workspace account. */
  async sendMail(opts: { to: string; subject: string; html: string; text?: string; cc?: string; bcc?: string }) {
    const token = await this.workspaceToken();
    const from = (await this.settings.get('google.senderEmail')) || (await this.settings.get('google.connectedEmail')) || '';
    const raw = buildMime({ ...opts, from });
    const res = await fetch(GMAIL_SEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.log.error(`Gmail send failed: ${JSON.stringify(body)}`);
      throw new BadRequestException(body?.error?.message || 'Gmail rejected the message.');
    }
    this.log.log(`Sent "${opts.subject}" to ${opts.to}`);
    return { id: body.id as string, threadId: body.threadId as string, from, to: opts.to };
  }

  // ----------------------------------------------------------------- drive

  async listDriveFiles(q?: string, pageSize = 25): Promise<DriveFile[]> {
    const token = await this.workspaceToken();
    const escaped = (q ?? '').replace(/['\\]/g, '\\$&');
    const params = new URLSearchParams({
      pageSize: String(pageSize),
      orderBy: 'modifiedTime desc',
      fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink)',
      q: escaped ? `name contains '${escaped}' and trashed = false` : 'trashed = false',
    });
    const res = await fetch(`${DRIVE_FILES_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new BadRequestException(body?.error?.message || 'Drive request failed.');
    return (body.files ?? []) as DriveFile[];
  }
}

/** RFC-2822 message, base64url encoded the way the Gmail API wants it. */
function buildMime(opts: { from: string; to: string; subject: string; html: string; text?: string; cc?: string; bcc?: string }) {
  const boundary = 'origami_' + Math.random().toString(36).slice(2);
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    opts.cc ? `Cc: ${opts.cc}` : '',
    opts.bcc ? `Bcc: ${opts.bcc}` : '',
    `Subject: =?UTF-8?B?${Buffer.from(opts.subject, 'utf8').toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);

  const text = opts.text ?? opts.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    text,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    opts.html,
    `--${boundary}--`,
  ];

  return Buffer.from([...headers, '', ...body].join('\r\n'), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
