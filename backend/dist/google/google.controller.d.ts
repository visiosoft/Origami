import type { Response } from 'express';
import { GoogleService } from './google.service';
import { CalendarService } from './calendar.service';
import { SettingsService } from '../settings/settings.service';
import { AuthService } from '../auth/auth.service';
import type { AuthedRequest } from '../auth/guards/session.guard';
export declare class GoogleController {
    private readonly google;
    private readonly settings;
    private readonly auth;
    private readonly calendar;
    constructor(google: GoogleService, settings: SettingsService, auth: AuthService, calendar: CalendarService);
    status(): Promise<{
        configured: boolean;
        connected: boolean;
        connectedEmail: string;
        connectedAt: string;
        senderEmail: string;
        redirectUri: string;
        scopes: string[];
    }>;
    connect(res: Response): Promise<void>;
    connectMyCalendar(req: AuthedRequest, res: Response): Promise<void>;
    disconnectMyCalendar(req: AuthedRequest): Promise<{
        connected: boolean;
    }>;
    myCalendarStatus(req: AuthedRequest): Promise<{
        connected: boolean;
        email: string;
        connectedAt: string;
    } | {
        connected: boolean;
        email: string;
    }>;
    myCalendarEvents(req: AuthedRequest, from: string, to: string): Promise<import("./calendar.service").MyCalendarEvent[]>;
    createMyCalendarEvent(req: AuthedRequest, body: {
        summary: string;
        start: string;
        end: string;
        description?: string;
        video?: boolean;
        location?: string;
        attendees?: string[];
    }): Promise<import("./calendar.service").MyCalendarEvent & {
        meetLink?: string;
    }>;
    login(res: Response): Promise<void>;
    callback(code: string, state: string, error: string, res: Response): Promise<void>;
    disconnect(): Promise<{
        configured: boolean;
        connected: boolean;
        connectedEmail: string;
        connectedAt: string;
        senderEmail: string;
        redirectUri: string;
        scopes: string[];
    }>;
    test(body: {
        to?: string;
    }): Promise<{
        sent: boolean;
        error: string;
        to?: undefined;
    } | {
        sent: boolean;
        to: string;
        error?: undefined;
    }>;
    send(body: {
        to: string;
        subject: string;
        html: string;
        cc?: string;
        bcc?: string;
    }): Promise<{
        id: string;
        threadId: string;
        from: string;
        to: string;
    }>;
    letterPdf(body: {
        subject?: string;
        html?: string;
        recipient?: string;
        date?: string;
        filename?: string;
        includeCoverPage?: boolean;
        includeAboutUs?: boolean;
        contactName?: string;
        contactPhone?: string;
    }, res: Response): Promise<Response<any, Record<string, any>>>;
    sendLetter(body: {
        to: string;
        subject: string;
        html: string;
        cc?: string;
        bcc?: string;
        recipient?: string;
        date?: string;
        filename?: string;
        includeCoverPage?: boolean;
        includeAboutUs?: boolean;
        contactName?: string;
        contactPhone?: string;
    }): Promise<{
        ok: boolean;
        filename: string;
    }>;
    private renderLetter;
    testDrive(): Promise<{
        ok: true;
        folderId: string;
    }>;
    files(q?: string): Promise<import("./google.service").DriveFile[]>;
}
