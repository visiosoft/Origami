import { Body, Controller, Delete, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto, DecideLeaveRequestDto } from './dto/leave-request.dto';

@Tiers('internal')
@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(
    private readonly service: LeaveRequestsService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  findAll(@Query('employeeId') employeeId?: string, @Query('status') status?: string) {
    return this.service.findAll({ employeeId, status });
  }

  @Post()
  async create(@Body() dto: CreateLeaveRequestDto, @Headers('authorization') auth?: string) {
    return this.service.create(dto, await this.auth.actor(auth));
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Body() dto: DecideLeaveRequestDto, @Headers('authorization') auth?: string) {
    return this.service.decide(id, 'approved', dto.note, await this.auth.actor(auth));
  }

  @Post(':id/deny')
  async deny(@Param('id') id: string, @Body() dto: DecideLeaveRequestDto, @Headers('authorization') auth?: string) {
    return this.service.decide(id, 'denied', dto.note, await this.auth.actor(auth));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
