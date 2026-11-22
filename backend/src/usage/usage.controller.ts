import { Body, Controller, Get, Put } from '@nestjs/common';
import { Roles } from '../auth/guards/roles.decorator';
import { UsageService } from './usage.service';

/** Settings → Integrations → Usage & credits (Nov 20): administrators only. */
@Roles('admin')
@Controller('usage')
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  @Get() status() { return this.usage.status(); }

  /** { quo: { amount, units, since }, openai: {...} } */
  @Put('credits') setCredits(@Body() body: unknown) { return this.usage.setCredits(body); }
}
