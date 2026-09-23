import { Body, Controller, Get, Headers, Param, Post, Put, Query } from '@nestjs/common';
import { IsArray, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { Tiers } from '../auth/guards/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { AssignmentsService } from './assignments.service';

export class AssignDto {
  @IsArray() employeeIds: string[];
  @IsNumber() projectId: number;
  @IsString() @IsOptional() workArea?: string;
  @IsString() @IsOptional() startDate?: string;
  @IsString() @IsOptional() endDate?: string;
  @IsIn(['regular', 'temporary']) @IsOptional() assignmentType?: string;
  @IsString() @IsOptional() designation?: string;
  @IsString() @IsOptional() notes?: string;
}

export class TransferDto {
  @IsNumber() projectId: number;
  @IsString() @IsOptional() workArea?: string;
  @IsString() @IsOptional() startDate?: string;
  @IsString() @IsOptional() designation?: string;
  @IsString() @IsOptional() notes?: string;
}

export class ReleaseDto {
  @IsString() @IsOptional() endDate?: string;
  @IsString() @IsOptional() notes?: string;
}

export class DemobilizeDto {
  @IsString() @IsOptional() date?: string;
  @IsString() @IsOptional() notes?: string;
}

export class UpdateAssignmentDto {
  @IsString() @IsOptional() workArea?: string;
  @IsString() @IsOptional() designation?: string;
  @IsString() @IsOptional() endDate?: string;
  @IsString() @IsOptional() notes?: string;
}

@Tiers('internal')
@Controller('assignments')
export class AssignmentsController {
  constructor(
    private readonly service: AssignmentsService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
    @Query('workforceRequestId') workforceRequestId?: string,
  ) {
    return this.service.findAll({ employeeId, projectId: projectId ? Number(projectId) : undefined, status, workforceRequestId });
  }

  @Post()
  async assign(@Body() dto: AssignDto, @Headers('authorization') auth?: string) {
    return this.service.assign(dto, await this.auth.actor(auth));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAssignmentDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/transfer')
  async transfer(@Param('id') id: string, @Body() dto: TransferDto, @Headers('authorization') auth?: string) {
    return this.service.transfer(id, dto, await this.auth.actor(auth));
  }

  @Post(':id/release')
  async release(@Param('id') id: string, @Body() dto: ReleaseDto, @Headers('authorization') auth?: string) {
    return this.service.release(id, dto, await this.auth.actor(auth));
  }

  @Post('demobilize/:employeeId')
  async demobilize(@Param('employeeId') employeeId: string, @Body() dto: DemobilizeDto, @Headers('authorization') auth?: string) {
    return this.service.demobilize(employeeId, dto, await this.auth.actor(auth));
  }
}
