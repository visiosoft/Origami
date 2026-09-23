import {
  Body, Controller, Delete, Get, Headers, Param, Post, Put, Query, Res, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Readable } from 'stream';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { Tiers } from '../auth/guards/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService, MAX_FILE_BYTES, MAX_FILES_PER_UPLOAD } from '../google/attachments.service';
import { AddLinkDto } from '../tasks/dto/update-task.dto';
import { EmployeeRecordsService } from './employee-records.service';

export class EmployeeRecordDto {
  @IsString() employeeId: string;
  @IsIn(['document', 'certification', 'contract']) kind: string;
  @IsString() @IsOptional() type?: string;
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() number?: string;
  @IsString() @IsOptional() issuer?: string;
  @IsString() @IsOptional() issueDate?: string;
  @IsString() @IsOptional() expiryDate?: string;
  @IsNumber() @IsOptional() rate?: number;
  @IsString() @IsOptional() terms?: string;
  @IsString() @IsOptional() verification?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() notes?: string;
}

@Tiers('internal')
@Controller('employee-records')
export class EmployeeRecordsController {
  constructor(
    private readonly service: EmployeeRecordsService,
    private readonly auth: AuthService,
    private readonly attachments: AttachmentsService,
  ) {}

  @Get()
  findAll(@Query('employeeId') employeeId?: string, @Query('kind') kind?: string) {
    return this.service.findAll({ employeeId, kind });
  }

  @Post()
  create(@Body() dto: EmployeeRecordDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<EmployeeRecordDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/attachments')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD, { limits: { fileSize: MAX_FILE_BYTES } }))
  async upload(@Param('id') id: string, @UploadedFiles() files: any[], @Headers('authorization') auth?: string) {
    return this.service.addAttachments(id, files, await this.auth.requireActor(auth));
  }

  @Post(':id/attachments/link')
  async link(@Param('id') id: string, @Body() dto: AddLinkDto, @Headers('authorization') auth?: string) {
    return this.service.addLink(id, dto.name ?? '', dto.url, await this.auth.actor(auth));
  }

  @Delete(':id/attachments/:attId')
  removeAttachment(@Param('id') id: string, @Param('attId') attId: string) {
    return this.service.removeAttachment(id, attId);
  }

  @Get(':id/attachments/:attId/content')
  async content(@Param('id') id: string, @Param('attId') attId: string, @Query('thumb') thumb: string, @Res() res: Response) {
    const att = await this.service.attachment(id, attId);
    const file = await this.attachments.download(att, thumb === '1');
    const inline = AttachmentsService.inlineSafe(file.mimeType);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(att.name)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    Readable.fromWeb(file.body).pipe(res);
  }
}
