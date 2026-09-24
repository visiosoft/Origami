import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CommitmentEntity, CommitmentLineEntity, ContractorEntity, CostEntryEntity, ProjectEntity, ProjectPhaseEntity, ProjectTaskEntity, UserEntity,
} from '../database/entities';
import type { SessionClaims } from '../auth/crypto.util';
import { AuthService } from '../auth/auth.service';
import { PORTAL_ROLE } from '../auth/guards/roles.decorator';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
import { emailShell, escapeHtml, loadEmailBrand } from '../email/shell';
import { normalizeAttachments, subId, type TaskAttachment } from '../database/task.types';
import { newId, todayISO } from '../manpower/workforce.util';
import type { Actor } from '../manpower/manpower-access.service';
import { FinancialsService } from './financials.service';
import { fromCents, sumCents, toCents } from './money';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const now = () => new Date().toISOString();
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const fmtUsd = (c: number) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const LIVE = ['approved', 'closed'];

/** How one of the sub's bills reads to them. */
const statusFor = (e: CostEntryEntity) => (e.status === 'void' ? 'returned' : e.status === 'paid' ? 'paid' : e.status === 'approved' ? 'approved' : 'submitted');

/**
 * The subcontractor portal: a subcontractor's own subcontracts, milestones,
 * invoices and payments -- and nothing else. Every read and write is scoped
 * to the contractor linked to the signed-in portal account.
 */
@Injectable()
export class PortalService {
  private readonly log = new Logger('Portal');

  constructor(
    @InjectRepository(ContractorEntity) private readonly contractors: Repository<ContractorEntity>,
    @InjectRepository(CommitmentEntity) private readonly commitments: Repository<CommitmentEntity>,
    @InjectRepository(CommitmentLineEntity) private readonly lines: Repository<CommitmentLineEntity>,
    @InjectRepository(CostEntryEntity) private readonly entries: Repository<CostEntryEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(ProjectPhaseEntity) private readonly phases: Repository<ProjectPhaseEntity>,
    @InjectRepository(ProjectTaskEntity) private readonly tasks: Repository<ProjectTaskEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly fin: FinancialsService,
    private readonly auth: AuthService,
    private readonly settings: SettingsService,
    private readonly google?: GoogleService,
    private readonly attachments?: AttachmentsService,
  ) {}

  // ------------------------------------------------------------------ who is asking

  private async me(claims: SessionClaims | null) {
    if (!claims || claims.roleKey !== PORTAL_ROLE) throw new ForbiddenException('This is the subcontractor portal.');
    const contractor = await this.contractors.findOneBy({ userId: claims.sub });
    if (!contractor) throw new ForbiddenException('Your account isn’t linked to a subcontractor yet — ask your contact to check your portal access.');
    // Removing access ends an open session too, not just the next sign-in.
    if ((await this.users.findOneBy({ id: claims.sub }))?.status === 'suspended') throw new ForbiddenException('Your portal access has been removed.');
    return contractor;
  }

  private async mine(contractorId: string) {
    const cms = (await this.commitments.find({ where: { contractorId } })).filter((c) => LIVE.includes(c.status));
    const ids = cms.map((c) => c.id);
    const [ls, es, projects] = await Promise.all([
      ids.length ? this.lines.find({ where: { commitmentId: In(ids) } }) : Promise.resolve([] as CommitmentLineEntity[]),
      ids.length ? this.entries.find({ where: { commitmentId: In(ids) } }) : Promise.resolve([] as CostEntryEntity[]),
      this.projects.find(),
    ]);
    return { cms, ls, es, projectName: new Map(projects.map((p) => [p.id, p.name])) };
  }

  /** One subcontract's figures as the sub sees them: agreed, billed, approved, paid, and what's left per milestone. */
  private figures(c: CommitmentEntity, ls: CommitmentLineEntity[], es: CostEntryEntity[]) {
    const lines = ls.filter((l) => l.commitmentId === c.id).sort((a, b) => a.lineOrder - b.lineOrder);
    const bills = es.filter((e) => e.commitmentId === c.id && e.status !== 'void');
    const sum = (xs: CostEntryEntity[]) => sumCents(xs.map((e) => toCents(e.amount)));
    const committedC = sumCents(lines.map((l) => toCents(l.amount)));
    const billedC = sum(bills);
    const byLine = lines.map((l) => {
      const mine = bills.filter((e) => (l.taskId ? e.taskId === l.taskId : l.phaseId ? e.phaseId === l.phaseId : false));
      const amountC = toCents(l.amount);
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

  // ------------------------------------------------------------------ reading

  async overview(claims: SessionClaims | null) {
    const k = await this.me(claims);
    const { cms, ls, es, projectName } = await this.mine(k.id);
    const subcontracts = cms.map((c) => {
      const f = this.figures(c, ls, es);
      return {
        id: c.id, number: c.number, title: c.title, status: c.status, dateIssued: c.dateIssued, projectId: c.projectId, projectName: projectName.get(c.projectId) || `Project ${c.projectId}`,
        committed: fromCents(f.committedC), billed: fromCents(f.billedC), submitted: fromCents(f.submittedC), approved: fromCents(f.approvedC), paid: fromCents(f.paidC),
        toBePaid: fromCents(f.toBePaidC), remaining: fromCents(f.remainingC), milestones: f.lines.length, sharedFiles: normalizeAttachments(c.sharedAttachments).length,
      };
    }).sort((a, b) => a.projectName.localeCompare(b.projectName));
    const invoices = this.groupInvoices(es, cms, projectName);
    return {
      vendor: { name: k.companyName, contactPerson: k.contactPerson, email: k.email },
      subcontracts,
      totals: {
        committed: fromCents(sumCents(subcontracts.map((s) => toCents(s.committed)))), paid: fromCents(sumCents(subcontracts.map((s) => toCents(s.paid)))),
        awaitingApproval: fromCents(sumCents(subcontracts.map((s) => toCents(s.submitted)))), approvedUnpaid: fromCents(sumCents(subcontracts.map((s) => toCents(s.approved)))),
        toBePaid: fromCents(sumCents(subcontracts.map((s) => toCents(s.toBePaid)))),
      },
      recentInvoices: invoices.slice(0, 5),
    };
  }

  async subcontract(claims: SessionClaims | null, id: string) {
    const k = await this.me(claims);
    const { cms, ls, es, projectName } = await this.mine(k.id);
    const c = cms.find((x) => x.id === id);
    if (!c) throw new NotFoundException('Subcontract not found.');
    const f = this.figures(c, ls, es);
    const [phases, tasks] = await Promise.all([this.phases.find({ where: { projectId: c.projectId } }), this.tasks.find({ where: { projectId: c.projectId } })]);
    const done = (t: ProjectTaskEntity) => !!t.completed || t.status === 'Done';
    return {
      id: c.id, number: c.number, title: c.title, scope: c.scope, status: c.status, dateIssued: c.dateIssued, projectName: projectName.get(c.projectId) || `Project ${c.projectId}`,
      committed: fromCents(f.committedC), billed: fromCents(f.billedC), paid: fromCents(f.paidC), toBePaid: fromCents(f.toBePaidC), remaining: fromCents(f.remainingC),
      milestones: f.lines.map((l) => {
        const phase = l.phaseId ? phases.find((p) => p.id === l.phaseId) : undefined;
        // Progress: the milestone's own tasks on the Phase Board (sub-tasks excluded).
        const its = l.taskId ? tasks.filter((t) => t.id === l.taskId) : phase ? tasks.filter((t) => t.phaseId === phase.id && !t.parentId) : [];
        return {
          id: l.id, description: l.description, amount: fromCents(l.amountC), billed: fromCents(l.billedC), paid: fromCents(l.paidC), remaining: fromCents(l.remainingC),
          progress: its.length ? { done: its.filter(done).length, total: its.length } : null,
          tasks: its.sort((a, b) => (a.order || 0) - (b.order || 0)).map((t) => ({ id: t.id, title: t.title, status: done(t) ? 'Done' : t.status || 'Not started', notes: t.description || '' })),
        };
      }),
      files: normalizeAttachments(c.sharedAttachments).map((a) => ({ id: a.id, name: a.name, kind: a.kind, url: a.kind === 'link' ? a.url : undefined, uploadedAt: a.uploadedAt })),
      invoices: this.groupInvoices(es.filter((e) => e.commitmentId === c.id), [c], projectName),
    };
  }

  async invoices(claims: SessionClaims | null) {
    const k = await this.me(claims);
    const { cms, es, projectName } = await this.mine(k.id);
    return this.groupInvoices(es, cms, projectName);
  }

  /** Bills grouped the way the sub sent them: one invoice per batch (portal) or per invoice number. */
  private groupInvoices(es: CostEntryEntity[], cms: CommitmentEntity[], projectName: Map<number, string>) {
    const groups = new Map<string, CostEntryEntity[]>();
    for (const e of es) {
      const key = e.batchId || `${e.commitmentId}|${e.reference || e.id}`;
      (groups.get(key) || groups.set(key, []).get(key)!).push(e);
    }
    return Array.from(groups.entries()).map(([key, xs]) => {
      const c = cms.find((m) => m.id === xs[0].commitmentId);
      const live = xs.filter((e) => e.status !== 'void');
      const statuses = new Set(xs.map(statusFor));
      const status = statuses.size === 1 ? [...statuses][0] : statuses.has('submitted') ? 'submitted' : live.every((e) => e.status === 'paid') ? 'paid' : 'approved';
      const paid = xs.filter((e) => e.status === 'paid').sort((a, b) => (b.paidDate || '').localeCompare(a.paidDate || ''))[0];
      return {
        id: key, reference: xs[0].reference || '—', date: xs[0].date, subcontractId: c?.id, subcontractNumber: c?.number, projectName: c ? projectName.get(c.projectId) : undefined,
        total: fromCents(sumCents((live.length ? live : xs).map((e) => toCents(e.amount)))), status,
        lines: xs.map((e) => ({ id: e.id, description: e.description, amount: e.amount, status: statusFor(e), returnedReason: e.status === 'void' ? e.voidReason : undefined })),
        paidDate: paid?.paidDate, paymentRef: paid?.paymentRef, returnedReason: xs.find((e) => e.status === 'void')?.voidReason,
        fromPortal: xs.some((e) => e.source === 'portal'), submittedAt: xs[0].createdAt,
        files: xs.flatMap((e) => normalizeAttachments(e.attachments).map((a) => ({ id: a.id, entryId: e.id, name: a.name, kind: a.kind, url: a.kind === 'link' ? a.url : undefined }))),
      };
    }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.submittedAt || '').localeCompare(a.submittedAt || ''));
  }

  // ------------------------------------------------------------------ submitting an invoice

  async submit(claims: SessionClaims | null, dto: { subcontractId?: string; reference?: string; date?: string; note?: string; lines?: { milestoneId: string; amount: number | string }[] }) {
    const k = await this.me(claims);
    const { cms, ls, es } = await this.mine(k.id);
    const c = cms.find((x) => x.id === dto.subcontractId);
    if (!c) throw new BadRequestException('Choose one of your subcontracts.');
    if (c.status !== 'approved') throw new BadRequestException(`${c.number} is closed — it can’t take new invoices.`);
    const reference = String(dto.reference || '').trim();
    if (!reference) throw new BadRequestException('Enter your invoice number.');
    if (es.some((e) => e.commitmentId === c.id && e.status !== 'void' && (e.reference || '').toLowerCase() === reference.toLowerCase())) {
      throw new ConflictException(`Invoice ${reference} has already been sent on ${c.number}.`);
    }
    const date = dto.date || todayISO();
    if (!ISO.test(date)) throw new BadRequestException('Enter the invoice date.');
    const f = this.figures(c, ls, es);
    const picked = (dto.lines || []).map((l) => ({ line: f.lines.find((x) => x.id === l.milestoneId), amountC: toCents(l.amount as any) })).filter((p) => p.amountC);
    if (!picked.length) throw new BadRequestException('Enter an amount against at least one milestone.');
    for (const p of picked) {
      if (!p.line) throw new BadRequestException('That milestone isn’t on this subcontract.');
      if (p.amountC < 0) throw new BadRequestException('Amounts must be positive.');
      if (p.amountC > p.line.remainingC) throw new BadRequestException(`${p.line.description}: only ${fmtUsd(p.line.remainingC)} is left to invoice on it.`);
    }
    const batchId = newId('PB');
    const lineRows = ls.filter((l) => l.commitmentId === c.id);
    const note = String(dto.note || '').trim();
    const rows = picked.map((p) => {
      const line = lineRows.find((l) => l.id === p.line!.id)!;
      return this.entries.create({
        id: newId('CE'), projectId: c.projectId, date, dueDate: addDays(date, 30), type: 'subcontract_invoice', contractorId: k.id, vendorName: k.companyName,
        reference, commitmentId: c.id, csiCodeId: line.csiCodeId, phaseId: line.phaseId, taskId: line.taskId,
        description: `${reference} — ${line.description}`, amount: fromCents(p.amountC), status: 'recorded', notes: note || undefined, attachments: [],
        source: 'portal', batchId, submittedByUserId: claims!.sub, createdAt: now(), createdBy: `${k.companyName} (portal)`,
      } as Partial<CostEntryEntity>);
    });
    await this.entries.save(rows, { chunk: 40 });
    const actor: Actor = { name: `${k.companyName} (portal)`, id: claims!.sub };
    await this.fin.log(null, {
      projectId: c.projectId, entityType: 'cost', entityId: batchId, action: 'portal_invoice_submitted',
      changes: { invoice: { from: null, to: reference }, amount: { from: null, to: fromCents(sumCents(picked.map((p) => p.amountC))) } }, reason: note || undefined,
    }, actor);
    return { batchId, invoices: await this.invoices(claims) };
  }

  /** Attach the invoice PDF (or other backup) to a batch the sub submitted -- stored on its first line. */
  async attachToInvoice(claims: SessionClaims | null, batchId: string, files: any[], uploader: UploadActor) {
    const k = await this.me(claims);
    const rows = (await this.entries.find({ where: { batchId } })).filter((e) => e.contractorId === k.id).sort((a, b) => a.id.localeCompare(b.id));
    if (!rows.length) throw new NotFoundException('Invoice not found.');
    const first = rows[0];
    const added = await this.attachments!.upload(files, `Project ${first.projectId}`, uploader);
    first.attachments = [...normalizeAttachments(first.attachments), ...added];
    await this.entries.save(first);
    return this.invoices(claims);
  }

  /** A file the sub may open: one on their own bill, or one shared on their subcontract. */
  async file(claims: SessionClaims | null, where: { entryId?: string; subcontractId?: string }, attId: string) {
    const k = await this.me(claims);
    if (where.entryId) {
      const e = await this.entries.findOneBy({ id: where.entryId });
      if (!e || e.contractorId !== k.id) throw new NotFoundException('File not found.');
      const att = normalizeAttachments(e.attachments).find((a) => a.id === attId);
      if (!att) throw new NotFoundException('File not found.');
      return att;
    }
    const c = await this.commitments.findOneBy({ id: where.subcontractId });
    if (!c || c.contractorId !== k.id || !LIVE.includes(c.status)) throw new NotFoundException('File not found.');
    const att = normalizeAttachments(c.sharedAttachments).find((a) => a.id === attId);
    if (!att) throw new NotFoundException('File not found.');
    return att;
  }

  // ------------------------------------------------------------------ staff: portal access

  async access(contractorId: string, actor: Actor) {
    await this.fin.need(actor, 'manageCosts');
    const k = await this.contractors.findOneBy({ id: contractorId });
    if (!k) throw new NotFoundException('Contractor not found');
    const u = k.userId ? await this.users.findOneBy({ id: k.userId }) : null;
    return {
      contractorId: k.id, email: u?.email || k.email || '', status: !u ? 'none' : u.status === 'suspended' ? 'removed' : u.passwordHash || u.googleId ? 'active' : 'invited',
      invitedAt: u?.inviteSentAt, lastLogin: u?.lastLogin,
    };
  }

  /** Create (or re-send) the portal login for a contractor and email the set-password link. */
  async invite(contractorId: string, dto: { email?: string; name?: string }, actor: Actor) {
    await this.fin.need(actor, 'manageCosts');
    const k = await this.contractors.findOneBy({ id: contractorId });
    if (!k) throw new NotFoundException('Contractor not found');
    const email = String(dto.email || k.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new BadRequestException('Enter the email address they’ll sign in with.');
    let user = k.userId ? await this.users.findOneBy({ id: k.userId }) : null;
    const clash = (await this.users.find()).find((u) => u.email.trim().toLowerCase() === email && u.id !== user?.id);
    if (clash && clash.roleKey !== PORTAL_ROLE) throw new ConflictException(`${email} already has an account in the app — use a different email for the portal.`);
    if (clash && clash.roleKey === PORTAL_ROLE && !user) {
      const owner = await this.contractors.findOneBy({ userId: clash.id });
      if (owner && owner.id !== k.id) throw new ConflictException(`${email} is already the portal login for ${owner.companyName}.`);
      user = clash;
    }
    if (!user) {
      user = this.users.create({
        id: `U-V${Date.now().toString(36).toUpperCase()}`, name: String(dto.name || k.contactPerson || k.companyName).trim(), email, tier: 'consultant', roleKey: PORTAL_ROLE,
        status: 'pending', createdAt: todayISO(),
      } as Partial<UserEntity>);
    } else {
      Object.assign(user, { email, roleKey: PORTAL_ROLE, tier: 'consultant', status: user.passwordHash || user.googleId ? 'active' : 'pending' });
    }
    user = await this.users.save(user);
    if (k.userId !== user.id) { k.userId = user.id; k.updatedAt = now(); await this.contractors.save(k); }
    const invite = await this.auth.sendInvite(user, user.passwordHash ? 'reset' : 'invite');
    await this.fin.log(null, { projectId: 0, entityType: 'contractor', entityId: k.id, action: 'portal_invited', changes: { email: { from: null, to: email } } }, actor);
    return { ...(await this.access(contractorId, actor)), invite };
  }

  async revoke(contractorId: string, actor: Actor) {
    await this.fin.need(actor, 'manageCosts');
    const k = await this.contractors.findOneBy({ id: contractorId });
    if (!k?.userId) throw new BadRequestException('This contractor has no portal access.');
    await this.users.update({ id: k.userId }, { status: 'suspended' });
    await this.fin.log(null, { projectId: 0, entityType: 'contractor', entityId: k.id, action: 'portal_removed' }, actor);
    return this.access(contractorId, actor);
  }

  // ------------------------------------------------------------------ staff: files shared with the sub

  private async commitment(id: string) {
    const c = await this.commitments.findOneBy({ id });
    if (!c) throw new NotFoundException('Subcontract not found');
    return c;
  }
  async addAttachments(id: string, files: any[], actor: UploadActor) {
    const c = await this.commitment(id);
    c.sharedAttachments = [...normalizeAttachments(c.sharedAttachments), ...(await this.attachments!.upload(files, `Project ${c.projectId}`, actor))];
    await this.commitments.save(c);
    return normalizeAttachments(c.sharedAttachments);
  }
  async addLink(id: string, name: string, url: string, actor: UploadActor) {
    const c = await this.commitment(id);
    const att: TaskAttachment = { id: subId('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: now() };
    c.sharedAttachments = [...normalizeAttachments(c.sharedAttachments), att];
    await this.commitments.save(c);
    return normalizeAttachments(c.sharedAttachments);
  }
  async removeAttachment(id: string, attId: string) {
    const c = await this.commitment(id);
    const all = normalizeAttachments(c.sharedAttachments);
    const target = all.find((a) => a.id === attId);
    if (!target) throw new NotFoundException('Attachment not found');
    await this.attachments!.discard(target);
    c.sharedAttachments = all.filter((a) => a.id !== attId);
    await this.commitments.save(c);
    return c.sharedAttachments;
  }
  async attachment(id: string, attId: string) {
    const att = normalizeAttachments((await this.commitment(id)).sharedAttachments).find((a) => a.id === attId);
    if (!att) throw new NotFoundException('Attachment not found');
    return att;
  }

  // ------------------------------------------------------------------ emails to the sub

  /**
   * Tell the subcontractor when an invoice they submitted moves on: approved,
   * paid, or returned. One email per invoice, sent once every line of it has
   * reached the same state (so a three-line invoice doesn't send three).
   */
  async notifyStatus(entry: CostEntryEntity) {
    try {
      if (!entry.contractorId || !this.google) return;
      const k = await this.contractors.findOneBy({ id: entry.contractorId });
      const user = k?.userId ? await this.users.findOneBy({ id: k.userId }) : null;
      if (!k || !user || user.status === 'suspended') return;
      const batch = entry.batchId ? await this.entries.find({ where: { batchId: entry.batchId } }) : [entry];
      if (!batch.every((e) => e.status === entry.status)) return;
      const project = await this.projects.findOneBy({ id: entry.projectId });
      const total = fromCents(sumCents(batch.map((e) => toCents(e.amount))));
      const brand = await loadEmailBrand(this.settings);
      const base = await this.settings.baseUrl();
      const ref = escapeHtml(entry.reference || 'your invoice');
      const words = entry.status === 'paid'
        ? { subject: `Paid: ${entry.reference || 'your invoice'}`, title: `${ref} has been paid`, body: `We've paid <b>${escapeHtml('$' + total.toLocaleString('en-US', { minimumFractionDigits: 2 }))}</b> for ${ref} on ${escapeHtml(project?.name || 'the project')}${entry.paymentRef ? ` (reference ${escapeHtml(entry.paymentRef)})` : ''}.` }
        : entry.status === 'approved'
          ? { subject: `Approved: ${entry.reference || 'your invoice'}`, title: `${ref} is approved`, body: `Your invoice ${ref} for ${escapeHtml(project?.name || 'the project')} has been approved and is now waiting for payment.` }
          : entry.status === 'void'
            ? { subject: `Returned: ${entry.reference || 'your invoice'}`, title: `${ref} was returned`, body: `Your invoice ${ref} for ${escapeHtml(project?.name || 'the project')} was returned: <i>${escapeHtml(entry.voidReason || '')}</i>. You can correct it and send it again from the portal.` }
            : null;
      if (!words) return;
      await this.google.sendMail({
        to: user.email, subject: words.subject,
        html: emailShell({
          brand, eyebrow: 'Subcontractor portal', title: words.title,
          body: `<p style="margin:0;font-size:14px;line-height:1.65;color:#43514D;">${words.body}</p>`,
          cta: base ? { label: 'Open the portal', url: `${base}/portal` } : undefined,
          footer: `You're receiving this because you submit invoices to ${escapeHtml(brand.companyName)} through the subcontractor portal.`,
        }),
      });
    } catch (e) {
      this.log.warn(`Could not email the subcontractor about ${entry.id}: ${(e as Error).message}`);
    }
  }
}
