import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractorEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService } from '../google/google.service';
import { readState, signState } from '../auth/crypto.util';
import { emailShell, escapeHtml, loadEmailBrand } from '../email/shell';
import { ContractorsService } from './contractors.service';
import { cleanPrequal, prequalBlock, type PrequalStatus } from './prequal';

const LINK_DAYS = 30;
const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;
const now = () => new Date().toISOString();

/**
 * GC & Sub Prequalify (Nov 13 sync): the prequal form per contractor (by
 * staff, or by the sub from a private link), staff review (approve /
 * reject), and the rule bid invites follow (approved + licence and
 * insurance current).
 */
@Injectable()
export class PrequalService {
  constructor(
    @InjectRepository(ContractorEntity) private readonly repo: Repository<ContractorEntity>,
    private readonly contractors: ContractorsService,
    private readonly settings: SettingsService,
    private readonly google: GoogleService,
  ) {}

  private async one(id: string) {
    const c = await this.repo.findOneBy({ id });
    if (!c) throw new NotFoundException('Contractor not found.');
    return c;
  }

  private view(c: ContractorEntity) {
    return {
      id: c.id, companyName: c.companyName, contactPerson: c.contactPerson, email: c.email, phone: c.phone, tradeIds: c.tradeIds || [],
      licenseNumber: c.licenseNumber, licenseExpiry: c.licenseExpiry, insuranceProvider: c.insuranceProvider, insurancePolicyNumber: c.insurancePolicyNumber, insuranceExpiry: c.insuranceExpiry,
      prequalStatus: (c.prequalStatus || null) as PrequalStatus | null, prequal: c.prequal || null, prequalAt: c.prequalAt, prequalBy: c.prequalBy, prequalNotes: c.prequalNotes,
      attachments: (c.attachments || []).map((a: any) => ({ id: a.id, name: a.name })),
      canBid: !prequalBlock(c), reason: prequalBlock(c),
    };
  }

  async list() {
    const rows = await this.repo.find({ order: { companyName: 'ASC' } });
    return rows.filter((c) => c.status !== 'ended').map((c) => this.view(c));
  }

  /** Staff fill in or correct the form. */
  async save(id: string, dto: any, by: string) {
    const c = await this.one(id);
    let parsed;
    try { parsed = cleanPrequal(dto); } catch (e) { throw new BadRequestException((e as Error).message); }
    Object.assign(c, parsed.fields, { prequal: { ...(c.prequal || {}), ...parsed.answers, submittedAt: now(), submittedBy: by }, updatedAt: now() });
    if (!c.prequalStatus) c.prequalStatus = 'pending';
    await this.repo.save(c);
    return this.view(c);
  }

  /** Approve or turn down (with a note). Approving needs licence and insurance on file and current. */
  async decide(id: string, decision: 'approved' | 'rejected' | 'pending', notes: string, by: string) {
    const c = await this.one(id);
    if (!['approved', 'rejected', 'pending'].includes(decision)) throw new BadRequestException('Approve or turn down.');
    if (decision === 'approved') {
      const why = prequalBlock({ ...c, prequalStatus: 'approved' });
      if (why) throw new BadRequestException(`Can’t approve yet: ${why.toLowerCase()}.`);
    }
    Object.assign(c, { prequalStatus: decision, prequalAt: now(), prequalBy: by, prequalNotes: String(notes || '').trim().slice(0, 2000) || null, updatedAt: now() });
    await this.repo.save(c);
    return this.view(c);
  }

  // ------------------------------------------------------------ the sub's own form
  private async token(c: ContractorEntity) { return signState({ mode: 'prequal', contractorId: c.id }, await this.settings.jwtSecret()); }
  private async fromToken(token: string) {
    const st = readState(String(token || ''), await this.settings.jwtSecret(), LINK_DAYS * 86_400_000);
    if (!st || st.mode !== 'prequal' || !st.contractorId) throw new ForbiddenException('This link has expired. Ask us for a new one.');
    return this.one(String(st.contractorId));
  }

  /** A private link for the sub to fill in the form (emailed when Google mail is connected). */
  async sendLink(id: string, actorName: string) {
    const c = await this.one(id);
    const link = `${(await this.settings.baseUrl()) || ''}/prequal?token=${encodeURIComponent(await this.token(c))}`;
    let emailed = false;
    if (c.email && EMAIL.test(c.email) && (await this.google.isConnected().catch(() => false))) {
      const brand = await loadEmailBrand(this.settings);
      await this.google.sendMail({
        to: c.email, subject: `Prequalification — ${brand.companyName}`,
        html: emailShell({ brand: brand as any, eyebrow: 'Prequalification', title: `Hello ${escapeHtml(c.companyName)},`,
          body: `<p style="margin:0 0 12px;font-size:13.5px;line-height:1.6;color:#43514D;">Before we invite you to bid, please fill in our short prequalification form: your licence, insurance, trades and references. You can upload your W-9 and certificates there too.</p><p style="margin:0 0 16px;"><a href="${link}" style="display:inline-block;padding:11px 20px;border-radius:999px;background:#1f3d33;color:#fff;font-weight:700;text-decoration:none;">Fill in the form</a></p>`,
          footer: `Sent by ${escapeHtml(actorName)} at ${escapeHtml(brand.companyName)}. The link works for ${LINK_DAYS} days.` }),
      }).then(() => { emailed = true; }).catch(() => undefined);
    }
    return { link, emailed };
  }

  async publicView(token: string) {
    const c = await this.fromToken(token);
    const v = this.view(c);
    return { companyName: v.companyName, licenseNumber: v.licenseNumber, licenseExpiry: v.licenseExpiry, insuranceProvider: v.insuranceProvider, insurancePolicyNumber: v.insurancePolicyNumber, insuranceExpiry: v.insuranceExpiry, prequal: v.prequal, status: v.prequalStatus, files: v.attachments.map((a) => a.name) };
  }

  async publicSubmit(token: string, dto: any) {
    const c = await this.fromToken(token);
    if (c.prequalStatus === 'approved') throw new BadRequestException('You’re already prequalified. Contact us to change your details.');
    await this.save(c.id, dto, `${c.companyName} (their form)`);
    // Sent back after a "no": it goes back for review.
    await this.repo.update({ id: c.id }, { prequalStatus: 'pending' });
    return this.publicView(token);
  }

  async publicUpload(token: string, files: any[]) {
    const c = await this.fromToken(token);
    if (!files?.length) throw new BadRequestException('Pick a file.');
    await this.contractors.addAttachments(c.id, files, { name: `${c.companyName} (prequal form)` });
    return this.publicView(token);
  }
}
