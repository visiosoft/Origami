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
exports.RfisService = exports.RFI_MODULE = void 0;
exports.addWorkingDays = addWorkingDays;
exports.cleanContact = cleanContact;
exports.ballInCourt = ballInCourt;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const attachments_service_1 = require("../google/attachments.service");
const google_service_1 = require("../google/google.service");
const task_types_1 = require("../database/task.types");
const manpower_access_service_1 = require("../manpower/manpower-access.service");
const workforce_util_1 = require("../manpower/workforce.util");
const settings_service_1 = require("../settings/settings.service");
const shell_1 = require("../email/shell");
const rfi_document_1 = require("./rfi.document");
exports.RFI_MODULE = 'rfis';
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
function addWorkingDays(from, n) {
    const d = new Date(`${from}T12:00:00Z`);
    let left = n;
    while (left > 0) {
        d.setUTCDate(d.getUTCDate() + 1);
        const w = d.getUTCDay();
        if (w !== 0 && w !== 6)
            left--;
    }
    return d.toISOString().slice(0, 10);
}
const EDITABLE = ['subject', 'question', 'suggestion', 'discipline', 'specSection', 'drawingRef', 'priority', 'dateDue',
    'costImpact', 'costAmount', 'scheduleImpact', 'scheduleDays', 'answer', 'answeredBy', 'dateAnswered'];
const cleanText = (v, max = 20000) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
const cleanEmail = (v) => { const e = String(v ?? '').replace(/[\r\n]/g, '').trim(); return EMAIL.test(e) ? e : ''; };
function cleanContact(c) {
    if (!c)
        return null;
    const name = cleanText(c.name, 200);
    const email = cleanEmail(c.email);
    if (!name && !email)
        return null;
    return { name: name || email, ...(email ? { email } : {}), ...(c.company ? { company: cleanText(c.company, 200) } : {}), ...(Number(c.personId) ? { personId: Number(c.personId) } : {}) };
}
const cleanDrawings = (list) => (Array.isArray(list) ? list : []).map((d) => ({ fileId: String(d?.fileId || '').slice(0, 100), name: cleanText(d?.name, 300) })).filter((d) => d.fileId && d.name).slice(0, 30);
function ballInCourt(r) {
    if (r.status === 'open')
        return r.to?.name || 'Recipient';
    if (r.status === 'draft' || r.status === 'answered')
        return r.ownerName || 'Us';
    return '';
}
let RfisService = class RfisService {
    constructor(repo, projects, users, access, google, settings, attachments) {
        this.repo = repo;
        this.projects = projects;
        this.users = users;
        this.access = access;
        this.google = google;
        this.settings = settings;
        this.attachments = attachments;
        this.log = new common_1.Logger('RfisService');
    }
    async rights(actor) {
        const manage = await this.access.can(actor, exports.RFI_MODULE, 'manage');
        const view = manage || (await this.access.can(actor, exports.RFI_MODULE, 'view'));
        return { view, manage };
    }
    async need(actor, what) {
        const r = await this.rights(actor);
        if (!r[what])
            throw new common_1.ForbiddenException(what === 'view' ? "Your role doesn't include RFIs." : "Your role doesn't allow changing RFIs.");
    }
    shape(r) {
        return { ...r, attachments: (0, task_types_1.normalizeAttachments)(r.attachments), history: r.history || [], ballInCourt: ballInCourt(r) };
    }
    async list(actor, projectId) {
        await this.need(actor, 'view');
        const rows = await this.repo.find({ where: projectId ? { projectId } : {}, order: { createdAt: 'DESC' } });
        const names = new Map((await this.projects.find()).map((p) => [Number(p.id), p.name]));
        return rows.map((r) => ({ ...this.shape(r), projectName: names.get(Number(r.projectId)) || `Project ${r.projectId}` }));
    }
    async load(id) {
        const r = await this.repo.findOneBy({ id });
        if (!r)
            throw new common_1.NotFoundException('RFI not found');
        return r;
    }
    async get(id, actor) {
        await this.need(actor, 'view');
        const r = await this.load(id);
        const p = await this.projects.findOneBy({ id: r.projectId });
        return { ...this.shape(r), projectName: p?.name || `Project ${r.projectId}` };
    }
    event(r, actor, action, note) {
        const e = { at: now(), by: actor.name, action, ...(note ? { note } : {}) };
        r.history = [...(r.history || []), e];
    }
    async projectFrom(dto) {
        const id = Number(dto.projectId);
        let p = Number.isFinite(id) && id > 0 ? await this.projects.findOneBy({ id }) : null;
        const ref = cleanText(dto.projectName ?? dto.project, 300);
        if (!p && ref) {
            const all = await this.projects.find();
            p = all.find((x) => x.leadId === ref) || all.find((x) => x.name.trim().toLowerCase() === ref.toLowerCase()) || null;
        }
        if (!p)
            throw new common_1.BadRequestException('Which project is this RFI for?');
        return p;
    }
    async nextNumber(projectId) {
        const rows = await this.repo.find({ where: { projectId } });
        const max = rows.reduce((m, r) => Math.max(m, Number(String(r.number).split('-').pop()) || 0), 0);
        return `RFI-${String(max + 1).padStart(3, '0')}`;
    }
    async create(dto, actor) {
        await this.need(actor, 'manage');
        const project = await this.projectFrom(dto || {});
        const subject = cleanText(dto.subject, 300);
        if (!subject)
            throw new common_1.BadRequestException('Give the RFI a subject.');
        const owner = (dto.ownerId && (await this.users.findOneBy({ id: String(dto.ownerId) }))) || (actor.id ? await this.users.findOneBy({ id: actor.id }) : null);
        let saved = null;
        for (let attempt = 0; attempt < 3 && !saved; attempt++) {
            const r = this.repo.create({
                id: (0, workforce_util_1.newId)('RFI'), projectId: project.id, number: await this.nextNumber(project.id), subject, status: 'draft',
                question: cleanText(dto.question), suggestion: cleanText(dto.suggestion),
                discipline: rfi_document_1.RFI_DISCIPLINES.includes(dto.discipline) ? dto.discipline : undefined,
                specSection: cleanText(dto.specSection, 100) || undefined, drawingRef: cleanText(dto.drawingRef, 300) || undefined,
                drawings: cleanDrawings(dto.drawings), to: cleanContact(dto.to), cc: (Array.isArray(dto.cc) ? dto.cc : []).map(cleanContact).filter(Boolean),
                ownerId: owner?.id, ownerName: owner?.name || actor.name, priority: ['Low', 'Medium', 'High'].includes(dto.priority) ? dto.priority : 'Medium',
                dateDue: ISO.test(dto.dateDue || '') ? dto.dateDue : undefined,
                sourceTaskId: cleanText(dto.sourceTaskId, 100) || undefined, sourceTaskType: dto.sourceTaskType === 'log' ? 'log' : dto.sourceTaskId ? 'board' : undefined,
                attachments: [], history: [], createdAt: now(), createdBy: actor.name, updatedAt: now(), updatedBy: actor.name,
            });
            this.event(r, actor, dto.sourceTaskId ? 'created from a task' : 'created');
            try {
                saved = await this.repo.save(r);
            }
            catch (e) {
                if (attempt === 2)
                    throw e;
            }
        }
        return this.get(saved.id, actor);
    }
    async applyFields(r, dto, actor) {
        for (const k of EDITABLE) {
            if (!(k in (dto || {})))
                continue;
            const v = dto[k];
            if (k === 'subject') {
                const s = cleanText(v, 300);
                if (!s)
                    throw new common_1.BadRequestException('The subject can’t be empty.');
                r.subject = s;
            }
            else if (k === 'discipline')
                r.discipline = rfi_document_1.RFI_DISCIPLINES.includes(v) ? v : '';
            else if (k === 'priority')
                r.priority = ['Low', 'Medium', 'High'].includes(v) ? v : 'Medium';
            else if (k === 'dateDue' || k === 'dateAnswered')
                r[k] = ISO.test(v || '') ? v : '';
            else if (k === 'costImpact' || k === 'scheduleImpact')
                r[k] = ['none', 'yes', 'tbd'].includes(v) ? v : '';
            else if (k === 'costAmount')
                r.costAmount = v === '' || v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100;
            else if (k === 'scheduleDays')
                r.scheduleDays = v === '' || v == null || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.round(Number(v)));
            else
                r[k] = cleanText(v, k === 'question' || k === 'suggestion' || k === 'answer' ? 20000 : 300);
        }
        if ('to' in (dto || {}))
            r.to = cleanContact(dto.to);
        if ('cc' in (dto || {}))
            r.cc = (Array.isArray(dto.cc) ? dto.cc : []).map(cleanContact).filter(Boolean);
        if ('drawings' in (dto || {}))
            r.drawings = cleanDrawings(dto.drawings);
        if ('ownerId' in (dto || {})) {
            const owner = dto.ownerId ? await this.users.findOneBy({ id: String(dto.ownerId) }) : null;
            r.ownerId = owner?.id || '';
            r.ownerName = owner?.name || '';
        }
        if ('changeOrderId' in (dto || {})) {
            r.changeOrderId = cleanText(dto.changeOrderId, 100);
            r.changeOrderNumber = cleanText(dto.changeOrderNumber, 50);
            if (r.changeOrderNumber)
                this.event(r, actor, `linked to change order ${r.changeOrderNumber}`);
        }
    }
    async update(id, dto, actor) {
        await this.need(actor, 'manage');
        const r = await this.load(id);
        if (r.status === 'closed' || r.status === 'void')
            throw new common_1.BadRequestException(`${r.number} is ${r.status} — reopen it to make changes.`);
        await this.applyFields(r, dto, actor);
        r.updatedAt = now();
        r.updatedBy = actor.name;
        await this.repo.save(r);
        return this.get(id, actor);
    }
    async pdf(id, actor) {
        await this.need(actor, 'view');
        const r = await this.load(id);
        const project = await this.projects.findOneBy({ id: r.projectId });
        const brand = await (0, shell_1.loadEmailBrand)(this.settings);
        const buffer = await this.google.htmlToPdf((0, rfi_document_1.rfiDocumentHtml)(r, { name: project?.name || '', location: project?.location }, brand.companyName), r.number);
        return { buffer, filename: `${r.number} ${r.subject}`.replace(/[^\w\- ]+/g, '').slice(0, 80) + '.pdf' };
    }
    async send(id, dto, actor) {
        await this.need(actor, 'manage');
        const r = await this.load(id);
        if (r.status !== 'draft' && r.status !== 'open')
            throw new common_1.BadRequestException(`${r.number} is ${r.status} — only a draft or an open RFI can be sent.`);
        if (!r.to?.email)
            throw new common_1.BadRequestException('Add who it goes to, with an email address.');
        if (!r.question?.trim())
            throw new common_1.BadRequestException('Write the question first.');
        if (!(await this.google.isConnected()))
            throw new common_1.BadRequestException('No Google account is connected for sending mail (Settings → Integrations).');
        const first = r.status === 'draft';
        if (first) {
            r.dateSent = today();
            if (!r.dateDue)
                r.dateDue = addWorkingDays(r.dateSent, 7);
            r.status = 'open';
        }
        const project = await this.projects.findOneBy({ id: r.projectId });
        const brand = await (0, shell_1.loadEmailBrand)(this.settings);
        const owner = r.ownerId ? await this.users.findOneBy({ id: r.ownerId }) : null;
        let attachments = [];
        try {
            const pdf = await this.google.htmlToPdf((0, rfi_document_1.rfiDocumentHtml)(r, { name: project?.name || '', location: project?.location }, brand.companyName), r.number);
            attachments = [{ filename: `${r.number}.pdf`, mimeType: 'application/pdf', content: pdf }];
        }
        catch (err) {
            this.log.warn(`${r.number} PDF not attached: ${err.message}`);
        }
        const cc = [...(r.cc || []).map((c) => c.email).filter(Boolean), owner?.email].filter((e, i, a) => e && e !== r.to.email && a.indexOf(e) === i);
        await this.google.sendMail({
            to: r.to.email,
            cc: cc.join(', ') || undefined,
            replyTo: owner?.email || undefined,
            subject: `${r.number}: ${r.subject} — ${project?.name || ''}`.trim(),
            html: (0, shell_1.emailShell)({ brand, eyebrow: `Request for Information · ${r.number}`, title: `Hi ${(r.to.name || '').split(/\s+/)[0] || 'there'},`, body: (0, rfi_document_1.rfiEmailBody)(r, { name: project?.name || '' }, cleanText(dto?.note, 4000)), footer: `Sent by ${owner?.name || actor.name} at ${brand.companyName}. Reply to this email with your answer.` }),
            attachments,
        });
        this.event(r, actor, first ? `sent to ${r.to.name}` : `re-sent to ${r.to.name}`, cleanText(dto?.note, 500) || undefined);
        r.updatedAt = now();
        r.updatedBy = actor.name;
        await this.repo.save(r);
        return this.get(id, actor);
    }
    async markSent(id, actor) {
        await this.need(actor, 'manage');
        const r = await this.load(id);
        if (r.status !== 'draft')
            throw new common_1.BadRequestException(`${r.number} has already been sent.`);
        r.status = 'open';
        r.dateSent = today();
        if (!r.dateDue)
            r.dateDue = addWorkingDays(r.dateSent, 7);
        this.event(r, actor, 'marked as sent');
        r.updatedAt = now();
        r.updatedBy = actor.name;
        await this.repo.save(r);
        return this.get(id, actor);
    }
    async answer(id, dto, actor) {
        await this.need(actor, 'manage');
        const r = await this.load(id);
        if (r.status !== 'open' && r.status !== 'draft' && r.status !== 'answered')
            throw new common_1.BadRequestException(`${r.number} is ${r.status}.`);
        const text = cleanText(dto?.answer);
        if (!text)
            throw new common_1.BadRequestException('Paste or type the answer.');
        const { costImpact, costAmount, scheduleImpact, scheduleDays } = dto || {};
        await this.applyFields(r, Object.fromEntries(Object.entries({ costImpact, costAmount, scheduleImpact, scheduleDays }).filter(([, v]) => v !== undefined)), actor);
        r.answer = text;
        r.answeredBy = cleanText(dto.answeredBy, 200) || r.to?.name || '';
        r.dateAnswered = ISO.test(dto.dateAnswered || '') ? dto.dateAnswered : today();
        if (!r.dateSent)
            r.dateSent = r.dateAnswered;
        const first = r.status !== 'answered';
        r.status = 'answered';
        this.event(r, actor, first ? `answer recorded${r.answeredBy ? ` (from ${r.answeredBy})` : ''}` : 'answer updated');
        r.updatedAt = now();
        r.updatedBy = actor.name;
        await this.repo.save(r);
        return this.get(id, actor);
    }
    async close(id, dto, actor) {
        await this.need(actor, 'manage');
        const r = await this.load(id);
        if (r.status === 'closed' || r.status === 'void')
            return this.get(id, actor);
        if (r.status === 'draft')
            throw new common_1.BadRequestException('Send it (or void it) before closing.');
        r.status = 'closed';
        r.dateClosed = today();
        this.event(r, actor, 'closed', cleanText(dto?.note, 500) || undefined);
        r.updatedAt = now();
        r.updatedBy = actor.name;
        await this.repo.save(r);
        return this.get(id, actor);
    }
    async reopen(id, actor) {
        await this.need(actor, 'manage');
        const r = await this.load(id);
        if (r.status !== 'closed' && r.status !== 'void')
            return this.get(id, actor);
        r.status = r.answer ? 'answered' : r.dateSent ? 'open' : 'draft';
        r.dateClosed = '';
        r.voidReason = '';
        this.event(r, actor, 'reopened');
        r.updatedAt = now();
        r.updatedBy = actor.name;
        await this.repo.save(r);
        return this.get(id, actor);
    }
    async void(id, dto, actor) {
        await this.need(actor, 'manage');
        const r = await this.load(id);
        const reason = cleanText(dto?.reason, 1000);
        if (!reason)
            throw new common_1.BadRequestException('Say why it’s being voided.');
        if (r.status === 'void')
            return this.get(id, actor);
        r.status = 'void';
        r.voidReason = reason;
        this.event(r, actor, 'voided', reason);
        r.updatedAt = now();
        r.updatedBy = actor.name;
        await this.repo.save(r);
        return this.get(id, actor);
    }
    async remove(id, actor) {
        await this.need(actor, 'manage');
        const r = await this.load(id);
        if (r.status !== 'draft' || r.dateSent)
            throw new common_1.BadRequestException(`${r.number} has been sent — void it instead.`);
        for (const a of (0, task_types_1.normalizeAttachments)(r.attachments))
            await this.attachments?.discard(a).catch(() => undefined);
        await this.repo.remove(r);
        return { id, deleted: true };
    }
    async addAttachments(id, files, actor) {
        const r = await this.load(id);
        const added = await this.attachments.upload(files, `Project ${r.projectId}`, actor);
        r.attachments = [...(0, task_types_1.normalizeAttachments)(r.attachments), ...added];
        await this.repo.save(r);
        return (0, task_types_1.normalizeAttachments)(r.attachments);
    }
    async addLink(id, name, url, actor) {
        const r = await this.load(id);
        const att = { id: (0, task_types_1.subId)('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: now() };
        r.attachments = [...(0, task_types_1.normalizeAttachments)(r.attachments), att];
        await this.repo.save(r);
        return (0, task_types_1.normalizeAttachments)(r.attachments);
    }
    async removeAttachment(id, attId) {
        const r = await this.load(id);
        const all = (0, task_types_1.normalizeAttachments)(r.attachments);
        const target = all.find((a) => a.id === attId);
        if (!target)
            throw new common_1.NotFoundException('Attachment not found');
        await this.attachments.discard(target);
        r.attachments = all.filter((a) => a.id !== attId);
        await this.repo.save(r);
        return r.attachments;
    }
    async attachment(id, attId) {
        const att = (0, task_types_1.normalizeAttachments)((await this.load(id)).attachments).find((a) => a.id === attId);
        if (!att)
            throw new common_1.NotFoundException('Attachment not found');
        return att;
    }
};
exports.RfisService = RfisService;
exports.RfisService = RfisService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.RfiEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        manpower_access_service_1.ManpowerAccess,
        google_service_1.GoogleService,
        settings_service_1.SettingsService,
        attachments_service_1.AttachmentsService])
], RfisService);
//# sourceMappingURL=rfis.service.js.map