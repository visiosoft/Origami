import { Body, Controller, Get, Headers, Param, Post, Put, Query } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { DailyLogsService } from './daily-logs.service';
import { SaveDailyLogDto, RejectDailyLogDto } from './dto/daily-log.dto';

@Tiers('internal')
@Controller('daily-logs')
export class DailyLogsController {
  constructor(
    private readonly service: DailyLogsService,
    private readonly auth: AuthService,
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
    return this.service.submit(id, await this.auth.actor(auth));
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
