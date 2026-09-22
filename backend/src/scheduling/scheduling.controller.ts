import { BadRequestException, Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { CalendarService } from '../google/calendar.service';
import { SettingsService } from '../settings/settings.service';
import { AuthService } from '../auth/auth.service';
import { Tiers } from '../auth/guards/roles.decorator';
import type { AuthedRequest } from '../auth/guards/session.guard';

export interface ConfiguredCalendar { name: string; email: string }

@Tiers('internal')
@Controller('scheduling')
export class SchedulingController {
  constructor(
    private readonly calendar: CalendarService,
    private readonly settings: SettingsService,
    private readonly auth: AuthService,
  ) {}

  /** Who to check availability for -- the office's own configured list. */
  @Get('calendars')
  async calendars(): Promise<ConfiguredCalendar[]> {
    const raw = await this.settings.get('scheduling.calendars');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((c) => c?.email) : [];
    } catch {
      return [];
    }
  }

  @Post('calendars')
  async setCalendars(@Body() body: ConfiguredCalendar[]) {
    const clean = (Array.isArray(body) ? body : [])
      .filter((c) => c?.email?.trim())
      .map((c) => ({ name: String(c.name || '').trim(), email: String(c.email).trim() }));
    await this.settings.set('scheduling.calendars', JSON.stringify(clean));
    return clean;
  }

  /**
   * Busy blocks for the configured calendars (or an explicit ?emails=
   * override) across one window, so booking a time shows conflicts before
   * they happen instead of after.
   */
  @Get('availability')
  async availability(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('emails') emails?: string,
  ) {
    if (!from || !to) return [];
    const list = emails
      ? emails.split(',').map((e) => e.trim()).filter(Boolean)
      : (await this.calendars()).map((c) => c.email);
    return this.calendar.freeBusy(list, from, to);
  }

  /**
   * Create or update the real calendar event a booking represents, on the
   * signed-in user's own calendar -- so it shows up on their My Calendar,
   * the same place any other event they create does.
   */
  @Post('events')
  async createEvent(@Req() req: AuthedRequest, @Body() body: {
    eventId?: string; summary: string; description?: string; start: string; end: string;
    location?: string; attendees?: string[]; video?: boolean;
  }) {
    const userId = req.claims?.sub;
    if (!userId) throw new BadRequestException('Sign in to continue.');
    const creds = await this.auth.myCalendarCredentials(userId);
    if (!creds) throw new BadRequestException('Connect your calendar first: Settings → My Calendar.');
    return this.calendar.scheduleMyEvent(userId, creds.refreshToken, body);
  }
}
