import {
  Body, Controller, Delete, Get, Headers, NotFoundException, Param, Post, Put, Query, Res, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Readable } from 'stream';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto, AddCommentDto, AddLinkDto, LinkDto, LinkedTaskDto } from './dto/update-task.dto';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService, MAX_FILE_BYTES, MAX_FILES_PER_UPLOAD } from '../google/attachments.service';
import { scopeTasks, isRestrictedViewer, assignedTo } from '../database/viewer.util';
import { Roles } from '../auth/guards/roles.decorator';

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
    @Query('slim') slim?: string,
    @Headers('authorization') auth?: string,
  ) {
    // ?slim=1: without each entry's comments and history (the drawer loads those when it opens).
    const rows = await this.tasksService.findAll(tab, project, { slim: slim === '1' });
    return scopeTasks(rows, await this.auth.verify(auth));
  }

  /** The Request Log's statuses, for every screen that lists or picks one. */
  @Get('statuses')
  statuses() {
    return this.tasksService.statuses();
  }

  /** Settings -> Request Log statuses (administrators). */
  @Roles('admin')
  @Put('statuses')
  saveStatuses(@Body() body: { statuses?: unknown }) {
    return this.tasksService.saveStatuses(body?.statuses);
  }

  /** What each priority means (every priority picker shows these). */
  @Get('priorities')
  priorities() {
    return this.tasksService.priorityDefinitions();
  }

  /** Settings -> Task priorities (administrators): the wording only; due windows are fixed. */
  @Roles('admin')
  @Put('priorities')
  savePriorities(@Body() body: { definitions?: unknown }) {
    return this.tasksService.savePriorityDefinitions(body?.definitions);
  }

  /** Projects and open leads a task can be linked to (for the pickers). */
  @Get('link-targets')
  async linkTargets(@Headers('authorization') auth?: string) {
    // Clients and subcontractors never see the list of leads and projects.
    const claims = await this.auth.verify(auth);
    if (!claims || isRestrictedViewer(claims)) return { projects: [], leads: [] };
    return this.tasksService.linkTargets();
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

  /** Save pressed in the task editor: send the emails held on the entry. */
  @Post(':id/notify')
  notify(@Param('id') id: string) {
    return this.tasksService.flushNotices(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }

  // ------------------------------------------------------------ FOR RECORD links

  /** Attach this entry to a task or a change order. */
  @Post(':id/links')
  async addRecordLink(@Param('id') id: string, @Body() dto: LinkDto, @Headers('authorization') auth?: string) {
    return this.tasksService.link(id, dto.kind, dto.targetId, await this.auth.actor(auth));
  }

  @Delete(':id/links/:kind/:targetId')
  async removeRecordLink(@Param('id') id: string, @Param('kind') kind: string, @Param('targetId') targetId: string, @Headers('authorization') auth?: string) {
    return this.tasksService.unlink(id, kind === 'task' ? 'task' : 'changeOrder', targetId, await this.auth.actor(auth));
  }

  /** Create a task from this entry, linked to it. */
  @Post(':id/linked-task')
  async linkedTask(@Param('id') id: string, @Body() dto: LinkedTaskDto, @Headers('authorization') auth?: string) {
    return this.tasksService.createLinkedTask(id, dto, await this.auth.actor(auth));
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
