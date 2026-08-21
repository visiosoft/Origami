import { Controller, ForbiddenException, Headers, Post } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { SettingsService } from '../settings/settings.service';

@Controller('reminders')
export class RemindersController {
  constructor(
    private readonly reminders: RemindersService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Send the digests now.
   *
   * Exists so reminders are testable on demand, and so an external scheduler can
   * drive them if the in-process cron ever proves unreliable (App Service will
   * idle the process out unless "Always On" is enabled). Guarded by a shared
   * token rather than a session, since the caller is usually a machine.
   */
  @Post('run')
  async run(@Headers('x-reminder-token') token?: string) {
    const expected = await this.settings.get('reminders.triggerToken');
    if (expected && token !== expected) throw new ForbiddenException('Invalid reminder token.');
    return this.reminders.run();
  }
}
