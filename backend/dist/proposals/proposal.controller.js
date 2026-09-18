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
exports.ProposalController = void 0;
const common_1 = require("@nestjs/common");
const proposal_service_1 = require("./proposal.service");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const public_decorator_1 = require("../auth/guards/public.decorator");
const google_service_1 = require("../google/google.service");
const settings_service_1 = require("../settings/settings.service");
const letterhead_1 = require("../documents/letterhead");
let ProposalController = class ProposalController {
    constructor(service, google, settings) {
        this.service = service;
        this.google = google;
        this.settings = settings;
    }
    get(dealId) {
        return this.service.get(dealId);
    }
    save(body, req) {
        return this.service.save(body?.dealId, body, { id: req.claims?.sub, name: req.claims?.name });
    }
    async pdf(body, res) {
        const { pdf, filename } = await this.renderPdf(body.subject, body.html || '', body.amount, body.dealName);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        return res.end(pdf);
    }
    async send(body, req) {
        const doc = await this.service.get(body.dealId);
        const link = await this.service.signingLink(body.dealId);
        const { pdf, filename } = await this.renderPdf(doc.subject, doc.html, doc.amount, doc.dealName);
        const attachments = [{ filename, mimeType: 'application/pdf', content: pdf }];
        for (const f of body.extraAttachments || []) {
            if (!f?.filename || !f?.contentBase64)
                continue;
            attachments.push({ filename: f.filename, mimeType: f.mimeType || 'application/octet-stream', content: Buffer.from(f.contentBase64, 'base64') });
        }
        const noteBody = [
            `<p>Hi${doc.dealName ? ` ${doc.dealName}` : ''},</p>`,
            `<p>Attached is <strong>${doc.subject}</strong>${doc.amount ? ` (proposed amount: ${doc.amount})` : ''} for your review.</p>`,
            `<p><a href="${link}" style="display:inline-block;padding:11px 22px;border-radius:999px;background:#173326;color:#ffffff;text-decoration:none;font-weight:700;">Review and sign the proposal</a></p>`,
            `<p style="color:#7E9B93;font-size:12px;">This link is valid for 10 days. No account needed to sign.</p>`,
        ].join('\n');
        await this.google.sendMail({
            to: body.to,
            cc: body.cc,
            subject: doc.subject,
            html: noteBody,
            attachments,
        });
        await this.service.markSent(body.dealId, body.to, { id: req.claims?.sub, name: req.claims?.name });
        return { ok: true, to: body.to, link, attachmentCount: attachments.length };
    }
    async renderPdf(subject, docHtml, amount, dealName) {
        const brand = (0, letterhead_1.brandingFrom)(await this.settings.getMany(letterhead_1.BRAND_KEYS));
        const bodyWithAmount = [
            amount ? `<p><strong>Proposed contract amount:</strong> ${amount}</p>` : '',
            docHtml || '',
        ].filter(Boolean).join('\n');
        const html = (0, letterhead_1.buildLetterHtml)({ brand, title: subject, recipient: dealName, date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), body: bodyWithAmount });
        const filename = (0, letterhead_1.safeFilename)(subject || 'Document') + '.pdf';
        const pdf = await this.google.htmlToPdf(html, (0, letterhead_1.safeFilename)(subject || 'Document'));
        return { pdf, filename: `${filename}` };
    }
    getByToken(token) {
        return this.service.getByToken(token);
    }
    async pdfByToken(token, res) {
        const doc = await this.service.getByToken(token);
        const signedDate = doc.signedAt
            ? new Date(doc.signedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            : '____________________';
        const clientSignature = doc.signatureImage
            ? `<img src="${doc.signatureImage}" alt="Signature of ${doc.signedByName}" style="max-width:220px;height:auto;display:block;margin-bottom:4px;" />`
            : '__________________________________';
        const merged = String(doc.html || '')
            .replace(/\{\{clientSignature\}\}/g, clientSignature)
            .replace(/\{\{signedDate\}\}/g, signedDate);
        const { pdf, filename } = await this.renderPdf(doc.subject, merged, doc.amount, doc.dealName);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        return res.end(pdf);
    }
    signByToken(body, req) {
        return this.service.signByToken(body?.token, { name: body?.name, email: body?.email || '' }, body?.image, { ip: req.ip || '', userAgent: String(req.headers['user-agent'] || '') });
    }
};
exports.ProposalController = ProposalController;
__decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('dealId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProposalController.prototype, "get", null);
__decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Put)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ProposalController.prototype, "save", null);
__decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Post)('pdf'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProposalController.prototype, "pdf", null);
__decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Post)('send'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProposalController.prototype, "send", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('public'),
    __param(0, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProposalController.prototype, "getByToken", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('public/pdf'),
    __param(0, (0, common_1.Query)('token')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProposalController.prototype, "pdfByToken", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('public/sign'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ProposalController.prototype, "signByToken", null);
exports.ProposalController = ProposalController = __decorate([
    (0, common_1.Controller)('proposals'),
    __metadata("design:paramtypes", [proposal_service_1.ProposalService,
        google_service_1.GoogleService,
        settings_service_1.SettingsService])
], ProposalController);
//# sourceMappingURL=proposal.controller.js.map