import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { ProjectHoldService, type HoldInput } from './project-hold.service';

@Controller('projects')
export class ProjectHoldController {
  constructor(
    private readonly holds: ProjectHoldService,
    private readonly auth: AuthService,
  ) {}

  /** Put a project on hold (or change the hold) -- creates / updates the follow-up task. */
  @Tiers('internal')
  @Post(':id/hold')
  async hold(@Param('id') id: string, @Body() body: HoldInput, @Headers('authorization') auth?: string) {
    return this.holds.hold(Number(id), body, await this.auth.actor(auth));
  }

  /** Take it off hold; the follow-up task is marked done. */
  @Tiers('internal')
  @Post(':id/resume')
  async resume(@Param('id') id: string, @Headers('authorization') auth?: string) {
    return this.holds.resume(Number(id), await this.auth.actor(auth));
  }
}
