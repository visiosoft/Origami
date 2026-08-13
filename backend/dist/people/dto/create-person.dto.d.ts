export declare enum PersonKind {
    Internal = "Internal",
    Client = "Client",
    Consultant = "Consultant",
    Subcontractor = "Subcontractor",
    Vendor = "Vendor"
}
export declare class CreatePersonDto {
    name: string;
    kind: PersonKind;
    role: string;
    company?: string;
    phone?: string;
    email?: string;
    projects?: string[];
    complianceDate?: string;
}
