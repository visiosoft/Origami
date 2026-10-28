import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import {
  ChangeOrderEntity, CommitmentEntity, ContractEntity, ContractTemplateEntity, FileRoomFileEntity, LeadEntity, PersonEntity, ProjectEntity,
} from '../database/entities';
import { readState, signState } from '../auth/crypto.util';
import { SettingsService } from '../settings/settings.service';
import { GoogleService } from '../google/google.service';
import { FileRoomService } from '../file-room/file-room.service';
import { ChangeOrdersService } from '../finance/change-orders.service';
import { BRAND_KEYS, brandingFrom, buildLetterHtml, safeFilename } from '../documents/letterhead';
import {
  CONTRACT_TYPES, DEFAULT_TEMPLATES, countInitials, initialsOf, isContractType, mergeContract, renderSigned, statusFromParties, typeOf, unfilledFields,
  type ContractAttachment, type ContractParty, type ContractType,
} from './contract-types';

/** Signing links stay live this long. */
const LINK_MAX_AGE_MS = 30 * 24 * 60 * 60_000;
const ATTACH_KINDS = ['estimate', 'drawings', 'specs', 'other'];
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const now = () => new Date().toISOString();
const money = (n: unknown) => (n == null || n === '' ? '' : Number.isFinite(Number(n)) ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : String(n));

export interface ContractActor { id?: string; name?: string; email?: string; roleKey?: string }

/**
 * Contracts signed inside ODIN (Oct 27 backlog): templates per type, merged
 * with the project, parties and change order; sent to each signer with their
 * own link; initialled and signed; counter-signed by Origami; the signed PDF
 * filed in the project's File Room.
 */
@Injectable()
export class ContractsService implements OnApplicationBootstrap {
  private readonly log = new Logger('Contracts');

  constructor(
    @InjectRepository(ContractEntity) private readonly contracts: Repository<ContractEntity>,
    @InjectRepository(ContractTemplateEntity) private readonly templates: Repository<ContractTemplateEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(LeadEntity) private readonly leads: Repository<LeadEntity>,
    @InjectRepository(PersonEntity) private readonly people: Repository<PersonEntity>,
    @InjectRepository(ChangeOrderEntity) private readonly cos: Repository<ChangeOrderEntity>,
    @InjectRepository(CommitmentEntity) private readonly commitments: Repository<CommitmentEntity>,
    @InjectRepository(FileRoomFileEntity) private readonly files: Repository<FileRoomFileEntity>,
    private readonly settings: SettingsService,
    private readonly google: GoogleService,
    @Optional() private readonly fileRoom?: FileRoomService,
    @Optional() private readonly changeOrders?: ChangeOrdersService,
  ) {}

  /** A default template for every type that has none (wording the office then edits). */
  async onApplicationBootstrap() {
    try {
      const have = new Set((await this.templates.find()).map((t) => t.type));
      const missing = CONTRACT_TYPES.filter((t) => !have.has(t.key));
      for (const t of missing) {
        await this.templates.save(this.templates.create({ id: `TPL-contract-${t.key}`, type: t.key, name: DEFAULT_TEMPLATES[t.key].name, html: DEFAULT_TEMPLATES[t.key].html, isDefault: true, updatedAt: now(), updatedBy: 'Origami' }));
      }
      if (missing.length) this.log.log(`Seeded ${missing.length} contract template(s)`);
    } catch (e) {
      this.log.warn('Contract templates not seeded: ' + (e as Error).message);
    }
  }

  // ------------------------------------------------------------------ templates

  listTemplates() {
    return this.templates.find({ order: { type: 'ASC', name: 'ASC' } });
  }

  async saveTemplate(id: string | null, dto: { type?: string; name?: string; html?: string; isDefault?: boolean }, actor: ContractActor) {
    const row = id ? await this.templates.findOneBy({ id }) : null;
    if (id && !row) throw new NotFoundException('Template not found.');
    const type = String(dto.type ?? row?.type ?? '');
    if (!isContractType(type)) throw new BadRequestException('Pick a contract type.');
    const name = String(dto.name ?? row?.name ?? '').trim();
    if (!name) throw new BadRequestException('Give the template a name.');
    const html = String(dto.html ?? row?.html ?? '');
    if (!html.trim()) throw new BadRequestException('The template is empty.');
    const saved = await this.templates.save(this.templates.create({ ...(row || {}), id: row?.id || randomUUID(), type, name: name.slice(0, 200), html, isDefault: dto.isDefault ?? row?.isDefault ?? false, updatedAt: now(), updatedBy: actor.name || null }));
    if (saved.isDefault) {
      const others = (await this.templates.find({ where: { type } })).filter((t) => t.id !== saved.id && t.isDefault);
      for (const o of others) o.isDefault = false;
      if (others.length) await this.templates.save(others);
    }
    return saved;
  }

  async removeTemplate(id: string) {
    const row = await this.templates.findOneBy({ id });
    if (!row) throw new NotFoundException('Template not found.');
    if ((await this.templates.count({ where: { type: row.type } })) <= 1) throw new BadRequestException('Keep at least one template for each contract type.');
    await this.templates.remove(row);
    return { deleted: true };
  }

  // ------------------------------------------------------------------ contracts

  async list(q: { projectId?: string; type?: string; status?: string }) {
    const where: Record<string, unknown> = {};
    if (q.projectId) where.projectId = Number(q.projectId);
    if (q.type) where.type = q.type;
    if (q.status) where.status = q.status;
    const [rows, projects] = await Promise.all([this.contracts.find({ where, order: { createdAt: 'DESC' } }), this.projects.find({ select: { id: true, name: true } })]);
    const names = new Map(projects.map((p) => [p.id, p.name]));
    // The list doesn't need the document or signatures.
    return rows.map(({ html: _h, ...r }) => ({ ...r, projectName: r.projectId ? names.get(r.projectId) || `Project ${r.projectId}` : null, parties: r.parties.map(({ signatureImage: _s, ...p }) => p) }));
  }

  async get(id: string) {
    const row = await this.contracts.findOneBy({ id });
    if (!row) throw new NotFoundException('Contract not found.');
    const project = row.projectId ? await this.projects.findOneBy({ id: row.projectId }) : null;
    return { ...row, projectName: project?.name || null, initialsNeeded: countInitials(row.html), unfilled: unfilledFields(row.html) };
  }

  /** The merge data for a contract: project, owner, other party, change order, subcontract and our own details. */
  private async mergeData(c: { type: string; projectId: number | null; amount?: string | null; number: string; changeOrderId?: string | null; commitmentId?: string | null }, counterparty: ContractParty | undefined) {
    const brand = brandingFrom(await this.settings.getMany(BRAND_KEYS));
    // Our licence number (Settings -> Branding), when it's been entered.
    const lic = (await this.settings.get('brand.license').catch(() => null)) || '';
    const project = c.projectId ? await this.projects.findOneBy({ id: c.projectId }) : null;
    const lead = project?.leadId ? await this.leads.findOneBy({ id: project.leadId }).catch(() => null) : null;
    const person = counterparty?.personId ? await this.people.findOneBy({ id: counterparty.personId }) : null;
    const co = c.changeOrderId ? await this.cos.findOneBy({ id: c.changeOrderId }) : null;
    const sc = c.commitmentId ? await this.commitments.findOneBy({ id: c.commitmentId }) : null;
    const ownerName = typeOf(c.type).counterparty === 'owner' ? counterparty?.name : lead?.leadName;
    return {
      'contract.number': c.number, 'contract.amount': c.amount || (co ? money(co.amount) : ''), 'contract.date': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      'project.name': project?.name || '', 'project.address': project?.location || lead?.projectStreetAddress || '', 'project.scope': project?.scope || '',
      'owner.name': ownerName || '', 'owner.email': typeOf(c.type).counterparty === 'owner' ? counterparty?.email || '' : lead?.email || '',
      'party.name': counterparty?.name || '', 'party.company': person?.company || counterparty?.name || '', 'party.email': counterparty?.email || '',
      'company.name': brand.companyName || 'Origami Design + Build', 'company.address': brand.address || '', 'company.license': lic,
      'changeOrder.number': co?.number || '', 'changeOrder.title': co?.title || '', 'changeOrder.description': co?.description || '', 'changeOrder.amount': co ? money(co.amount) : '',
      'subcontract.number': sc?.number || '', 'subcontract.title': sc?.title || '', 'subcontract.amount': c.amount || '',
    };
  }

  private async nextNumber() {
    const year = new Date().getFullYear();
    const prefix = `CT-${year}-`;
    const taken = (await this.contracts.find({ select: { number: true } })).map((r) => r.number).filter((n) => n.startsWith(prefix)).map((n) => Number(n.slice(prefix.length)) || 0);
    return prefix + String(Math.max(0, ...taken) + 1).padStart(4, '0');
  }

  private cleanParties(raw: unknown): ContractParty[] {
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 8).map((p: any, i): ContractParty => ({
      key: String(p?.key || `p${i + 1}`).slice(0, 20),
      role: String(p?.role || 'other').slice(0, 20),
      label: String(p?.label || p?.role || 'Signer').trim().slice(0, 60),
      name: String(p?.name || '').trim().slice(0, 200),
      email: String(p?.email || '').trim().toLowerCase().slice(0, 200),
      personId: Number(p?.personId) || null,
      internal: !!p?.internal,
    }));
  }

  private cleanAttachments(raw: unknown): ContractAttachment[] {
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 30).filter((a: any) => a?.fileId).map((a: any) => ({ fileId: String(a.fileId), name: String(a.name || 'File').slice(0, 200), kind: (ATTACH_KINDS.includes(a.kind) ? a.kind : 'other') as ContractAttachment['kind'] }));
  }

  /** A new draft from a template, merged with the project, parties and change order. */
  async create(dto: any, actor: ContractActor) {
    const type = String(dto?.type || '');
    if (!isContractType(type)) throw new BadRequestException('Pick a contract type.');
    const projectId = dto?.projectId ? Number(dto.projectId) : null;
    if (projectId && !(await this.projects.findOneBy({ id: projectId }))) throw new BadRequestException('Project not found.');
    const template = dto?.templateId ? await this.templates.findOneBy({ id: String(dto.templateId) })
      : (await this.templates.find({ where: { type } })).sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault))[0];
    const parties = this.cleanParties(dto?.parties);
    if (!parties.some((p) => p.internal)) parties.push({ key: `p${parties.length + 1}`, role: 'origami', label: 'Origami Design + Build', name: actor.name || '', email: actor.email || '', internal: true });
    const number = await this.nextNumber();
    const base = { type, projectId, amount: String(dto?.amount || '').trim() || null, number, changeOrderId: dto?.changeOrderId || null, commitmentId: dto?.commitmentId || null };
    const counterparty = parties.find((p) => !p.internal);
    const html = mergeContract(template?.html || DEFAULT_TEMPLATES[type as ContractType].html, await this.mergeData(base, counterparty));
    const row = this.contracts.create({
      id: randomUUID(), ...base, title: String(dto?.title || '').trim().slice(0, 300) || `${typeOf(type).label}${counterparty?.name ? ` — ${counterparty.name}` : ''}`,
      html, status: 'draft', parties, attachments: this.cleanAttachments(dto?.attachments), templateId: template?.id || null,
      createdById: actor.id || null, createdByName: actor.name || null, createdAt: now(), updatedAt: now(),
    });
    return this.contracts.save(row);
  }

  /** Edit a draft: wording, title, amount, parties, attachments. Re-merge refills any {{fields}} still open. */
  async update(id: string, dto: any) {
    const row = await this.contracts.findOneBy({ id });
    if (!row) throw new NotFoundException('Contract not found.');
    if (row.status !== 'draft') throw new BadRequestException('Only a draft can be edited. Void it and start a new one to change a sent contract.');
    if (dto.title !== undefined) row.title = String(dto.title).trim().slice(0, 300) || row.title;
    if (dto.amount !== undefined) row.amount = String(dto.amount || '').trim() || null;
    if (dto.html !== undefined) row.html = String(dto.html);
    if (dto.parties !== undefined) {
      const parties = this.cleanParties(dto.parties);
      if (!parties.some((p) => p.internal)) throw new BadRequestException('Origami signs every contract — keep its signer.');
      row.parties = parties;
    }
    if (dto.attachments !== undefined) row.attachments = this.cleanAttachments(dto.attachments);
    if (dto.remerge) row.html = mergeContract(row.html, await this.mergeData(row, row.parties.find((p) => !p.internal)));
    row.updatedAt = now();
    return this.contracts.save(row);
  }

  async remove(id: string) {
    const row = await this.contracts.findOneBy({ id });
    if (!row) throw new NotFoundException('Contract not found.');
    if (row.status !== 'draft') throw new BadRequestException('A sent contract is voided, not deleted, so its history stays.');
    await this.contracts.remove(row);
    return { deleted: true };
  }

  async void(id: string, reason: string) {
    const row = await this.contracts.findOneBy({ id });
    if (!row) throw new NotFoundException('Contract not found.');
    if (row.status === 'signed') throw new BadRequestException('A signed contract can’t be voided; make a change order instead.');
    if (!String(reason || '').trim()) throw new BadRequestException('Say why it is being voided.');
    Object.assign(row, { status: 'void', voidedAt: now(), voidReason: String(reason).trim().slice(0, 500), updatedAt: now() });
    return this.contracts.save(row);
  }

  // ------------------------------------------------------------------ sending and signing

  private async link(contractId: string, key: string) {
    const token = signState({ mode: 'contract-sign', contractId, key }, await this.settings.jwtSecret());
    return `${(await this.settings.baseUrl()) || ''}/sign-contract?token=${encodeURIComponent(token)}`;
  }

  private async readToken(token: string) {
    const p = readState(String(token || ''), await this.settings.jwtSecret(), LINK_MAX_AGE_MS);
    if (!p || p.mode !== 'contract-sign' || typeof p.contractId !== 'string' || typeof p.key !== 'string') throw new ForbiddenException('This link has expired or is no longer valid. Ask your Origami contact to resend it.');
    const row = await this.contracts.findOneBy({ id: p.contractId });
    if (!row) throw new ForbiddenException('This contract is no longer available.');
    const party = row.parties.find((x) => x.key === p.key);
    if (!party || party.internal) throw new ForbiddenException('This link is not for a signer of this contract.');
    return { row, party };
  }

  /** Check it's ready, then email each outside signer who hasn't signed their own link. */
  async send(id: string, opts: { note?: string; resendKeys?: string[] }, actor: ContractActor) {
    const row = await this.contracts.findOneBy({ id });
    if (!row) throw new NotFoundException('Contract not found.');
    if (row.status === 'void' || row.status === 'signed') throw new BadRequestException(`This contract is ${row.status}.`);
    const open = unfilledFields(row.html);
    if (open.length) throw new BadRequestException(`Fill in ${open.map((f) => `{{${f}}}`).join(', ')} before sending.`);
    const outside = row.parties.filter((p) => !p.internal && p.role !== 'copy');
    if (!outside.length) throw new BadRequestException('Add who signs for the other side.');
    for (const p of outside) if (!p.name || !isEmail(p.email)) throw new BadRequestException(`${p.label} needs a name and an email address.`);
    if (!(await this.google.isConnected())) throw new BadRequestException('Sending needs the Google account connected (Settings → Integrations).');
    const targets = outside.filter((p) => !p.signedAt && (!opts.resendKeys?.length || opts.resendKeys.includes(p.key)));
    const at = now();
    for (const p of targets) {
      const url = await this.link(row.id, p.key);
      const note = String(opts.note || '').trim();
      await this.google.sendMail({
        to: p.email,
        subject: `Please sign: ${row.title} (${row.number})`,
        html: [
          `<p>Hi ${p.name.split(' ')[0] || ''},</p>`,
          `<p>${actor.name || 'Origami Design + Build'} has sent you <strong>${row.title}</strong>${row.amount ? ` (${row.amount})` : ''} to review and sign.</p>`,
          note ? `<p>${note.replace(/</g, '&lt;')}</p>` : '',
          (row.attachments || []).length ? `<p>It comes with: ${(row.attachments || []).map((a) => a.name).join(', ')}.</p>` : '',
          `<p><a href="${url}" style="display:inline-block;padding:11px 22px;border-radius:999px;background:#173326;color:#ffffff;text-decoration:none;font-weight:700;">Review, initial and sign</a></p>`,
          `<p style="color:#7E9B93;font-size:12px;">No account needed. This link is yours and stays valid for 30 days.</p>`,
        ].join('\n'),
      });
      p.sentAt = at;
    }
    Object.assign(row, { status: statusFromParties(row.parties), sentAt: row.sentAt || at, updatedAt: at });
    await this.contracts.save(row);
    return { sent: targets.map((p) => p.email), contract: row };
  }

  /** What a signer's page shows: the document, the attachments, and what's theirs to do. */
  async publicView(token: string) {
    const { row, party } = await this.readToken(token);
    // First and latest view, and a count (Oct 27 backlog item 12). The page's own request -- scanners don't run it.
    const at = now();
    if (!party.viewedAt) party.viewedAt = at;
    party.lastViewedAt = at;
    party.views = (party.views || 0) + 1;
    await this.contracts.save(row);
    return {
      number: row.number, title: row.title, amount: row.amount, status: row.status, html: row.html, initialsNeeded: countInitials(row.html),
      attachments: (row.attachments || []).map((a) => ({ fileId: a.fileId, name: a.name, kind: a.kind })),
      you: { key: party.key, label: party.label, name: party.name, email: party.email, signedAt: party.signedAt || null, suggestedInitials: initialsOf(party.name) },
      parties: row.parties.filter((p) => p.role !== 'copy').map((p) => ({ label: p.label, name: p.name, signedAt: p.signedAt || null })),
    };
  }

  /** One of the contract's attachments, for the signer (only files on this contract). */
  async publicAttachment(token: string, fileId: string) {
    const { row } = await this.readToken(token);
    if (!(row.attachments || []).some((a) => a.fileId === fileId)) throw new NotFoundException('Not part of this contract.');
    if (!this.fileRoom) throw new NotFoundException('Files are not available.');
    return this.fileRoom.content(fileId);
  }

  private checkSignature(body: { name?: string; initials?: string; image?: string; initialled?: number; reviewed?: boolean }, need: number) {
    if (!String(body.name || '').trim()) throw new BadRequestException('Type your full name.');
    if (!String(body.initials || '').trim()) throw new BadRequestException('Type your initials.');
    if (need && Number(body.initialled) !== need) throw new BadRequestException(`Initial all ${need} sections before signing.`);
    if (!String(body.image || '').startsWith('data:image/')) throw new BadRequestException('Draw your signature.');
    if (String(body.image).length > 400_000) throw new BadRequestException('That signature image is too large.');
    if (!body.reviewed) throw new BadRequestException('Confirm you have read the whole contract and its attachments.');
  }

  private apply(party: ContractParty, body: { name?: string; initials?: string; image?: string }, meta: { ip?: string; userAgent?: string }) {
    Object.assign(party, {
      signedAt: now(), signedName: String(body.name).trim().slice(0, 200), initials: String(body.initials).trim().toUpperCase().slice(0, 6),
      signatureImage: String(body.image), ip: (meta.ip || '').slice(0, 64), userAgent: (meta.userAgent || '').slice(0, 300),
    });
  }

  /** An outside party initials every section and signs from their link. */
  async publicSign(token: string, body: any, meta: { ip?: string; userAgent?: string }) {
    const { row, party } = await this.readToken(token);
    if (row.status === 'void') throw new BadRequestException('This contract was voided.');
    if (party.signedAt) throw new BadRequestException('You have already signed this contract.');
    if (row.status === 'draft') throw new BadRequestException('This contract hasn’t been sent yet.');
    this.checkSignature(body, countInitials(row.html));
    this.apply(party, body, meta);
    row.status = statusFromParties(row.parties);
    row.updatedAt = now();
    await this.contracts.save(row);
    return this.publicView(token);
  }

  /** Origami signs last, in the app, once everyone else has. Completing it files the PDF and approves a change order. */
  async countersign(id: string, body: any, actor: ContractActor, meta: { ip?: string; userAgent?: string }) {
    const row = await this.contracts.findOneBy({ id });
    if (!row) throw new NotFoundException('Contract not found.');
    if (row.status !== 'countersign') throw new BadRequestException(row.status === 'signed' ? 'It is already signed.' : 'Origami signs once everyone else has.');
    const party = row.parties.find((p) => p.internal && !p.signedAt);
    if (!party) throw new BadRequestException('Nothing left for Origami to sign.');
    this.checkSignature(body, countInitials(row.html));
    this.apply(party, body, meta);
    row.status = statusFromParties(row.parties);
    if (row.status === 'signed') row.signedAt = now();
    row.updatedAt = now();
    await this.contracts.save(row);
    if (row.status === 'signed') await this.complete(row, actor);
    return this.get(id);
  }

  /** Fully signed: file the signed PDF in the project's File Room and record a change order's approval. */
  private async complete(row: ContractEntity, actor: ContractActor) {
    try {
      if (row.projectId && this.fileRoom && (await this.google.isConnected())) {
        const { pdf, filename } = await this.pdf(row);
        const [saved] = await this.fileRoom.upload(row.projectId, ['Contracts'], [{ originalname: filename, mimetype: 'application/pdf', size: pdf.length, buffer: pdf }], { id: actor.id || '', name: actor.name || 'Origami' } as any);
        if (saved?.id) { row.signedFileId = saved.id; await this.contracts.save(row); }
      }
    } catch (e) {
      this.log.warn(`Signed ${row.number} not filed: ${(e as Error).message}`);
    }
    if (row.type === 'co_owner' && row.changeOrderId && this.changeOrders) {
      const owner = row.parties.find((p) => !p.internal && p.role !== 'copy');
      try {
        await this.changeOrders.act(row.changeOrderId, 'client_approve', { signer: owner?.signedName || owner?.name || 'Owner', date: (owner?.signedAt || now()).slice(0, 10), reference: `${row.number} (signed in ODIN)` }, { name: actor.name || 'Origami', id: actor.id, roleKey: actor.roleKey });
      } catch (e) {
        this.log.warn(`Change order ${row.changeOrderId} approval not recorded from ${row.number}: ${(e as Error).message}`);
      }
    }
  }

  /** The contract as a PDF: as it stands (draft or part-signed), or signed. */
  async pdf(rowOrId: ContractEntity | string) {
    const row = typeof rowOrId === 'string' ? await this.contracts.findOneBy({ id: rowOrId }) : rowOrId;
    if (!row) throw new NotFoundException('Contract not found.');
    const brand = brandingFrom(await this.settings.getMany(BRAND_KEYS));
    const body = renderSigned(row.html, row.parties, { title: row.number })
      + ((row.attachments || []).length ? `<p style="font-size:11px;color:#555;margin-top:18px;"><strong>Attached:</strong> ${(row.attachments || []).map((a) => a.name.replace(/</g, '&lt;')).join(', ')}</p>` : '');
    const html = buildLetterHtml({ brand, title: row.title, date: new Date(row.signedAt || row.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), body });
    const footer = [`${row.number}`, row.status === 'signed' ? 'Signed in ODIN' : row.status === 'void' ? 'VOID' : 'Not yet signed'].join('  ·  ');
    const pdf = await this.google.htmlToPdf(html, safeFilename(row.title), { footer });
    return { pdf, filename: `${safeFilename(`${row.number} ${row.title}${row.status === 'signed' ? ' (signed)' : ''}`)}.pdf` };
  }

  async publicPdf(token: string) {
    const { row } = await this.readToken(token);
    return this.pdf(row);
  }

  /** What a contract on this project can be for: its change orders and subcontracts / POs. */
  async links(projectId: number) {
    const [cos, scs] = await Promise.all([this.cos.find({ where: { projectId } }), this.commitments.find({ where: { projectId } })]);
    return {
      changeOrders: cos.map((c) => ({ id: c.id, number: c.number, title: c.title, amount: c.amount, status: c.status })).sort((a, b) => a.number.localeCompare(b.number)),
      commitments: scs.map((c) => ({ id: c.id, number: c.number, title: c.title, vendorName: c.vendorName, contractorId: c.contractorId, type: c.type })).sort((a, b) => a.number.localeCompare(b.number)),
    };
  }

  /** The File Room files a contract can attach (estimates, drawings, specs) for its project. */
  async attachableFiles(projectId: number) {
    const rows = await this.files.find({ where: { projectId } as any });
    return rows.filter((f) => f.isLatest !== false).map((f) => ({ id: f.id, name: f.name, folderPath: f.folderPath || [] })).sort((a, b) => a.name.localeCompare(b.name));
  }
}
