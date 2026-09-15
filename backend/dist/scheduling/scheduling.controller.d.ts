import { CalendarService } from '../google/calendar.service';
import { SettingsService } from '../settings/settings.service';
export interface ConfiguredCalendar {
    name: string;
    email: string;
}
export declare class SchedulingController {
    private readonly calendar;
    private readonly settings;
    constructor(calendar: CalendarService, settings: SettingsService);
    calendars(): Promise<ConfiguredCalendar[]>;
    setCalendars(body: ConfiguredCalendar[]): Promise<{
        name: string;
        email: string;
    }[]>;
    availability(from: string, to: string, emails?: string): Promise<import("../google/calendar.service").CalendarAvailability[]>;
    createEvent(body: {
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
