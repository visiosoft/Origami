export interface LogStatus {
    name: string;
    closed?: boolean;
    color?: string;
}
export declare const LOG_STATUSES_KEY = "requestLog.statuses";
export declare const DEFAULT_LOG_STATUSES: LogStatus[];
export declare function parseLogStatuses(raw: unknown): LogStatus[];
export declare const isClosedStatus: (list: LogStatus[], status?: string | null) => boolean;
