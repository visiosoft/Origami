import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Readable } from 'stream';
import { Public } from '../auth/guards/public.decorator';
import { Roles, Tiers } from '../auth/guards/roles.decorator';
import type { AuthedRequest } from '../auth/guards/session.guard';
import { CONTRACT_TYPES, MERGE_FIELDS } from './contract-types';
import { ContractsService, type ContractActor } from './contracts.service';

const actorOf = (req: AuthedRequest): ContractActor => ({ id: req.claims?.sub, name: req.claims?.name, email: req.claims?.email, roleKey: req.claims?.roleKey });
const meta = (req: AuthedRequest) => ({ ip: req.ip || '', userAgent: String(req.headers['user-agent'] || '') });
const sendPdf = (res: Response, r: { pdf: Buffer; filename: string }, download: boolean) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(r.filename)}"`);
  return res.end(r.pdf);
};

/** Contracts signed inside ODIN: templates, drafts, sending, signing, counter-signing and the signed PDF. */
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  // --- the signer's own page (no account) ---

  @Public()
  @Get('public')
  publicView(@Query('token') token: string) {
    return this.contracts.publicView(token);
  }

  @Public()
  @Post('public/sign')
  publicSign(@Body() body: any, @Req() req: AuthedRequest) {
    return this.contracts.publicSign(body?.token, body || {}, meta(req));
  }

  @Public()
  @Get('public/pdf')
  async publicPdf(@Query('token') token: string, @Query('download') download: string, @Res() res: Response) {
    return sendPdf(res, await this.contracts.publicPdf(token), download === '1');
  }

  @Public()
  @Get('public/file')
  async publicFile(@Query('token') token: string, @Query('fileId') fileId: string, @Res() res: Response) {
    const { file, body, mimeType } = await this.contracts.publicAttachment(token, fileId);
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file?.name || 'file')}"`);
    Readable.fromWeb(body).pipe(res);
  }

  // --- staff ---

  @Tiers('internal')
  @Get('types')
  types() {
    return { types: CONTRACT_TYPES, mergeFields: MERGE_FIELDS };
  }

  @Tiers('internal')
  @Get('templates')
  templates() {
    return this.contracts.listTemplates();
  }

  @Roles('admin')
  @Post('templates')
  createTemplate(@Body() body: any, @Req() req: AuthedRequest) {
    return this.contracts.saveTemplate(null, body || {}, actorOf(req));
  }

  @Roles('admin')
  @Put('templates/:id')
  saveTemplate(@Param('id') id: string, @Body() body: any, @Req() req: AuthedRequest) {
    return this.contracts.saveTemplate(id, body || {}, actorOf(req));
  }

  @Roles('admin')
  @Delete('templates/:id')
  removeTemplate(@Param('id') id: string) {
    return this.contracts.removeTemplate(id);
  }

  @Tiers('internal')
  @Get('links')
  links(@Query('projectId') projectId: string) {
    return this.contracts.links(Number(projectId));
  }

  @Tiers('internal')
  @Get('files')
  files(@Query('projectId') projectId: string) {
    return this.contracts.attachableFiles(Number(projectId));
  }

  @Tiers('internal')
  @Get()
  list(@Query() q: Record<string, string>) {
    return this.contracts.list(q);
  }

  @Tiers('internal')
  @Post()
  create(@Body() body: any, @Req() req: AuthedRequest) {
    return this.contracts.create(body || {}, actorOf(req));
  }

  @Tiers('internal')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.contracts.get(id);
  }

  @Tiers('internal')
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.contracts.update(id, body || {});
  }

  @Tiers('internal')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contracts.remove(id);
  }

  @Tiers('internal')
  @Post(':id/send')
  send(@Param('id') id: string, @Body() body: { note?: string; resendKeys?: string[] }, @Req() req: AuthedRequest) {
    return this.contracts.send(id, body || {}, actorOf(req));
  }

  @Tiers('internal')
  @Post(':id/countersign')
  countersign(@Param('id') id: string, @Body() body: any, @Req() req: AuthedRequest) {
    return this.contracts.countersign(id, body || {}, actorOf(req), meta(req));
  }

  @Tiers('internal')
  @Post(':id/void')
  void(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.contracts.void(id, body?.reason || '');
  }

  @Tiers('internal')
  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Query('download') download: string, @Res() res: Response) {
    return sendPdf(res, await this.contracts.pdf(id), download === '1');
  }
}
