export declare class CreateLeaveRequestDto {
    id?: string;
    employeeId: string;
    type: string;
    startDate: string;
    endDate: string;
    hours?: number;
    reason?: string;
}
export declare class DecideLeaveRequestDto {
    note?: string;
}
