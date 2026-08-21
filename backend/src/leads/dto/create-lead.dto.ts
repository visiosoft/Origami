import { IsString, IsOptional, IsArray, IsNumber, IsObject, Allow } from 'class-validator';

export class CreateLeadDto {
    @IsString() @IsOptional() id?: string;
    @IsString() leadName: string;
    @IsString() @IsOptional() namePronunciation?: string;
    @IsString() phone: string;
    @IsString() @IsOptional() email?: string;
    @IsString() @IsOptional() primaryPointOfContact?: string;
    @IsString() @IsOptional() secondPointOfContact?: string;
    @IsString() @IsOptional() nameOfSecondContact?: string;
    @IsString() @IsOptional() phoneOfSecondContact?: string;
    @IsString() @IsOptional() emailOfSecondContact?: string;
    @IsString() @IsOptional() relationshipOfSecondContact?: string;
    @IsString() @IsOptional() decisionMakers?: string;
    @IsString() @IsOptional() preferredContactMethod?: string;
    @IsString() @IsOptional() leadSource?: string;
    @IsString() @IsOptional() projectStreetAddress?: string;
    @IsString() @IsOptional() projectStreetName?: string;
    @IsString() @IsOptional() projectCity?: string;
    @IsString() @IsOptional() projectZipCode?: string;
    @IsString() @IsOptional() countyLocation?: string;
    @IsString() @IsOptional() propertyType?: string;
    @IsString() @IsOptional() potentialProjectType?: string;
    @IsArray() @IsOptional() homeworkCompleted?: string[];
    @IsString() @IsOptional() projectVision?: string;
    @IsString() @IsOptional() reasonForProject?: string;
    @IsString() @IsOptional() budgetPosition?: string;
    @IsString() @IsOptional() fundingStatus?: string;
    @IsString() @IsOptional() desiredStart?: string;
    @IsString() @IsOptional() expectedDuration?: string;
    @IsString() @IsOptional() expectedLengthOfOwnership?: string;
    @IsString() @IsOptional() clientPersonality?: string;
    @IsString() @IsOptional() virtualMeetingAt?: string;
    @IsString() @IsOptional() siteVisitAt?: string;
    @IsNumber() @IsOptional() fitScore?: number;
    @IsObject() @IsOptional() fitSelections?: Record<string, string>;
    @IsString() @IsOptional() zoningImages?: string; // JSON string of [{name,dataUrl}]
    @IsString() @IsOptional() zoningAnalysis?: string; // JSON string of the Zoning Code Analysis field map
}
