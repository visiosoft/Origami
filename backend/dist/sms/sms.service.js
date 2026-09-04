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
exports.SmsService = void 0;
exports.normalizeNumber = normalizeNumber;
exports.segmentsFor = segmentsFor;
const common_1 = require("@nestjs/common");
const settings_service_1 = require("../settings/settings.service");
const TWILIO_API = 'https://api.twilio.com/2010-04-01';
function normalizeNumber(raw, defaultCountry = '1') {
    const trimmed = (raw || '').trim();
    if (!trimmed)
        return '';
    if (trimmed.startsWith('+'))
        return '+' + trimmed.slice(1).replace(/\D/g, '');
    const digits = trimmed.replace(/\D/g, '');
    if (!digits)
        return '';
    return digits.length === 10 ? `+${defaultCountry}${digits}` : `+${digits}`;
}
function segmentsFor(body) {
    const unicode = /[^\x00-\x7F]/.test(body);
    const single = unicode ? 70 : 160;
    const multi = unicode ? 67 : 153;
    const length = body.length;
    if (length === 0)
        return { length, unicode, segments: 0, limit: single };
    const segments = length <= single ? 1 : Math.ceil(length / multi);
    return { length, unicode, segments, limit: single };
}
let SmsService = class SmsService {
    constructor(settings) {
        this.settings = settings;
        this.log = new common_1.Logger('SmsService');
    }
    async credentials() {
        const [accountSid, authToken, fromNumber, enabled] = await Promise.all([
            this.settings.get('sms.accountSid'),
            this.settings.get('sms.authToken'),
            this.settings.get('sms.fromNumber'),
            this.settings.get('sms.enabled'),
        ]);
        return {
            accountSid: (accountSid || '').trim(),
            authToken: (authToken || '').trim(),
            fromNumber: normalizeNumber(fromNumber || ''),
            enabled: enabled !== 'false',
        };
    }
    async isConfigured() {
        const c = await this.credentials();
        return !!(c.accountSid && c.authToken && c.fromNumber);
    }
    async status() {
        const c = await this.credentials();
        return {
            configured: !!(c.accountSid && c.authToken && c.fromNumber),
            enabled: c.enabled,
            fromNumber: c.fromNumber,
            accountSid: c.accountSid ? `${c.accountSid.slice(0, 6)}…${c.accountSid.slice(-4)}` : '',
        };
    }
    async send(opts) {
        const c = await this.credentials();
        if (!c.enabled)
            throw new common_1.BadRequestException('SMS is switched off in Settings.');
        if (!c.accountSid || !c.authToken || !c.fromNumber) {
            throw new common_1.BadRequestException('SMS is not configured. Add the account SID, auth token and sending number in Settings.');
        }
        const to = normalizeNumber(opts.to);
        if (!to || to.length < 8)
            throw new common_1.BadRequestException(`"${opts.to}" is not a usable phone number.`);
        const body = (opts.body || '').trim();
        if (!body)
            throw new common_1.BadRequestException('The message is empty.');
        const auth = Buffer.from(`${c.accountSid}:${c.authToken}`).toString('base64');
        const form = new URLSearchParams({ To: to, From: c.fromNumber, Body: body });
        const res = await fetch(`${TWILIO_API}/Accounts/${encodeURIComponent(c.accountSid)}/Messages.json`, {
            method: 'POST',
            headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form.toString(),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            const reason = payload?.message || `SMS failed (${res.status})`;
            this.log.warn(`SMS to ${to} failed: ${reason}`);
            throw new common_1.BadRequestException(reason);
        }
        const meta = segmentsFor(body);
        this.log.log(`SMS sent to ${to} (${meta.segments} segment${meta.segments === 1 ? '' : 's'})`);
        return { sent: true, to, sid: payload?.sid, segments: meta.segments };
    }
};
exports.SmsService = SmsService;
exports.SmsService = SmsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [settings_service_1.SettingsService])
], SmsService);
//# sourceMappingURL=sms.service.js.map