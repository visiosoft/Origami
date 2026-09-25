import { Body, Controller, Delete, Get, Headers, Param, Post, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Readable } from 'stream';
import { Tiers } from '../auth/guards/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService, MAX_FILE_BYTES, MAX_FILES_PER_UPLOAD } from '../google/attachments.service';
import { AddLinkDto } from '../tasks/dto/update-task.dto';
import { LeadFilesService } from './lead-files.service';

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
  ) {}

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
