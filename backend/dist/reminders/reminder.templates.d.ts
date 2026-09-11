import { type EmailBrand } from '../email/shell';
export interface ReminderTask {
    id: string;
    title: string;
    dueDate: string;
    project: string;
    where: 'board' | 'log';
}
export interface ReminderBuckets {
    overdue: ReminderTask[];
    today: ReminderTask[];
    soon: ReminderTask[];
    milestones?: ReminderTask[];
}
export declare function reminderEmail(opts: {
    name: string;
    buckets: ReminderBuckets;
    url: string;
    brand: EmailBrand;
}): {
    subject: string;
    html: string;
};
export declare function overdueEmail(opts: {
    name: string;
    tasks: ReminderTask[];
    url: string;
    brand: EmailBrand;
}): {
    subject: string;
    html: string;
};
export declare function progressEmail(opts: {
    name: string;
    phaseName: string;
    projectName: string;
    threshold: 50 | 90 | 100;
    url: string;
    brand: EmailBrand;
}): {
    subject: string;
    html: string;
};
export declare function overstretchEmail(opts: {
    name: string;
    count: number;
    threshold: number;
    url: string;
    brand: EmailBrand;
}): {
    subject: string;
    html: string;
};
