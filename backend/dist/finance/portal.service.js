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
exports.PortalService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const auth_service_1 = require("../auth/auth.service");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const attachments_service_1 = require("../google/attachments.service");
const google_service_1 = require("../google/google.service");
const settings_service_1 = require("../settings/settings.service");
const shell_1 = require("../email/shell");
const task_types_1 = require("../database/task.types");
const workforce_util_1 = require("../manpower/workforce.util");
const financials_service_1 = require("./financials.service");
const money_1 = require("./money");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const now = () => new Date().toISOString();
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const fmtUsd = (c) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const LIVE = ['approved', 'closed'];
const statusFor = (e) => (e.status === 'void' ? 'returned' : e.status === 'paid' ? 'paid' : e.status === 'approved' ? 'approved' : 'submitted');
let PortalService = class PortalService {
    constructor(contractors, commitments, lines, entries, projects, phases, tasks, users, fin, auth, settings, google, attachments) {
        this.contractors = contractors;
        this.commitments = commitments;
        this.lines = lines;
        this.entries = entries;
        this.projects = projects;
        this.phases = phases;
        this.tasks = tasks;
        this.users = users;
        this.fin = fin;
        this.auth = auth;
        this.settings = settings;
        this.google = google;
        this.attachments = attachments;
        this.log = new common_1.Logger('Portal');
    }
    async me(claims) {
        if (!claims || claims.roleKey !== roles_decorator_1.PORTAL_ROLE)
            throw new common_1.ForbiddenException('This is the subcontractor portal.');
        const contractor = await this.contractors.findOneBy({ userId: claims.sub });
        if (!contractor)
            throw new common_1.ForbiddenException('Your account isn’t linked to a subcontractor yet — ask your contact to check your portal access.');
        if ((await this.users.findOneBy({ id: claims.sub }))?.status === 'suspended')
            throw new common_1.ForbiddenException('Your portal access has been removed.');
        return contractor;
    }
    async mine(contractorId) {
        const cms = (await this.commitments.find({ where: { contractorId } })).filter((c) => LIVE.includes(c.status));
        const ids = cms.map((c) => c.id);
        const [ls, es, projects] = await Promise.all([
            ids.length ? this.lines.find({ where: { commitmentId: (0, typeorm_2.In)(ids) } }) : Promise.resolve([]),
            ids.length ? this.entries.find({ where: { commitmentId: (0, typeorm_2.In)(ids) } }) : Promise.resolve([]),
            this.projects.find(),
        ]);
        return { cms, ls, es, projectName: new Map(projects.map((p) => [p.id, p.name])) };
    }
    figures(c, ls, es) {
        const lines = ls.filter((l) => l.commitmentId === c.id).sort((a, b) => a.lineOrder - b.lineOrder);
        const bills = es.filter((e) => e.commitmentId === c.id && e.status !== 'void');
        const sum = (xs) => (0, money_1.sumCents)(xs.map((e) => (0, money_1.toCents)(e.amount)));
        const committedC = (0, money_1.sumCents)(lines.map((l) => (0, money_1.toCents)(l.amount)));
        const billedC = sum(bills);
        const byLine = lines.map((l) => {
            const mine = bills.filter((e) => (l.taskId ? e.taskId === l.taskId : l.phaseId ? e.phaseId === l.phaseId : false));
            const amountC = (0, money_1.toCents)(l.amount);
            const lineBilledC = sum(mine);
            return {
                id: l.id, description: l.description, phaseId: l.phaseId || null, taskId: l.taskId || null,
                amountC, billedC: lineBilledC, paidC: sum(mine.filter((e) => e.status === 'paid')), remainingC: Math.max(amountC - lineBilledC, 0),
            };
        });
        return {
            committedC, billedC, submittedC: sum(bills.filter((e) => e.status === 'recorded')), approvedC: sum(bills.filter((e) => e.status === 'approved')),
            paidC: sum(bills.filter((e) => e.status === 'paid')), toBePaidC: Math.max(committedC - sum(bills.filter((e) => e.status === 'paid')), 0),
            remainingC: c.status === 'approved' ? Math.max(committedC - billedC, 0) : 0, lines: byLine,
        };
    }
    async overview(claims) {
        const k = await this.me(claims);
        const { cms, ls, es, projectName } = await this.mine(k.id);
        const subcontracts = cms.map((c) => {
            const f = this.figures(c, ls, es);
            return {
                id: c.id, number: c.number, title: c.title, status: c.status, dateIssued: c.dateIssued, projectId: c.projectId, projectName: projectName.get(c.projectId) || `Project ${c.projectId}`,
                committed: (0, money_1.fromCents)(f.committedC), billed: (0, money_1.fromCents)(f.billedC), submitted: (0, money_1.fromCents)(f.submittedC), approved: (0, money_1.fromCents)(f.approvedC), paid: (0, money_1.fromCents)(f.paidC),
                toBePaid: (0, money_1.fromCents)(f.toBePaidC), remaining: (0, money_1.fromCents)(f.remainingC), milestones: f.lines.length, sharedFiles: (0, task_types_1.normalizeAttachments)(c.sharedAttachments).length,
            };
        }).sort((a, b) => a.projectName.localeCompare(b.projectName));
        const invoices = this.groupInvoices(es, cms, projectName);
        return {
            vendor: { name: k.companyName, contactPerson: k.contactPerson, email: k.email },
            subcontracts,
            totals: {
                committed: (0, money_1.fromCents)((0, money_1.sumCents)(subcontracts.map((s) => (0, money_1.toCents)(s.committed)))), paid: (0, money_1.fromCents)((0, money_1.sumCents)(subcontracts.map((s) => (0, money_1.toCents)(s.paid)))),
                awaitingApproval: (0, money_1.fromCents)((0, money_1.sumCents)(subcontracts.map((s) => (0, money_1.toCents)(s.submitted)))), approvedUnpaid: (0, money_1.fromCents)((0, money_1.sumCents)(subcontracts.map((s) => (0, money_1.toCents)(s.approved)))),
                toBePaid: (0, money_1.fromCents)((0, money_1.sumCents)(subcontracts.map((s) => (0, money_1.toCents)(s.toBePaid)))),
            },
            recentInvoices: invoices.slice(0, 5),
        };
    }
    async subcontract(claims, id) {
        const k = await this.me(claims);
        const { cms, ls, es, projectName } = await this.mine(k.id);
        const c = cms.find((x) => x.id === id);
        if (!c)
            throw new common_1.NotFoundException('Subcontract not found.');
        const f = this.figures(c, ls, es);
        const [phases, tasks] = await Promise.all([this.phases.find({ where: { projectId: c.projectId } }), this.tasks.find({ where: { projectId: c.projectId } })]);
        const done = (t) => !!t.completed || t.status === 'Done';
        return {
            id: c.id, number: c.number, title: c.title, scope: c.scope, status: c.status, dateIssued: c.dateIssued, projectName: projectName.get(c.projectId) || `Project ${c.projectId}`,
            committed: (0, money_1.fromCents)(f.committedC), billed: (0, money_1.fromCents)(f.billedC), paid: (0, money_1.fromCents)(f.paidC), toBePaid: (0, money_1.fromCents)(f.toBePaidC), remaining: (0, money_1.fromCents)(f.remainingC),
            milestones: f.lines.map((l) => {
                const phase = l.phaseId ? phases.find((p) => p.id === l.phaseId) : undefined;
                const its = l.taskId ? tasks.filter((t) => t.id === l.taskId) : phase ? tasks.filter((t) => t.phaseId === phase.id && !t.parentId) : [];
                return {
                    id: l.id, description: l.description, amount: (0, money_1.fromCents)(l.amountC), billed: (0, money_1.fromCents)(l.billedC), paid: (0, money_1.fromCents)(l.paidC), remaining: (0, money_1.fromCents)(l.remainingC),
                    progress: its.length ? { done: its.filter(done).length, total: its.length } : null,
                    tasks: its.sort((a, b) => (a.order || 0) - (b.order || 0)).map((t) => ({ id: t.id, title: t.title, status: done(t) ? 'Done' : t.status || 'Not started', notes: t.description || '' })),
                };
            }),
            files: (0, task_types_1.normalizeAttachments)(c.sharedAttachments).map((a) => ({ id: a.id, name: a.name, kind: a.kind, url: a.kind === 'link' ? a.url : undefined, uploadedAt: a.uploadedAt })),
            invoices: this.groupInvoices(es.filter((e) => e.commitmentId === c.id), [c], projectName),
        };
    }
    async invoices(claims) {
        const k = await this.me(claims);
        const { cms, es, projectName } = await this.mine(k.id);
        return this.groupInvoices(es, cms, projectName);
    }
    groupInvoices(es, cms, projectName) {
        const groups = new Map();
        for (const e of es) {
            const key = e.batchId || `${e.commitmentId}|${e.reference || e.id}`;
            (groups.get(key) || groups.set(key, []).get(key)).push(e);
        }
        return Array.from(groups.entries()).map(([key, xs]) => {
            const c = cms.find((m) => m.id === xs[0].commitmentId);
            const live = xs.filter((e) => e.status !== 'void');
            const statuses = new Set(xs.map(statusFor));
            const status = statuses.size === 1 ? [...statuses][0] : statuses.has('submitted') ? 'submitted' : live.every((e) => e.status === 'paid') ? 'paid' : 'approved';
            const paid = xs.filter((e) => e.status === 'paid').sort((a, b) => (b.paidDate || '').localeCompare(a.paidDate || ''))[0];
            return {
                id: key, reference: xs[0].reference || '—', date: xs[0].date, subcontractId: c?.id, subcontractNumber: c?.number, projectName: c ? projectName.get(c.projectId) : undefined,
                total: (0, money_1.fromCents)((0, money_1.sumCents)((live.length ? live : xs).map((e) => (0, money_1.toCents)(e.amount)))), status,
                lines: xs.map((e) => ({ id: e.id, description: e.description, amount: e.amount, status: statusFor(e), returnedReason: e.status === 'void' ? e.voidReason : undefined })),
                paidDate: paid?.paidDate, paymentRef: paid?.paymentRef, returnedReason: xs.find((e) => e.status === 'void')?.voidReason,
                fromPortal: xs.some((e) => e.source === 'portal'), submittedAt: xs[0].createdAt,
                files: xs.flatMap((e) => (0, task_types_1.normalizeAttachments)(e.attachments).map((a) => ({ id: a.id, entryId: e.id, name: a.name, kind: a.kind, url: a.kind === 'link' ? a.url : undefined }))),
            };
        }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.submittedAt || '').localeCompare(a.submittedAt || ''));
    }
    async submit(claims, dto) {
        const k = await this.me(claims);
        const { cms, ls, es } = await this.mine(k.id);
        const c = cms.find((x) => x.id === dto.subcontractId);
        if (!c)
            throw new common_1.BadRequestException('Choose one of your subcontracts.');
        if (c.status !== 'approved')
            throw new common_1.BadRequestException(`${c.number} is closed — it can’t take new invoices.`);
        const reference = String(dto.reference || '').trim();
        if (!reference)
            throw new common_1.BadRequestException('Enter your invoice number.');
        if (es.some((e) => e.commitmentId === c.id && e.status !== 'void' && (e.reference || '').toLowerCase() === reference.toLowerCase())) {
            throw new common_1.ConflictException(`Invoice ${reference} has already been sent on ${c.number}.`);
        }
        const date = dto.date || (0, workforce_util_1.todayISO)();
        if (!ISO.test(date))
            throw new common_1.BadRequestException('Enter the invoice date.');
        const f = this.figures(c, ls, es);
        const picked = (dto.lines || []).map((l) => ({ line: f.lines.find((x) => x.id === l.milestoneId), amountC: (0, money_1.toCents)(l.amount) })).filter((p) => p.amountC);
        if (!picked.length)
            throw new common_1.BadRequestException('Enter an amount against at least one milestone.');
        for (const p of picked) {
            if (!p.line)
                throw new common_1.BadRequestException('That milestone isn’t on this subcontract.');
            if (p.amountC < 0)
                throw new common_1.BadRequestException('Amounts must be positive.');
            if (p.amountC > p.line.remainingC)
                throw new common_1.BadRequestException(`${p.line.description}: only ${fmtUsd(p.line.remainingC)} is left to invoice on it.`);
        }
        const batchId = (0, workforce_util_1.newId)('PB');
        const lineRows = ls.filter((l) => l.commitmentId === c.id);
        const note = String(dto.note || '').trim();
        const rows = picked.map((p) => {
            const line = lineRows.find((l) => l.id === p.line.id);
            return this.entries.create({
                id: (0, workforce_util_1.newId)('CE'), projectId: c.projectId, date, dueDate: addDays(date, 30), type: 'subcontract_invoice', contractorId: k.id, vendorName: k.companyName,
                reference, commitmentId: c.id, csiCodeId: line.csiCodeId, phaseId: line.phaseId, taskId: line.taskId,
                description: `${reference} — ${line.description}`, amount: (0, money_1.fromCents)(p.amountC), status: 'recorded', notes: note || undefined, attachments: [],
                source: 'portal', batchId, submittedByUserId: claims.sub, createdAt: now(), createdBy: `${k.companyName} (portal)`,
            });
        });
        await this.entries.save(rows, { chunk: 40 });
        const actor = { name: `${k.companyName} (portal)`, id: claims.sub };
        await this.fin.log(null, {
            projectId: c.projectId, entityType: 'cost', entityId: batchId, action: 'portal_invoice_submitted',
            changes: { invoice: { from: null, to: reference }, amount: { from: null, to: (0, money_1.fromCents)((0, money_1.sumCents)(picked.map((p) => p.amountC))) } }, reason: note || undefined,
        }, actor);
        return { batchId, invoices: await this.invoices(claims) };
    }
    async attachToInvoice(claims, batchId, files, uploader) {
        const k = await this.me(claims);
        const rows = (await this.entries.find({ where: { batchId } })).filter((e) => e.contractorId === k.id).sort((a, b) => a.id.localeCompare(b.id));
        if (!rows.length)
            throw new common_1.NotFoundException('Invoice not found.');
        const first = rows[0];
        const added = await this.attachments.upload(files, `Project ${first.projectId}`, uploader);
        first.attachments = [...(0, task_types_1.normalizeAttachments)(first.attachments), ...added];
        await this.entries.save(first);
        return this.invoices(claims);
    }
    async file(claims, where, attId) {
        const k = await this.me(claims);
        if (where.entryId) {
            const e = await this.entries.findOneBy({ id: where.entryId });
            if (!e || e.contractorId !== k.id)
                throw new common_1.NotFoundException('File not found.');
            const att = (0, task_types_1.normalizeAttachments)(e.attachments).find((a) => a.id === attId);
            if (!att)
                throw new common_1.NotFoundException('File not found.');
            return att;
        }
        const c = await this.commitments.findOneBy({ id: where.subcontractId });
        if (!c || c.contractorId !== k.id || !LIVE.includes(c.status))
            throw new common_1.NotFoundException('File not found.');
        const att = (0, task_types_1.normalizeAttachments)(c.sharedAttachments).find((a) => a.id === attId);
        if (!att)
            throw new common_1.NotFoundException('File not found.');
        return att;
    }
    async access(contractorId, actor) {
        await this.fin.need(actor, 'manageCosts');
        const k = await this.contractors.findOneBy({ id: contractorId });
        if (!k)
            throw new common_1.NotFoundException('Contractor not found');
        const u = k.userId ? await this.users.findOneBy({ id: k.userId }) : null;
        return {
            contractorId: k.id, email: u?.email || k.email || '', status: !u ? 'none' : u.status === 'suspended' ? 'removed' : u.passwordHash || u.googleId ? 'active' : 'invited',
            invitedAt: u?.inviteSentAt, lastLogin: u?.lastLogin,
        };
    }
    async invite(contractorId, dto, actor) {
        await this.fin.need(actor, 'manageCosts');
        const k = await this.contractors.findOneBy({ id: contractorId });
        if (!k)
            throw new common_1.NotFoundException('Contractor not found');
        const email = String(dto.email || k.email || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
            throw new common_1.BadRequestException('Enter the email address they’ll sign in with.');
        let user = k.userId ? await this.users.findOneBy({ id: k.userId }) : null;
        const clash = (await this.users.find()).find((u) => u.email.trim().toLowerCase() === email && u.id !== user?.id);
        if (clash && clash.roleKey !== roles_decorator_1.PORTAL_ROLE)
            throw new common_1.ConflictException(`${email} already has an account in the app — use a different email for the portal.`);
        if (clash && clash.roleKey === roles_decorator_1.PORTAL_ROLE && !user) {
            const owner = await this.contractors.findOneBy({ userId: clash.id });
            if (owner && owner.id !== k.id)
                throw new common_1.ConflictException(`${email} is already the portal login for ${owner.companyName}.`);
            user = clash;
        }
        if (!user) {
            user = this.users.create({
                id: `U-V${Date.now().toString(36).toUpperCase()}`, name: String(dto.name || k.contactPerson || k.companyName).trim(), email, tier: 'consultant', roleKey: roles_decorator_1.PORTAL_ROLE,
                status: 'pending', createdAt: (0, workforce_util_1.todayISO)(),
            });
        }
        else {
            Object.assign(user, { email, roleKey: roles_decorator_1.PORTAL_ROLE, tier: 'consultant', status: user.passwordHash || user.googleId ? 'active' : 'pending' });
        }
        user = await this.users.save(user);
        if (k.userId !== user.id) {
            k.userId = user.id;
            k.updatedAt = now();
            await this.contractors.save(k);
        }
        const invite = await this.auth.sendInvite(user, user.passwordHash ? 'reset' : 'invite');
        await this.fin.log(null, { projectId: 0, entityType: 'contractor', entityId: k.id, action: 'portal_invited', changes: { email: { from: null, to: email } } }, actor);
        return { ...(await this.access(contractorId, actor)), invite };
    }
    async revoke(contractorId, actor) {
        await this.fin.need(actor, 'manageCosts');
        const k = await this.contractors.findOneBy({ id: contractorId });
        if (!k?.userId)
            throw new common_1.BadRequestException('This contractor has no portal access.');
        await this.users.update({ id: k.userId }, { status: 'suspended' });
        await this.fin.log(null, { projectId: 0, entityType: 'contractor', entityId: k.id, action: 'portal_removed' }, actor);
        return this.access(contractorId, actor);
    }
    async commitment(id) {
        const c = await this.commitments.findOneBy({ id });
        if (!c)
            throw new common_1.NotFoundException('Subcontract not found');
        return c;
    }
    async addAttachments(id, files, actor) {
        const c = await this.commitment(id);
        c.sharedAttachments = [...(0, task_types_1.normalizeAttachments)(c.sharedAttachments), ...(await this.attachments.upload(files, `Project ${c.projectId}`, actor))];
        await this.commitments.save(c);
        return (0, task_types_1.normalizeAttachments)(c.sharedAttachments);
    }
    async addLink(id, name, url, actor) {
        const c = await this.commitment(id);
        const att = { id: (0, task_types_1.subId)('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: now() };
        c.sharedAttachments = [...(0, task_types_1.normalizeAttachments)(c.sharedAttachments), att];
        await this.commitments.save(c);
        return (0, task_types_1.normalizeAttachments)(c.sharedAttachments);
    }
    async removeAttachment(id, attId) {
        const c = await this.commitment(id);
        const all = (0, task_types_1.normalizeAttachments)(c.sharedAttachments);
        const target = all.find((a) => a.id === attId);
        if (!target)
            throw new common_1.NotFoundException('Attachment not found');
        await this.attachments.discard(target);
        c.sharedAttachments = all.filter((a) => a.id !== attId);
        await this.commitments.save(c);
        return c.sharedAttachments;
    }
    async attachment(id, attId) {
        const att = (0, task_types_1.normalizeAttachments)((await this.commitment(id)).sharedAttachments).find((a) => a.id === attId);
        if (!att)
            throw new common_1.NotFoundException('Attachment not found');
        return att;
    }
    async notifyStatus(entry) {
        try {
            if (!entry.contractorId || !this.google)
                return;
            const k = await this.contractors.findOneBy({ id: entry.contractorId });
            const user = k?.userId ? await this.users.findOneBy({ id: k.userId }) : null;
            if (!k || !user || user.status === 'suspended')
                return;
            const batch = entry.batchId ? await this.entries.find({ where: { batchId: entry.batchId } }) : [entry];
            if (!batch.every((e) => e.status === entry.status))
                return;
            const project = await this.projects.findOneBy({ id: entry.projectId });
            const total = (0, money_1.fromCents)((0, money_1.sumCents)(batch.map((e) => (0, money_1.toCents)(e.amount))));
            const brand = await (0, shell_1.loadEmailBrand)(this.settings);
            const base = await this.settings.baseUrl();
            const ref = (0, shell_1.escapeHtml)(entry.reference || 'your invoice');
            const words = entry.status === 'paid'
                ? { subject: `Paid: ${entry.reference || 'your invoice'}`, title: `${ref} has been paid`, body: `We've paid <b>${(0, shell_1.escapeHtml)('$' + total.toLocaleString('en-US', { minimumFractionDigits: 2 }))}</b> for ${ref} on ${(0, shell_1.escapeHtml)(project?.name || 'the project')}${entry.paymentRef ? ` (reference ${(0, shell_1.escapeHtml)(entry.paymentRef)})` : ''}.` }
                : entry.status === 'approved'
                    ? { subject: `Approved: ${entry.reference || 'your invoice'}`, title: `${ref} is approved`, body: `Your invoice ${ref} for ${(0, shell_1.escapeHtml)(project?.name || 'the project')} has been approved and is now waiting for payment.` }
                    : entry.status === 'void'
                        ? { subject: `Returned: ${entry.reference || 'your invoice'}`, title: `${ref} was returned`, body: `Your invoice ${ref} for ${(0, shell_1.escapeHtml)(project?.name || 'the project')} was returned: <i>${(0, shell_1.escapeHtml)(entry.voidReason || '')}</i>. You can correct it and send it again from the portal.` }
                        : null;
            if (!words)
                return;
            await this.google.sendMail({
                to: user.email, subject: words.subject,
                html: (0, shell_1.emailShell)({
                    brand, eyebrow: 'Subcontractor portal', title: words.title,
                    body: `<p style="margin:0;font-size:14px;line-height:1.65;color:#43514D;">${words.body}</p>`,
                    cta: base ? { label: 'Open the portal', url: `${base}/portal` } : undefined,
                    footer: `You're receiving this because you submit invoices to ${(0, shell_1.escapeHtml)(brand.companyName)} through the subcontractor portal.`,
                }),
            });
        }
        catch (e) {
            this.log.warn(`Could not email the subcontractor about ${entry.id}: ${e.message}`);
        }
    }
};
exports.PortalService = PortalService;
exports.PortalService = PortalService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ContractorEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.CommitmentEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.CommitmentLineEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.CostEntryEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __param(5, (0, typeorm_1.InjectRepository)(entities_1.ProjectPhaseEntity)),
    __param(6, (0, typeorm_1.InjectRepository)(entities_1.ProjectTaskEntity)),
    __param(7, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        financials_service_1.FinancialsService,
        auth_service_1.AuthService,
        settings_service_1.SettingsService,
        google_service_1.GoogleService,
        attachments_service_1.AttachmentsService])
], PortalService);
//# sourceMappingURL=portal.service.js.map