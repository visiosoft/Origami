import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProposalEntity, DealEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { PipelineService, type DealActor } from '../pipeline/pipeline.service';
import { signState, readState } from '../auth/crypto.util';

/** The signing link stays live this long after it's sent -- long enough to decide, short enough to matter. */
const SIGN_LINK_MAX_AGE_MS = 10 * 24 * 60 * 60_000; // 10 days

export interface ProposalActor { id?: string; name?: string }

/**
 * The proposal/contract sent to a lead, and its e-signature.
 *
 * Signing it moves the deal to Client Review, flagged as accepted so the
 * board can call it out -- a person still confirms and converts it to a
 * project deliberately, rather than the signature doing that on its own.
 * See `signByToken`.
 */
@Injectable()
export class ProposalService {
  private readonly log = new Logger('ProposalService');

  constructor(
    @InjectRepository(ProposalEntity) private readonly repo: Repository<ProposalEntity>,
    @InjectRepository(DealEntity) private readonly deals: Repository<DealEntity>,
    private readonly settings: SettingsService,
    private readonly pipeline: PipelineService,
  ) {}

  async get(dealId: string) {
    if (!dealId) throw new BadRequestException('Which deal?');
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

  async save(dealId: string, body: { subject?: string; html?: string; amount?: string }, actor?: ProposalActor) {
    if (!dealId) throw new BadRequestException('Which deal?');
    if (!(await this.deals.findOneBy({ id: dealId }))) throw new BadRequestException(`Deal ${dealId} not found`);
    const existing = await this.repo.findOneBy({ dealId });
    const row = existing || this.repo.create({ dealId } as Partial<ProposalEntity>);
    row.subject = body.subject || row.subject || '';
    row.html = body.html || '';
    row.amount = body.amount || row.amount || '';
    row.updatedAt = new Date().toISOString();
    row.updatedBy = actor?.name || 'System';
    await this.repo.save(row);
    return this.get(dealId);
  }

  /** A signed, time-limited link a prospect can open without an Origami account. */
  async signingLink(dealId: string) {
    const secret = await this.settings.jwtSecret();
    const base = (await this.settings.baseUrl()) || '';
    const token = signState({ mode: 'proposal-sign', dealId }, secret);
    return `${base}/sign-proposal?token=${encodeURIComponent(token)}`;
  }

  async markSent(dealId: string, to: string, actor?: ProposalActor) {
    const row = await this.repo.findOneBy({ dealId });
    if (!row) return;
    row.sentAt = new Date().toISOString();
    row.sentTo = to || '';
    row.updatedBy = actor?.name || row.updatedBy || 'System';
    await this.repo.save(row);
  }

  /** Decode + validate a signing link's token. Null means expired, tampered, or malformed. */
  private async readToken(token: string): Promise<{ dealId: string } | null> {
    const secret = await this.settings.jwtSecret();
    const parsed = readState(token, secret, SIGN_LINK_MAX_AGE_MS);
    if (!parsed || parsed.mode !== 'proposal-sign' || typeof parsed.dealId !== 'string') return null;
    return { dealId: parsed.dealId };
  }

  /** What the public signing page shows -- nothing beyond what's needed to review and sign. */
  async getByToken(token: string) {
    const parsed = await this.readToken(token);
    if (!parsed) throw new ForbiddenException('This link has expired or is no longer valid. Ask your project contact to resend it.');
    return this.get(parsed.dealId);
  }

  /**
   * Record the e-signature and, the moment it lands, migrate the lead into a
   * real project -- the CRM strategy is to do this immediately on contract
   * signature rather than wait for someone to notice and convert it by hand.
   *
   * `meta.ip` / `meta.userAgent` are the server's own record of the request,
   * captured by the controller from the socket and headers -- never anything
   * the signer's browser claims -- which is what makes this a certification.
   */
  async signByToken(token: string, signer: { name: string; email: string }, image: string, meta: { ip: string; userAgent: string }) {
    const parsed = await this.readToken(token);
    if (!parsed) throw new ForbiddenException('This link has expired or is no longer valid. Ask your project contact to resend it.');
    if (!signer.name?.trim()) throw new BadRequestException('Type your name to certify the signature.');
    if (!image?.trim()) throw new BadRequestException('Draw your signature before submitting.');

    const row = await this.repo.findOneBy({ dealId: parsed.dealId });
    if (!row) throw new BadRequestException('There is nothing to sign yet.');
    row.signedAt = new Date().toISOString();
    row.signedByName = signer.name.trim();
    row.signedByEmail = (signer.email || '').trim();
    row.signatureImage = image;
    row.signerIp = meta.ip || '';
    row.signerUserAgent = meta.userAgent || '';
    await this.repo.save(row);

    // Signing no longer converts the deal straight to a project -- it moves
    // to Client Review, flagged "accepted" so the board can call it out
    // (a blinking card) for a person to confirm and convert deliberately.
    const actor: DealActor = { name: `${row.signedByName} (e-signature)` };
    try {
      await this.pipeline.updateStage(parsed.dealId, 'client_approval', actor);
      await this.deals.update(parsed.dealId, { status: 'accepted' });
    } catch (err) {
      this.log.warn(`Post-signature stage move for deal ${parsed.dealId}: ${(err as Error).message}`);
    }

    return this.get(parsed.dealId);
  }
}
