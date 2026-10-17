export interface LogStatus {
    name: string;
    closed?: boolean;
    color?: string;
}
export declare const LOG_STATUSES_KEY = "requestLog.statuses";
export declare const DEFAULT_LOG_STATUSES: LogStatus[];
export declare const LOG_START = "To Do";
export declare const LOG_BUCKETS: string[];
export declare function bucketOf(status: string | null | undefined, hasAssignee: boolean): string | null | undefined;
export declare function withBuckets(list: LogStatus[]): LogStatus[];
export declare function parseLogStatuses(raw: unknown): LogStatus[];
export declare const isClosedStatus: (list: LogStatus[], status?: string | null) => boolean;
