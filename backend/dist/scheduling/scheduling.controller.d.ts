import { CalendarService } from '../google/calendar.service';
import { SettingsService } from '../settings/settings.service';
import { AuthService } from '../auth/auth.service';
import type { AuthedRequest } from '../auth/guards/session.guard';
export interface ConfiguredCalendar {
    name: string;
    email: string;
}
export declare class SchedulingController {
    private readonly calendar;
    private readonly settings;
    private readonly auth;
    constructor(calendar: CalendarService, settings: SettingsService, auth: AuthService);
    calendars(): Promise<ConfiguredCalendar[]>;
    setCalendars(body: ConfiguredCalendar[]): Promise<{
        name: string;
        email: string;
    }[]>;
    availability(from: string, to: string, emails?: string): Promise<import("../google/calendar.service").CalendarAvailability[]>;
    createEvent(req: AuthedRequest, body: {
        eventId?: string;
        summary: string;
        description?: string;
        start: string;
        end: string;
        location?: string;
        attendees?: string[];
        video?: boolean;
    }): Promise<{
        id: string;
        htmlLink: string;
        meetLink?: string;
    }>;
}
