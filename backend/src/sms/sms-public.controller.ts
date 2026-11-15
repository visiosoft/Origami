import { Body, Controller, Get, Headers, HttpCode, Post, Put, Query, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/guards/public.decorator';
import { SmsService } from './sms.service';

/**
 * Text preferences (Nov 13 sync), without signing in: the link at the foot of
 * every text, and Quo's webhook for STOP / START replies.
 */
@Public()
@Controller('texts')
export class SmsPublicController {
  constructor(private readonly sms: SmsService) {}

  @Get('prefs')
  prefs(@Query('t') t: string) {
    return this.sms.prefsFor(t);
  }

  @Put('prefs')
  save(@Body() body: { t: string; stopAll?: boolean; off?: string[] }) {
    return this.sms.savePrefs(String(body?.t || ''), { stopAll: !!body?.stopAll, off: Array.isArray(body?.off) ? body.off.map(String) : [] });
  }

  @Post('quo-webhook')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers() headers: Record<string, string>, @Body() body: unknown) {
    const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(body ?? {});
    return this.sms.quoWebhook(headers, raw, body);
  }
}
