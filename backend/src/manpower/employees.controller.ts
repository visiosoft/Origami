import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Readable } from 'stream';
import { Tiers } from '../auth/guards/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService, MAX_FILE_BYTES } from '../google/attachments.service';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/employee.dto';

@Tiers('internal')
@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly service: EmployeesService,
    private readonly auth: AuthService,
    private readonly attachments: AttachmentsService,
  ) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateEmployeeDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/photo')
  @UseInterceptors(FilesInterceptor('files', 1, { limits: { fileSize: MAX_FILE_BYTES } }))
  async uploadPhoto(@Param('id') id: string, @UploadedFiles() files: any[], @Headers('authorization') auth?: string) {
    return this.service.setPhoto(id, files, await this.auth.requireActor(auth));
  }

  @Get(':id/photo')
  async photo(@Param('id') id: string, @Res() res: Response) {
    const att = await this.service.photo(id);
    const file = await this.attachments.download(att);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    Readable.fromWeb(file.body).pipe(res);
  }
}
