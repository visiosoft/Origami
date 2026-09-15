import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { GuestAccessService } from './guest-access.service';
import { Tiers } from '../auth/guards/roles.decorator';
import { Public } from '../auth/guards/public.decorator';
import type { AuthedRequest } from '../auth/guards/session.guard';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
import { BRAND_KEYS, brandingFrom, buildLetterHtml } from '../documents/letterhead';

@Tiers('internal')
@Controller('guest-access')
export class GuestAccessController {
  constructor(
    private readonly service: GuestAccessService,
    private readonly google: GoogleService,
    private readonly settings: SettingsService,
  ) {}

  @Get()
  list(@Query('projectId') projectId?: string) {
    return this.service.list(projectId ? Number(projectId) : undefined);
  }

  /** Creates the grant and emails the link -- the office never has to copy/paste it by hand. */
  @Post()
  async create(
    @Body() body: { name: string; email: string; tier: 'client' | 'consultant'; projectId: number; days?: number },
    @Req() req: AuthedRequest,
  ) {
    const grant = await this.service.create(body, { id: req.claims?.sub, name: req.claims?.name });
    try {
      const brand = brandingFrom(await this.settings.getMany(BRAND_KEYS));
      const days = Math.round((Date.parse(grant.expiresAt) - Date.now()) / 86_400_000);
      const html = buildLetterHtml({
        brand,
        title: `Access to ${grant.projectName}`,
        recipient: grant.name,
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        body: `<p>You've been given access to ${grant.projectName}.</p><p><a href="${grant.link}">Open your project</a> — this link works for about ${days} day${days === 1 ? '' : 's'}.</p>`,
      });
      await this.google.sendMail({
        to: grant.email,
        subject: `Your access to ${grant.projectName}`,
        html,
      });
    } catch (err) {
      // The grant still exists and the link still works either way -- surface
      // the failure so staff know to send it another way, rather than fail
      // the whole grant over a mail problem.
      return { ...grant, emailSent: false, emailError: (err as Error).message };
    }
    return { ...grant, emailSent: true };
  }

  @Post(':id/revoke')
  revoke(@Param('id') id: string) {
    return this.service.revoke(Number(id));
  }

  /** Sends a real "set your password" invite on the same account -- upgrading a frequent guest to standing access. */
  @Post(':id/promote')
  promote(@Param('id') id: string) {
    return this.service.promote(Number(id));
  }

  // --- Public: the guest opening their emailed link ---

  @Public()
  @Post('resolve')
  resolve(@Body('token') token: string) {
    return this.service.resolveToken(token);
  }
}
