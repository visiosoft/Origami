import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query } from '@nestjs/common';
import { IsArray, IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { Tiers } from '../auth/guards/roles.decorator';
import { HR_MODULE, ManpowerAccess } from './manpower-access.service';
import { PayrollService } from './payroll.service';
import { PayrollSetupService } from './payroll-setup.service';

export class PayrollSettingsDto {
  @IsString() @IsOptional() currency?: string;
  @IsNumber() @IsOptional() standardDayHours?: number;
  @IsNumber() @IsOptional() halfDayHours?: number;
  @IsNumber() @IsOptional() monthDays?: number;
  @IsObject() @IsOptional() otMultipliers?: Record<string, number>;
  @IsArray() @IsOptional() weekendDays?: number[];
}

export class PayComponentDto {
  @IsString() @IsOptional() name?: string;
  @IsIn(['earning', 'deduction']) @IsOptional() kind?: string;
  @IsIn(['fixed', 'percent_basic', 'percent_gross']) @IsOptional() calcType?: string;
  @IsNumber() @IsOptional() defaultValue?: number;
  @IsIn(['all', 'monthly', 'daily']) @IsOptional() appliesTo?: string;
  @IsString() @IsOptional() category?: string;
  @IsBoolean() @IsOptional() active?: boolean;
  @IsNumber() @IsOptional() order?: number;
}

export class CreateRunDto {
  @IsString() @IsOptional() label?: string;
  @IsString() periodStart: string;
  @IsString() periodEnd: string;
  @IsIn(['all', 'monthly', 'daily']) @IsOptional() payGroup?: string;
  @IsString() @IsOptional() notes?: string;
}

export class UpdatePayslipDto {
  @IsOptional() work?: { fullDays?: number; halfDays?: number; extraHours?: number; hoursWorked?: number } | null;
  @IsArray() @IsOptional() manualLines?: { id?: string; name: string; kind: string; amount: number; note?: string }[];
  @IsString() @IsOptional() notes?: string;
}

export class PayDto {
  @IsArray() @IsOptional() payslipIds?: string[];
  @IsString() @IsOptional() method?: string;
  @IsString() @IsOptional() ref?: string;
  @IsString() @IsOptional() date?: string;
}

export class VoidDto {
  @IsString() @IsOptional() reason?: string;
}

@Tiers('internal')
@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly payroll: PayrollService,
    private readonly setup: PayrollSetupService,
    private readonly access: ManpowerAccess,
  ) {}

  @Get('settings')
  settings() {
    return this.setup.settings();
  }

  @Put('settings')
  async saveSettings(@Body() dto: PayrollSettingsDto, @Headers('authorization') auth?: string) {
    await this.access.require(await this.access.actor(auth), HR_MODULE, 'change payroll settings');
    return this.setup.saveSettings(dto as any);
  }

  @Get('components')
  components() {
    return this.setup.listComponents();
  }

  @Post('components')
  async createComponent(@Body() dto: PayComponentDto, @Headers('authorization') auth?: string) {
    await this.access.require(await this.access.actor(auth), HR_MODULE, 'change pay components');
    return this.setup.createComponent(dto as any);
  }

  @Put('components/:id')
  async updateComponent(@Param('id') id: string, @Body() dto: PayComponentDto, @Headers('authorization') auth?: string) {
    await this.access.require(await this.access.actor(auth), HR_MODULE, 'change pay components');
    return this.setup.updateComponent(id, dto as any);
  }

  @Delete('components/:id')
  async removeComponent(@Param('id') id: string, @Headers('authorization') auth?: string) {
    await this.access.require(await this.access.actor(auth), HR_MODULE, 'change pay components');
    return this.setup.removeComponent(id);
  }

  /** Tax and deduction summaries by employee and pay run: ?from&to (YYYY-MM-DD), ?employeeId, ?drafts=1. */
  @Get('reports')
  async reports(@Query() q: { from?: string; to?: string; employeeId?: string; drafts?: string }, @Headers('authorization') auth?: string) {
    return this.payroll.report(q, await this.access.actor(auth));
  }

  @Get('runs')
  runs() {
    return this.payroll.listRuns();
  }

  @Get('runs/:id')
  run(@Param('id') id: string) {
    return this.payroll.getRun(id);
  }

  @Post('runs')
  async createRun(@Body() dto: CreateRunDto, @Headers('authorization') auth?: string) {
    return this.payroll.createRun(dto, await this.access.actor(auth));
  }

  @Post('runs/:id/recalculate')
  async recalculate(@Param('id') id: string, @Headers('authorization') auth?: string) {
    return this.payroll.recalculate(id, await this.access.actor(auth));
  }

  @Delete('runs/:id')
  async removeRun(@Param('id') id: string, @Headers('authorization') auth?: string) {
    return this.payroll.removeRun(id, await this.access.actor(auth));
  }

  @Post('runs/:id/finalize')
  async finalize(@Param('id') id: string, @Headers('authorization') auth?: string) {
    return this.payroll.finalize(id, await this.access.actor(auth));
  }

  @Post('runs/:id/void')
  async voidRun(@Param('id') id: string, @Body() dto: VoidDto, @Headers('authorization') auth?: string) {
    return this.payroll.voidRun(id, dto.reason, await this.access.actor(auth));
  }

  @Post('runs/:id/pay')
  async pay(@Param('id') id: string, @Body() dto: PayDto, @Headers('authorization') auth?: string) {
    return this.payroll.markPaid(id, dto.payslipIds?.length ? dto.payslipIds : 'all', dto, await this.access.actor(auth));
  }

  @Put('payslips/:id')
  async updatePayslip(@Param('id') id: string, @Body() dto: UpdatePayslipDto, @Headers('authorization') auth?: string) {
    return this.payroll.updatePayslip(id, dto, await this.access.actor(auth));
  }

  @Get('employees/:employeeId/payslips')
  employeePayslips(@Param('employeeId') employeeId: string) {
    return this.payroll.employeePayslips(employeeId);
  }
}
