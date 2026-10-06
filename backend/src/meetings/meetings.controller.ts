import { Body, Controller, Delete, Get, Headers, Param, Post, Put } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { MeetingsService } from './meetings.service';
import { MeetingActionDto, MeetingDto } from './dto';

@Tiers('internal')
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly service: MeetingsService, private readonly auth: AuthService) {}

  @Get() list() { return this.service.list(); }
  @Get(':id') get(@Param('id') id: string) { return this.service.get(id); }
  @Post() async create(@Body() dto: MeetingDto, @Headers('authorization') a?: string) { return this.service.create(dto, await this.auth.actor(a)); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: MeetingDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
  /** Raise a task, FYI or observation from the meeting (a Request Log entry linked to it). */
  @Post(':id/actions') async addAction(@Param('id') id: string, @Body() dto: MeetingActionDto, @Headers('authorization') a?: string) {
    return this.service.addAction(id, dto, await this.auth.actor(a));
  }
}
