import { Body, Controller, Get, Put } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Current workspace settings. Secrets come back masked. */
  @Get()
  read() {
    return this.settings.publicView();
  }

  @Put()
  async update(@Body() body: Record<string, unknown>) {
    await this.settings.setMany(body);
    return this.settings.publicView();
  }
}
