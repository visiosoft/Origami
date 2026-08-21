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
        this.accessToken = null;
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