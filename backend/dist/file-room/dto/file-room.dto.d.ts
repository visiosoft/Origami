export declare class CreateFolderDto {
    projectId: number;
    path?: string[];
    name: string;
}
export declare class UpdateFileDto {
    name?: string;
    notes?: string;
}
export declare class MoveFileDto {
    folderPath: string[];
}
export declare class EmailFileDto {
    to: string;
    note?: string;
}
export declare class FileIdsDto {
    ids: string[];
}
export declare class EmailFilesDto extends FileIdsDto {
    to: string;
    note?: string;
}
export declare class MoveFilesDto extends FileIdsDto {
    folderPath: string[];
}
