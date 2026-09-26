import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { LeadEntity, LeadFilesEntity, UserEntity, type LeadAttachment } from '../database/entities';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
import { emailShell, escapeHtml, loadEmailBrand } from '../email/shell';
import { readState, signState } from '../auth/crypto.util';
import { normalizeAttachments } from '../database/task.types';
import { leadStreetAddress } from './lead-address';

export const UPLOAD_LINK_DAYS = 30;
export const CLIENT_UPLOAD_STAGE = 'client_upload';
const DAY = 86_400_000;
const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;
const clean = (v: unknown, max = 200) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
const na = (v?: string | null) => { const t = (v || '').trim(); return /^(n\/?a|none|-+|—)$/i.test(t) ? '' : t; };

/** What the client told us at Initial Questions, as label/value lines for the email -- only what's filled in. */
export function intakeSummary(l: Partial<LeadEntity>): [string, string][] {
  const rows: [string, string][] = [
    ['Project', na(l.leadName)],
    ['Address', leadStreetAddress(l as any)],
    ['Property type', na((l as any).propertyType)],
    ['Type of project', na((l as any).potentialProjectType)],
    ['How you’d like to work with us', na((l as any).contractType)],
    ['What you have in mind', na((l as any).projectVision).slice(0, 700)],
  ];
  return rows.filter(([, v]) => !!v);
}

/**
 * The client welcome email (F11): after Initial Questions, a thank-you, a
 * summary of what they told us, the documents we still need ("homework"),
 * and a private link to upload them -- no account needed. Uploads land in
 * the lead's Files under "Uploaded by the client" and the person who sent the
 * email is told. A new email, or turning the link off, retires older links.
 */
@Injectable()
export class ClientWelcomeService {
  private readonly log = new Logger('ClientWelcome');

  constructor(
    @InjectRepository(LeadFilesEntity) private readonly files: Repository<LeadFilesEntity>,
    @InjectRepository(LeadEntity) private readonly leads: Repository<LeadEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly attachments: AttachmentsService,
    private readonly google: GoogleService,
    private readonly settings: SettingsService,
  ) {}

  private async row(leadId: string) {
    return (await this.files.findOneBy({ leadId })) || this.files.create({ leadId, attachments: [] });
  }

  private live(r: LeadFilesEntity | null) {
    return !!r?.uploadNonce && !!r.uploadExpiresAt && r.uploadExpiresAt > new Date().toISOString();
  }

  /** For the lead panel: sent when / to whom, link live until, what's been uploaded. */
  async status(leadId: string) {
    const r = await this.files.findOneBy({ leadId });
    const uploads = normalizeAttachments(r?.attachments).filter((a: any) => a.stage === CLIENT_UPLOAD_STAGE);
    return {
      sentAt: r?.welcomeSentAt || null, sentTo: r?.welcomeSentTo || null, sentBy: r?.welcomeSentBy || null,
      linkLive: this.live(r), expiresAt: this.live(r) ? r!.uploadExpiresAt : null, items: r?.uploadItems || [],
      uploads: uploads.length,
    };
  }

  private async link(leadId: string, nonce: string) {
    const token = signState({ mode: 'lead-upload', leadId, n: nonce }, await this.settings.jwtSecret());
    return `${(await this.settings.baseUrl()) || ''}/upload?token=${encodeURIComponent(token)}`;
  }

  async send(leadId: string, dto: { to?: string; note?: string; items?: string[] }, actor: UploadActor) {
    const lead = await this.leads.findOneBy({ id: leadId });
    if (!lead) throw new NotFoundException('Lead not found');
    const to = clean(dto.to || lead.email, 200);
    if (!EMAIL.test(to)) throw new BadRequestException('Give the client’s email address.');
    if (!(await this.google.isConnected())) throw new BadRequestException('No Google account is connected for sending mail (Settings → Integrations).');
    const items = (Array.isArray(dto.items) ? dto.items : lead.homeworkCompleted || []).map((x) => clean(x, 80)).filter(Boolean).slice(0, 40);

    const r = await this.row(leadId);
    r.uploadNonce = randomBytes(9).toString('base64url');
    r.uploadItems = items;
    r.uploadExpiresAt = new Date(Date.now() + UPLOAD_LINK_DAYS * DAY).toISOString();
    const url = await this.link(leadId, r.uploadNonce);

    const brand = await loadEmailBrand(this.settings);
    const first = na(lead.goByName) || na(lead.firstName) || (na(lead.leadName) || '').split(/\s+/)[0] || 'there';
    const note = String(dto.note || '').trim().slice(0, 3000);
    const summary = intakeSummary(lead);
    const body = `
      <p style="margin:0 0 16px;font-size:13.5px;line-height:1.6;color:#43514D;">Thank you for taking the time to walk us through your project. ${note ? escapeHtml(note).replace(/\n/g, '<br>') : 'Here’s a summary of what you told us, and what would help us most next.'}</p>
      ${summary.length ? `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#2F6F68;margin-bottom:6px;">What you told us</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;font-size:13px;color:#0B1A12;">
        ${summary.map(([k, v]) => `<tr><td style="padding:3px 16px 3px 0;color:#7E9B93;vertical-align:top;white-space:nowrap;">${escapeHtml(k)}</td><td style="padding:3px 0;line-height:1.5;">${escapeHtml(v).replace(/\n/g, '<br>')}</td></tr>`).join('')}
      </table>` : ''}
      ${items.length ? `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#2F6F68;margin-bottom:6px;">Documents that would help</div>
      <ul style="margin:0 0 16px;padding-left:18px;font-size:13px;line-height:1.7;color:#0B1A12;">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : ''}
      <p style="margin:0;font-size:13px;line-height:1.6;color:#43514D;">Upload whatever you have with the button below — photos from your phone are fine. The link is private to you and works for ${UPLOAD_LINK_DAYS} days; no account needed.</p>`;
    await this.google.sendMail({
      to, replyTo: actor.id ? (await this.users.findOneBy({ id: actor.id }))?.email || undefined : undefined,
      subject: `Thank you — next steps for ${na(lead.leadName) || 'your project'}`,
      html: emailShell({ brand, eyebrow: 'Welcome', title: `Hi ${escapeHtml(first)},`, body, cta: { label: 'Upload your documents', url }, footer: `Sent by ${escapeHtml(actor.name)} at ${escapeHtml(brand.companyName)}.` }),
    });
    Object.assign(r, { welcomeSentAt: new Date().toISOString(), welcomeSentTo: to, welcomeSentBy: actor.name, welcomeSentById: actor.id || '', updatedAt: new Date().toISOString() });
    await this.files.save(r);
    return { ...(await this.status(leadId)), url };
  }

  /** Turn the link off -- nothing more can be uploaded with it. */
  async disable(leadId: string) {
    const r = await this.files.findOneBy({ leadId });
    if (r) { r.uploadNonce = ''; r.uploadExpiresAt = ''; await this.files.save(r); }
    return this.status(leadId);
  }

  // ------------------------------------------------------------------ the client's side (no account)

  private async resolve(token: string) {
    const data = readState(String(token || ''), await this.settings.jwtSecret(), UPLOAD_LINK_DAYS * DAY);
    if (!data || data.mode !== 'lead-upload' || typeof data.leadId !== 'string') throw new BadRequestException('This upload link isn’t valid or has expired — ask us for a new one.');
    const r = await this.files.findOneBy({ leadId: data.leadId });
    if (!r || !this.live(r) || r.uploadNonce !== data.n) throw new BadRequestException('This upload link has been replaced or turned off — ask us for a new one.');
    const lead = await this.leads.findOneBy({ id: data.leadId });
    if (!lead) throw new NotFoundException('Not found');
    return { r, lead };
  }

  /** What the upload page shows: whose project, what we asked for, what's already here (names only). */
  async publicView(token: string) {
    const { r, lead } = await this.resolve(token);
    const brand = await loadEmailBrand(this.settings);
    const mine = normalizeAttachments(r.attachments).filter((a: any) => a.stage === CLIENT_UPLOAD_STAGE) as LeadAttachment[];
    return {
      company: brand.companyName, accent: brand.accent,
      project: na(lead.leadName) || 'your project', firstName: na(lead.goByName) || na(lead.firstName) || '',
      items: r.uploadItems || [], expiresAt: r.uploadExpiresAt,
      uploaded: mine.map((a) => ({ name: a.name, item: a.stageName === 'Uploaded by the client' ? '' : (a.stageName || '').replace(/^Client: /, ''), at: a.uploadedAt })),
    };
  }

  async publicUpload(token: string, files: any[], item?: string) {
    const { r, lead } = await this.resolve(token);
    if (!files?.length) throw new BadRequestException('Choose a file to upload.');
    const who = [na(lead.firstName), na(lead.lastName)].filter(Boolean).join(' ') || na(lead.leadName) || 'Client';
    const label = clean(item, 80);
    const added = (await this.attachments.upload(files, `Lead ${lead.id} - ${na(lead.leadName) || 'client'}`.slice(0, 100), { name: `${who} (client)` }))
      .map((a) => ({ ...a, stage: CLIENT_UPLOAD_STAGE, stageName: label ? `Client: ${label}` : 'Uploaded by the client' }));
    const fresh = (await this.files.findOneBy({ leadId: lead.id })) || r;
    fresh.attachments = [...normalizeAttachments(fresh.attachments), ...added];
    fresh.updatedAt = new Date().toISOString();
    await this.files.save(fresh);
    void this.notify(fresh, lead, added.map((a) => a.name), label).catch((e) => this.log.warn('Upload notice not sent: ' + (e as Error).message));
    return this.publicView(token);
  }

  /** Tell whoever sent the welcome email that files came in. */
  private async notify(r: LeadFilesEntity, lead: LeadEntity, names: string[], item: string) {
    if (!r.welcomeSentById || !(await this.google.isConnected())) return;
    const user = await this.users.findOneBy({ id: r.welcomeSentById });
    if (!user?.email) return;
    const brand = await loadEmailBrand(this.settings);
    const base = (await this.settings.baseUrl()) || '';
    await this.google.sendMail({
      to: user.email,
      subject: `${na(lead.leadName) || 'A client'} uploaded ${names.length} file${names.length === 1 ? '' : 's'}`,
      html: emailShell({
        brand, eyebrow: 'Client upload', title: `${escapeHtml(na(lead.leadName) || 'A client')} sent documents`,
        body: `<p style="margin:0 0 10px;font-size:13.5px;color:#43514D;">${item ? `For <b>${escapeHtml(item)}</b>:` : 'New files:'}</p><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;">${names.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`,
        cta: { label: 'Open the lead', url: `${base}/pipeline` }, footer: 'They’re in the lead’s Files tab, under “Uploaded by the client”.',
      }),
    });
  }
}
