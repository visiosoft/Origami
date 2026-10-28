import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { ManpowerAccess } from '../manpower/manpower-access.service';
import { SpecialActionsService } from './special-actions.service';

/** Duplicate a special action (to several projects at once) or convert it into another kind. */
@Tiers('internal')
@Controller('special-actions')
export class SpecialActionsController {
  constructor(private readonly service: SpecialActionsService, private readonly access: ManpowerAccess) {}

  /** One project's special actions at a glance: open counts and when each kind last changed. */
  @Get('project/:id') summary(@Param('id', ParseIntPipe) id: number) { return this.service.projectSummary(id); }

  @Post('duplicate') async duplicate(@Body() dto: any, @Headers('authorization') a?: string) { return this.service.duplicate(dto || {}, await this.access.actor(a)); }
  @Post('convert') async convert(@Body() dto: any, @Headers('authorization') a?: string) { return this.service.convert(dto || {}, await this.access.actor(a)); }
}
