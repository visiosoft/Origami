import { Body, Controller, Delete, Get, Param, Post, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Tiers } from '../auth/guards/roles.decorator';
import { Public } from '../auth/guards/public.decorator';
import { Claims } from '../auth/guards/claims.decorator';
import type { SessionClaims } from '../auth/crypto.util';
import { MAX_FILE_BYTES } from '../google/attachments.service';
import { MailService, type LinkType } from './mail.service';

/** Each person's own Gmail (Nov 13 sync). Staff only; everything acts on the caller's own mailbox. */
@Tiers('internal')
@Controller('mail')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Get('threads')
  threads(@Claims() c: SessionClaims, @Query('q') q?: string, @Query('page') page?: string, @Query('label') label?: string) {
    return this.mail.threads(c.sub, q || '', page || '', label || 'INBOX');
  }

  @Get('threads/:id')
  thread(@Claims() c: SessionClaims, @Param('id') id: string) { return this.mail.thread(c.sub, id); }

  @Get('messages/:mid/attachments/:aid')
  async attachment(@Claims() c: SessionClaims, @Param('mid') mid: string, @Param('aid') aid: string, @Query('name') name: string, @Res() res: Response) {
    const buf = await this.mail.attachment(c.sub, mid, aid);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name || 'attachment')}"`);
    res.send(buf);
  }

  @Post('send')
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: MAX_FILE_BYTES } }))
  send(@Claims() c: SessionClaims, @Body() body: any, @UploadedFiles() files: any[]) {
    return this.mail.send(c.sub, { ...this.input(body) }, files || []);
  }

  // Drafts (Batch 6): Gmail's own drafts.
  @Get('drafts')
  drafts(@Claims() c: SessionClaims) { return this.mail.drafts(c.sub); }

  @Get('drafts/:id')
  draft(@Claims() c: SessionClaims, @Param('id') id: string) { return this.mail.draft(c.sub, id); }

  @Post('drafts')
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: MAX_FILE_BYTES } }))
  saveDraft(@Claims() c: SessionClaims, @Body() body: any, @UploadedFiles() files: any[]) {
    return this.mail.saveDraft(c.sub, body?.id || null, this.input(body), files || []);
  }

  @Post('drafts/:id/send')
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: MAX_FILE_BYTES } }))
  sendDraft(@Claims() c: SessionClaims, @Param('id') id: string, @Body() body: any, @UploadedFiles() files: any[]) {
    return this.mail.sendDraft(c.sub, id, body && Object.keys(body).length ? this.input(body) : null, files || []);
  }

  @Delete('drafts/:id')
  discardDraft(@Claims() c: SessionClaims, @Param('id') id: string) { return this.mail.discardDraft(c.sub, id); }

  private input(body: any) {
    return { to: body?.to || '', cc: body?.cc, subject: body?.subject || '', html: body?.html || '', threadId: body?.threadId || undefined, inReplyTo: body?.inReplyTo || undefined, track: body?.track !== 'false' && body?.track !== false };
  }

  // Templates (Batch 6): shared (administrators) and personal.
  @Get('templates')
  templates(@Claims() c: SessionClaims) { return this.mail.templates(c.sub); }

  @Post('templates')
  createTemplate(@Claims() c: SessionClaims, @Body() body: any) { return this.mail.saveTemplate(c, null, body); }

  @Post('templates/:id')
  updateTemplate(@Claims() c: SessionClaims, @Param('id') id: string, @Body() body: any) { return this.mail.saveTemplate(c, id, body); }

  @Delete('templates/:id')
  removeTemplate(@Claims() c: SessionClaims, @Param('id') id: string) { return this.mail.removeTemplate(c, id); }

  /** Mail with one address, from your own mailbox (a person's or lead's page). */
  @Get('with')
  withAddress(@Claims() c: SessionClaims, @Query('email') email: string) { return this.mail.withAddress(c.sub, email); }

  @Get('contacts')
  contacts(@Query('q') q: string) { return this.mail.contacts(q); }

  @Post('threads/:id/link')
  link(@Claims() c: SessionClaims, @Param('id') id: string, @Body() body: { entityType: LinkType; entityId: string }) {
    return this.mail.link(c, id, body?.entityType, String(body?.entityId || ''));
  }

  @Delete('links/:id')
  unlink(@Claims() c: SessionClaims, @Param('id') id: string) { return this.mail.unlink(c, id); }

  /** Mail linked to a lead, project or task. */
  @Get('linked')
  linked(@Claims() c: SessionClaims, @Query('entityType') type: LinkType, @Query('entityId') id: string) {
    return this.mail.forRecord(c, type, String(id || ''));
  }
}

/** The open-tracking image (Batch 6): public, a transparent 1×1 GIF; each load counts an open. */
@Public()
@Controller('mail-open')
export class MailOpenController {
  constructor(private readonly mail: MailService) {}
  private static GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

  @Get(':file')
  async open(@Param('file') file: string, @Res() res: Response) {
    await this.mail.opened(String(file || '').replace(/\.gif$/, '')).catch(() => undefined);
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, private');
    res.send(MailOpenController.GIF);
  }
}
