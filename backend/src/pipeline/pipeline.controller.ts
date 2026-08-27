import { Controller, Get, Post, Put, Delete, Param, Body, Query, Headers } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { PipelineService } from './pipeline.service';
import { AuthService } from '../auth/auth.service';
import { CreateDealDto } from './dto/create-deal.dto';

@Tiers('internal')
@Controller('pipeline')
export class PipelineController {
  constructor(
    private readonly pipelineService: PipelineService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  findAll(@Query('archived') archived?: string) {
    return this.pipelineService.findAll(archived === 'true');
  }

  @Get('stages')
  getStages() {
    return this.pipelineService.getStages();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pipelineService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateDealDto) {
    return this.pipelineService.create(dto);
  }

  @Put(':id/stage')
  async updateStage(
    @Param('id') id: string,
    @Body('stage') stage: string,
    @Headers('authorization') auth?: string,
  ) {
    return this.pipelineService.updateStage(id, stage, await this.auth.actor(auth));
  }

  @Put(':id/archived')
  async setArchived(
    @Param('id') id: string,
    @Body('archived') archived: boolean,
    @Headers('authorization') auth?: string,
  ) {
    return this.pipelineService.setArchived(id, !!archived, await this.auth.actor(auth));
  }

  @Put(':id/roles')
  async setRoles(
    @Param('id') id: string,
    @Body() roles: Record<string, string>,
    @Headers('authorization') auth?: string,
  ) {
    return this.pipelineService.setRoles(id, roles, await this.auth.actor(auth));
  }

  /** Record something in the audit trail that isn't a stage move. */
  @Put(':id/event')
  async addEvent(
    @Param('id') id: string,
    @Body('action') action: string,
    @Headers('authorization') auth?: string,
  ) {
    return this.pipelineService.addEvent(id, action, await this.auth.actor(auth));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pipelineService.remove(id);
  }
}
