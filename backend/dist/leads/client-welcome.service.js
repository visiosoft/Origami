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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientWelcomeService = exports.CLIENT_UPLOAD_STAGE = exports.UPLOAD_LINK_DAYS = void 0;
exports.intakeSummary = intakeSummary;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto_1 = require("crypto");
const entities_1 = require("../database/entities");
const attachments_service_1 = require("../google/attachments.service");
const google_service_1 = require("../google/google.service");
const settings_service_1 = require("../settings/settings.service");
const shell_1 = require("../email/shell");
const crypto_util_1 = require("../auth/crypto.util");
const task_types_1 = require("../database/task.types");
const lead_address_1 = require("./lead-address");
exports.UPLOAD_LINK_DAYS = 30;
exports.CLIENT_UPLOAD_STAGE = 'client_upload';
const DAY = 86_400_000;
const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;
const clean = (v, max = 200) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
const na = (v) => { const t = (v || '').trim(); return /^(n\/?a|none|-+|—)$/i.test(t) ? '' : t; };
function intakeSummary(l) {
    const rows = [
        ['Project', na(l.leadName)],
        ['Address', (0, lead_address_1.leadStreetAddress)(l)],
        ['Property type', na(l.propertyType)],
        ['Type of project', na(l.potentialProjectType)],
        ['How you’d like to work with us', na(l.contractType)],
        ['What you have in mind', na(l.projectVision).slice(0, 700)],
    ];
    return rows.filter(([, v]) => !!v);
}
let ClientWelcomeService = class ClientWelcomeService {
    constructor(files, leads, users, attachments, google, settings) {
        this.files = files;
        this.leads = leads;
        this.users = users;
        this.attachments = attachments;
        this.google = google;
        this.settings = settings;
        this.log = new common_1.Logger('ClientWelcome');
    }
    async row(leadId) {
        return (await this.files.findOneBy({ leadId })) || this.files.create({ leadId, attachments: [] });
    }
    live(r) {
        return !!r?.uploadNonce && !!r.uploadExpiresAt && r.uploadExpiresAt > new Date().toISOString();
    }
    async status(leadId) {
        const r = await this.files.findOneBy({ leadId });
        const uploads = (0, task_types_1.normalizeAttachments)(r?.attachments).filter((a) => a.stage === exports.CLIENT_UPLOAD_STAGE);
        return {
            sentAt: r?.welcomeSentAt || null, sentTo: r?.welcomeSentTo || null, sentBy: r?.welcomeSentBy || null,
            linkLive: this.live(r), expiresAt: this.live(r) ? r.uploadExpiresAt : null, items: r?.uploadItems || [],
            uploads: uploads.length,
        };
    }
    async link(leadId, nonce) {
        const token = (0, crypto_util_1.signState)({ mode: 'lead-upload', leadId, n: nonce }, await this.settings.jwtSecret());
        return `${(await this.settings.baseUrl()) || ''}/upload?token=${encodeURIComponent(token)}`;
    }
    async send(leadId, dto, actor) {
        const lead = await this.leads.findOneBy({ id: leadId });
        if (!lead)
            throw new common_1.NotFoundException('Lead not found');
        const to = clean(dto.to || lead.email, 200);
        if (!EMAIL.test(to))
            throw new common_1.BadRequestException('Give the client’s email address.');
        if (!(await this.google.isConnected()))
            throw new common_1.BadRequestException('No Google account is connected for sending mail (Settings → Integrations).');
        const items = (Array.isArray(dto.items) ? dto.items : lead.homeworkCompleted || []).map((x) => clean(x, 80)).filter(Boolean).slice(0, 40);
        const r = await this.row(leadId);
        r.uploadNonce = (0, crypto_1.randomBytes)(9).toString('base64url');
        r.uploadItems = items;
        r.uploadExpiresAt = new Date(Date.now() + exports.UPLOAD_LINK_DAYS * DAY).toISOString();
        const url = await this.link(leadId, r.uploadNonce);
        const brand = await (0, shell_1.loadEmailBrand)(this.settings);
        const first = na(lead.goByName) || na(lead.firstName) || (na(lead.leadName) || '').split(/\s+/)[0] || 'there';
        const note = String(dto.note || '').trim().slice(0, 3000);
        const summary = intakeSummary(lead);
        const body = `
      <p style="margin:0 0 16px;font-size:13.5px;line-height:1.6;color:#43514D;">Thank you for taking the time to walk us through your project. ${note ? (0, shell_1.escapeHtml)(note).replace(/\n/g, '<br>') : 'Here’s a summary of what you told us, and what would help us most next.'}</p>
      ${summary.length ? `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#2F6F68;margin-bottom:6px;">What you told us</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;font-size:13px;color:#0B1A12;">
        ${summary.map(([k, v]) => `<tr><td style="padding:3px 16px 3px 0;color:#7E9B93;vertical-align:top;white-space:nowrap;">${(0, shell_1.escapeHtml)(k)}</td><td style="padding:3px 0;line-height:1.5;">${(0, shell_1.escapeHtml)(v).replace(/\n/g, '<br>')}</td></tr>`).join('')}
      </table>` : ''}
      ${items.length ? `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#2F6F68;margin-bottom:6px;">Documents that would help</div>
      <ul style="margin:0 0 16px;padding-left:18px;font-size:13px;line-height:1.7;color:#0B1A12;">${items.map((i) => `<li>${(0, shell_1.escapeHtml)(i)}</li>`).join('')}</ul>` : ''}
      <p style="margin:0;font-size:13px;line-height:1.6;color:#43514D;">Upload whatever you have with the button below — photos from your phone are fine. The link is private to you and works for ${exports.UPLOAD_LINK_DAYS} days; no account needed.</p>`;
        await this.google.sendMail({
            to, replyTo: actor.id ? (await this.users.findOneBy({ id: actor.id }))?.email || undefined : undefined,
            subject: `Thank you — next steps for ${na(lead.leadName) || 'your project'}`,
            html: (0, shell_1.emailShell)({ brand, eyebrow: 'Welcome', title: `Hi ${(0, shell_1.escapeHtml)(first)},`, body, cta: { label: 'Upload your documents', url }, footer: `Sent by ${(0, shell_1.escapeHtml)(actor.name)} at ${(0, shell_1.escapeHtml)(brand.companyName)}.` }),
        });
        Object.assign(r, { welcomeSentAt: new Date().toISOString(), welcomeSentTo: to, welcomeSentBy: actor.name, welcomeSentById: actor.id || '', updatedAt: new Date().toISOString() });
        await this.files.save(r);
        return { ...(await this.status(leadId)), url };
    }
    async disable(leadId) {
        const r = await this.files.findOneBy({ leadId });
        if (r) {
            r.uploadNonce = '';
            r.uploadExpiresAt = '';
            await this.files.save(r);
        }
        return this.status(leadId);
    }
    async resolve(token) {
        const data = (0, crypto_util_1.readState)(String(token || ''), await this.settings.jwtSecret(), exports.UPLOAD_LINK_DAYS * DAY);
        if (!data || data.mode !== 'lead-upload' || typeof data.leadId !== 'string')
            throw new common_1.BadRequestException('This upload link isn’t valid or has expired — ask us for a new one.');
        const r = await this.files.findOneBy({ leadId: data.leadId });
        if (!r || !this.live(r) || r.uploadNonce !== data.n)
            throw new common_1.BadRequestException('This upload link has been replaced or turned off — ask us for a new one.');
        const lead = await this.leads.findOneBy({ id: data.leadId });
        if (!lead)
            throw new common_1.NotFoundException('Not found');
        return { r, lead };
    }
    async publicView(token) {
        const { r, lead } = await this.resolve(token);
        const brand = await (0, shell_1.loadEmailBrand)(this.settings);
        const mine = (0, task_types_1.normalizeAttachments)(r.attachments).filter((a) => a.stage === exports.CLIENT_UPLOAD_STAGE);
        return {
            company: brand.companyName, accent: brand.accent,
            project: na(lead.leadName) || 'your project', firstName: na(lead.goByName) || na(lead.firstName) || '',
            items: r.uploadItems || [], expiresAt: r.uploadExpiresAt,
            uploaded: mine.map((a) => ({ name: a.name, item: a.stageName === 'Uploaded by the client' ? '' : (a.stageName || '').replace(/^Client: /, ''), at: a.uploadedAt })),
        };
    }
    async publicUpload(token, files, item) {
        const { r, lead } = await this.resolve(token);
        if (!files?.length)
            throw new common_1.BadRequestException('Choose a file to upload.');
        const who = [na(lead.firstName), na(lead.lastName)].filter(Boolean).join(' ') || na(lead.leadName) || 'Client';
        const label = clean(item, 80);
        const added = (await this.attachments.upload(files, `Lead ${lead.id} - ${na(lead.leadName) || 'client'}`.slice(0, 100), { name: `${who} (client)` }))
            .map((a) => ({ ...a, stage: exports.CLIENT_UPLOAD_STAGE, stageName: label ? `Client: ${label}` : 'Uploaded by the client' }));
        const fresh = (await this.files.findOneBy({ leadId: lead.id })) || r;
        fresh.attachments = [...(0, task_types_1.normalizeAttachments)(fresh.attachments), ...added];
        fresh.updatedAt = new Date().toISOString();
        await this.files.save(fresh);
        void this.notify(fresh, lead, added.map((a) => a.name), label).catch((e) => this.log.warn('Upload notice not sent: ' + e.message));
        return this.publicView(token);
    }
    async notify(r, lead, names, item) {
        if (!r.welcomeSentById || !(await this.google.isConnected()))
            return;
        const user = await this.users.findOneBy({ id: r.welcomeSentById });
        if (!user?.email)
            return;
        const brand = await (0, shell_1.loadEmailBrand)(this.settings);
        const base = (await this.settings.baseUrl()) || '';
        await this.google.sendMail({
            to: user.email,
            subject: `${na(lead.leadName) || 'A client'} uploaded ${names.length} file${names.length === 1 ? '' : 's'}`,
            html: (0, shell_1.emailShell)({
                brand, eyebrow: 'Client upload', title: `${(0, shell_1.escapeHtml)(na(lead.leadName) || 'A client')} sent documents`,
                body: `<p style="margin:0 0 10px;font-size:13.5px;color:#43514D;">${item ? `For <b>${(0, shell_1.escapeHtml)(item)}</b>:` : 'New files:'}</p><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;">${names.map((n) => `<li>${(0, shell_1.escapeHtml)(n)}</li>`).join('')}</ul>`,
                cta: { label: 'Open the lead', url: `${base}/pipeline` }, footer: 'They’re in the lead’s Files tab, under “Uploaded by the client”.',
            }),
        });
    }
};
exports.ClientWelcomeService = ClientWelcomeService;
exports.ClientWelcomeService = ClientWelcomeService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.LeadFilesEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.LeadEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        attachments_service_1.AttachmentsService,
        google_service_1.GoogleService,
        settings_service_1.SettingsService])
], ClientWelcomeService);
//# sourceMappingURL=client-welcome.service.js.map