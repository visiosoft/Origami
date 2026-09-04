import { SmsService } from './sms.service';
export declare class SmsController {
    private readonly sms;
    constructor(sms: SmsService);
    status(): Promise<{
        configured: boolean;
        enabled: boolean;
        fromNumber: string;
        accountSid: string;
    }>;
    send(body: {
        to: string;
        body: string;
    }): Promise<{
        sent: boolean;
        to: string;
        sid: any;
        segments: number;
    }>;
    test(body: {
        to: string;
    }): Promise<{
        sent: boolean;
        to: string;
        sid: any;
        segments: number;
    }>;
}
