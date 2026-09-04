import { Body, Controller, Get, Post } from '@nestjs/common';
import { SmsService } from './sms.service';
import { Roles, Tiers } from '../auth/guards/roles.decorator';

@Tiers('internal')
@Controller('sms')
export class SmsController {
  constructor(private readonly sms: SmsService) {}

  /** Whether SMS is set up, without returning the auth token. */
  @Get('status')
  status() {
    return this.sms.status();
  }

  @Post('send')
  send(@Body() body: { to: string; body: string }) {
    return this.sms.send({ to: body?.to, body: body?.body });
  }

  /** Prove the credentials work before relying on them. */
  @Roles('admin')
  @Post('test')
  test(@Body() body: { to: string }) {
    return this.sms.send({
      to: body?.to,
      body: 'Test message from Origami. If you received this, SMS is set up correctly.',
    });
  }
}
