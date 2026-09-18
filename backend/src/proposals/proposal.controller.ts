import { Body, Controller, Get, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ProposalService } from './proposal.service';
import { Tiers } from '../auth/guards/roles.decorator';
import { Public } from '../auth/guards/public.decorator';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
import { BRAND_KEYS, brandingFrom, buildLetterHtml, safeFilename } from '../documents/letterhead';
import type { AuthedRequest } from '../auth/guards/session.guard';

@Controller('proposals')
export class ProposalController {
  constructor(
    private readonly service: ProposalService,
    private readonly google: GoogleService,
    private readonly settings: SettingsService,
  ) {}

  // --- Staff side: preparing and sending the proposal ---

  @Tiers('internal')
  @Get()
  get(@Query('dealId') dealId: string) {
    return this.service.get(dealId);
  }

  @Tiers('internal')
  @Put()
  save(@Body() body: { dealId: string; subject?: string; html?: string; amount?: string }, @Req() req: AuthedRequest) {
    return this.service.save(body?.dealId, body, { id: req.claims?.sub, name: req.claims?.name });
  }

  /** Renders whatever is currently in the composer -- saved or not -- as a PDF, to preview before sending. */
  @Tiers('internal')
  @Post('pdf')
  async pdf(@Body() body: { subject?: string; html?: string; amount?: string; dealName?: string }, @Res() res: Response) {
    const { pdf, filename } = await this.renderPdf(body.subject, body.html || '', body.amount, body.dealName);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.end(pdf);
  }

  /** Emails a short note -- the document itself only lives in the PDF and the signing page, never pasted into the email body. */
  @Tiers('internal')
  @Post('send')
  async send(
    @Body() body: {
      dealId: string; to: string; cc?: string;
      /** Extra local files picked by the sender, base64-encoded client-side. */
      extraAttachments?: { filename: string; mimeType?: string; contentBase64: string }[];
    },
    @Req() req: AuthedRequest,
  ) {
    const doc = await this.service.get(body.dealId);
    const link = await this.service.signingLink(body.dealId);
    const { pdf, filename } = await this.renderPdf(doc.subject, doc.html, doc.amount, doc.dealName);
    const attachments = [{ filename, mimeType: 'application/pdf', content: pdf }];
    for (const f of body.extraAttachments || []) {
      if (!f?.filename || !f?.contentBase64) continue;
      attachments.push({ filename: f.filename, mimeType: f.mimeType || 'application/octet-stream', content: Buffer.from(f.contentBase64, 'base64') });
    }
    const noteBody = [
      `<p>Hi${doc.dealName ? ` ${doc.dealName}` : ''},</p>`,
      `<p>Attached is <strong>${doc.subject}</strong>${doc.amount ? ` (proposed amount: ${doc.amount})` : ''} for your review.</p>`,
      `<p><a href="${link}" style="display:inline-block;padding:11px 22px;border-radius:999px;background:#173326;color:#ffffff;text-decoration:none;font-weight:700;">Review and sign the proposal</a></p>`,
      `<p style="color:#7E9B93;font-size:12px;">This link is valid for 10 days. No account needed to sign.</p>`,
    ].join('\n');
    await this.google.sendMail({
      to: body.to,
      cc: body.cc,
      subject: doc.subject,
      html: noteBody,
      attachments,
    });
    await this.service.markSent(body.dealId, body.to, { id: req.claims?.sub, name: req.claims?.name });
    return { ok: true, to: body.to, link, attachmentCount: attachments.length };
  }

  /** Shared by the internal preview and the send -- neither can drift from the other. */
  private async renderPdf(subject: string | undefined, docHtml: string, amount?: string, dealName?: string) {
    const brand = brandingFrom(await this.settings.getMany(BRAND_KEYS));
    const bodyWithAmount = [
      amount ? `<p><strong>Proposed contract amount:</strong> ${amount}</p>` : '',
      docHtml || '',
    ].filter(Boolean).join('\n');
    const html = buildLetterHtml({ brand, title: subject, recipient: dealName, date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), body: bodyWithAmount });
    const filename = safeFilename(subject || 'Document') + '.pdf';
    // A real running footer, not just one written into the HTML flow, so a
    // proposal/agreement that overflows onto another page still carries it.
    const footer = [brand.address, brand.phone, brand.email, brand.website].filter(Boolean).join('  ·  ');
    const pdf = await this.google.htmlToPdf(html, safeFilename(subject || 'Document'), footer ? { footer } : undefined);
    return { pdf, filename: `${filename}` };
  }

  // --- Public side: the prospect's own signing page, no account needed ---

  @Public()
  @Get('public')
  getByToken(@Query('token') token: string) {
    return this.service.getByToken(token);
  }

  /** The document as a real, scrollable PDF -- the client's own signature (once captured) rendered in place, not pasted into an email or a plain HTML block. */
  @Public()
  @Get('public/pdf')
  async pdfByToken(@Query('token') token: string, @Res() res: Response) {
    try {
      const doc: any = await this.service.getByToken(token);
      const signedDate = doc.signedAt
        ? new Date(doc.signedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : '____________________';
      const clientSignature = doc.signatureImage
        ? `<img src="${doc.signatureImage}" alt="Signature of ${doc.signedByName}" style="max-width:220px;height:auto;display:block;margin-bottom:4px;" />`
        : '__________________________________';
      const merged = String(doc.html || '')
        .replace(/\{\{clientSignature\}\}/g, clientSignature)
        .replace(/\{\{signedDate\}\}/g, signedDate);
      const { pdf, filename } = await this.renderPdf(doc.subject, merged, doc.amount, doc.dealName);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      return res.end(pdf);
    } catch (err) {
      console.error('pdfByToken failed:', err);
      res.status(500);
      return res.end(String((err as Error)?.message || err));
    }
  }

  @Public()
  @Post('public/sign')
  signByToken(@Body() body: { token: string; name: string; email?: string; image: string }, @Req() req: AuthedRequest) {
    return this.service.signByToken(
      body?.token,
      { name: body?.name, email: body?.email || '' },
      body?.image,
      { ip: req.ip || '', userAgent: String(req.headers['user-agent'] || '') },
    );
  }
}
