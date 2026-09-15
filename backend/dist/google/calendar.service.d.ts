import { GoogleService } from './google.service';
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
    constructor(google: GoogleService);
    freeBusy(emails: string[], timeMin: string, timeMax: string): Promise<CalendarAvailability[]>;
    scheduleEvent(input: ScheduleEventInput): Promise<{
        id: string;
        htmlLink: string;
        meetLink?: string;
    }>;
}
