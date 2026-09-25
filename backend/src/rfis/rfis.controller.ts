import {
  Body, Controller, Delete, ForbiddenException, Get, Headers, Param, Post, Put, Query, Res, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Readable } from 'stream';
import { Tiers } from '../auth/guards/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService, MAX_FILE_BYTES, MAX_FILES_PER_UPLOAD } from '../google/attachments.service';
import { ManpowerAccess } from '../manpower/manpower-access.service';
import { AddLinkDto } from '../tasks/dto/update-task.dto';
import { RfisService } from './rfis.service';
import { Claims } from '../auth/guards/claims.decorator';
import type { SessionClaims } from '../auth/crypto.util';

@Tiers('internal')
@Controller('rfis')
export class RfisController {
  constructor(
    private readonly rfis: RfisService,
    private readonly access: ManpowerAccess,
    private readonly auth: AuthService,
    private readonly attachments: AttachmentsService,
  ) {}

  private actor(a?: string) { return this.access.actor(a); }

  /** What this person may do with RFIs -- the client hides what the server would refuse. */
  @Get('access')
  async rights(@Headers('authorization') a?: string) {
    return this.rfis.rights(await this.actor(a));
  }

  @Get()
  async list(@Query('projectId') projectId: string | undefined, @Headers('authorization') a?: string) {
    const id = Number(projectId);
    return this.rfis.list(await this.actor(a), Number.isFinite(id) && id > 0 ? id : undefined);
  }

  @Get(':id')
  async get(@Param('id') id: string, @Headers('authorization') a?: string) {
    return this.rfis.get(id, await this.actor(a));
  }

  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Query('download') download: string, @Res() res: Response, @Claims() claims: SessionClaims | null) {
    // Opened as a plain link, so the session comes from the cookie, not a bearer header.
    if (!claims) throw new ForbiddenException('Sign in first.');
    const { buffer, filename } = await this.rfis.pdf(id, { id: claims.sub, name: claims.name, roleKey: claims.roleKey });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${download === '1' ? 'attachment' : 'inline'}; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  }

  @Post()
  async create(@Body() dto: any, @Headers('authorization') a?: string) {
    return this.rfis.create(dto, await this.actor(a));
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) {
    return this.rfis.update(id, dto, await this.actor(a));
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Headers('authorization') a?: string) {
    return this.rfis.remove(id, await this.actor(a));
  }

  @Post(':id/send')
  async send(@Param('id') id: string, @Body() dto: { note?: string }, @Headers('authorization') a?: string) {
    return this.rfis.send(id, dto || {}, await this.actor(a));
  }

  @Post(':id/mark-sent')
  async markSent(@Param('id') id: string, @Headers('authorization') a?: string) {
    return this.rfis.markSent(id, await this.actor(a));
  }

  @Post(':id/answer')
  async answer(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) {
    return this.rfis.answer(id, dto || {}, await this.actor(a));
  }

  @Post(':id/close')
  async close(@Param('id') id: string, @Body() dto: { note?: string }, @Headers('authorization') a?: string) {
    return this.rfis.close(id, dto || {}, await this.actor(a));
  }

  @Post(':id/reopen')
  async reopen(@Param('id') id: string, @Headers('authorization') a?: string) {
    return this.rfis.reopen(id, await this.actor(a));
  }

  @Post(':id/void')
  async void(@Param('id') id: string, @Body() dto: { reason?: string }, @Headers('authorization') a?: string) {
    return this.rfis.void(id, dto || {}, await this.actor(a));
  }

  // ------------------------------------------------------------------ attachments (the shared Attachments component's routes)

  private async manage(a?: string) {
    if (!(await this.rfis.rights(await this.actor(a))).manage) throw new ForbiddenException("Your role doesn't allow changing RFIs.");
  }

  @Post(':id/attachments')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD, { limits: { fileSize: MAX_FILE_BYTES } }))
  async upload(@Param('id') id: string, @UploadedFiles() files: any[], @Headers('authorization') a?: string) {
    await this.manage(a);
    return this.rfis.addAttachments(id, files, await this.auth.requireActor(a));
  }

  @Post(':id/attachments/link')
  async link(@Param('id') id: string, @Body() dto: AddLinkDto, @Headers('authorization') a?: string) {
    await this.manage(a);
    return this.rfis.addLink(id, dto.name ?? '', dto.url, await this.auth.actor(a));
  }

  @Delete(':id/attachments/:attId')
  async removeAttachment(@Param('id') id: string, @Param('attId') attId: string, @Headers('authorization') a?: string) {
    await this.manage(a);
    return this.rfis.removeAttachment(id, attId);
  }

  @Get(':id/attachments/:attId/content')
  async content(@Param('id') id: string, @Param('attId') attId: string, @Query('thumb') thumb: string, @Res() res: Response) {
    const att = await this.rfis.attachment(id, attId);
    const file = await this.attachments.download(att, thumb === '1');
    const inline = AttachmentsService.inlineSafe(file.mimeType);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(att.name)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    Readable.fromWeb(file.body).pipe(res);
  }
}
