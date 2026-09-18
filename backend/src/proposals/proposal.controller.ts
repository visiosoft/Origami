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
    const brand = brandingFrom(await this.settings.getMany(BRAND_KEYS));
    const bodyWithAmount = [
      body.amount ? `<p><strong>Proposed contract amount:</strong> ${body.amount}</p>` : '',
      body.html || '',
    ].filter(Boolean).join('\n');
    const html = buildLetterHtml({ brand, title: body.subject, recipient: body.dealName, date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), body: bodyWithAmount });
    const filename = safeFilename(body.subject || 'Document') + '.pdf';
    const pdf = await this.google.htmlToPdf(html, safeFilename(body.subject || 'Document'));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.end(pdf);
  }

  /** Emails the proposal with the letterhead PDF attached, plus a signing link the prospect can open without an account. */
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
    const brand = brandingFrom(await this.settings.getMany(BRAND_KEYS));
    const bodyWithAmount = [
      doc.amount ? `<p><strong>Proposed contract amount:</strong> ${doc.amount}</p>` : '',
      doc.html,
      `<p><a href="${link}">Review and sign the proposal</a> — this link is valid for 10 days.</p>`,
    ].filter(Boolean).join('\n');
    const html = buildLetterHtml({ brand, title: doc.subject, recipient: doc.dealName, date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), body: bodyWithAmount });
    const filename = safeFilename(doc.subject || 'Proposal') + '.pdf';
    const pdf = await this.google.htmlToPdf(html, safeFilename(doc.subject || 'Proposal'));
    const attachments = [{ filename, mimeType: 'application/pdf', content: pdf }];
    for (const f of body.extraAttachments || []) {
      if (!f?.filename || !f?.contentBase64) continue;
      attachments.push({ filename: f.filename, mimeType: f.mimeType || 'application/octet-stream', content: Buffer.from(f.contentBase64, 'base64') });
    }
    await this.google.sendMail({
      to: body.to,
      cc: body.cc,
      subject: doc.subject,
      html: bodyWithAmount,
      attachments,
    });
    await this.service.markSent(body.dealId, body.to, { id: req.claims?.sub, name: req.claims?.name });
    return { ok: true, to: body.to, link, attachmentCount: attachments.length };
  }

  // --- Public side: the prospect's own signing page, no account needed ---

  @Public()
  @Get('public')
  getByToken(@Query('token') token: string) {
    return this.service.getByToken(token);
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
