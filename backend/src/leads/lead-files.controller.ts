import { Body, Controller, Delete, Get, Headers, Param, Post, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Readable } from 'stream';
import { Tiers } from '../auth/guards/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService, MAX_FILE_BYTES, MAX_FILES_PER_UPLOAD } from '../google/attachments.service';
import { AddLinkDto } from '../tasks/dto/update-task.dto';
import { LeadFilesService } from './lead-files.service';
import { ClientWelcomeService } from './client-welcome.service';
import { AllFilesService } from './all-files.service';

/**
 * A lead's files, on the routes the shared Attachments component uses
 * (scope "lead-files", the lead id in the task-id slot). `stage` tags an
 * upload with the pipeline stage it belongs to.
 */
@Tiers('internal')
@Controller('lead-files')
export class LeadFilesController {
  constructor(
    private readonly files: LeadFilesService,
    private readonly auth: AuthService,
    private readonly attachments: AttachmentsService,
    private readonly welcome: ClientWelcomeService,
    private readonly all: AllFilesService,
  ) {}

  /** Every file on a project: its lead's, the client's, its tasks', RFIs' and File Room's -- numbered. */
  @Get('project/:projectId/all')
  allForProject(@Param('projectId') projectId: string) {
    return this.all.forProject(Number(projectId));
  }

  /** Every file on a lead (and the project it became): stage files, client uploads, task files. */
  @Get(':leadId/all')
  allForLead(@Param('leadId') leadId: string) {
    return this.all.forLead(leadId);
  }

  /** The client welcome email + upload link: sent when, link live, uploads so far. */
  @Get(':leadId/welcome')
  welcomeStatus(@Param('leadId') leadId: string) {
    return this.welcome.status(leadId);
  }

  @Post(':leadId/welcome')
  async sendWelcome(@Param('leadId') leadId: string, @Body() dto: { to?: string; note?: string; items?: string[] }, @Headers('authorization') a?: string) {
    return this.welcome.send(leadId, dto || {}, await this.auth.requireActor(a));
  }

  @Post(':leadId/welcome/disable')
  disableLink(@Param('leadId') leadId: string) {
    return this.welcome.disable(leadId);
  }

  @Get(':leadId')
  list(@Param('leadId') leadId: string) {
    return this.files.list(leadId);
  }

  @Post(':leadId/attachments')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD, { limits: { fileSize: MAX_FILE_BYTES } }))
  async upload(
    @Param('leadId') leadId: string, @UploadedFiles() files: any[],
    @Query('stage') stage?: string, @Query('stageName') stageName?: string, @Headers('authorization') a?: string,
  ) {
    return this.files.addAttachments(leadId, files, await this.auth.requireActor(a), stage, stageName);
  }

  @Post(':leadId/attachments/link')
  async link(@Param('leadId') leadId: string, @Body() dto: AddLinkDto & { stage?: string; stageName?: string }, @Headers('authorization') a?: string) {
    return this.files.addLink(leadId, dto.name ?? '', dto.url, await this.auth.actor(a), dto.stage, dto.stageName);
  }

  @Delete(':leadId/attachments/:attId')
  remove(@Param('leadId') leadId: string, @Param('attId') attId: string) {
    return this.files.removeAttachment(leadId, attId);
  }

  @Get(':leadId/attachments/:attId/content')
  async content(@Param('leadId') leadId: string, @Param('attId') attId: string, @Query('thumb') thumb: string, @Res() res: Response) {
    const att = await this.files.attachment(leadId, attId);
    const file = await this.attachments.download(att, thumb === '1');
    const inline = AttachmentsService.inlineSafe(file.mimeType);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(att.name)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    Readable.fromWeb(file.body).pipe(res);
  }
}
