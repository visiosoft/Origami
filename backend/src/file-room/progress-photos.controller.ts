import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query, UploadedFiles, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Claims } from '../auth/guards/claims.decorator';
import { Tiers } from '../auth/guards/roles.decorator';
import { ProjectAccessService } from '../auth/project-access.service';
import type { SessionClaims } from '../auth/crypto.util';
import { AuthService } from '../auth/auth.service';
import { MAX_FILE_BYTES, MAX_FILES_PER_UPLOAD } from './file-room.service';
import { ProgressPhotosService } from './progress-photos.service';

@Controller('progress-photos')
export class ProgressPhotosController {
  constructor(
    private readonly service: ProgressPhotosService,
    private readonly auth: AuthService,
    private readonly access: ProjectAccessService,
  ) {}

  @Get('categories')
  categories() {
    return this.service.categories();
  }

  /** A project's photos. Clients see only the ones marked for them; staff also get the unsorted ones. */
  @Get()
  async list(@Query('projectId') projectId: string, @Claims() claims?: SessionClaims | null) {
    const pid = Number(projectId);
    if (!Number.isFinite(pid) || pid <= 0) throw new BadRequestException('Pick a project.');
    await this.access.assert(claims ?? null, pid);
    return this.service.list(pid, this.access.isStaff(claims ?? null));
  }

  @Tiers('internal')
  @Post('upload')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD, { limits: { fileSize: MAX_FILE_BYTES } }))
  async upload(@UploadedFiles() files: any[], @Body('projectId') projectId: string, @Body('meta') meta: string, @Body('dates') dates: string, @Headers('authorization') auth?: string) {
    // Multipart: the details and the per-photo dates arrive as JSON strings.
    let m: any = {}; let d: string[] = [];
    try { m = meta ? JSON.parse(meta) : {}; } catch { m = {}; }
    try { d = dates ? JSON.parse(dates) : []; } catch { d = []; }
    const count = await this.service.upload(Number(projectId), files, m, Array.isArray(d) ? d.map(String) : [], await this.auth.requireActor(auth));
    return { uploaded: count };
  }

  @Tiers('internal')
  @Post('classify')
  async classify(@Body() dto: { fileIds?: string[]; meta?: any }, @Headers('authorization') auth?: string) {
    return this.service.classify(Array.isArray(dto?.fileIds) ? dto.fileIds : [], dto?.meta || {}, await this.auth.requireActor(auth));
  }

  @Tiers('internal')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto || {});
  }

  @Tiers('internal')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
