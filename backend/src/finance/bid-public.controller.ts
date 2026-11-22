import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Public } from '../auth/guards/public.decorator';
import { BidPackagesService } from './bid-packages.service';

/**
 * /api/bid-public -- a sub's page for a bid request (K10, Nov 13): the scope
 * to price (never our amounts), and their price or "decline". No account
 * needed; the signed link in their email is the key.
 */
@Controller('bid-public')
export class BidPublicController {
  constructor(private readonly bids: BidPackagesService) {}

  @Public()
  @Get()
  view(@Query('token') token: string) { return this.bids.publicView(token); }

  @Public()
  @Post()
  submit(@Body() body: { token: string; decline?: boolean; total?: number | string | null; lineAmounts?: Record<string, unknown>; notes?: string }) {
    return this.bids.publicSubmit(body?.token, body || {});
  }

  /** Nov 19: the sub asks a question (answered to them only), or says they'll come to the site visit. */
  @Public()
  @Post('question')
  ask(@Body() body: { token: string; text: string }) { return this.bids.publicAsk(body?.token, body?.text); }

  @Public()
  @Post('attend')
  attend(@Body() body: { token: string; attending: boolean }) { return this.bids.publicAttend(body?.token, !!body?.attending); }
}
