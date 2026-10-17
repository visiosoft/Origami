import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { DailyLogsService } from './daily-logs.service';
import { DailyLogBackupService } from './daily-log-backup.service';
import { DailyReportAutomationService } from './daily-report-automation.service';
import { WeeklyReportService } from './weekly-report.service';
import { SaveDailyLogDto, RejectDailyLogDto, SaveDailyReportTemplateDto } from './dto/daily-log.dto';

@Tiers('internal')
@Controller('daily-logs')
export class DailyLogsController {
  constructor(
    private readonly service: DailyLogsService,
    private readonly auth: AuthService,
    private readonly backup: DailyLogBackupService,
    private readonly automation: DailyReportAutomationService,
    private readonly weekly: WeeklyReportService,
  ) {}

  @Get()
  findAll(@Query('status') status?: string, @Query('projectId') projectId?: string) {
    return this.service.findAllLogs({ status, projectId: projectId != null ? Number(projectId) : undefined });
  }

  @Get('day')
  getForDay(@Query('projectId') projectId: string, @Query('date') date: string, @Query('id') id?: string) {
    return this.service.getForDay(Number(projectId), date, id || undefined);
  }

  /** A project's week, rolled up from its daily reports. `week` is any day in it. */
  @Get('weekly')
  weeklyReport(@Query('projectId') projectId: string, @Query('week') week?: string) {
    return this.weekly.week(Number(projectId), week || '');
  }

  /** Email the week as PDF + Excel, to the usual backup list or to `to`. */
  @Post('weekly/email')
  emailWeekly(@Body() body: { projectId?: number; week?: string; to?: string }) {
    const to = String(body?.to || '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    return this.weekly.email(Number(body?.projectId), String(body?.week || ''), to.length ? to : undefined);
  }

  /** Named Daily Report templates -- shared by the whole team. */
  @Get('templates')
  templates() {
    return this.service.listTemplates();
  }

  @Post('templates')
  async saveTemplate(@Body() dto: SaveDailyReportTemplateDto, @Headers('authorization') auth?: string) {
    return this.service.saveTemplate(dto, await this.auth.actor(auth));
  }

  @Delete('templates/:id')
  async removeTemplate(@Param('id') id: string, @Headers('authorization') auth?: string) {
    return this.service.removeTemplate(id, await this.auth.actor(auth));
  }

  @Post()
  async save(@Body() dto: SaveDailyLogDto, @Headers('authorization') auth?: string) {
    return this.service.save(dto, await this.auth.actor(auth));
  }

  @Post(':id/submit')
  async submit(@Param('id') id: string, @Headers('authorization') auth?: string) {
    const actor = await this.auth.actor(auth);
    const log = await this.service.submit(id, actor);
    // A stop order puts the project on hold; stop / holiday days already passed get their reports.
    const auto = await this.automation.afterSubmit(log.id, actor).catch(() => ({ held: false, created: 0 }));
    // The day goes out by email (PDF + Excel) as a backup -- never holding up the submit.
    this.backup.afterSubmit(log.id);
    // Completed on someone's behalf: they get a copy for their records.
    if (log.onBehalfOf) {
      const to = await this.service.ownerEmail(log).catch(() => null);
      if (to) this.backup.send(log.id, [to]).catch(() => undefined);
    }
    return { ...log, projectHeld: auto.held, autoReportsMade: auto.created };
  }

  /** "Email a copy": the same backup, on demand, to the usual list or to given addresses. */
  @Post(':id/email')
  email(@Param('id') id: string, @Body() body: { to?: string }) {
    const to = String(body?.to || '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    return this.backup.send(id, to.length ? to : undefined);
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Headers('authorization') auth?: string) {
    return this.service.approve(id, await this.auth.actor(auth));
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Body() dto: RejectDailyLogDto, @Headers('authorization') auth?: string) {
    return this.service.reject(id, dto.note, await this.auth.actor(auth));
  }
}
