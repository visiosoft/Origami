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
exports.ProposalService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const settings_service_1 = require("../settings/settings.service");
const pipeline_service_1 = require("../pipeline/pipeline.service");
const crypto_util_1 = require("../auth/crypto.util");
const SIGN_LINK_MAX_AGE_MS = 10 * 24 * 60 * 60_000;
let ProposalService = class ProposalService {
    constructor(repo, deals, settings, pipeline) {
        this.repo = repo;
        this.deals = deals;
        this.settings = settings;
        this.pipeline = pipeline;
        this.log = new common_1.Logger('ProposalService');
    }
    async get(dealId) {
        if (!dealId)
            throw new common_1.BadRequestException('Which deal?');
        const row = await this.repo.findOneBy({ dealId });
        const deal = await this.deals.findOneBy({ id: dealId });
        return {
            dealId,
            dealName: deal?.name || '',
            subject: row?.subject || `Proposal — ${deal?.name || ''}`.trim(),
            html: row?.html || '',
            amount: row?.amount || deal?.value || '',
            updatedAt: row?.updatedAt || '',
            updatedBy: row?.updatedBy || '',
            sentAt: row?.sentAt || '',
            sentTo: row?.sentTo || '',
            signedAt: row?.signedAt || '',
            signedByName: row?.signedByName || '',
            signedByEmail: row?.signedByEmail || '',
            signatureImage: row?.signatureImage || '',
        };
    }
    async save(dealId, body, actor) {
        if (!dealId)
            throw new common_1.BadRequestException('Which deal?');
        if (!(await this.deals.findOneBy({ id: dealId })))
            throw new common_1.BadRequestException(`Deal ${dealId} not found`);
        const existing = await this.repo.findOneBy({ dealId });
        const row = existing || this.repo.create({ dealId });
        row.subject = body.subject || row.subject || '';
        row.html = body.html || '';
        row.amount = body.amount || row.amount || '';
        row.updatedAt = new Date().toISOString();
        row.updatedBy = actor?.name || 'System';
        await this.repo.save(row);
        return this.get(dealId);
    }
    async signingLink(dealId) {
        const secret = await this.settings.jwtSecret();
        const base = (await this.settings.baseUrl()) || '';
        const token = (0, crypto_util_1.signState)({ mode: 'proposal-sign', dealId }, secret);
        return `${base}/sign-proposal?token=${encodeURIComponent(token)}`;
    }
    async markSent(dealId, to, actor) {
        const row = await this.repo.findOneBy({ dealId });
        if (!row)
            return;
        row.sentAt = new Date().toISOString();
        row.sentTo = to || '';
        row.updatedBy = actor?.name || row.updatedBy || 'System';
        await this.repo.save(row);
    }
    async readToken(token) {
        const secret = await this.settings.jwtSecret();
        const parsed = (0, crypto_util_1.readState)(token, secret, SIGN_LINK_MAX_AGE_MS);
        if (!parsed || parsed.mode !== 'proposal-sign' || typeof parsed.dealId !== 'string')
            return null;
        return { dealId: parsed.dealId };
    }
    async getByToken(token) {
        const parsed = await this.readToken(token);
        if (!parsed)
            throw new common_1.ForbiddenException('This link has expired or is no longer valid. Ask your project contact to resend it.');
        return this.get(parsed.dealId);
    }
    async signByToken(token, signer, image, meta) {
        const parsed = await this.readToken(token);
        if (!parsed)
            throw new common_1.ForbiddenException('This link has expired or is no longer valid. Ask your project contact to resend it.');
        if (!signer.name?.trim())
            throw new common_1.BadRequestException('Type your name to certify the signature.');
        if (!image?.trim())
            throw new common_1.BadRequestException('Draw your signature before submitting.');
        const row = await this.repo.findOneBy({ dealId: parsed.dealId });
        if (!row)
            throw new common_1.BadRequestException('There is nothing to sign yet.');
        row.signedAt = new Date().toISOString();
        row.signedByName = signer.name.trim();
        row.signedByEmail = (signer.email || '').trim();
        row.signatureImage = image;
        row.signerIp = meta.ip || '';
        row.signerUserAgent = meta.userAgent || '';
        await this.repo.save(row);
        const actor = { name: `${row.signedByName} (e-signature)` };
        try {
            await this.pipeline.updateStage(parsed.dealId, 'client_approval', actor);
            await this.deals.update(parsed.dealId, { status: 'accepted' });
        }
        catch (err) {
            this.log.warn(`Post-signature stage move for deal ${parsed.dealId}: ${err.message}`);
        }
        return this.get(parsed.dealId);
    }
};
exports.ProposalService = ProposalService;
exports.ProposalService = ProposalService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ProposalEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.DealEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        settings_service_1.SettingsService,
        pipeline_service_1.PipelineService])
], ProposalService);
//# sourceMappingURL=proposal.service.js.map