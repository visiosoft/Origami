import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_FILE_FIELDS = 'id,name,mimeType,size,webViewLink,iconLink,thumbnailLink,createdTime';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
/** Google caps uploadType=multipart at 5 MB; anything larger goes resumable. */
const MULTIPART_LIMIT = 5 * 1024 * 1024;

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
  thumbnailLink?: string;
  createdTime?: string;
}

@Injectable()
export class GoogleService {
  private readonly log = new Logger('GoogleService');
  /** Cached workspace access token (they last an hour). */
  private accessToken: { value: string; expiresAt: number } | null = null;
  /** Resolved Drive folder ids, keyed by `parent/name`. */
  private folderIds = new Map<string, string>();

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
    await this.settings.set('google.attachmentsFolderId', '');
    this.accessToken = null;
    this.folderIds.clear();
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

  /** True when a Google account is connected — never throws, unlike credentials(). */
  async isConnected(): Promise<boolean> {
    return !!(await this.settings.get('google.refreshToken')) && !!(await this.settings.get('google.connectedEmail'));
  }

  /** Escape a value for use inside a Drive `q` string literal. */
  private q(value: string): string {
    return value.replace(/['\\]/g, '\\$&');
  }

  /** Find a folder by name (optionally within a parent), creating it if absent. */
  async ensureFolder(name: string, parentId?: string): Promise<string> {
    const cacheKey = `${parentId ?? 'root'}/${name}`;
    const cached = this.folderIds.get(cacheKey);
    if (cached) return cached;

    const token = await this.workspaceToken();
    const clauses = [
      `name = '${this.q(name)}'`,
      `mimeType = '${FOLDER_MIME}'`,
      'trashed = false',
      parentId ? `'${this.q(parentId)}' in parents` : '',
    ].filter(Boolean);
    const params = new URLSearchParams({ q: clauses.join(' and '), fields: 'files(id)', pageSize: '1' });
    const found = await fetch(`${DRIVE_FILES_URL}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const foundBody: any = await found.json().catch(() => ({}));
    const existing = foundBody?.files?.[0]?.id;
    if (existing) {
      this.folderIds.set(cacheKey, existing);
      return existing;
    }

    const made = await fetch(`${DRIVE_FILES_URL}?fields=id`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
    });
    const madeBody: any = await made.json().catch(() => ({}));
    if (!made.ok) throw new BadRequestException(madeBody?.error?.message || 'Could not create the Drive folder.');
    this.folderIds.set(cacheKey, madeBody.id);
    return madeBody.id;
  }

  /** The shared root folder every Origami attachment lives under. */
  async attachmentsRootId(): Promise<string> {
    const saved = await this.settings.get('google.attachmentsFolderId');
    if (saved) return saved;
    const name = (await this.settings.get('google.attachmentsFolder')) || 'Origami Attachments';
    const id = await this.ensureFolder(name);
    await this.settings.set('google.attachmentsFolderId', id);
    return id;
  }

  /** A per-scope subfolder, e.g. "Project 12" or "Request Log". */
  async folderForScope(scope: string): Promise<string> {
    return this.ensureFolder(scope || 'General', await this.attachmentsRootId());
  }

  /**
   * Resolve (creating as needed) a nested folder path under a named root, so the
   * Drive mirrors the tree people see rather than dumping everything flat.
   */
  async folderForPath(root: string, segments: string[]): Promise<string> {
    let parent = await this.ensureFolder(root);
    for (const segment of segments) {
      const clean = (segment || '').trim();
      if (!clean) continue;
      parent = await this.ensureFolder(clean, parent);
    }
    return parent;
  }

  /** Upload a file into Drive. Small files go multipart, larger ones resumable. */
  async uploadDriveFile(opts: { name: string; mimeType: string; buffer: Buffer; parentId: string }): Promise<DriveFile> {
    const token = await this.workspaceToken();
    const metadata = { name: opts.name, parents: [opts.parentId] };
    const mimeType = opts.mimeType || 'application/octet-stream';

    if (opts.buffer.length <= MULTIPART_LIMIT) {
      const boundary = 'origami_up_' + Math.random().toString(36).slice(2);
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`, 'utf8'),
        Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`, 'utf8'),
        opts.buffer,
        Buffer.from(`\r\n--${boundary}--`, 'utf8'),
      ]);
      const res = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart&supportsAllDrives=true&fields=${DRIVE_FILE_FIELDS}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: body as any,
      });
      const out: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.log.error(`Drive upload failed: ${JSON.stringify(out)}`);
        throw new BadRequestException(out?.error?.message || 'Drive rejected the upload.');
      }
      return out as DriveFile;
    }

    // Resumable: ask for a session URL, then send the whole buffer in one PUT.
    const start = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=resumable&supportsAllDrives=true&fields=${DRIVE_FILE_FIELDS}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(opts.buffer.length),
      },
      body: JSON.stringify(metadata),
    });
    const session = start.headers.get('location');
    if (!start.ok || !session) {
      throw new BadRequestException('Drive would not start the upload session.');
    }
    const put = await fetch(session, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType, 'Content-Length': String(opts.buffer.length) },
      body: opts.buffer as any,
    });
    const out: any = await put.json().catch(() => ({}));
    if (!put.ok) {
      this.log.error(`Drive resumable upload failed: ${JSON.stringify(out)}`);
      throw new BadRequestException(out?.error?.message || 'Drive rejected the upload.');
    }
    return out as DriveFile;
  }

  /**
   * Stream a Drive file's bytes back. Callers must have already established that
   * the requester is entitled to this particular file — see the task-scoped
   * content endpoints, which look the id up on the task first.
   */
  async downloadDriveFile(id: string, thumb = false): Promise<{ body: any; mimeType: string; size?: string }> {
    const token = await this.workspaceToken();

    if (thumb) {
      const meta = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(id)}?fields=thumbnailLink,mimeType&supportsAllDrives=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const metaBody: any = await meta.json().catch(() => ({}));
      if (meta.ok && metaBody?.thumbnailLink) {
        // Drive thumbnails are served from a token-authenticated CDN URL.
        const thumbRes = await fetch(metaBody.thumbnailLink, { headers: { Authorization: `Bearer ${token}` } });
        if (thumbRes.ok) {
          return { body: thumbRes.body, mimeType: thumbRes.headers.get('content-type') || 'image/jpeg' };
        }
      }
      // Thumbnails lag a few seconds after upload — fall through to the original.
    }

    const res = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      this.log.error(`Drive download failed for ${id}: ${err.slice(0, 200)}`);
      throw new BadRequestException('Could not read that file from Drive.');
    }
    return {
      body: res.body,
      mimeType: res.headers.get('content-type') || 'application/octet-stream',
      size: res.headers.get('content-length') || undefined,
    };
  }

  /** Move a file to Drive's trash — recoverable, unlike a hard delete. */
  async trashDriveFile(id: string): Promise<void> {
    const token = await this.workspaceToken();
    const res = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(id)}?supportsAllDrives=true`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    });
    if (!res.ok) this.log.warn(`Could not trash Drive file ${id} (already gone?)`);
  }

  /** End-to-end check: create the folder, upload, read back, trash. */
  async testDrive(): Promise<{ ok: true; folderId: string }> {
    const parentId = await this.folderForScope('Health check');
    const file = await this.uploadDriveFile({
      name: `origami-healthcheck-${Date.now()}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from('Origami Drive access is working.', 'utf8'),
      parentId,
    });
    await this.downloadDriveFile(file.id);
    await this.trashDriveFile(file.id);
    return { ok: true, folderId: parentId };
  }

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
