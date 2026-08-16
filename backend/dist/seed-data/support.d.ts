export type TicketStatus = 'Open' | 'In Progress' | 'Resolved';
export interface Faq {
    id: string;
    question: string;
    answer: string;
    category?: string;
    order: number;
}
export interface Ticket {
    id: string;
    subject: string;
    category?: string;
    priority?: string;
    message: string;
    requesterName?: string;
    requesterEmail?: string;
    status: TicketStatus;
    createdAt: string;
}
export declare const DEFAULT_FAQS: Faq[];
