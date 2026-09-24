import {
  Body, Controller, Delete, Get, Headers, Param, Post, Put, Query, Res, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { Claims } from '../auth/guards/claims.decorator';
import { Tiers } from '../auth/guards/roles.decorator';
import { ProjectAccessService } from '../auth/project-access.service';
import type { SessionClaims } from '../auth/crypto.util';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Readable } from 'stream';
import { FileRoomService, MAX_FILE_BYTES, MAX_FILES_PER_UPLOAD } from './file-room.service';
import { CreateFolderDto, UpdateFileDto, EmailFileDto } from './dto/file-room.dto';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService } from '../google/attachments.service';

@Controller('file-room')
export class FileRoomController {
  constructor(
    private readonly service: FileRoomService,
    private readonly auth: AuthService,
    private readonly access: ProjectAccessService,
  ) {}

  /** Projects, categories, folders and files — everything the tree needs. */
  @Get()
  async list(@Query('projectId') projectId?: string, @Claims() claims?: SessionClaims | null) {
    const pid = Number(projectId);
    const scoped = Number.isFinite(pid) && pid > 0 ? pid : undefined;
    if (scoped) await this.access.assert(claims ?? null, scoped);
    const all = await this.service.list(scoped);
    if (this.access.isStaff(claims ?? null)) return all;
    // Outside accounts see only the projects they're linked to.
    const allowed = await this.access.allowedIds(claims ?? null);
    const ok = (id: unknown) => allowed === 'all' || allowed.has(Number(id));
    return { ...all, projects: all.projects.filter((p: any) => ok(p.id)), files: all.files.filter((f: any) => ok(f.projectId)), folders: all.folders.filter((f: any) => ok(f.projectId)) };
  }

  @Tiers('internal')
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
    @Claims() claims: SessionClaims | null,
  ) {
    const { file, body, mimeType } = await this.service.content(id, thumb === '1');
    if (!(await this.access.canSee(claims, (file as any).projectId))) {
      await (body as any)?.cancel?.().catch?.(() => {});
      res.status(403).json({ message: 'You don’t have access to this file.' });
      return;
    }
    const inline = download !== '1' && AttachmentsService.inlineSafe(mimeType);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.name)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    Readable.fromWeb(body).pipe(res);
  }

  @Tiers('internal')
  @Put('files/:id')
  update(@Param('id') id: string, @Body() dto: UpdateFileDto) {
    return this.service.update(id, dto);
  }

  /** Make the file readable by anyone holding the link, and return that link. */
  @Tiers('internal')
  @Post('files/:id/share')
  share(@Param('id') id: string) {
    return this.service.shareLink(id);
  }

  @Tiers('internal')
  @Post('files/:id/email')
  async emailFile(@Param('id') id: string, @Body() dto: EmailFileDto, @Headers('authorization') auth?: string) {
    return this.service.email(id, dto.to, dto.note ?? '', await this.auth.actor(auth));
  }

  /** Pull in anything added to the project's Drive folder outside the app. */
  @Tiers('internal')
  @Post('sync')
  sync(@Query('projectId') projectId: string) {
    return this.service.sync(Number(projectId));
  }

  @Tiers('internal')
  @Put('files/:id/latest')
  markLatest(@Param('id') id: string) {
    return this.service.markLatest(id);
  }

  @Tiers('internal')
  @Delete('files/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Tiers('internal')
  @Post('folders')
  createFolder(@Body() dto: CreateFolderDto) {
    return this.service.createFolder(Number(dto.projectId), dto.path ?? [], dto.name);
  }

  @Tiers('internal')
  @Delete('folders/:id')
  removeFolder(@Param('id') id: string) {
    return this.service.removeFolder(id);
  }
}
