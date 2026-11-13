import { prequalBlock } from '../manpower/prequal';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { readState, signState } from '../auth/crypto.util';
import { BidInviteEntity, BidPackageEntity, ContractorBidEntity, ContractorEntity, CsiCodeEntity } from '../database/entities';
import { emailShell, escapeHtml, loadEmailBrand } from '../email/shell';
import { GoogleService } from '../google/google.service';
import type { Actor } from '../manpower/manpower-access.service';
import { newId, todayISO } from '../manpower/workforce.util';
import { SettingsService } from '../settings/settings.service';
import { viewButton } from './change-orders.service';
import { autoStrategy, NOTE_LABEL } from './estimate.calc';
import { EstimatesService } from './estimates.service';
import { FinancialsService } from './financials.service';

const LINK_DAYS = 90;
const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;
const now = () => new Date().toISOString();
type Content = BidPackageEntity['content'];

/**
 * The package as a sub sees it: only the allow-listed fields of the snapshot
 * and their own invite. Nothing about our costs, markup, prices or other subs.
 */
export function subView(pkg: BidPackageEntity, inv: BidInviteEntity, projectName: string, companyName: string) {
  return {
    companyName, projectName, number: pkg.number, title: pkg.title, dueDate: pkg.dueDate, notes: pkg.notes, closed: pkg.status === 'closed',
    scopes: pkg.content.scopes.map((s) => ({
      key: s.key, title: s.title, csi: s.csi,
      lines: s.lines.map((l) => ({ key: l.key, description: l.description })),
      notes: s.notes.map((n) => ({ kind: n.kind, label: NOTE_LABEL[n.kind as keyof typeof NOTE_LABEL] || n.kind, text: n.text })),
    })),
    invite: { vendorName: inv.vendorName, status: inv.status, total: inv.total, lineAmounts: inv.lineAmounts || {}, notes: inv.notes, submittedAt: inv.submittedAt },
  };
}

/** Bid leveling: per line, each sub's price; per sub, their total (given, or the sum of their lines). */
export function leveling(pkg: BidPackageEntity, invites: BidInviteEntity[]) {
  const priced = invites.filter((i) => i.status === 'submitted' || i.status === 'awarded' || i.status === 'not_awarded');
  const totalOf = (i: BidInviteEntity) => (i.total != null ? Number(i.total) : Object.values(i.lineAmounts || {}).reduce((a, n) => a + (Number(n) || 0), 0));
  const totals = priced.map((i) => ({ inviteId: i.id, vendorName: i.vendorName, total: totalOf(i) }));
  const low = totals.length ? Math.min(...totals.map((t) => t.total)) : null;
  return {
    subs: totals.map((t) => ({ ...t, lowest: t.total === low })),
    rows: pkg.content.scopes.flatMap((s) => s.lines.map((l) => ({ scope: s.title, key: l.key, description: l.description, prices: Object.fromEntries(priced.map((i) => [i.id, i.lineAmounts?.[l.key] ?? null])) }))),
  };
}

@Injectable()
export class BidPackagesService {
  constructor(
    private readonly estimates: EstimatesService,
    private readonly fin: FinancialsService,
    private readonly settings: SettingsService,
    private readonly google: GoogleService,
    @InjectRepository(BidPackageEntity) private readonly packages: Repository<BidPackageEntity>,
    @InjectRepository(BidInviteEntity) private readonly invites: Repository<BidInviteEntity>,
    @InjectRepository(ContractorBidEntity) private readonly bids: Repository<ContractorBidEntity>,
    @InjectRepository(ContractorEntity) private readonly contractors: Repository<ContractorEntity>,
    @InjectRepository(CsiCodeEntity) private readonly csi: Repository<CsiCodeEntity>,
  ) {}

  private async pkg(projectId: number, id: string) {
    const p = await this.packages.findOne({ where: { id } });
    if (!p || p.projectId !== projectId) throw new NotFoundException('Bid package not found.');
    return p;
  }

  /** The packages for an estimate number, each with its invites and the leveling table. */
  async list(projectId: number, estimateId: string, actor: Actor) {
    const { e } = await this.estimates.raw(projectId, estimateId, actor);
    const rows = await this.packages.find({ where: { projectId, estimateNumber: e.number }, order: { createdAt: 'DESC' } });
    const inv = rows.length ? await this.invites.find({ where: { packageId: In(rows.map((r) => r.id)) } }) : [];
    return rows.map((p) => {
      const mine = inv.filter((i) => i.packageId === p.id);
      return { ...p, invites: mine.map((i) => ({ ...i })), leveling: leveling(p, mine) };
    });
  }

  /** A package from chosen scopes: a snapshot of their text only (no money ever goes in). */
  async create(projectId: number, estimateId: string, dto: { title?: string; scopeIds?: string[]; dueDate?: string; notes?: string }, actor: Actor) {
    const { e, sheet } = await this.estimates.raw(projectId, estimateId, actor, 'edit');
    const ids = new Set((dto?.scopeIds || []).map(String));
    const scopes = sheet.scopes.filter((s) => ids.has(s.id));
    if (!scopes.length) throw new BadRequestException('Pick the scopes to send out for pricing.');
    const due = dto?.dueDate ? String(dto.dueDate).slice(0, 10) : null;
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new BadRequestException('The due date must be a date.');
    const codes = new Map((await this.csi.find()).map((c) => [c.id, `${c.code}${c.division ? ` — ${c.division}` : ''}`]));
    const content: Content = {
      scopes: scopes.map((s) => ({
        key: s.originId || s.id, title: String(s.title || 'Scope'), csi: s.csiCodeId ? codes.get(s.csiCodeId) || null : null,
        lines: sheet.lines.filter((l) => l.scopeId === s.id && (!l.kind || l.kind === 'item') && l.pricing !== 'nis').map((l) => ({ key: l.originId || l.id, description: String(l.description || '').trim() || 'Line' })),
        notes: sheet.lines.filter((l) => l.scopeId === s.id && l.kind && l.kind !== 'item' && (l.description || '').trim()).map((l) => ({ kind: String(l.kind), text: String(l.description).trim() })),
      })),
    };
    const n = (await this.packages.count({ where: { projectId } })) + 1;
    const title = String(dto?.title || '').trim().slice(0, 300) || scopes.map((s) => s.title).filter(Boolean).slice(0, 3).join(', ') || 'Bid package';
    const p = this.packages.create({ id: newId('BP'), projectId, estimateId: e.id, estimateNumber: e.number, number: `BP-${String(n).padStart(3, '0')}`, title, content, dueDate: due, notes: String(dto?.notes || '').trim().slice(0, 8000) || null, status: 'draft', createdAt: now(), createdBy: actor.name, updatedAt: now() });
    await this.packages.save(p);
    await this.fin.log(null, { projectId, entityType: 'bid_package', entityId: p.id, action: 'created', reason: `${p.number} from ${e.number} Rev ${e.rev}` }, actor);
    return p;
  }

  private async link(inv: BidInviteEntity) {
    const token = signState({ mode: 'bid', inviteId: inv.id }, await this.settings.jwtSecret());
    return `${(await this.settings.baseUrl()) || ''}/bid?token=${encodeURIComponent(token)}`;
  }

  /**
   * Ask subs to price it: one invite each (again = resend), an email with
   * their private link when Google mail is connected, and their row on the
   * Contractors page (invited, due date).
   */
  async invite(projectId: number, packageId: string, dto: { contractorIds?: string[] }, actor: Actor) {
    await this.estimates.raw(projectId, (await this.pkg(projectId, packageId)).estimateId, actor, 'edit');
    const p = await this.pkg(projectId, packageId);
    if (p.status === 'closed') throw new ConflictException('This package is closed.');
    const ids = [...new Set((dto?.contractorIds || []).map(String))];
    if (!ids.length) throw new BadRequestException('Pick the subs to invite.');
    const subs = await this.contractors.find({ where: { id: In(ids) } });
    // Only prequalified subs with a current licence and insurance (Nov 13 sync).
    const blocked = subs.map((c) => ({ c, why: prequalBlock(c) })).filter((x) => x.why);
    if (blocked.length) throw new BadRequestException(`Can’t invite ${blocked.map((x) => `${x.c.companyName} (${x.why!.toLowerCase()})`).join(', ')}. Prequalify them first.`);
    const project = await this.fin.project(projectId);
    const canMail = await this.google.isConnected().catch(() => false);
    const emailBrand = await loadEmailBrand(this.settings);
    const out: { contractorId: string; vendorName: string; link: string; emailed: boolean }[] = [];
    for (const c of subs) {
      let inv = await this.invites.findOne({ where: { packageId, contractorId: c.id } });
      if (!inv) inv = this.invites.create({ id: newId('BI'), packageId, projectId, contractorId: c.id, status: 'invited', createdAt: now() });
      inv.vendorName = c.companyName; inv.email = c.email || null; inv.sentAt = now();
      if (!inv.contractorBidId) {
        const bid = this.bids.create({ id: newId('CBID'), contractorId: c.id, projectId, projectName: project.name, scope: `${p.number} ${p.title}`.slice(0, 2000), dateReceived: todayISO(), amount: null, outcome: 'invited', dueDate: p.dueDate, createdByName: actor.name, createdAt: now() });
        await this.bids.save(bid);
        inv.contractorBidId = bid.id;
      }
      await this.invites.save(inv);
      const link = await this.link(inv);
      let emailed = false;
      if (canMail && inv.email && EMAIL.test(inv.email)) {
        await this.google.sendMail({
          to: inv.email, subject: `Bid request ${p.number} — ${project.name}`,
          html: emailShell({ brand: emailBrand as any, eyebrow: `Bid request · ${p.number}`, title: `Hello ${escapeHtml(c.companyName)},`,
            body: `<p style="margin:0 0 12px;font-size:13.5px;line-height:1.6;color:#43514D;">We’d like your price for <b>${escapeHtml(p.title)}</b> on ${escapeHtml(project.name)}${p.dueDate ? `, by <b>${escapeHtml(p.dueDate)}</b>` : ''}. The scope, lines and inclusions / exclusions are on the page below, where you can enter your price or decline.</p>${p.notes ? `<p style="margin:0 0 12px;font-size:13.5px;line-height:1.6;color:#43514D;">${escapeHtml(p.notes).replace(/\n/g, '<br>')}</p>` : ''}` + viewButton(link).replace('View the change order', 'See the scope and send your price'),
            footer: `Sent by ${escapeHtml(actor.name)} at ${escapeHtml(emailBrand.companyName)}.` }),
        }).then(() => { emailed = true; }).catch(() => undefined);
      }
      out.push({ contractorId: c.id, vendorName: c.companyName, link, emailed });
    }
    if (p.status === 'draft') { p.status = 'out'; p.updatedAt = now(); await this.packages.save(p); }
    await this.fin.log(null, { projectId, entityType: 'bid_package', entityId: p.id, action: 'subs_invited', reason: out.map((o) => o.vendorName).join(', ') }, actor);
    return { invited: out };
  }

  private async fromToken(token: string) {
    const st = readState(String(token || ''), await this.settings.jwtSecret(), LINK_DAYS * 24 * 60 * 60_000);
    if (!st || st.mode !== 'bid' || !st.inviteId) throw new ForbiddenException('This link has expired. Ask for the bid request to be sent again.');
    const inv = await this.invites.findOne({ where: { id: String(st.inviteId) } });
    if (!inv) throw new ForbiddenException('This bid request is no longer open.');
    const p = await this.packages.findOne({ where: { id: inv.packageId } });
    if (!p) throw new ForbiddenException('This bid request is no longer open.');
    return { inv, p };
  }

  /** The sub's page. */
  async publicView(token: string) {
    const { inv, p } = await this.fromToken(token);
    if (inv.status === 'invited') { inv.status = 'viewed'; inv.viewedAt = now(); await this.invites.save(inv); }
    const brand = await loadEmailBrand(this.settings);
    return subView(p, inv, (await this.fin.project(p.projectId)).name, brand.companyName);
  }

  /** The sub sends a price (per line and/or a total) or declines. They can update it until a bid is chosen. */
  async publicSubmit(token: string, dto: { decline?: boolean; total?: number | string | null; lineAmounts?: Record<string, unknown>; notes?: string }) {
    const { inv, p } = await this.fromToken(token);
    if (p.status === 'closed' || inv.status === 'awarded' || inv.status === 'not_awarded') throw new ConflictException('A bid has already been chosen for this package.');
    const notes = String(dto?.notes || '').trim().slice(0, 4000) || null;
    const bid = inv.contractorBidId ? await this.bids.findOne({ where: { id: inv.contractorBidId } }) : null;
    if (dto?.decline) {
      Object.assign(inv, { status: 'declined', notes, submittedAt: now() });
      await this.invites.save(inv);
      if (bid) { bid.outcome = 'declined'; bid.outcomeDate = todayISO(); bid.updatedAt = now(); await this.bids.save(bid); }
      return { status: inv.status };
    }
    const keys = new Set(p.content.scopes.flatMap((s) => s.lines.map((l) => l.key)));
    const amt = (v: unknown) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(String(v).replace(/[$,\s]/g, ''));
      if (!Number.isFinite(n) || n < 0 || n > 1e9) throw new BadRequestException('Prices must be amounts in dollars.');
      return Math.round(n * 100) / 100;
    };
    const lineAmounts: Record<string, number> = {};
    for (const [k, v] of Object.entries(dto?.lineAmounts || {})) { const n = amt(v); if (keys.has(k) && n != null) lineAmounts[k] = n; }
    const total = amt(dto?.total);
    if (total == null && !Object.keys(lineAmounts).length) throw new BadRequestException('Enter your price — per line, or a total.');
    Object.assign(inv, { status: 'submitted', total, lineAmounts, notes, submittedAt: now() });
    await this.invites.save(inv);
    if (bid) {
      bid.amount = total ?? Object.values(lineAmounts).reduce((a, n) => a + n, 0);
      bid.outcome = 'pending'; bid.dateReceived = todayISO(); bid.updatedAt = now();
      await this.bids.save(bid);
    }
    return { status: inv.status };
  }

  /**
   * "Use this bid": the sub's prices go into the estimate's current draft
   * revision as sub cost on the package's lines (a total only is spread over
   * the lines in proportion to their current cost), with the sub named; the
   * sub's row on the Contractors page is awarded and the others not.
   */
  async useBid(projectId: number, packageId: string, inviteId: string, actor: Actor) {
    const p = await this.pkg(projectId, packageId);
    const all = await this.invites.find({ where: { packageId } });
    const inv = all.find((i) => i.id === inviteId);
    if (!inv || inv.status !== 'submitted') throw new BadRequestException('Only a submitted bid can be used.');
    const keys = p.content.scopes.flatMap((s) => s.lines.map((l) => l.key));
    const result = await this.estimates.changeDraftLines(projectId, p.estimateNumber, (lines) => {
      const mine = lines.filter((l) => keys.includes(l.originId || l.id));
      if (!mine.length) return 0;
      const per = inv.lineAmounts || {};
      const hasLines = Object.keys(per).length > 0;
      const base = mine.reduce((a, l) => a + (Number(l.cost) || 0), 0);
      let left = Math.round(Number(inv.total || 0) * 100);
      mine.forEach((l, i) => {
        const key = l.originId || l.id;
        let cost: number | null = null;
        if (hasLines) cost = per[key] ?? null;
        else if (inv.total != null) {
          const share = i === mine.length - 1 ? left : Math.round(Number(inv.total) * 100 * (base ? (Number(l.cost) || 0) / base : 1 / mine.length));
          left -= share; cost = share / 100;
        }
        if (cost != null) l.cost = cost;
        l.subName = inv.vendorName; l.contractorId = inv.contractorId;
        l.strategy = autoStrategy(l);
      });
      return mine.length;
    }, actor, `Bid from ${inv.vendorName} (${p.number})`);
    for (const i of all) {
      if (i.status !== 'submitted' && i.id !== inv.id) continue;
      i.status = i.id === inv.id ? 'awarded' : 'not_awarded'; i.decidedAt = now();
      await this.invites.save(i);
      if (i.contractorBidId) {
        const b = await this.bids.findOne({ where: { id: i.contractorBidId } });
        if (b) { b.outcome = i.status; b.outcomeDate = todayISO(); b.updatedAt = now(); await this.bids.save(b); }
      }
    }
    p.status = 'closed'; p.updatedAt = now(); await this.packages.save(p);
    return { ...result, vendorName: inv.vendorName };
  }
}
