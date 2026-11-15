import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CommitmentEntity, ContractorEntity, CostEntryEntity, LienReleaseEntity, SubInvoiceEntity } from '../database/entities';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { newId, todayISO } from '../manpower/workforce.util';
import type { Actor } from '../manpower/manpower-access.service';
import { FinancialsService } from './financials.service';
import { fromCents, toCents } from './money';
import { DEFAULT_RETENTION_PCT, RELEASE_LABEL, invoiceFigures, isReleaseKind, payBlock, retentionBlock, unconditionalWaiting, type ReleaseLike } from './sub-invoices';

const now = () => new Date().toISOString();
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Sub invoices (Batch 6): the header (with its retention) over the lines a
 * sub billed through the portal, the lien releases they upload, the rule
 * that an invoice is paid only with a conditional release on file, and the
 * retention payout against a conditional final release.
 */
@Injectable()
export class SubInvoicesService {
  constructor(
    @InjectRepository(SubInvoiceEntity) private readonly invoices: Repository<SubInvoiceEntity>,
    @InjectRepository(LienReleaseEntity) private readonly releases: Repository<LienReleaseEntity>,
    @InjectRepository(CommitmentEntity) private readonly commitments: Repository<CommitmentEntity>,
    @InjectRepository(CostEntryEntity) private readonly entries: Repository<CostEntryEntity>,
    @InjectRepository(ContractorEntity) private readonly contractors: Repository<ContractorEntity>,
    private readonly fin: FinancialsService,
    @Optional() private readonly attachments?: AttachmentsService,
  ) {}

  /** The header for a portal batch, made on first sight (older batches have none): the subcontract's retention, else 10%. */
  async header(batchId: string, sample?: CostEntryEntity): Promise<SubInvoiceEntity | null> {
    const got = await this.invoices.findOneBy({ id: batchId });
    if (got) return got;
    const e = sample || (await this.entries.findOne({ where: { batchId } }));
    if (!e?.commitmentId || !e.contractorId) return null;
    const c = await this.commitments.findOneBy({ id: e.commitmentId });
    return this.invoices.save({ id: batchId, projectId: e.projectId, commitmentId: e.commitmentId, contractorId: e.contractorId, reference: e.reference || null, retentionPct: c?.retentionPct ?? DEFAULT_RETENTION_PCT, createdAt: now(), updatedAt: null });
  }

  private view(inv: SubInvoiceEntity, lines: CostEntryEntity[], rs: LienReleaseEntity[]) {
    const live = lines.filter((e) => e.status !== 'void');
    const f = invoiceFigures(live.map((e) => toCents(e.amount)), inv.retentionPct);
    const paid = live.length > 0 && live.every((e) => e.status === 'paid');
    const status = !live.length ? 'returned' : paid ? 'paid' : live.every((e) => e.status === 'approved' || e.status === 'paid') ? 'approved' : 'submitted';
    const mine = rs.filter((r) => r.invoiceId === inv.id);
    return {
      id: inv.id, reference: inv.reference, commitmentId: inv.commitmentId, contractorId: inv.contractorId, date: lines[0]?.date || null, status,
      gross: fromCents(f.grossC), retentionPct: f.pct, retention: fromCents(f.retentionC), net: fromCents(f.netC),
      lineIds: lines.map((e) => e.id), paidDate: live.find((e) => e.paidDate)?.paidDate || null,
      releases: mine.map((r) => ({ id: r.id, kind: r.kind, label: r.kind && isReleaseKind(r.kind) ? RELEASE_LABEL[r.kind] : 'Type not marked yet', name: r.file?.name, amount: r.amount, throughDate: r.throughDate, uploadedAt: r.uploadedAt, checked: !!r.checkedAt })),
      payBlock: paid ? null : payBlock(mine as ReleaseLike[]),
      waitingUnconditional: unconditionalWaiting(paid, mine as ReleaseLike[]),
    };
  }

  /** Every portal invoice on these subcontracts, with its figures and releases, and each subcontract's retention. */
  async forCommitments(cms: CommitmentEntity[]) {
    const ids = cms.map((c) => c.id);
    if (!ids.length) return { invoices: [], retention: [] };
    const lines = (await this.entries.find({ where: { commitmentId: In(ids) } })).filter((e) => e.batchId);
    const batches = [...new Set(lines.map((e) => e.batchId!))];
    const rs = await this.releases.find({ where: { commitmentId: In(ids) } });
    const out: ReturnType<SubInvoicesService["view"]>[] = [];
    for (const b of batches) {
      const mine = lines.filter((e) => e.batchId === b);
      const h = await this.header(b, mine[0]);
      if (h) out.push(this.view(h, mine, rs));
    }
    out.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const retention = cms.map((c) => {
      const heldC = out.filter((i) => i.commitmentId === c.id && i.status !== 'returned').reduce((a, i) => a + toCents(i.retention), 0);
      const finals = rs.filter((r) => r.commitmentId === c.id && !r.invoiceId);
      return {
        commitmentId: c.id, number: c.number, held: fromCents(heldC), paidDate: c.retentionPaidDate, paymentRef: c.retentionPaymentRef,
        block: retentionBlock(heldC, finals as ReleaseLike[], !!c.retentionPaidDate),
        waitingUnconditional: !!c.retentionPaidDate && !finals.some((r) => r.checkedAt && r.kind === 'unconditional_final'),
        releases: finals.map((r) => ({ id: r.id, kind: r.kind, label: r.kind && isReleaseKind(r.kind) ? RELEASE_LABEL[r.kind] : 'Type not marked yet', name: r.file?.name, checked: !!r.checkedAt, uploadedAt: r.uploadedAt })),
      };
    });
    return { invoices: out, retention };
  }

  // ------------------------------------------------------------ the sub (portal)
  async uploadRelease(contractor: ContractorEntity, where: { invoiceId?: string; commitmentId?: string }, files: any[], kind: string | undefined, uploader: UploadActor) {
    if (!files?.length) throw new BadRequestException('Pick the signed release (PDF or photo).');
    if (!this.attachments) throw new BadRequestException('File uploads aren’t set up.');
    let commitmentId: string; let projectId: number; let invoiceId: string | null = null;
    if (where.invoiceId) {
      const e = await this.entries.findOne({ where: { batchId: where.invoiceId } });
      if (!e || e.contractorId !== contractor.id) throw new NotFoundException('Invoice not found.');
      commitmentId = e.commitmentId!; projectId = e.projectId; invoiceId = where.invoiceId;
    } else {
      const c = await this.commitments.findOneBy({ id: String(where.commitmentId || '') });
      if (!c || c.contractorId !== contractor.id) throw new NotFoundException('Subcontract not found.');
      commitmentId = c.id; projectId = c.projectId;
    }
    const added = await this.attachments.upload(files.slice(0, 1), `Project ${projectId}`, uploader);
    // The sub may say which kind it is; the bookkeeper still checks it before it counts.
    await this.releases.save({ id: newId('LR'), projectId, commitmentId, contractorId: contractor.id, invoiceId, kind: isReleaseKind(kind) ? kind : null, amount: null, throughDate: null, file: added[0], uploadedBy: uploader.name, uploadedAt: now(), checkedBy: null, checkedAt: null });
  }

  // ------------------------------------------------------------ staff
  async forProject(projectId: number, actor: Actor) {
    const r = await this.fin.rights(actor);
    if (!r.viewProfitability && !r.manageCosts && !r.approveCosts) await this.fin.need(actor, 'viewProfitability');
    const cms = (await this.commitments.find({ where: { projectId } })).filter((c) => c.status !== 'draft' && c.status !== 'void');
    const names = new Map((await this.contractors.find()).map((k) => [k.id, k.companyName]));
    const res = await this.forCommitments(cms);
    return {
      invoices: res.invoices.map((i) => ({ ...i, vendorName: names.get(i.contractorId) || '', commitmentNumber: cms.find((c) => c.id === i.commitmentId)?.number })),
      retention: res.retention.filter((x) => x.held > 0 || x.releases.length || x.paidDate).map((x) => ({ ...x, vendorName: names.get(cms.find((c) => c.id === x.commitmentId)?.contractorId || '') || '' })),
    };
  }

  /** The bookkeeper marks what a release is (and its amount and through date); only then does it count. */
  async markRelease(id: string, dto: { kind?: string; amount?: number | string | null; throughDate?: string | null }, actor: Actor) {
    await this.fin.need(actor, 'approveCosts');
    const r = await this.releases.findOneBy({ id });
    if (!r) throw new NotFoundException('Release not found.');
    if (!isReleaseKind(dto.kind)) throw new BadRequestException('Pick which kind of release it is.');
    if (r.invoiceId && /final/.test(dto.kind)) { /* a final release sent with an invoice is allowed (last invoice) */ }
    if (dto.throughDate && !ISO.test(dto.throughDate)) throw new BadRequestException('Give the through date as a date.');
    Object.assign(r, { kind: dto.kind, amount: dto.amount == null || dto.amount === '' ? null : Number(dto.amount), throughDate: dto.throughDate || null, checkedBy: actor.name, checkedAt: now() });
    await this.releases.save(r);
    await this.fin.log(null, { projectId: r.projectId, entityType: 'cost', entityId: r.invoiceId || r.commitmentId, action: 'lien_release_checked', changes: { kind: { from: null, to: dto.kind } } }, actor);
    return r;
  }

  async setRetention(invoiceId: string, pct: number, actor: Actor) {
    await this.fin.need(actor, 'approveCosts');
    const h = await this.header(invoiceId);
    if (!h) throw new NotFoundException('Invoice not found.');
    const p = Number(pct);
    if (!Number.isFinite(p) || p < 0 || p > 50) throw new BadRequestException('Retention is a % from 0 to 50.');
    h.retentionPct = p; h.updatedAt = now();
    return this.invoices.save(h);
  }

  /** Pay out the retention held on a subcontract: only against a checked conditional final release. */
  async releaseRetention(commitmentId: string, dto: { paidDate?: string; paymentRef?: string }, actor: Actor) {
    await this.fin.need(actor, 'approveCosts');
    const c = await this.commitments.findOneBy({ id: commitmentId });
    if (!c) throw new NotFoundException('Subcontract not found.');
    const res = await this.forCommitments([c]);
    const r = res.retention[0];
    if (r.block) throw new BadRequestException(r.block);
    const d = dto.paidDate || todayISO();
    if (!ISO.test(d)) throw new BadRequestException('Give the payment date.');
    Object.assign(c, { retentionPaidDate: d, retentionPaymentRef: String(dto.paymentRef || '').trim().slice(0, 200) || null });
    await this.commitments.save(c);
    await this.fin.log(null, { projectId: c.projectId, entityType: 'commitment', entityId: c.id, action: 'retention_paid', changes: { retention: { from: null, to: r.held } } }, actor);
    return r;
  }

  /** Costs → "pay": a portal invoice line is paid only with a conditional release on file (Batch 6). */
  async assertPayable(e: CostEntryEntity) {
    if (!e.batchId || e.source !== 'portal') return;
    const rs = await this.releases.find({ where: { invoiceId: e.batchId } });
    const why = payBlock(rs as ReleaseLike[]);
    if (why) throw new BadRequestException(why);
  }

  async releaseFile(id: string) {
    const r = await this.releases.findOneBy({ id });
    if (!r) throw new NotFoundException('Release not found.');
    return r.file;
  }
}
