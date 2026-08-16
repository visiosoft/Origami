// Types + styles for the Support feature (Help Center / Tickets / FAQs).

export type TicketStatus = 'Open' | 'In Progress' | 'Resolved';
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface Ticket {
  id: string;
  subject: string;
  category?: string;
  priority?: TicketPriority;
  message: string;
  requesterName?: string;
  requesterEmail?: string;
  status: TicketStatus;
  createdAt: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category?: string;
  order: number;
}

export const TICKET_CATEGORIES = ['General', 'Projects', 'Tasks', 'CRM', 'Access / Roles', 'Billing', 'Bug'];
export const TICKET_PRIORITIES: TicketPriority[] = ['Low', 'Medium', 'High', 'Urgent'];
export const TICKET_STATUSES: TicketStatus[] = ['Open', 'In Progress', 'Resolved'];

export const TICKET_STATUS_STYLE: Record<TicketStatus, { bg: string; c: string }> = {
  Open: { bg: '#FBE9AE', c: '#8A6D12' },
  'In Progress': { bg: '#D6E8E5', c: '#2F6F68' },
  Resolved: { bg: '#D2EAD3', c: '#1C5230' },
};
