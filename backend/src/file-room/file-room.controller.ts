import {
  Body, Controller, Delete, Get, Headers, Param, Post, Put, Query, Res, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Readable } from 'stream';
import { FileRoomService, MAX_FILE_BYTES, MAX_FILES_PER_UPLOAD } from './file-room.service';
import { CreateFolderDto, RenameFileDto, EmailFileDto } from './dto/file-room.dto';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService } from '../google/attachments.service';

@Controller('file-room')
export class FileRoomController {
  constructor(
    private readonly service: FileRoomService,
    private readonly auth: AuthService,
  ) {}

  /** Projects, categories, folders and files — everything the tree needs. */
  @Get()
  list(@Query('projectId') projectId?: string) {
    const pid = Number(projectId);
    return this.service.list(Number.isFinite(pid) && pid > 0 ? pid : undefined);
  }

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD, { limits: { fileSize: MAX_FILE_BYTES } }))
  async upload(
    @UploadedFiles() files: any[],
    @Body('projectId') projectId: string,
    @Body('path') path: string,
    @Headers('authorization') auth?: string,
  ) {
    // `path` arrives as JSON in the multipart body — it can't be a real array there.
    let folderPath: string[] = [];
    try { folderPath = path ? JSON.parse(path) : []; } catch { folderPath = []; }
    return this.service.upload(
      Number(projectId),
      Array.isArray(folderPath) ? folderPath : [],
      files,
      await this.auth.requireActor(auth),
    );
  }

  /**
   * Stream a file. Scoped to its record, so a Drive id on its own is never
   * enough to pull something out of the workspace Drive.
   */
  @Get('files/:id/content')
  async content(
    @Param('id') id: string,
    @Query('thumb') thumb: string,
    @Query('download') download: string,
    @Res() res: Response,
  ) {
    const { file, body, mimeType } = await this.service.content(id, thumb === '1');
    const inline = download !== '1' && AttachmentsService.inlineSafe(mimeType);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.name)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    Readable.fromWeb(body).pipe(res);
  }

  @Put('files/:id')
  rename(@Param('id') id: string, @Body() dto: RenameFileDto) {
    return this.service.rename(id, dto.name);
  }

  /** Make the file readable by anyone holding the link, and return that link. */
  @Post('files/:id/share')
  share(@Param('id') id: string) {
    return this.service.shareLink(id);
  }

  @Post('files/:id/email')
  async emailFile(@Param('id') id: string, @Body() dto: EmailFileDto, @Headers('authorization') auth?: string) {
    return this.service.email(id, dto.to, dto.note ?? '', await this.auth.actor(auth));
  }

  /** Pull in anything added to the project's Drive folder outside the app. */
  @Post('sync')
  sync(@Query('projectId') projectId: string) {
    return this.service.sync(Number(projectId));
  }

  @Put('files/:id/latest')
  markLatest(@Param('id') id: string) {
    return this.service.markLatest(id);
  }

  @Delete('files/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('folders')
  createFolder(@Body() dto: CreateFolderDto) {
    return this.service.createFolder(Number(dto.projectId), dto.path ?? [], dto.name);
  }

  @Delete('folders/:id')
  removeFolder(@Param('id') id: string) {
    return this.service.removeFolder(id);
  }
}
