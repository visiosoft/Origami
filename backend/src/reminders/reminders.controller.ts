import { Controller, ForbiddenException, Headers, Post } from '@nestjs/common';
import { Roles, Tiers } from '../auth/guards/roles.decorator';
import { Claims } from '../auth/guards/claims.decorator';
import type { SessionClaims } from '../auth/crypto.util';
import { Public } from '../auth/guards/public.decorator';
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
  @Public()
  @Post('run')
  async run(@Headers('x-reminder-token') token?: string) {
    const expected = await this.settings.get('reminders.triggerToken');
    // Deny by default: with no token configured this route would otherwise be
    // an unauthenticated way to make the app send mail. The in-process
    // scheduler calls the service directly and is unaffected.
    if (!expected || token !== expected) throw new ForbiddenException('Invalid reminder token.');
    return this.reminders.run();
  }

  /** Settings -> Integrations "Send now": every digest, today, from an admin session. */
  @Roles('admin')
  @Post('send-all')
  sendAll() {
    return this.reminders.run();
  }

  /** Settings -> Notifications "Email me my reminder now": the caller's own digest, whatever the schedule. */
  @Tiers('internal')
  @Post('mine')
  mine(@Claims() claims: SessionClaims | null) {
    if (!claims) throw new ForbiddenException('Sign in first.');
    return this.reminders.sendMine(claims.sub);
  }
}
