"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleService = exports.LOGIN_SCOPES = exports.WORKSPACE_SCOPES = void 0;
const common_1 = require("@nestjs/common");
const settings_service_1 = require("../settings/settings.service");
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_FILE_FIELDS = 'id,name,mimeType,size,webViewLink,iconLink,thumbnailLink,createdTime';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const MULTIPART_LIMIT = 5 * 1024 * 1024;
exports.WORKSPACE_SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/drive',
];
exports.LOGIN_SCOPES = ['openid', 'email', 'profile'];
let GoogleService = class GoogleService {
    constructor(settings) {
        this.settings = settings;
        this.log = new common_1.Logger('GoogleService');
        this.accessToken = null;
        this.folderIds = new Map();
    }
    async credentials() {
        const clientId = (await this.settings.get('google.clientId')) || '';
        const clientSecret = (await this.settings.get('google.clientSecret')) || '';
        if (!clientId || !clientSecret) {
            throw new common_1.BadRequestException('Google is not configured. Add the Client ID and Client Secret under Settings -> Integrations -> Google Workspace.');
        }
        return { clientId, clientSecret, redirectUri: await this.redirectUri() };
    }
    async isConfigured() {
        return !!(await this.settings.get('google.clientId')) && !!(await this.settings.get('google.clientSecret'));
    }
    async redirectUri() {
        const base = await this.settings.baseUrl();
        if (!base) {
            throw new common_1.BadRequestException('App base URL is not set. Add it under Settings -> Integrations -> Google Workspace so Google knows where to send users back.');
        }
        return `${base}/api/google/callback`;
    }
    async consentUrl(mode, state) {
        const { clientId, redirectUri } = await this.credentials();
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: (mode === 'connect' ? exports.WORKSPACE_SCOPES : exports.LOGIN_SCOPES).join(' '),
            state,
            include_granted_scopes: 'true',
        });
        if (mode === 'connect') {
            params.set('access_type', 'offline');
            params.set('prompt', 'consent');
        }
        else {
            params.set('prompt', 'select_account');
        }
        const hd = await this.settings.get('google.hostedDomain');
        if (hd)
            params.set('hd', hd);
        return `${AUTH_URL}?${params.toString()}`;
    }
    async exchangeCode(code) {
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
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            this.log.error(`Token exchange failed: ${JSON.stringify(body)}`);
            throw new common_1.BadRequestException(body?.error_description || 'Google rejected the sign-in.');
        }
        return body;
    }
    async profile(accessToken) {
        const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.ok)
            throw new common_1.BadRequestException('Could not read the Google profile.');
        return (await res.json());
    }
    async saveConnection(refreshToken, profile) {
        if (refreshToken)
            await this.settings.set('google.refreshToken', refreshToken);
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
        try {
            redirectUri = await this.redirectUri();
        }
        catch { }
        return {
            configured: await this.isConfigured(),
            connected: hasRefresh && !!connectedEmail,
            connectedEmail,
            connectedAt: (await this.settings.get('google.connectedAt')) || '',
            senderEmail: (await this.settings.get('google.senderEmail')) || connectedEmail,
            redirectUri,
            scopes: exports.WORKSPACE_SCOPES,
        };
    }
    async workspaceToken() {
        if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000)
            return this.accessToken.value;
        const refreshToken = await this.settings.get('google.refreshToken');
        if (!refreshToken) {
            throw new common_1.BadRequestException('No Google account is connected. Connect one under Settings -> Integrations -> Google Workspace.');
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
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            this.log.error(`Refresh failed: ${JSON.stringify(body)}`);
            throw new common_1.BadRequestException('The Google connection expired. Reconnect it in Settings.');
        }
        this.accessToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
        return this.accessToken.value;
    }
    async sendMail(opts) {
        const token = await this.workspaceToken();
        const from = (await this.settings.get('google.senderEmail')) || (await this.settings.get('google.connectedEmail')) || '';
        const raw = buildMime({ ...opts, from });
        const res = await fetch(GMAIL_SEND_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            this.log.error(`Gmail send failed: ${JSON.stringify(body)}`);
            throw new common_1.BadRequestException(body?.error?.message || 'Gmail rejected the message.');
        }
        this.log.log(`Sent "${opts.subject}" to ${opts.to}`);
        return { id: body.id, threadId: body.threadId, from, to: opts.to };
    }
    async isConnected() {
        return !!(await this.settings.get('google.refreshToken')) && !!(await this.settings.get('google.connectedEmail'));
    }
    q(value) {
        return value.replace(/['\\]/g, '\\$&');
    }
    async ensureFolder(name, parentId) {
        const cacheKey = `${parentId ?? 'root'}/${name}`;
        const cached = this.folderIds.get(cacheKey);
        if (cached)
            return cached;
        const token = await this.workspaceToken();
        const clauses = [
            `name = '${this.q(name)}'`,
            `mimeType = '${FOLDER_MIME}'`,
            'trashed = false',
            parentId ? `'${this.q(parentId)}' in parents` : '',
        ].filter(Boolean);
        const params = new URLSearchParams({ q: clauses.join(' and '), fields: 'files(id)', pageSize: '1' });
        const found = await fetch(`${DRIVE_FILES_URL}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
        const foundBody = await found.json().catch(() => ({}));
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
        const madeBody = await made.json().catch(() => ({}));
        if (!made.ok)
            throw new common_1.BadRequestException(madeBody?.error?.message || 'Could not create the Drive folder.');
        this.folderIds.set(cacheKey, madeBody.id);
        return madeBody.id;
    }
    async attachmentsRootId() {
        const saved = await this.settings.get('google.attachmentsFolderId');
        if (saved)
            return saved;
        const name = (await this.settings.get('google.attachmentsFolder')) || 'Origami Attachments';
        const id = await this.ensureFolder(name);
        await this.settings.set('google.attachmentsFolderId', id);
        return id;
    }
    async folderForScope(scope) {
        return this.ensureFolder(scope || 'General', await this.attachmentsRootId());
    }
    async folderForPath(root, segments) {
        let parent = await this.ensureFolder(root);
        for (const segment of segments) {
            const clean = (segment || '').trim();
            if (!clean)
                continue;
            parent = await this.ensureFolder(clean, parent);
        }
        return parent;
    }
    async uploadDriveFile(opts) {
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
                body: body,
            });
            const out = await res.json().catch(() => ({}));
            if (!res.ok) {
                this.log.error(`Drive upload failed: ${JSON.stringify(out)}`);
                throw new common_1.BadRequestException(out?.error?.message || 'Drive rejected the upload.');
            }
            return out;
        }
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
            throw new common_1.BadRequestException('Drive would not start the upload session.');
        }
        const put = await fetch(session, {
            method: 'PUT',
            headers: { 'Content-Type': mimeType, 'Content-Length': String(opts.buffer.length) },
            body: opts.buffer,
        });
        const out = await put.json().catch(() => ({}));
        if (!put.ok) {
            this.log.error(`Drive resumable upload failed: ${JSON.stringify(out)}`);
            throw new common_1.BadRequestException(out?.error?.message || 'Drive rejected the upload.');
        }
        return out;
    }
    async downloadDriveFile(id, thumb = false) {
        const token = await this.workspaceToken();
        if (thumb) {
            const meta = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(id)}?fields=thumbnailLink,mimeType&supportsAllDrives=true`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const metaBody = await meta.json().catch(() => ({}));
            if (meta.ok && metaBody?.thumbnailLink) {
                const thumbRes = await fetch(metaBody.thumbnailLink, { headers: { Authorization: `Bearer ${token}` } });
                if (thumbRes.ok) {
                    return { body: thumbRes.body, mimeType: thumbRes.headers.get('content-type') || 'image/jpeg' };
                }
            }
        }
        const res = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            const err = await res.text().catch(() => '');
            this.log.error(`Drive download failed for ${id}: ${err.slice(0, 200)}`);
            throw new common_1.BadRequestException('Could not read that file from Drive.');
        }
        return {
            body: res.body,
            mimeType: res.headers.get('content-type') || 'application/octet-stream',
            size: res.headers.get('content-length') || undefined,
        };
    }
    async listChildren(folderId) {
        const token = await this.workspaceToken();
        const out = [];
        let pageToken;
        do {
            const params = new URLSearchParams({
                q: `'${this.q(folderId)}' in parents and trashed = false`,
                fields: `nextPageToken, files(${DRIVE_FILE_FIELDS})`,
                pageSize: '200',
                supportsAllDrives: 'true',
                includeItemsFromAllDrives: 'true',
            });
            if (pageToken)
                params.set('pageToken', pageToken);
            const res = await fetch(`${DRIVE_FILES_URL}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
            const body = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new common_1.BadRequestException(body?.error?.message || 'Could not read that Drive folder.');
            out.push(...(body.files ?? []));
            pageToken = body.nextPageToken;
        } while (pageToken);
        return out;
    }
    static isFolder(f) {
        return f.mimeType === FOLDER_MIME;
    }
    async shareLink(id) {
        const token = await this.workspaceToken();
        const grant = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(id)}/permissions?supportsAllDrives=true`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'reader', type: 'anyone' }),
        });
        if (!grant.ok) {
            const err = await grant.json().catch(() => ({}));
            this.log.warn(`Could not make ${id} link-readable: ${JSON.stringify(err)}`);
        }
        const meta = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(id)}?fields=webViewLink&supportsAllDrives=true`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const body = await meta.json().catch(() => ({}));
        if (!meta.ok || !body?.webViewLink)
            throw new common_1.BadRequestException('Could not produce a share link.');
        return body.webViewLink;
    }
    async trashDriveFile(id) {
        const token = await this.workspaceToken();
        const res = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(id)}?supportsAllDrives=true`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ trashed: true }),
        });
        if (!res.ok)
            this.log.warn(`Could not trash Drive file ${id} (already gone?)`);
    }
    async testDrive() {
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
    async listDriveFiles(q, pageSize = 25) {
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
        const body = await res.json().catch(() => ({}));
        if (!res.ok)
            throw new common_1.BadRequestException(body?.error?.message || 'Drive request failed.');
        return (body.files ?? []);
    }
};
exports.GoogleService = GoogleService;
exports.GoogleService = GoogleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [settings_service_1.SettingsService])
], GoogleService);
function buildMime(opts) {
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
//# sourceMappingURL=google.service.js.map