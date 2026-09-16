import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ProjectProgramService, type ProgramActor } from './project-program.service';
import { Tiers } from '../auth/guards/roles.decorator';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
import { BRAND_KEYS, brandingFrom, safeFilename } from '../documents/letterhead';
import { buildProgramHtml, type DocStep } from '../documents/program-document';
import type { AuthedRequest } from '../auth/guards/session.guard';

/** Who did it, off the verified session -- never off anything the client claims. */
const actorFrom = (req: AuthedRequest): ProgramActor => ({ id: req.claims?.sub, name: req.claims?.name });

interface DocumentInput {
  projectId?: number;
  leadId?: string;
  projectName?: string;
  subtitle?: string;
  date?: string;
  steps: DocStep[];
}

@Tiers('internal')
@Controller('project-program')
export class ProjectProgramController {
  constructor(
    private readonly service: ProjectProgramService,
    private readonly google: GoogleService,
    private readonly settings: SettingsService,
  ) {}

  @Get()
  get(@Query('projectId') projectId?: string, @Query('leadId') leadId?: string) {
    return leadId ? this.service.getLead(leadId) : this.service.get(Number(projectId));
  }

  /** The client's own read of their project's program -- gated by the People directory, not just tier. */
  @Tiers('internal', 'client')
  @Get('mine')
  getMine(@Query('projectId') projectId: string, @Req() req: AuthedRequest) {
    if (!req.claims?.email) throw new ForbiddenException('Sign in to continue.');
    return this.service.getForClient(Number(projectId), req.claims.email);
  }

  /** The client's e-signature -- timestamp, IP and user agent are the server's own record, not anything the browser claims. */
  @Tiers('internal', 'client')
  @Post('sign')
  sign(@Body() body: { projectId: number; name: string; image: string }, @Req() req: AuthedRequest) {
    if (!req.claims?.email) throw new ForbiddenException('Sign in to continue.');
    return this.service.sign(
      Number(body?.projectId),
      { name: body?.name, email: req.claims.email },
      body?.image,
      { ip: req.ip || '', userAgent: String(req.headers['user-agent'] || '') },
    );
  }

  @Put()
  save(@Body() body: { projectId?: number; leadId?: string; data: unknown }, @Req() req: AuthedRequest) {
    return body?.leadId
      ? this.service.saveLead(body.leadId, body.data, actorFrom(req))
      : this.service.save(Number(body?.projectId), body?.data, actorFrom(req));
  }

  @Put('complete')
  complete(@Body() body: { projectId?: number; leadId?: string; complete?: boolean }) {
    return body?.leadId
      ? this.service.setCompleteLead(body.leadId, body.complete !== false)
      : this.service.setComplete(Number(body?.projectId), body.complete !== false);
  }

  /** Every past save, newest first -- the living document's history. */
  @Get('versions')
  listVersions(@Query('projectId') projectId?: string, @Query('leadId') leadId?: string) {
    return leadId ? this.service.listVersionsForLead(leadId) : this.service.listVersionsFor(Number(projectId));
  }

  /** One past save in full, to preview before deciding whether to restore it. */
  @Get('versions/:id')
  getVersion(@Param('id') id: string, @Query('projectId') projectId?: string, @Query('leadId') leadId?: string) {
    return leadId ? this.service.getVersionForLead(leadId, Number(id)) : this.service.getVersionFor(Number(projectId), Number(id));
  }

  /** Copies an old version's answers back over the current document. */
  @Post('versions/:id/restore')
  restoreVersion(@Param('id') id: string, @Body() body: { projectId?: number; leadId?: string }, @Req() req: AuthedRequest) {
    return body?.leadId
      ? this.service.restoreVersionLead(body.leadId, Number(id), actorFrom(req))
      : this.service.restoreVersion(Number(body?.projectId), Number(id), actorFrom(req));
  }

  /** The program on the company letterhead, as a PDF to read or download. */
  @Post('pdf')
  async pdf(@Body() body: DocumentInput, @Res() res: Response) {
    const { pdf, filename } = await this.render(body);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.end(pdf);
  }

  /** Email the program to the client with that same PDF attached. */
  @Post('send')
  async send(
    @Body() body: DocumentInput & {
      to: string; cc?: string; subject: string; html: string;
      /** Off by default only when the caller explicitly opts out -- normally this IS the document being sent. */
      includeProgram?: boolean;
      /** Extra files picked by the sender, base64-encoded client-side. */
      extraAttachments?: { filename: string; mimeType?: string; contentBase64: string }[];
    },
    @Req() req: AuthedRequest,
  ) {
    const attachments: { filename: string; mimeType: string; content: Buffer }[] = [];
    let filename = '';
    if (body.includeProgram !== false) {
      const rendered = await this.render(body);
      attachments.push({ filename: rendered.filename, mimeType: 'application/pdf', content: rendered.pdf });
      filename = rendered.filename;
    }
    for (const f of body.extraAttachments || []) {
      if (!f?.filename || !f?.contentBase64) continue;
      attachments.push({ filename: f.filename, mimeType: f.mimeType || 'application/octet-stream', content: Buffer.from(f.contentBase64, 'base64') });
    }
    await this.google.sendMail({
      to: body.to,
      cc: body.cc,
      subject: body.subject,
      html: body.html,
      attachments,
    });
    if (body.leadId) await this.service.markSentLead(body.leadId, body.to, actorFrom(req));
    else await this.service.markSent(Number(body.projectId), body.to, actorFrom(req));
    return { ok: true, filename, to: body.to, attachmentCount: attachments.length };
  }

  /** Shared by the download and the send, so neither can drift from the other. */
  private async render(body: DocumentInput) {
    const brand = brandingFrom(await this.settings.getMany(BRAND_KEYS));
    const projectName = body.projectName || (body.leadId ? `Lead ${body.leadId}` : `Project ${body.projectId}`);
    const html = buildProgramHtml({
      brand,
      projectName,
      subtitle: body.subtitle,
      date: body.date,
      steps: Array.isArray(body.steps) ? body.steps : [],
    });
    const name = safeFilename(`${projectName} - Project Program`);
    // The running head repeats on every printed page; the section bands in the
    // HTML repeat per section. Both, so a page that overflows still says whose
    // document it is.
    const header = [brand.companyName, projectName, 'Project Program'].filter(Boolean).join('  ·  ');
    const footer = [brand.address, brand.phone, brand.email, brand.website].filter(Boolean).join('  ·  ');
    // Landscape for this document only -- the plain letterhead path in
    // google.controller.ts doesn't pass this and stays portrait.
    const pdf = await this.google.htmlToPdf(html, name, { header, footer }, true);
    return { pdf, filename: `${name}.pdf` };
  }
}
