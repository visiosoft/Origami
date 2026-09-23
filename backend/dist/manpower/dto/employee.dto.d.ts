export declare class CreateEmployeeDto {
    id?: string;
    name: string;
    jobTitle?: string;
    trade?: string;
    expertise?: string[];
    payType?: string;
    payRate?: number;
    phone?: string;
    email?: string;
    hireDate?: string;
    status?: string;
    supervisorId?: string | null;
    userId?: string | null;
}
