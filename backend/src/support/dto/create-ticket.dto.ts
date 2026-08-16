import { IsString, IsOptional } from 'class-validator';

export class CreateTicketDto {
  @IsString() @IsOptional() id?: string;
  @IsString() subject: string;
  @IsString() @IsOptional() category?: string;
  @IsString() @IsOptional() priority?: string;
  @IsString() message: string;
  @IsString() @IsOptional() requesterName?: string;
  @IsString() @IsOptional() requesterEmail?: string;
  @IsString() @IsOptional() status?: string;
}
