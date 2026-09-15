"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarService = void 0;
const common_1 = require("@nestjs/common");
const google_service_1 = require("./google.service");
const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
let CalendarService = class CalendarService {
    constructor(google) {
        this.google = google;
        this.log = new common_1.Logger('CalendarService');
    }
    async freeBusy(emails, timeMin, timeMax) {
        const clean = [...new Set(emails.map((e) => e.trim()).filter(Boolean))];
        if (!clean.length)
            return [];
        const token = await this.google.workspaceToken();
        const res = await fetch(FREEBUSY_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeMin, timeMax, items: clean.map((id) => ({ id })) }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            this.log.error(`freeBusy failed: ${JSON.stringify(body)}`);
            throw new common_1.BadRequestException(body?.error?.message || 'Could not read calendar availability.');
        }
        const calendars = body?.calendars || {};
        return clean.map((email) => {
            const cal = calendars[email];
            if (!cal || cal.errors?.length) {
                return { email, busy: null, error: cal?.errors?.[0]?.reason || 'not shared with this account' };
            }
            return { email, busy: (cal.busy || []).map((b) => ({ start: b.start, end: b.end })) };
        });
    }
    async scheduleEvent(input) {
        const token = await this.google.workspaceToken();
        const body = {
            summary: input.summary,
            description: input.description || '',
            start: { dateTime: input.start },
            end: { dateTime: input.end },
        };
        if (input.location)
            body.location = input.location;
        if (input.attendees?.length)
            body.attendees = input.attendees.map((email) => ({ email }));
        if (input.video) {
            body.conferenceData = { createRequest: { requestId: `origami-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } };
        }
        const url = input.eventId ? `${EVENTS_URL}/${encodeURIComponent(input.eventId)}` : EVENTS_URL;
        const params = new URLSearchParams({ sendUpdates: 'all' });
        if (input.video)
            params.set('conferenceDataVersion', '1');
        const res = await fetch(`${url}?${params.toString()}`, {
            method: input.eventId ? 'PATCH' : 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            this.log.error(`Calendar event ${input.eventId ? 'update' : 'create'} failed: ${JSON.stringify(json)}`);
            throw new common_1.BadRequestException(json?.error?.message || 'Google Calendar rejected the event.');
        }
        const meetLink = json?.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri;
        return { id: json.id, htmlLink: json.htmlLink, meetLink };
    }
};
exports.CalendarService = CalendarService;
exports.CalendarService = CalendarService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [google_service_1.GoogleService])
], CalendarService);
//# sourceMappingURL=calendar.service.js.map