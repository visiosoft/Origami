import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { readState, signState } from '../auth/crypto.util';
import { ChangeOrderEntity, ClientApprovalBundleEntity, ProjectEntity, RfiEntity, TaskEntity, type BundleItem } from '../database/entities';
import { event, normalizeList, type ActivityEvent } from '../database/task.types';
import { emailShell, escapeHtml, loadEmailBrand } from '../email/shell';
import { FileRoomService } from '../file-room/file-room.service';
import { ChangeOrdersService } from '../finance/change-orders.service';
import { FinancialsService } from '../finance/financials.service';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
import { bundleHtml, cleanDecisions, coItem, isForRecord, recordItem, rfiItem } from './bundle';

const LINK_DAYS = 60;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const now = () => new Date().toISOString();
type Actor = { id?: string; name: string };

/**
 * Client approval bundles (Nov 17 sync, Edward): pick RFIs, decisions /
 * observations and change orders on a project, send the client one link;
 * they approve or decline each item and sign once. Each item's history
 * records the answer; approved change orders are recorded as client-approved;
 * the signed PDF goes in the project's files (Approvals).
 */
@Injectable()
export class ClientApprovalsService {
  private readonly log = new Logger('ClientApprovals');

  constructor(
    @InjectRepository(ClientApprovalBundleEntity) private readonly repo: Repository<ClientApprovalBundleEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(RfiEntity) private readonly rfis: Repository<RfiEntity>,
    @InjectRepository(TaskEntity) private readonly logTasks: Repository<TaskEntity>,
    @InjectRepository(ChangeOrderEntity) private readonly cos: Repository<ChangeOrderEntity>,
    private readonly settings: SettingsService,
    private readonly google: GoogleService,
    @Optional() private readonly fin?: FinancialsService,
    @Optional() private readonly changeOrders?: ChangeOrdersService,
    @Optional() private readonly fileRoom?: FileRoomService,
  ) {}

  private async project(id: number) {
    const p = await this.projects.findOneBy({ id });
    if (!p) throw new NotFoundException('Project not found.');
    return p;
  }

  /** What can go in a bundle on this project: answered or open RFIs, FOR RECORD entries, change orders with the client. */
  async candidates(projectId: number) {
    const p = await this.project(projectId);
    const [rfis, log, cos, bill] = await Promise.all([
      this.rfis.find({ where: { projectId, status: In(['open', 'answered', 'closed']) } as any }),
      this.logTasks.find({ where: { project: p.name } as any }),
      this.cos.find({ where: { projectId, status: In(['internal_review', 'submitted']) } as any }),
      this.fin ? this.fin.settingsFor(projectId).then((r) => r.value).catch(() => null) : Promise.resolve(null),
    ]);
    return {
      rfis: rfis.map(rfiItem),
      records: log.filter((t) => isForRecord(t.topicType) && !t.archivedAt).map(recordItem),
      changeOrders: cos.map((c) => coItem(c as any)),
      clientEmail: (bill as any)?.billToEmail || '',
      clientName: (bill as any)?.billToName || '',
    };
  }

  async list(projectId: number) {
    const rows = await this.repo.find({ where: { projectId }, order: { createdAt: 'DESC' } as any });
    return rows.map(({ signatureImage: _s, ...r }) => r);
  }

  private async nextNumber(projectId: number) {
    const n = (await this.repo.find({ where: { projectId }, select: { number: true } as any })).map((r) => Number(String(r.number).replace(/\D/g, '')) || 0);
    return `AP-${String(Math.max(0, ...n) + 1).padStart(3, '0')}`;
  }

  /** Make a bundle from picked items, as they read now. */
  async create(projectId: number, dto: { title?: string; items?: { kind?: string; id?: string }[] }, actor: Actor) {
    const c = await this.candidates(projectId);
    const all = new Map([...c.rfis, ...c.records, ...c.changeOrders].map((it) => [`${it.kind}:${it.id}`, it]));
    const picked = [...new Set((dto.items || []).map((x) => `${x.kind}:${x.id}`))].map((k) => all.get(k)).filter((x): x is BundleItem => !!x);
    if (!picked.length) throw new BadRequestException('Pick at least one item for the client to approve.');
    if (picked.length > 40) throw new BadRequestException('Up to 40 items in one approval.');
    const row = this.repo.create({
      id: 'CAB-' + randomBytes(6).toString('hex'), projectId, number: await this.nextNumber(projectId),
      title: String(dto.title || '').trim().slice(0, 200) || 'Items for your approval', items: picked, status: 'draft',
      createdBy: actor.name, createdAt: now(),
    });
    return this.repo.save(row);
  }

  /** The project a bundle belongs to (for the access check). */
  async projectOf(id: string) { return (await this.load(id)).projectId; }

  private async load(id: string) {
    const r = await this.repo.findOneBy({ id });
    if (!r) throw new NotFoundException('That approval no longer exists.');
    return r;
  }

  private async token(r: ClientApprovalBundleEntity) { return signState({ mode: 'bundle-sign', bundleId: r.id }, await this.settings.jwtSecret()); }
  private async fromToken(token: string) {
    const st = readState(String(token || ''), await this.settings.jwtSecret(), LINK_DAYS * 86_400_000);
    if (!st || st.mode !== 'bundle-sign' || !st.bundleId) throw new ForbiddenException('This link has expired. Ask your project team to send it again.');
    return this.load(String(st.bundleId));
  }

  /** Email the client their link (to the bill-to email unless another is given). */
  async send(id: string, dto: { to?: string; message?: string }, actor: Actor) {
    const r = await this.load(id);
    if (r.status === 'signed') throw new BadRequestException('This approval is already signed.');
    if (!(await this.google.isConnected())) throw new BadRequestException('Connect a Google account (Settings -> Integrations) to email the client.');
    const c = await this.candidates(r.projectId);
    const to = String(dto.to || c.clientEmail || '').trim();
    if (!EMAIL.test(to)) throw new BadRequestException('Give the client’s email address (or set the bill-to email in the project’s financial settings).');
    const project = await this.project(r.projectId);
    const link = `${(await this.settings.baseUrl()) || ''}/approve?token=${encodeURIComponent(await this.token(r))}`;
    const brand = await loadEmailBrand(this.settings);
    const first = (c.clientName || '').split(/\s+/)[0];
    const message = String(dto.message || '').trim().slice(0, 2000);
    await this.google.sendMail({
      to, subject: `For your approval: ${r.title} — ${project.name}`,
      html: emailShell({
        brand, eyebrow: `Approval · ${r.number}`, title: `Hi ${escapeHtml(first || 'there')},`,
        body: `<p style="margin:0 0 12px;">Please review ${r.items.length} item${r.items.length === 1 ? '' : 's'} on <b>${escapeHtml(project.name)}</b>, approve or decline each one, and sign once.</p>`
          + (message ? `<p style="margin:0 0 12px;">${escapeHtml(message).replace(/\n/g, '<br>')}</p>` : '')
          + `<ul style="margin:0 0 12px;padding-left:18px;">${r.items.map((it) => `<li>${escapeHtml(it.label)}</li>`).join('')}</ul>`,
        cta: { label: 'Review and sign', url: link },
        footer: `Sent by ${escapeHtml(actor.name)} at ${escapeHtml(brand.companyName)}. The link works for ${LINK_DAYS} days.`,
      }),
    });
    Object.assign(r, { status: 'sent', sentTo: to, sentAt: now(), sentBy: actor.name, message: message || null });
    await this.repo.save(r);
    return { sent: true, to, link };
  }

  /** The client's page. */
  async publicView(token: string) {
    const r = await this.fromToken(token);
    const project = await this.project(r.projectId);
    const brand = await loadEmailBrand(this.settings);
    return { number: r.number, title: r.title, projectName: project.name, companyName: brand.companyName, status: r.status, items: r.items, message: r.message, signedName: r.signedName, signedAt: r.signedAt };
  }

  /** The client answers each item and signs once. */
  async publicSign(token: string, dto: { decisions?: unknown; name?: string; email?: string; image?: string; agree?: boolean }, meta: { ip?: string }) {
    const r = await this.fromToken(token);
    if (r.status === 'signed') throw new BadRequestException('This has already been signed. Thank you!');
    if (r.status !== 'sent') throw new BadRequestException('This approval isn’t ready to sign yet.');
    const items = cleanDecisions(r.items, dto.decisions);
    const name = String(dto.name || '').trim().slice(0, 200);
    if (name.length < 2) throw new BadRequestException('Type your full name.');
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dto.image || '') || String(dto.image).length > 400_000) throw new BadRequestException('Draw your signature in the box.');
    if (dto.agree !== true) throw new BadRequestException('Tick the box to sign.');
    Object.assign(r, { items, status: 'signed', signedName: name, signedEmail: String(dto.email || '').trim().slice(0, 200) || null, signatureImage: dto.image, signedIp: String(meta.ip || '').slice(0, 64), signedAt: now() });
    await this.repo.save(r);
    void this.afterSigned(r).catch((e) => this.log.warn(`${r.number}: ${(e as Error).message}`));
    return { signed: true };
  }

  /** Each item's history gets the answer; approved change orders are recorded; the signed PDF is filed. */
  async afterSigned(r: ClientApprovalBundleEntity) {
    const who: Actor = { name: `${r.signedName} (client, online)` };
    const day = (r.signedAt || now()).slice(0, 10);
    for (const it of r.items) {
      const said = `${it.decision === 'approved' ? 'Approved' : 'Declined'} by the client in ${r.number}${it.note ? ` — ${it.note}` : ''}`;
      try {
        if (it.kind === 'rfi') {
          const x = await this.rfis.findOneBy({ id: it.id });
          if (x) { x.history = [...(x.history || []), { at: now(), by: who.name, action: it.decision === 'approved' ? 'client approved' : 'client declined', note: `${r.number}${it.note ? ` — ${it.note}` : ''}` } as any]; await this.rfis.save(x); }
        } else if (it.kind === 'record') {
          const x = await this.logTasks.findOneBy({ id: it.id });
          if (x) { x.activity = [...normalizeList<ActivityEvent>(x.activity), event('status', who, { text: said })]; await this.logTasks.save(x); }
        } else if (it.kind === 'co' && this.changeOrders) {
          const co = await this.cos.findOneBy({ id: it.id });
          if (co && it.decision === 'approved' && co.status === 'submitted') {
            await this.changeOrders.act(it.id, 'client_approve', { signer: r.signedName, date: day, reference: `${r.number} (signed online)` }, { name: who.name, id: undefined, roleKey: 'admin' } as any);
          } else if (co && it.decision === 'declined' && (co.status === 'submitted' || co.status === 'internal_review')) {
            await this.changeOrders.act(it.id, 'reject', { comment: said }, { name: who.name, id: undefined, roleKey: 'admin' } as any);
          }
        }
      } catch (e) { this.log.warn(`${r.number} ${it.kind} ${it.id}: ${(e as Error).message}`); }
    }
    if (this.fileRoom && (await this.google.isConnected().catch(() => false))) {
      const project = await this.project(r.projectId);
      const brand = await loadEmailBrand(this.settings);
      const base = `${r.number} ${r.title} (signed)`.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 120);
      const pdf = await this.google.htmlToPdf(bundleHtml(r, project.name, brand.companyName), base);
      const [saved] = await this.fileRoom.upload(r.projectId, ['Approvals'], [{ originalname: `${base}.pdf`, mimetype: 'application/pdf', size: pdf.length, buffer: pdf }], { id: '', name: 'Origami' } as any);
      if (saved?.id) { r.signedFileId = saved.id; await this.repo.save(r); }
    }
  }
}
