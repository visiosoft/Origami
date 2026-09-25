import { Body, Controller, Get, Headers, Param, Post, Put, Query } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { DailyLogsService } from './daily-logs.service';
import { DailyLogBackupService } from './daily-log-backup.service';
import { SaveDailyLogDto, RejectDailyLogDto } from './dto/daily-log.dto';

@Tiers('internal')
@Controller('daily-logs')
export class DailyLogsController {
  constructor(
    private readonly service: DailyLogsService,
    private readonly auth: AuthService,
    private readonly backup: DailyLogBackupService,
  ) {}

  @Get()
  findAll(@Query('status') status?: string, @Query('projectId') projectId?: string) {
    return this.service.findAllLogs({ status, projectId: projectId != null ? Number(projectId) : undefined });
  }

  @Get('day')
  getForDay(@Query('projectId') projectId: string, @Query('date') date: string) {
    return this.service.getForDay(Number(projectId), date);
  }

  @Post()
  async save(@Body() dto: SaveDailyLogDto, @Headers('authorization') auth?: string) {
    return this.service.save(dto, await this.auth.actor(auth));
  }

  @Post(':id/submit')
  async submit(@Param('id') id: string, @Headers('authorization') auth?: string) {
    const log = await this.service.submit(id, await this.auth.actor(auth));
    // The day goes out by email (PDF + Excel) as a backup -- never holding up the submit.
    this.backup.afterSubmit(log.id);
    return log;
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
