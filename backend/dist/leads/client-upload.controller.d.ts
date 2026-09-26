import { ClientWelcomeService } from './client-welcome.service';
export declare class ClientUploadController {
    private readonly welcome;
    constructor(welcome: ClientWelcomeService);
    view(token: string): Promise<{
        company: string;
        accent: string;
        project: string;
        firstName: string;
        items: string[];
        expiresAt: string;
        uploaded: {
            name: string;
            item: string;
            at: string | undefined;
        }[];
    }>;
    upload(token: string, files: any[], body: {
        item?: string;
    }): Promise<{
        company: string;
        accent: string;
        project: string;
        firstName: string;
        items: string[];
        expiresAt: string;
        uploaded: {
            name: string;
            item: string;
            at: string | undefined;
        }[];
    }>;
}
