import { Controller, Get, Headers, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/guards/public.decorator';
import { Tiers } from '../auth/guards/roles.decorator';
import { TrackingService } from './tracking.service';

/** /api/d/:token -- a tracked email link: count the open, then forward. */
@Controller('d')
export class TrackedLinkController {
  constructor(private readonly tracking: TrackingService) {}

  @Public()
  @Get(':token')
  async go(@Param('token') token: string, @Headers('user-agent') ua: string | undefined, @Res() res: Response) {
    const target = await this.tracking.open(token, ua);
    if (!target) return res.status(404).type('text/plain').send('This link is no longer valid. Ask your project contact to send it again.');
    return res.redirect(302, target);
  }
}

/** Who opened what: a change order's or a share's tracked links (internal staff). */
@Tiers('internal')
@Controller('tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Get(':kind/:refId')
  list(@Param('kind') kind: string, @Param('refId') refId: string) {
    return this.tracking.forRef(kind, refId);
  }
}
