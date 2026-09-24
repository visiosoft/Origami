import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Post, Put, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Readable } from 'stream';
import { Tiers } from '../auth/guards/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService, MAX_FILE_BYTES, MAX_FILES_PER_UPLOAD } from '../google/attachments.service';
import { AddLinkDto } from '../tasks/dto/update-task.dto';
import { ManpowerAccess } from '../manpower/manpower-access.service';
import { FinancialsService } from './financials.service';
import { InvoicesService } from './invoices.service';

const kindOf = (k: string) => {
  if (k !== 'phase' && k !== 'task' && k !== 'project') throw new BadRequestException('Unknown item.');
  return k as 'phase' | 'task' | 'project';
};

/**
 * Project financials. Bodies are read as plain objects and validated field by
 * field in the services (money, percentages, versions), since most edits are
 * partial updates of a few fields.
 */
@Tiers('internal')
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly fin: FinancialsService,
    private readonly invoices: InvoicesService,
    private readonly access: ManpowerAccess,
  ) {}

  private actor(a?: string) { return this.access.actor(a); }

  @Get('access') async rights(@Headers('authorization') a?: string) { return this.fin.rights(await this.actor(a)); }
  @Get('brand') async brand(@Headers('authorization') a?: string) { return this.fin.brand(await this.actor(a)); }

  @Get('projects/:id') async overview(@Param('id') id: string, @Headers('authorization') a?: string) { return this.fin.overview(Number(id), await this.actor(a)); }
  @Put('projects/:id') async settings(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.fin.saveSettings(Number(id), dto, await this.actor(a)); }
  @Post('projects/:id/milestones') async milestone(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.fin.addMilestone(Number(id), dto, await this.actor(a)); }
  @Get('projects/:id/activity') async activity(@Param('id') id: string, @Headers('authorization') a?: string) { return this.fin.activity(Number(id), await this.actor(a)); }
  @Get('projects/:id/invoices') async invoiceList(@Param('id') id: string, @Headers('authorization') a?: string) { return this.invoices.list(Number(id), await this.actor(a)); }
  @Post('projects/:id/invoices') async draft(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.invoices.createDraft(Number(id), dto, await this.actor(a)); }
  @Get('projects/:id/payments') async payments(@Param('id') id: string, @Headers('authorization') a?: string) { return this.invoices.projectPayments(Number(id), await this.actor(a)); }

  @Put('items/:kind/:id') async item(@Param('kind') kind: string, @Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) {
    const k = kindOf(kind);
    if (k === 'project') throw new BadRequestException('Project values are set in the project’s financial settings.');
    return this.fin.updateItem(k, id, dto, await this.actor(a));
  }
  @Post('items/:kind/:id/progress') async progress(@Param('kind') kind: string, @Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) {
    return this.fin.reportProgress(kindOf(kind), id, dto, await this.actor(a));
  }
  @Post('items/:kind/:id/progress/approve') async approve(@Param('kind') kind: string, @Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) {
    return this.fin.approveProgress(kindOf(kind), id, dto, await this.actor(a));
  }
  @Get('items/:kind/:id/progress') async history(@Param('kind') kind: string, @Param('id') id: string, @Headers('authorization') a?: string) {
    return this.fin.progressHistory(kindOf(kind), id, await this.actor(a));
  }
  @Get('items/:kind/:id/invoices') async itemInvoices(@Param('kind') kind: string, @Param('id') id: string, @Headers('authorization') a?: string) {
    return this.fin.itemInvoices(kindOf(kind), id, await this.actor(a));
  }

  @Get('invoices/:id') async invoice(@Param('id') id: string, @Headers('authorization') a?: string) { return this.invoices.get(id, await this.actor(a)); }
  @Put('invoices/:id') async updateDraft(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.invoices.updateDraft(id, dto, await this.actor(a)); }
  @Delete('invoices/:id') async removeDraft(@Param('id') id: string, @Headers('authorization') a?: string) { return this.invoices.removeDraft(id, await this.actor(a)); }
  @Post('invoices/:id/issue') async issue(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.invoices.issue(id, dto, await this.actor(a)); }
  @Post('invoices/:id/void') async void(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.invoices.void(id, dto, await this.actor(a)); }
  @Post('invoices/:id/payments') async pay(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.invoices.recordPayment(id, dto, await this.actor(a)); }
  @Post('payments/:id/void') async voidPayment(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.invoices.voidPayment(id, dto, await this.actor(a)); }
}

/** Invoice documents, on the same routes the shared Attachments component uses for its other scopes. */
@Tiers('internal')
@Controller('finance-invoices')
export class FinanceInvoiceFilesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly fin: FinancialsService,
    private readonly auth: AuthService,
    private readonly attachments: AttachmentsService,
    private readonly access: ManpowerAccess,
  ) {}

  private async manage(a?: string) {
    const actor = await this.access.actor(a);
    if (!(await this.fin.rights(actor)).manage) throw new BadRequestException("Your role doesn't allow changing invoices.");
  }

  @Post(':id/attachments')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD, { limits: { fileSize: MAX_FILE_BYTES } }))
  async upload(@Param('id') id: string, @UploadedFiles() files: any[], @Headers('authorization') a?: string) {
    await this.manage(a);
    return this.invoices.addAttachments(id, files, await this.auth.requireActor(a));
  }

  @Post(':id/attachments/link')
  async link(@Param('id') id: string, @Body() dto: AddLinkDto, @Headers('authorization') a?: string) {
    await this.manage(a);
    return this.invoices.addLink(id, dto.name ?? '', dto.url, await this.auth.actor(a));
  }

  @Delete(':id/attachments/:attId')
  async remove(@Param('id') id: string, @Param('attId') attId: string, @Headers('authorization') a?: string) {
    await this.manage(a);
    return this.invoices.removeAttachment(id, attId);
  }

  @Get(':id/attachments/:attId/content')
  async content(@Param('id') id: string, @Param('attId') attId: string, @Query('thumb') thumb: string, @Res() res: Response) {
    const att = await this.invoices.attachment(id, attId);
    const file = await this.attachments.download(att, thumb === '1');
    const inline = AttachmentsService.inlineSafe(file.mimeType);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(att.name)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    Readable.fromWeb(file.body).pipe(res);
  }
}
