import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Post, Put, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Readable } from 'stream';
import { Tiers } from '../auth/guards/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService, MAX_FILE_BYTES, MAX_FILES_PER_UPLOAD } from '../google/attachments.service';
import { AddLinkDto } from '../tasks/dto/update-task.dto';
import { ManpowerAccess } from '../manpower/manpower-access.service';
import type { TaskAttachment } from '../database/task.types';
import { FinancialsService, type FinRights } from './financials.service';
import { InvoicesService } from './invoices.service';
import { ChangeOrdersService } from './change-orders.service';
import { ReimbursablesService } from './reimbursables.service';
import { RetentionService } from './retention.service';
import { FinanceHubService } from './finance-hub.service';
import { CostsService } from './costs.service';
import { ReportsService } from './reports.service';

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
    private readonly cos: ChangeOrdersService,
    private readonly reimbs: ReimbursablesService,
    private readonly retention: RetentionService,
    private readonly hub: FinanceHubService,
    private readonly access: ManpowerAccess,
    private readonly costs: CostsService,
    private readonly reports: ReportsService,
  ) {}

  private actor(a?: string) { return this.access.actor(a); }

  @Get('access') async rights(@Headers('authorization') a?: string) { return this.fin.rights(await this.actor(a)); }
  @Get('brand') async brand(@Headers('authorization') a?: string) { return this.fin.brand(await this.actor(a)); }

  // --- across projects
  @Get('portfolio') async portfolio(@Headers('authorization') a?: string) { return this.hub.portfolio(await this.actor(a)); }
  @Get('approvals') async pending(@Headers('authorization') a?: string) { return this.hub.pending(await this.actor(a)); }
  @Get('audit') async audit(@Query() q: any, @Headers('authorization') a?: string) { return this.hub.audit(await this.actor(a), q || {}); }
  @Get('change-orders') async allCos(@Headers('authorization') a?: string) { return this.cos.all(await this.actor(a)); }
  @Get('reimbursables') async allReimbs(@Headers('authorization') a?: string) { return this.reimbs.all(await this.actor(a)); }

  // --- a project
  @Get('projects/:id') async overview(@Param('id') id: string, @Headers('authorization') a?: string) { return this.fin.overview(Number(id), await this.actor(a)); }
  @Put('projects/:id') async settings(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.fin.saveSettings(Number(id), dto, await this.actor(a)); }
  @Post('projects/:id/milestones') async milestone(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.fin.addMilestone(Number(id), dto, await this.actor(a)); }
  @Get('projects/:id/activity') async activity(@Param('id') id: string, @Headers('authorization') a?: string) { return this.fin.activity(Number(id), await this.actor(a)); }
  @Get('projects/:id/invoices') async invoiceList(@Param('id') id: string, @Headers('authorization') a?: string) { return this.invoices.list(Number(id), await this.actor(a)); }
  @Post('projects/:id/invoices') async draft(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.invoices.createDraft(Number(id), dto, await this.actor(a)); }
  @Get('projects/:id/payments') async payments(@Param('id') id: string, @Headers('authorization') a?: string) { return this.invoices.projectPayments(Number(id), await this.actor(a)); }
  @Get('projects/:id/change-orders') async cosOf(@Param('id') id: string, @Headers('authorization') a?: string) { return this.cos.list(Number(id), await this.actor(a)); }
  @Post('projects/:id/change-orders') async newCo(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.cos.create(Number(id), dto, await this.actor(a)); }
  @Get('projects/:id/reimbursables') async reimbsOf(@Param('id') id: string, @Headers('authorization') a?: string) { return this.reimbs.list(Number(id), await this.actor(a)); }
  @Post('projects/:id/reimbursables') async newReimb(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.reimbs.create(Number(id), dto, await this.actor(a)); }
  @Get('projects/:id/retention') async retentionOf(@Param('id') id: string, @Headers('authorization') a?: string) { return this.retention.overview(Number(id), await this.actor(a)); }
  @Post('projects/:id/retention/releases') async requestRelease(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.retention.request(Number(id), dto, await this.actor(a)); }

  // --- job cost
  @Get('projects/:id/costs') async costsOf(@Param('id') id: string, @Headers('authorization') a?: string) { return this.costs.overview(Number(id), await this.actor(a)); }
  @Post('projects/:id/budget-lines') async budgetLine(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.costs.saveBudgetLine(Number(id), dto, await this.actor(a)); }
  @Delete('budget-lines/:id') async removeBudgetLine(@Param('id') id: string, @Headers('authorization') a?: string) { return this.costs.removeBudgetLine(id, await this.actor(a)); }
  @Put('projects/:id/forecasts') async forecast(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.costs.setForecast(Number(id), dto, await this.actor(a)); }
  @Post('projects/:id/commitments') async commitment(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.costs.saveCommitment(Number(id), dto, await this.actor(a)); }
  @Post('commitments/:id/:action') async commitmentStep(@Param('id') id: string, @Param('action') action: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.costs.commitmentStep(id, action, dto || {}, await this.actor(a)); }
  @Post('projects/:id/cost-entries') async costEntry(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.costs.saveEntry(Number(id), dto, await this.actor(a)); }
  @Post('cost-entries/:id/:action') async costEntryStep(@Param('id') id: string, @Param('action') action: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.costs.entryStep(id, action, dto || {}, await this.actor(a)); }

  // --- reports
  @Get('reports/wip') async wip(@Headers('authorization') a?: string) { return this.reports.wip(await this.actor(a)); }
  @Get('reports/ar-aging') async aging(@Query('asOf') asOf: string, @Headers('authorization') a?: string) { return this.reports.arAging(await this.actor(a), asOf); }
  @Get('reports/budget-vs-actual') async bva(@Query('projectId') projectId: string, @Headers('authorization') a?: string) { return this.reports.budgetVsActual(await this.actor(a), projectId ? Number(projectId) : undefined); }
  @Get('reports/change-orders') async coRegister(@Headers('authorization') a?: string) { return this.reports.changeOrderRegister(await this.actor(a)); }
  @Get('reports/retention') async retentionReport(@Headers('authorization') a?: string) { return this.reports.retention(await this.actor(a)); }
  @Get('reports/contract-vs-invoiced') async contractReport(@Headers('authorization') a?: string) { return this.reports.contractVsInvoiced(await this.actor(a)); }
  @Get('reports/cash-forecast') async cash(@Query('months') months: string, @Headers('authorization') a?: string) { return this.reports.cashForecast(await this.actor(a), Number(months) || 6); }

  // --- items
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

  // --- invoices and payments
  @Get('invoices/:id') async invoice(@Param('id') id: string, @Headers('authorization') a?: string) { return this.invoices.get(id, await this.actor(a)); }
  @Put('invoices/:id') async updateDraft(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.invoices.updateDraft(id, dto, await this.actor(a)); }
  @Delete('invoices/:id') async removeDraft(@Param('id') id: string, @Headers('authorization') a?: string) { return this.invoices.removeDraft(id, await this.actor(a)); }
  @Post('invoices/:id/issue') async issue(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.invoices.issue(id, dto, await this.actor(a)); }
  @Post('invoices/:id/void') async void(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.invoices.void(id, dto, await this.actor(a)); }
  @Post('invoices/:id/request-approval') async requestApproval(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.invoices.requestApproval(id, dto, await this.actor(a)); }
  @Post('invoices/:id/return') async returnDraft(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.invoices.returnDraft(id, dto, await this.actor(a)); }
  @Post('invoices/:id/credit') async credit(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.invoices.createCredit(id, dto, await this.actor(a)); }
  @Post('invoices/:id/payments') async pay(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.invoices.recordPayment(id, dto, await this.actor(a)); }
  @Post('payments/:id/void') async voidPayment(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.invoices.voidPayment(id, dto, await this.actor(a)); }

  // --- change orders
  @Get('change-orders/:id') async co(@Param('id') id: string, @Headers('authorization') a?: string) { return this.cos.get(id, await this.actor(a)); }
  @Get('change-orders/:id/impact') async coImpact(@Param('id') id: string, @Headers('authorization') a?: string) { return this.cos.impact(id, await this.actor(a)); }
  @Put('change-orders/:id') async updateCo(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.cos.update(id, dto, await this.actor(a)); }
  @Delete('change-orders/:id') async removeCo(@Param('id') id: string, @Headers('authorization') a?: string) { return this.cos.remove(id, await this.actor(a)); }
  @Post('change-orders/:id/:action') async actCo(@Param('id') id: string, @Param('action') action: string, @Body() dto: any, @Headers('authorization') a?: string) {
    return this.cos.act(id, action, dto || {}, await this.actor(a));
  }

  // --- reimbursables
  @Get('reimbursables/:id') async reimb(@Param('id') id: string, @Headers('authorization') a?: string) { return this.reimbs.get(id, await this.actor(a)); }
  @Put('reimbursables/:id') async updateReimb(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.reimbs.update(id, dto, await this.actor(a)); }
  @Delete('reimbursables/:id') async removeReimb(@Param('id') id: string, @Headers('authorization') a?: string) { return this.reimbs.remove(id, await this.actor(a)); }
  @Post('reimbursables/:id/decision') async decideReimb(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.reimbs.decide(id, dto, await this.actor(a)); }

  // --- retention
  @Post('retention-releases/:id/decision') async decideRelease(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) { return this.retention.decide(id, dto, await this.actor(a)); }
  @Post('retention-releases/:id/bill') async billRelease(@Param('id') id: string, @Headers('authorization') a?: string) { return this.retention.bill(id, await this.actor(a)); }
}

/** What a documents controller needs from the service that owns the record. */
interface FileOwner {
  addAttachments(id: string, files: any[], actor: any): Promise<TaskAttachment[]>;
  addLink(id: string, name: string, url: string, actor: any): Promise<TaskAttachment[]>;
  removeAttachment(id: string, attId: string): Promise<TaskAttachment[]>;
  attachment(id: string, attId: string): Promise<TaskAttachment>;
}

/**
 * Documents on a financial record (invoices, change orders, receipts), on the
 * same routes the shared Attachments component uses for its other scopes.
 */
abstract class FinanceFilesBase {
  constructor(
    protected readonly fin: FinancialsService,
    protected readonly auth: AuthService,
    protected readonly attachments: AttachmentsService,
    protected readonly access: ManpowerAccess,
  ) {}

  protected abstract owner(): FileOwner;
  protected abstract right: keyof FinRights;

  private async manage(a?: string) {
    const actor = await this.access.actor(a);
    if (!(await this.fin.rights(actor))[this.right]) throw new BadRequestException("Your role doesn't allow changing these documents.");
  }

  @Post(':id/attachments')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD, { limits: { fileSize: MAX_FILE_BYTES } }))
  async upload(@Param('id') id: string, @UploadedFiles() files: any[], @Headers('authorization') a?: string) {
    await this.manage(a);
    return this.owner().addAttachments(id, files, await this.auth.requireActor(a));
  }

  @Post(':id/attachments/link')
  async link(@Param('id') id: string, @Body() dto: AddLinkDto, @Headers('authorization') a?: string) {
    await this.manage(a);
    return this.owner().addLink(id, dto.name ?? '', dto.url, await this.auth.actor(a));
  }

  @Delete(':id/attachments/:attId')
  async remove(@Param('id') id: string, @Param('attId') attId: string, @Headers('authorization') a?: string) {
    await this.manage(a);
    return this.owner().removeAttachment(id, attId);
  }

  @Get(':id/attachments/:attId/content')
  async content(@Param('id') id: string, @Param('attId') attId: string, @Query('thumb') thumb: string, @Res() res: Response) {
    const att = await this.owner().attachment(id, attId);
    const file = await this.attachments.download(att, thumb === '1');
    const inline = AttachmentsService.inlineSafe(file.mimeType);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(att.name)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    Readable.fromWeb(file.body).pipe(res);
  }
}

@Tiers('internal')
@Controller('finance-invoices')
export class FinanceInvoiceFilesController extends FinanceFilesBase {
  protected right: keyof FinRights = 'prepareInvoice';
  constructor(private readonly invoices: InvoicesService, fin: FinancialsService, auth: AuthService, attachments: AttachmentsService, access: ManpowerAccess) {
    super(fin, auth, attachments, access);
  }
  protected owner() { return this.invoices; }
}

@Tiers('internal')
@Controller('finance-change-orders')
export class FinanceChangeOrderFilesController extends FinanceFilesBase {
  protected right: keyof FinRights = 'editChangeOrders';
  constructor(private readonly cos: ChangeOrdersService, fin: FinancialsService, auth: AuthService, attachments: AttachmentsService, access: ManpowerAccess) {
    super(fin, auth, attachments, access);
  }
  protected owner() { return this.cos; }
}

@Tiers('internal')
@Controller('finance-reimbursables')
export class FinanceReimbursableFilesController extends FinanceFilesBase {
  protected right: keyof FinRights = 'submitReimbursables';
  constructor(private readonly reimbs: ReimbursablesService, fin: FinancialsService, auth: AuthService, attachments: AttachmentsService, access: ManpowerAccess) {
    super(fin, auth, attachments, access);
  }
  protected owner() { return this.reimbs; }
}

@Tiers('internal')
@Controller('finance-costs')
export class FinanceCostFilesController extends FinanceFilesBase {
  protected right: keyof FinRights = 'manageCosts';
  constructor(private readonly costs: CostsService, fin: FinancialsService, auth: AuthService, attachments: AttachmentsService, access: ManpowerAccess) {
    super(fin, auth, attachments, access);
  }
  protected owner() { return this.costs; }
}
