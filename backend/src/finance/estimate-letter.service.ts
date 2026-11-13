import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workbook } from 'exceljs';
import { readState, signState } from '../auth/crypto.util';
import { CsiCodeEntity, RoleEntity, UserEntity, type EstimateEntity } from '../database/entities';
import { brandingFrom } from '../documents/letterhead';
import { emailShell, escapeHtml, loadEmailBrand } from '../email/shell';
import { FileRoomService } from '../file-room/file-room.service';
import { GoogleService } from '../google/google.service';
import type { Actor } from '../manpower/manpower-access.service';
import { SettingsService } from '../settings/settings.service';
import { viewButton } from './change-orders.service';
import { NOTE_LABEL, STRATEGY_LABEL, PRICING_LABEL, type EstimateResult } from './estimate.calc';
import { estimateEmailBody, estimateHtml } from './estimate.document';
import { moneyRightsOf, redactEstimate, type MoneyRights } from './estimate.money';
import { EstimatesService } from './estimates.service';
import { BOOK_ROLE, FinancialsService } from './financials.service';

const LINK_DAYS = 60;
const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;
const now = () => new Date().toISOString();

/** Closed book when the client role can't be found: prices and totals only. */
const CLOSED: MoneyRights = { full: false, cost: false, markup: false, price: true, subtotal: true, grDetail: false, grTotal: false, profit: false, contingency: false, total: true };

/**
 * K8 (Nov 13): the estimate as a letter -- PDF, emailed to the client with a
 * link to accept it online (typed name + drawn signature), which marks the
 * revision accepted and files the signed PDF in the project's File Room --
 * and the internal .xlsx export.
 */
@Injectable()
export class EstimateLetterService {
  private readonly log = new Logger('EstimateLetter');
  constructor(
    private readonly estimates: EstimatesService,
    private readonly fin: FinancialsService,
    private readonly settings: SettingsService,
    private readonly google: GoogleService,
    @InjectRepository(RoleEntity) private readonly roles: Repository<RoleEntity>,
    @InjectRepository(CsiCodeEntity) private readonly csi: Repository<CsiCodeEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @Optional() private readonly fileRoom?: FileRoomService,
  ) {}

  /** What the client's copy shows: the project's book type -> that client role's data types (K7). */
  async clientMoney(projectId: number): Promise<MoneyRights> {
    const { value } = await this.fin.settingsFor(projectId);
    const key = BOOK_ROLE[(value.bookType || 'closed') as keyof typeof BOOK_ROLE] || BOOK_ROLE.closed;
    const role = await this.roles.findOne({ where: { key } });
    if (!role) return CLOSED;
    const m = moneyRightsOf(role.permissions);
    // A client role that sets none of the data types is closed book, never everything.
    return Object.keys(role.permissions || {}).some((k) => k.startsWith('fin:')) ? m : CLOSED;
  }

  private async brand() {
    const keys = ['companyName', 'tagline', 'logoDataUrl', 'accentColor', 'address', 'phone', 'email', 'website', 'footerNote'].map((k) => `brand.${k}`);
    return brandingFrom(await this.settings.getMany(keys));
  }

  private async html(e: EstimateEntity, sheet: { scopes: any[]; lines: any[]; gr: any[] }, result: EstimateResult) {
    const [project, { value: fs }, money, brand, codes] = await Promise.all([
      this.fin.project(e.projectId), this.fin.settingsFor(e.projectId), this.clientMoney(e.projectId), this.brand(), this.csi.find(),
    ]);
    const label = new Map(codes.map((c: any) => [c.id, c.code]));
    return estimateHtml({
      estimate: e as any, scopes: sheet.scopes.map((s) => ({ id: s.id, title: s.title, csiLabel: s.csiCodeId ? label.get(s.csiCodeId) || null : null })),
      lines: sheet.lines, gr: sheet.gr, result, money, projectName: project.name,
      client: { name: fs.billToName, address: fs.billToAddress }, brand,
    });
  }

  private async render(e: EstimateEntity, sheet: any, result: EstimateResult) {
    const brand = await this.brand();
    const footer = [brand.address, brand.phone, brand.email, brand.website].filter(Boolean).join('  ·  ');
    const name = `${e.number} Rev ${e.rev}`;
    const pdf = await this.google.htmlToPdf(await this.html(e, sheet, result), name, footer ? { footer } : undefined);
    return { pdf, filename: `${name}.pdf` };
  }

  /** The client's copy as a PDF, for staff to preview before sending. */
  async pdf(projectId: number, id: string, actor: Actor) {
    const { e, sheet, result } = await this.estimates.raw(projectId, id, actor);
    if (!(await this.google.isConnected())) throw new BadRequestException('No Google account is connected for making PDFs (Settings → Integrations).');
    return this.render(e, sheet, result);
  }

  private async token(e: EstimateEntity) { return signState({ mode: 'est-sign', estimateId: e.id }, await this.settings.jwtSecret()); }
  private async fromToken(token: string) {
    const st = readState(String(token || ''), await this.settings.jwtSecret(), LINK_DAYS * 24 * 60 * 60_000);
    if (!st || st.mode !== 'est-sign' || !st.estimateId) throw new ForbiddenException('This link has expired. Ask your project contact to send the estimate again.');
    return this.estimates.raw(0, String(st.estimateId), null);
  }

  /**
   * Email the client's copy: marks a draft as sent (it's frozen from then on),
   * attaches the PDF and a link to accept it online. To the project's bill-to
   * contact unless another address is given.
   */
  async send(projectId: number, id: string, dto: { to?: string; cc?: string; note?: string }, actor: Actor) {
    let { e } = await this.estimates.raw(projectId, id, actor, 'edit');
    if (e.status === 'accepted' || e.status === 'superseded') throw new ConflictException(`${e.number} Rev ${e.rev} is ${e.status}; send the latest revision.`);
    if (!(await this.google.isConnected())) throw new BadRequestException('No Google account is connected for sending mail (Settings → Integrations).');
    const { value: fs } = await this.fin.settingsFor(projectId);
    const to = String(dto?.to || fs.billToEmail || '').replace(/[\r\n]/g, '').trim();
    if (!EMAIL.test(to)) throw new BadRequestException('Give the client’s email address (or set the bill-to email in the project’s financial settings).');
    const cc = String(dto?.cc || '').split(/[,;]/).map((x) => x.replace(/[\r\n]/g, '').trim()).filter((x) => EMAIL.test(x) && x !== to);
    if (e.status === 'draft') await this.estimates.markSent(projectId, id, actor);
    const fresh = await this.estimates.raw(projectId, id, actor);
    e = fresh.e;
    const { pdf, filename } = await this.render(e, fresh.sheet, fresh.result);
    const project = await this.fin.project(projectId);
    const money = await this.clientMoney(projectId);
    const link = `${(await this.settings.baseUrl()) || ''}/sign-estimate?token=${encodeURIComponent(await this.token(e))}`;
    const emailBrand = await loadEmailBrand(this.settings);
    const first = (fs.billToName || '').split(/\s+/)[0];
    const note = String(dto?.note || '').trim().slice(0, 4000);
    await this.google.sendMail({
      to, cc: cc.join(', ') || undefined,
      subject: `Estimate ${e.number} Rev ${e.rev} — ${project.name}`,
      html: emailShell({ brand: emailBrand as any, eyebrow: `Estimate · ${e.number} Rev ${e.rev}`, title: first ? `Hi ${escapeHtml(first)},` : 'Hello,',
        body: estimateEmailBody({ number: e.number, rev: e.rev, title: e.title, projectName: project.name, total: money.total ? fresh.result.totals.totalProject : null, note }) + viewButton(link).replace('View the change order', 'Review and accept the estimate'),
        footer: `Sent by ${escapeHtml(actor.name)} at ${escapeHtml(emailBrand.companyName)}.` }),
      attachments: [{ filename, mimeType: 'application/pdf', content: pdf }],
    });
    e.sentTo = [to, ...cc].join(', ').slice(0, 300); e.sentById = actor.id || null;
    await this.estimates.saveEntity(e);
    await this.fin.log(null, { projectId, entityType: 'estimate', entityId: e.id, action: 'estimate_emailed', changes: { sentTo: { from: null, to: e.sentTo } } }, actor);
    return { sent: true, to: e.sentTo, link };
  }

  /** The client's signing page: the letter, and whether it can still be accepted. */
  async publicView(token: string) {
    const { e, sheet, result } = await this.fromToken(token);
    const all = await this.estimates.revisionsOf(e.projectId, e.number);
    const latest = all.filter((x) => x.status !== 'draft').sort((a, b) => b.rev - a.rev)[0];
    const accepted = all.find((x) => x.status === 'accepted');
    const replacedBy = e.status === 'superseded' && latest && latest.id !== e.id ? latest.rev : null;
    const brand = await this.brand();
    return {
      number: e.number, rev: e.rev, title: e.title, status: e.status, projectName: (await this.fin.project(e.projectId)).name,
      companyName: brand.companyName, accentColor: brand.accentColor, html: await this.html(e, sheet, result),
      canSign: e.status === 'sent' && !accepted, replacedBy, acceptedAt: e.acceptedAt, signedName: e.signedName,
      otherAccepted: accepted && accepted.id !== e.id ? accepted.rev : null,
    };
  }

  async publicPdf(token: string) {
    const { e, sheet, result } = await this.fromToken(token);
    return this.render(e, sheet, result);
  }

  /**
   * The client accepts online: their typed name and drawn signature go on the
   * letter, the revision becomes accepted, the signed PDF is filed in the
   * project's File Room (Estimates), and whoever sent it gets an email.
   */
  async sign(token: string, dto: { name?: string; email?: string; image?: string; agree?: boolean }, meta: { ip?: string }) {
    const { e } = await this.fromToken(token);
    const name = String(dto?.name || '').replace(/[\r\n]/g, ' ').trim().slice(0, 200);
    const email = String(dto?.email || '').trim().slice(0, 200);
    const image = String(dto?.image || '');
    if (!dto?.agree) throw new BadRequestException('Tick the box to accept the estimate.');
    if (name.length < 2) throw new BadRequestException('Type your full name.');
    if (email && !EMAIL.test(email)) throw new BadRequestException('That email address doesn’t look right.');
    if (!/^data:image\/png;base64,[a-z0-9+/=]+$/i.test(image) || image.length > 400_000) throw new BadRequestException('Draw your signature in the box.');
    const all = await this.estimates.revisionsOf(e.projectId, e.number);
    if (all.some((x) => x.status === 'accepted')) throw new ConflictException('This estimate has already been accepted.');
    if (e.status !== 'sent') {
      const latest = all.filter((x) => x.status === 'sent').sort((a, b) => b.rev - a.rev)[0];
      throw new ConflictException(latest ? `This estimate was replaced by Rev ${latest.rev}. Please open the latest one.` : 'This estimate can no longer be accepted online.');
    }
    e.status = 'accepted'; e.acceptedAt = now(); e.acceptedBy = (email ? `${name} <${email}>` : name).slice(0, 120);
    e.signedName = name; e.signedEmail = email || null; e.signatureImage = image; e.signedIp = String(meta?.ip || '').slice(0, 80) || null;
    e.updatedAt = now(); e.updatedBy = name;
    await this.estimates.saveEntity(e);
    const who: Actor = { name: `${name} (client, online)` };
    await this.fin.log(null, { projectId: e.projectId, entityType: 'estimate', entityId: e.id, action: 'accepted', reason: `${e.number} Rev ${e.rev} accepted online by ${name}` }, who);
    void this.afterSigned(e).catch((err) => this.log.warn(`After signing ${e.number}: ${(err as Error).message}`));
    return { accepted: true, acceptedAt: e.acceptedAt };
  }

  private async afterSigned(e: EstimateEntity) {
    const fresh = await this.estimates.raw(0, e.id, null);
    const { pdf, filename } = await this.render(fresh.e, fresh.sheet, fresh.result);
    if (this.fileRoom) {
      const [saved] = await this.fileRoom.upload(e.projectId, ['Estimates'], [{ originalname: `${filename.replace(/\.pdf$/, '')} (signed).pdf`, mimetype: 'application/pdf', size: pdf.length, buffer: pdf }], { id: '', name: 'Origami' } as any);
      if (saved?.id) { fresh.e.signedFileId = saved.id; await this.estimates.saveEntity(fresh.e); }
    }
    const sender = e.sentById ? await this.users.findOne({ where: { id: e.sentById } }) : null;
    const to = sender?.email;
    if (to && EMAIL.test(to)) {
      const project = await this.fin.project(e.projectId);
      const emailBrand = await loadEmailBrand(this.settings);
      await this.google.sendMail({
        to, subject: `Accepted: estimate ${e.number} Rev ${e.rev} — ${project.name}`,
        html: emailShell({ brand: emailBrand as any, eyebrow: 'Estimate accepted', title: `${escapeHtml(e.signedName || 'The client')} accepted ${escapeHtml(e.number)} Rev ${e.rev}`,
          body: `<p style="margin:0;font-size:13.5px;line-height:1.6;color:#43514D;">${escapeHtml(project.name)} — signed online. The signed PDF is attached and filed in the project’s File Room (Estimates). Next: “Set up the job” on the estimate.</p>`,
          footer: escapeHtml(emailBrand.companyName) }),
        attachments: [{ filename: `${filename.replace(/\.pdf$/, '')} (signed).pdf`, mimeType: 'application/pdf', content: pdf }],
      });
    }
  }

  /** The internal workbook: what the caller may see (K7), scope subtotals as formulas, GR and totals, statements. */
  async xlsx(projectId: number, id: string, actor: Actor): Promise<{ buffer: Buffer; filename: string }> {
    const raw = await this.estimates.raw(projectId, id, actor);
    const r = redactEstimate({ estimate: raw.e as any, scopes: raw.sheet.scopes, lines: raw.sheet.lines, gr: raw.sheet.gr, result: raw.result }, raw.rights!.money);
    const wb = new Workbook();
    wb.creator = 'Origami';
    const ws = wb.addWorksheet('Estimate', { views: [{ state: 'frozen', ySplit: 4 }] });
    const lineOut = new Map(r.result.lines.map((l: any) => [l.id, l]));
    const show = { cost: r.result.lines.some((l: any) => l.cost != null) || !r.result.lines.length, markup: r.result.lines.some((l: any) => l.markup != null), price: r.result.lines.some((l: any) => l.price != null) };
    const cols: { header: string; key: string; width: number; money?: boolean }[] = [
      { header: '#', key: 'n', width: 7 }, { header: 'Line item', key: 'd', width: 52 }, { header: 'Pricing', key: 'p', width: 10 },
      ...(show.cost ? [{ header: 'Sub cost', key: 'cost', width: 14, money: true }] : []),
      ...(show.markup ? [{ header: 'Markup $', key: 'markup', width: 13, money: true }] : []),
      ...(show.price ? [{ header: 'Line item total', key: 'price', width: 15, money: true }] : []),
      { header: 'Performing strategy', key: 's', width: 22 }, { header: 'Performing sub', key: 'sub', width: 26 },
    ];
    ws.getCell('A1').value = `${raw.e.number} Rev ${raw.e.rev} — ${raw.e.title || ''}`; ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A2').value = `${(await this.fin.project(projectId)).name} · ${raw.e.status}${raw.e.estimateDate ? ` · ${raw.e.estimateDate}` : ''}`;
    ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
    const head = ws.getRow(4);
    cols.forEach((c, i) => { const cell = head.getCell(i + 1); cell.value = c.header; cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.key === 'cost' || c.key === 's' || c.key === 'sub' ? 'FF3C5C8A' : c.key === 'markup' ? 'FF2E7D50' : 'FF173326' } }; });
    const colOf = (k: string) => cols.findIndex((c) => c.key === k) + 1;
    const letter = (k: string) => ws.getColumn(colOf(k)).letter;
    const MONEY = '"$"#,##0.00;[Red]-"$"#,##0.00';
    let row = 5;
    const scopeTotals: string[] = [];
    r.scopes.forEach((s: any, si: number) => {
      const sr = ws.getRow(row++);
      sr.getCell(1).value = si + 1; sr.getCell(2).value = s.title || 'Scope'; sr.font = { bold: true };
      sr.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3EFE6' } }; });
      const first = row;
      r.lines.filter((l: any) => l.scopeId === s.id).forEach((l: any, li: number) => {
        const o: any = lineOut.get(l.id);
        const x = ws.getRow(row++);
        const note = l.kind && l.kind !== 'item';
        x.getCell(1).value = note ? '' : `${si + 1}.${String(li + 1).padStart(2, '0')}`;
        x.getCell(2).value = note ? `${NOTE_LABEL[l.kind as keyof typeof NOTE_LABEL] || l.kind}: ${l.description || ''}` : l.description || '';
        x.getCell(2).alignment = { wrapText: true, vertical: 'top' };
        if (note) { x.getCell(2).font = { italic: true, color: { argb: 'FF667066' } }; return; }
        x.getCell(3).value = (PRICING_LABEL[l.pricing as keyof typeof PRICING_LABEL] || l.pricing || '').replace(/^.*\((\w+&?\w*)\)$/, '$1');
        if (show.cost) x.getCell(colOf('cost')).value = o?.cost == null ? null : o.cost / 100;
        if (show.markup) x.getCell(colOf('markup')).value = o?.markup == null ? null : o.markup / 100;
        if (show.price) x.getCell(colOf('price')).value = o?.price == null ? null : (l.pricing === 'nis' ? 0 : o.price / 100);
        x.getCell(colOf('s')).value = STRATEGY_LABEL[l.strategy as keyof typeof STRATEGY_LABEL] || '';
        x.getCell(colOf('sub')).value = l.subName || '';
      });
      if (show.price && row > first) {
        const c = sr.getCell(colOf('price'));
        c.value = { formula: `SUM(${letter('price')}${first}:${letter('price')}${row - 1})`, result: (s.total ?? 0) / 100 } as any;
        scopeTotals.push(`${letter('price')}${sr.number}`);
      }
    });
    for (const c of cols) if (c.money) ws.getColumn(colOf(c.key)).numFmt = MONEY;
    row++;
    const t: any = r.result.totals;
    const put = (label: string, v: number | null | undefined, formula?: string, bold = false) => {
      if (v == null) return;
      const x = ws.getRow(row++);
      x.getCell(2).value = label; x.getCell(2).font = { bold };
      const at = x.getCell(show.price ? colOf('price') : 3);
      at.value = formula ? ({ formula, result: v / 100 } as any) : v / 100; at.numFmt = MONEY; at.font = { bold };
    };
    put('Subtotal', t.subtotal, scopeTotals.length ? scopeTotals.join('+') : undefined, true);
    if (r.gr.some((g: any) => g.base != null)) r.gr.filter((g: any) => g.included !== false).forEach((g: any) => put(`  GR: ${g.title}`, (r.result.gr.find((x: any) => x.id === g.id) as any)?.amount));
    put('General Requirements total', t.grTotal);
    if (t.gl) put('General Liability', t.gl);
    put('Profit', t.profit); put('Contractor contingency', t.contingency);
    put('Total build cost', t.totalBuild, undefined, true);
    if (t.discount) put('Discounts & credits', -t.discount);
    if (t.designCost) put('Design cost', t.designCost);
    put('Total project cost', t.totalProject, undefined, true);

    const st = wb.addWorksheet('Statements');
    st.columns = [{ header: 'Scope', key: 'scope', width: 30 }, { header: 'Kind', key: 'kind', width: 26 }, { header: 'Text', key: 'text', width: 90 }];
    st.getRow(1).font = { bold: true };
    for (const s of r.scopes as any[]) for (const l of r.lines.filter((x: any) => x.scopeId === s.id && x.kind && x.kind !== 'item' && (x.description || '').trim()) as any[]) {
      st.addRow({ scope: s.title || '', kind: NOTE_LABEL[l.kind as keyof typeof NOTE_LABEL] || l.kind, text: l.description }).getCell(3).alignment = { wrapText: true };
    }
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return { buffer, filename: `${raw.e.number} Rev ${raw.e.rev}.xlsx` };
  }
}

