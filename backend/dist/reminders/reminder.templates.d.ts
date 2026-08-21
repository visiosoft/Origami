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
}
export declare function reminderEmail(opts: {
    name: string;
    buckets: ReminderBuckets;
    url: string;
}): {
    subject: string;
    html: string;
};
