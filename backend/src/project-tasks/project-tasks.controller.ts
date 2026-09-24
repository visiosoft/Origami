import {
  Controller, Get, Post, Put, Delete, Param, Query, Body, Headers, Res, UploadedFiles, UseInterceptors, ForbiddenException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Readable } from 'stream';
import { ProjectTasksService } from './project-tasks.service';
import { CreateProjectTaskDto, ReorderDto } from './dto/create-project-task.dto';
import { AddCommentDto, AddLinkDto } from '../tasks/dto/update-task.dto';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService, MAX_FILE_BYTES, MAX_FILES_PER_UPLOAD } from '../google/attachments.service';
import { assignedTo, scopeTasks } from '../database/viewer.util';
import { Claims } from '../auth/guards/claims.decorator';
import { Tiers } from '../auth/guards/roles.decorator';
import { ProjectAccessService } from '../auth/project-access.service';
import type { SessionClaims } from '../auth/crypto.util';

@Controller('project-tasks')
export class ProjectTasksController {
  constructor(
    private readonly service: ProjectTasksService,
    private readonly auth: AuthService,
    private readonly attachments: AttachmentsService,
    private readonly access: ProjectAccessService,
  ) {}

  /**
   * Outside accounts (clients, consultants, guests) may only touch tasks on
   * projects they're linked to that are assigned to them; staff, anything.
   */
  private async mayTouch(id: string, claims: SessionClaims | null) {
    if (this.access.isStaff(claims)) return;
    const task = await this.service.get(id);
    await this.access.assert(claims, task.projectId);
    if (!claims || !assignedTo(task as any, claims)) throw new ForbiddenException('That task isn’t assigned to you.');
  }

  /**
   * `projectId` query param: absent = everything (every project + General
   * Tasks); the literal string "null" = General Tasks only; anything else =
   * that project's id.
   */
  private parseProjectId(raw?: string): number | null | undefined {
    if (raw === undefined) return undefined;
    if (raw === 'null' || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  @Get()
  async findAll(@Query('projectId') projectId?: string, @Headers('authorization') auth?: string) {
    const claims = await this.auth.verify(auth);
    const pid = this.parseProjectId(projectId);
    if (pid) await this.access.assert(claims, pid);
    const rows = await this.service.findAll(pid);
    return scopeTasks(await this.access.filter(claims, rows, (t: any) => t.projectId), claims);
  }

  @Get('board')
  async board(@Query('projectId') projectId?: string, @Headers('authorization') auth?: string) {
    const pid = this.parseProjectId(projectId) ?? null;
    const claims = await this.auth.verify(auth);
    if (pid) await this.access.assert(claims, pid);
    else if (!this.access.isStaff(claims)) return { sections: [], tasks: [] }; // the General Tasks board is internal
    const { sections, tasks } = await this.service.board(pid);
    return { sections, tasks: scopeTasks(tasks, claims) };
  }

  /**
   * Persist a manual card order for one section in a single request.
   * Declared before `:id` so "reorder" isn't captured as a task id.
   */
  @Tiers('internal')
  @Put('reorder')
  reorder(@Body() dto: ReorderDto) {
    return this.service.reorder(dto.sectionId, dto.ids ?? []);
  }

  @Tiers('internal')
  @Post()
  async create(@Body() dto: CreateProjectTaskDto, @Headers('authorization') auth?: string) {
    return this.service.create(dto, await this.auth.actor(auth));
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateProjectTaskDto>, @Headers('authorization') auth?: string, @Claims() claims?: SessionClaims | null) {
    await this.mayTouch(id, claims ?? null);
    return this.service.update(id, dto, await this.auth.actor(auth));
  }

  @Tiers('internal')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ------------------------------------------------------------- attachments

  @Post(':id/attachments')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD, { limits: { fileSize: MAX_FILE_BYTES } }))
  async upload(@Param('id') id: string, @UploadedFiles() files: any[], @Headers('authorization') auth?: string, @Claims() claims?: SessionClaims | null) {
    await this.mayTouch(id, claims ?? null);
    return this.service.addAttachments(id, files, await this.auth.requireActor(auth));
  }

  @Post(':id/attachments/link')
  async link(@Param('id') id: string, @Body() dto: AddLinkDto, @Headers('authorization') auth?: string, @Claims() claims?: SessionClaims | null) {
    await this.mayTouch(id, claims ?? null);
    return this.service.addLink(id, dto.name ?? '', dto.url, await this.auth.actor(auth));
  }

  @Delete(':id/attachments/:attId')
  async removeAttachment(@Param('id') id: string, @Param('attId') attId: string, @Headers('authorization') auth?: string, @Claims() claims?: SessionClaims | null) {
    await this.mayTouch(id, claims ?? null);
    return this.service.removeAttachment(id, attId, await this.auth.actor(auth));
  }

  /**
   * Stream one attachment's bytes.
   *
   * Scoped to the task on purpose: the attachment is resolved from the task
   * record first, so a bare Drive file id can never pull an arbitrary file out
   * of the workspace Drive.
   */
  @Get(':id/attachments/:attId/content')
  async content(
    @Param('id') id: string,
    @Param('attId') attId: string,
    @Query('thumb') thumb: string,
    @Res() res: Response,
    @Claims() claims: SessionClaims | null,
  ) {
    await this.mayTouch(id, claims);
    const att = await this.service.attachment(id, attId);
    const file = await this.attachments.download(att, thumb === '1');
    const inline = AttachmentsService.inlineSafe(file.mimeType);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(att.name)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    Readable.fromWeb(file.body).pipe(res);
  }

  // ---------------------------------------------------------------- comments

  @Post(':id/comments')
  async comment(@Param('id') id: string, @Body() dto: AddCommentDto, @Headers('authorization') auth?: string, @Claims() claims?: SessionClaims | null) {
    await this.mayTouch(id, claims ?? null);
    return this.service.addComment(id, dto.text, await this.auth.actor(auth));
  }
}
