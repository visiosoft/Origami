import { GoogleService } from './google.service';
export interface MyCalendarEvent {
    id: string;
    summary: string;
    start: string;
    end: string;
    allDay: boolean;
    htmlLink?: string;
}
export interface BusyBlock {
    start: string;
    end: string;
}
export interface CalendarAvailability {
    email: string;
    busy: BusyBlock[] | null;
    error?: string;
}
export interface ScheduleEventInput {
    eventId?: string;
    summary: string;
    description?: string;
    start: string;
    end: string;
    location?: string;
    attendees?: string[];
    video?: boolean;
}
export declare class CalendarService {
    private readonly google;
    private readonly log;
    private userTokens;
    constructor(google: GoogleService);
    private userToken;
    myEvents(userId: string, refreshToken: string, timeMin: string, timeMax: string): Promise<MyCalendarEvent[]>;
    createMyEvent(userId: string, refreshToken: string, input: ScheduleEventInput): Promise<MyCalendarEvent & {
        meetLink?: string;
    }>;
    freeBusy(emails: string[], timeMin: string, timeMax: string): Promise<CalendarAvailability[]>;
    scheduleMyEvent(userId: string, refreshToken: string, input: ScheduleEventInput): Promise<{
        id: string;
        htmlLink: string;
        meetLink?: string;
    }>;
}
