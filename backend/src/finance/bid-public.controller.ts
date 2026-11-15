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
}
