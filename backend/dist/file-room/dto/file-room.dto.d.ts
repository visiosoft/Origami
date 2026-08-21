export declare class CreateFolderDto {
    projectId: number;
    path?: string[];
    name: string;
}
export declare class UpdateFileDto {
    name?: string;
    notes?: string;
}
export declare class EmailFileDto {
    to: string;
    note?: string;
}
