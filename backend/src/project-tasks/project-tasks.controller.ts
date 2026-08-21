import {
  Controller, Get, Post, Put, Delete, Param, Query, Body, Headers, Res, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Readable } from 'stream';
import { ProjectTasksService } from './project-tasks.service';
import { CreateProjectTaskDto, ReorderDto } from './dto/create-project-task.dto';
import { AddCommentDto, AddLinkDto } from '../tasks/dto/update-task.dto';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService, MAX_FILE_BYTES, MAX_FILES_PER_UPLOAD } from '../google/attachments.service';
import { scopeTasks } from '../database/viewer.util';

@Controller('project-tasks')
export class ProjectTasksController {
  constructor(
    private readonly service: ProjectTasksService,
    private readonly auth: AuthService,
    private readonly attachments: AttachmentsService,
  ) {}

  @Get()
  async findAll(@Query('projectId') projectId?: string, @Headers('authorization') auth?: string) {
    const rows = await this.service.findAll(projectId ? Number(projectId) : undefined);
    return scopeTasks(rows, await this.auth.verify(auth));
  }

  @Get('board')
  async board(@Query('projectId') projectId: string, @Headers('authorization') auth?: string) {
    const pid = Number(projectId);
    if (!Number.isFinite(pid)) return { sections: [], tasks: [] };
    const { sections, tasks } = await this.service.board(pid);
    return { sections, tasks: scopeTasks(tasks, await this.auth.verify(auth)) };
  }

  /**
   * Persist a manual card order for one section in a single request.
   * Declared before `:id` so "reorder" isn't captured as a task id.
   */
  @Put('reorder')
  reorder(@Body() dto: ReorderDto) {
    return this.service.reorder(dto.sectionId, dto.ids ?? []);
  }

  @Post()
  async create(@Body() dto: CreateProjectTaskDto, @Headers('authorization') auth?: string) {
    return this.service.create(dto, await this.auth.actor(auth));
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateProjectTaskDto>, @Headers('authorization') auth?: string) {
    return this.service.update(id, dto, await this.auth.actor(auth));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ------------------------------------------------------------- attachments

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
  async removeAttachment(@Param('id') id: string, @Param('attId') attId: string, @Headers('authorization') auth?: string) {
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
  ) {
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
  async comment(@Param('id') id: string, @Body() dto: AddCommentDto, @Headers('authorization') auth?: string) {
    return this.service.addComment(id, dto.text, await this.auth.actor(auth));
  }
}
