import { type EmailBrand } from '../email/shell';
export interface AssignmentEmailInput {
    brand: EmailBrand;
    recipientName: string;
    assignerName: string;
    title: string;
    description?: string;
    project?: string;
    dueDate?: string;
    priority?: string;
    status?: string;
    url: string;
    settingsUrl: string;
}
export declare function assignmentEmail(input: AssignmentEmailInput): {
    subject: string;
    html: string;
};
