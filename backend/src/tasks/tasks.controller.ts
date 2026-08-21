import {
  Body, Controller, Delete, Get, Headers, NotFoundException, Param, Post, Put, Query, Res, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Readable } from 'stream';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto, AddCommentDto, AddLinkDto } from './dto/update-task.dto';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService, MAX_FILE_BYTES, MAX_FILES_PER_UPLOAD } from '../google/attachments.service';
import { scopeTasks, isRestrictedViewer, assignedTo } from '../database/viewer.util';

@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly auth: AuthService,
    private readonly attachments: AttachmentsService,
  ) {}

  @Get()
  async findAll(
    @Query('tab') tab?: string,
    @Query('project') project?: string,
    @Headers('authorization') auth?: string,
  ) {
    const rows = await this.tasksService.findAll(tab, project);
    return scopeTasks(rows, await this.auth.verify(auth));
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Headers('authorization') auth?: string) {
    const claims = await this.auth.verify(auth);
    const task = await this.tasksService.findOne(id);
    // A restricted viewer must not reach someone else's task by guessing an id.
    if (claims && isRestrictedViewer(claims) && !assignedTo(task, claims)) {
      throw new NotFoundException(`Task ${id} not found`);
    }
    return task;
  }

  @Post()
  async create(@Body() dto: CreateTaskDto, @Headers('authorization') auth?: string) {
    return this.tasksService.create(dto, await this.auth.actor(auth));
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @Headers('authorization') auth?: string) {
    return this.tasksService.update(id, dto, await this.auth.actor(auth));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }

  // ------------------------------------------------------------- attachments

  @Post(':id/attachments')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD, { limits: { fileSize: MAX_FILE_BYTES } }))
  async upload(@Param('id') id: string, @UploadedFiles() files: any[], @Headers('authorization') auth?: string) {
    return this.tasksService.addAttachments(id, files, await this.auth.requireActor(auth));
  }

  @Post(':id/attachments/link')
  async link(@Param('id') id: string, @Body() dto: AddLinkDto, @Headers('authorization') auth?: string) {
    return this.tasksService.addLink(id, dto.name ?? '', dto.url, await this.auth.actor(auth));
  }

  @Delete(':id/attachments/:attId')
  async removeAttachment(@Param('id') id: string, @Param('attId') attId: string, @Headers('authorization') auth?: string) {
    return this.tasksService.removeAttachment(id, attId, await this.auth.actor(auth));
  }

  /**
   * Stream one attachment's bytes.
   *
   * The route is deliberately scoped to the task: the attachment is looked up on
   * the task first, so a Drive file id on its own can never be used to pull an
   * arbitrary file out of the workspace Drive.
   */
  @Get(':id/attachments/:attId/content')
  async content(
    @Param('id') id: string,
    @Param('attId') attId: string,
    @Query('thumb') thumb: string,
    @Res() res: Response,
  ) {
    const att = await this.tasksService.attachment(id, attId);
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
    return this.tasksService.addComment(id, dto.text, await this.auth.actor(auth));
  }
}
