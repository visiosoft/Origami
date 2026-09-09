import { Body, Controller, Get, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ProjectProgramService } from './project-program.service';
import { Tiers } from '../auth/guards/roles.decorator';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
import { BRAND_KEYS, brandingFrom, safeFilename } from '../documents/letterhead';
import { buildProgramHtml, type DocStep } from '../documents/program-document';

interface DocumentInput {
  projectId: number;
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
  get(@Query('projectId') projectId: string) {
    return this.service.get(Number(projectId));
  }

  @Put()
  save(@Body() body: { projectId: number; data: unknown }, @Req() req: any) {
    return this.service.save(Number(body?.projectId), body?.data, req?.user);
  }

  @Put('complete')
  complete(@Body() body: { projectId: number; complete?: boolean }) {
    return this.service.setComplete(Number(body?.projectId), body?.complete !== false);
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
    @Body() body: DocumentInput & { to: string; cc?: string; subject: string; html: string },
    @Req() req: any,
  ) {
    const { pdf, filename } = await this.render(body);
    await this.google.sendMail({
      to: body.to,
      cc: body.cc,
      subject: body.subject,
      html: body.html,
      attachments: [{ filename, mimeType: 'application/pdf', content: pdf }],
    });
    await this.service.markSent(Number(body.projectId), body.to, req?.user);
    return { ok: true, filename, to: body.to };
  }

  /** Shared by the download and the send, so neither can drift from the other. */
  private async render(body: DocumentInput) {
    const brand = brandingFrom(await this.settings.getMany(BRAND_KEYS));
    const projectName = body.projectName || `Project ${body.projectId}`;
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
    const pdf = await this.google.htmlToPdf(html, name, { header, footer });
    return { pdf, filename: `${name}.pdf` };
  }
}
