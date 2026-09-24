import { Body, Controller, Get, Headers, Param, Post, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Readable } from 'stream';
import { Claims } from '../auth/guards/claims.decorator';
import { PortalRoute, Tiers } from '../auth/guards/roles.decorator';
import type { SessionClaims } from '../auth/crypto.util';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService, MAX_FILE_BYTES, MAX_FILES_PER_UPLOAD } from '../google/attachments.service';
import type { TaskAttachment } from '../database/task.types';
import { ManpowerAccess } from '../manpower/manpower-access.service';
import { FinancialsService, type FinRights } from './financials.service';
import { FinanceFilesBase } from './finance.controller';
import { PortalService } from './portal.service';

const stream = async (attachments: AttachmentsService, att: TaskAttachment, thumb: boolean, res: Response) => {
  const file = await attachments.download(att, thumb);
  const inline = AttachmentsService.inlineSafe(file.mimeType);
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(att.name)}"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  Readable.fromWeb(file.body).pipe(res);
};

/**
 * The subcontractor portal. Only portal accounts get through (the service
 * checks the signed-in account is linked to a contractor), and every answer
 * is limited to that contractor's own subcontracts.
 */
@PortalRoute()
@Controller('portal')
export class PortalController {
  constructor(private readonly portal: PortalService, private readonly attachments: AttachmentsService) {}

  @Get('overview') overview(@Claims() c: SessionClaims | null) { return this.portal.overview(c); }
  @Get('subcontracts/:id') subcontract(@Param('id') id: string, @Claims() c: SessionClaims | null) { return this.portal.subcontract(c, id); }
  @Get('invoices') invoices(@Claims() c: SessionClaims | null) { return this.portal.invoices(c); }
  @Post('invoices') submit(@Body() dto: any, @Claims() c: SessionClaims | null) { return this.portal.submit(c, dto || {}); }

  @Post('invoices/:batchId/attachments')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD, { limits: { fileSize: MAX_FILE_BYTES } }))
  attach(@Param('batchId') batchId: string, @UploadedFiles() files: any[], @Claims() c: SessionClaims | null) {
    return this.portal.attachToInvoice(c, batchId, files, { name: c?.name || 'Subcontractor', id: c?.sub });
  }

  @Get('bills/:entryId/files/:attId')
  async billFile(@Param('entryId') entryId: string, @Param('attId') attId: string, @Query('thumb') thumb: string, @Claims() c: SessionClaims | null, @Res() res: Response) {
    await stream(this.attachments, await this.portal.file(c, { entryId }, attId), thumb === '1', res);
  }

  @Get('subcontracts/:id/files/:attId')
  async sharedFile(@Param('id') id: string, @Param('attId') attId: string, @Query('thumb') thumb: string, @Claims() c: SessionClaims | null, @Res() res: Response) {
    await stream(this.attachments, await this.portal.file(c, { subcontractId: id }, attId), thumb === '1', res);
  }
}

/** Staff: give a contractor a portal login, resend it, or take it away. */
@Tiers('internal')
@Controller('finance-portal')
export class PortalAccessController {
  constructor(private readonly portal: PortalService, private readonly access: ManpowerAccess) {}

  @Get(':contractorId') async status(@Param('contractorId') id: string, @Headers('authorization') a?: string) { return this.portal.access(id, await this.access.actor(a)); }
  @Post(':contractorId/invite') async invite(@Param('contractorId') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.portal.invite(id, dto || {}, await this.access.actor(a)); }
  @Post(':contractorId/revoke') async revoke(@Param('contractorId') id: string, @Headers('authorization') a?: string) { return this.portal.revoke(id, await this.access.actor(a)); }
}

/** Documents on a subcontract that its subcontractor can see in the portal. */
@Tiers('internal')
@Controller('finance-commitment-shared')
export class SharedWithVendorFilesController extends FinanceFilesBase {
  protected right: keyof FinRights = 'manageCosts';
  constructor(private readonly portal: PortalService, fin: FinancialsService, auth: AuthService, attachments: AttachmentsService, access: ManpowerAccess) {
    super(fin, auth, attachments, access);
  }
  protected owner() { return this.portal; }
}
