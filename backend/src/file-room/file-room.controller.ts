import { FolderAccessService } from './folder-access.service';
import { BadRequestException, ForbiddenException,
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
import { CreateFolderDto, UpdateFileDto, EmailFileDto, MoveFileDto, FileIdsDto, EmailFilesDto, MoveFilesDto } from './dto/file-room.dto';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService } from '../google/attachments.service';
import { FilePreviewsService, BACKFILL_KEY } from './file-previews.service';
import { SettingsService } from '../settings/settings.service';
import { MarkupsService } from './markups.service';
import { Perm } from '../auth/guards/perm.guard';

@Perm('planroom', 'allfiles', 'projects', 'pm', 'design')
@Controller('file-room')
export class FileRoomController {
  constructor(
    private readonly service: FileRoomService,
    private readonly auth: AuthService,
    private readonly access: ProjectAccessService,
    private readonly markups: MarkupsService,
    private readonly previews: FilePreviewsService,
    private readonly settings: SettingsService,
    private readonly folders: FolderAccessService,
  ) {}

  /**
   * Changing files is for people who manage the File Room (Oct 30 sync: field
   * staff view and mark up the build set, but don't move, rename or delete).
   */
  private async assertManage(claims: SessionClaims | null) {
    if (claims?.roleKey === 'admin') return;
    const perms = claims ? await this.access.permissions(claims) : {} as any;
    if (!perms?.planroom?.manage && !perms?.allfiles?.manage) throw new ForbiddenException('Only people who manage the File Room can change or delete files.');
  }

  // ---------------------------------------------------------------- PDF markup

  private async seeFile(fileId: string, claims: SessionClaims | null | undefined) {
    const f = await this.markups.file(fileId);
    await this.access.assert(claims ?? null, f.projectId);
    await this.folders.assertFile(claims ?? null, f);
    return f;
  }

  /** The markups on a PDF: everyone's shared ones and your own private drafts. */
  @Get('files/:id/markups')
  async listMarkups(@Param('id') id: string, @Claims() claims: SessionClaims | null) {
    await this.seeFile(id, claims);
    return this.markups.list(id, claims);
  }

  @Post('files/:id/markups')
  async addMarkup(@Param('id') id: string, @Body() body: unknown, @Claims() claims: SessionClaims | null) {
    await this.seeFile(id, claims);
    return this.markups.create(id, body, claims);
  }

  @Put('markups/:mid')
  async editMarkup(@Param('mid') mid: string, @Body() body: unknown, @Claims() claims: SessionClaims | null) {
    return this.markups.update(mid, body, claims);
  }

  /** Rename a layer on this drawing: { from: name | null, authorId?, to }. */
  @Put('files/:id/layers')
  async renameLayer(@Param('id') id: string, @Body() body: any, @Claims() claims: SessionClaims | null) {
    await this.seeFile(id, claims);
    return this.markups.renameLayer(id, body, claims);
  }

  /** Who sees each layer on this drawing (only the restricted ones). */
  @Get('files/:id/layer-access')
  async layerAccess(@Param('id') id: string, @Claims() claims: SessionClaims | null) {
    await this.seeFile(id, claims);
    return this.markups.layerAccess(id);
  }

  /** Who sees one layer: { audience: everyone | internal | people, people?: [{ type, id, name }] }. */
  @Put('files/:id/layer-access')
  async setLayerAccess(@Param('id') id: string, @Body() body: any, @Claims() claims: SessionClaims | null) {
    await this.seeFile(id, claims);
    return this.markups.setLayerAccess(id, String(body?.layerKey || ''), body, claims);
  }

  /**
   * Read a scanned sheet's title block (Nov 3 sync): the browser sends the
   * corner of the page as a PNG; Google Drive's OCR reads it (no AI, no cost).
   */
  @Tiers('internal')
  @Post('title-ocr')
  async titleOcr(@Body() body: { image?: string }) {
    const m = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(String(body?.image || ''));
    if (!m) throw new BadRequestException('Send the title block as a PNG or JPEG.');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 4 * 1024 * 1024) throw new BadRequestException('That image is too big.');
    return { text: await this.markups.readTitleBlock(buf, m[1]) };
  }

  /** The shared drawing-symbol library (admins add, rename and delete). */
  @Get('symbols')
  symbols() { return this.markups.symbols(); }

  @Post('symbols')
  addSymbol(@Body() body: any, @Claims() claims: SessionClaims | null) { return this.markups.addSymbol(body, claims); }

  @Put('symbols/:sid')
  renameSymbol(@Param('sid') sid: string, @Body() body: any, @Claims() claims: SessionClaims | null) { return this.markups.renameSymbol(sid, body, claims); }

  @Delete('symbols/:sid')
  removeSymbol(@Param('sid') sid: string, @Claims() claims: SessionClaims | null) { return this.markups.removeSymbol(sid, claims); }

  /** A drawing's sheet names by page ("1": "A100"). */
  @Get('files/:id/sheets')
  async sheets(@Param('id') id: string, @Claims() claims: SessionClaims | null) {
    await this.seeFile(id, claims);
    return this.markups.sheetNames(id);
  }

  @Put('files/:id/sheets')
  async setSheets(@Param('id') id: string, @Body() body: any, @Claims() claims: SessionClaims | null) {
    await this.seeFile(id, claims);
    return this.markups.setSheetNames(id, body, claims);
  }

  /** Photos pinned to a spot on the drawing. */
  @Post('markups/:mid/photos')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD, { limits: { fileSize: MAX_FILE_BYTES } }))
  async addPinPhotos(@Param('mid') mid: string, @UploadedFiles() files: any[], @Claims() claims: SessionClaims | null) {
    const m = await this.markups.markup(mid);
    await this.seeFile(m.fileId, claims);
    return this.markups.addPhotos(mid, files, claims);
  }

  @Delete('markups/:mid/photos/:fileId')
  async removePinPhoto(@Param('mid') mid: string, @Param('fileId') fileId: string, @Claims() claims: SessionClaims | null) {
    const m = await this.markups.markup(mid);
    await this.seeFile(m.fileId, claims);
    return this.markups.removePhoto(mid, fileId, claims);
  }

  @Delete('markups/:mid')
  async removeMarkup(@Param('mid') mid: string, @Claims() claims: SessionClaims | null) {
    return this.markups.remove(mid, claims);
  }

  /** Download the PDF with markups drawn in (?layers=<keys> or ?authors=U-1,U-2 for just those layers). */
  @Get('files/:id/markups/pdf')
  async markedUpPdf(@Param('id') id: string, @Res() res: Response, @Claims() claims: SessionClaims | null, @Query('authors') authors?: string, @Query('layers') layers?: string) {
    await this.seeFile(id, claims);
    const list = (v?: string) => (v ? v.split(',').filter(Boolean) : undefined);
    const { file, pdf } = await this.markups.flatten(id, claims, list(authors), list(layers));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name.replace(/\.pdf$/i, '') + ' (marked up).pdf')}"`);
    res.end(pdf);
  }

  /** Save a marked-up copy beside the drawing in the File Room. */
  @Post('files/:id/markups/copy')
  async markedUpCopy(@Param('id') id: string, @Body() body: { authors?: string[]; layers?: string[] }, @Claims() claims: SessionClaims | null) {
    await this.seeFile(id, claims);
    const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : undefined);
    return this.markups.saveCopy(id, claims, list(body?.authors), list(body?.layers));
  }

  /** Which projects this account may see files of. */
  private async seeProject(claims?: SessionClaims | null) {
    // Staff on "Assigned projects" are narrowed too (Oct 30 sync), not only outside accounts.
    const allowed = await this.access.allowedIds(claims ?? null);
    // And restricted folders (Nov 13): files and folders inside one the caller may not open are left out.
    const folderOk = await this.folders.gate(claims ?? null);
    return (id: unknown, path?: string[] | null) => (allowed === 'all' || allowed.has(Number(id))) && folderOk(id, path);
  }

  /** The tree without the files: projects, folders, file counts per folder and totals. */
  @Get('tree')
  async tree(@Claims() claims?: SessionClaims | null) {
    return this.service.tree(await this.seeProject(claims));
  }

  /** One page of files: ?projectId=&path=a>b (a folder) or neither (all files); q, latest=1, dir, page, size. */
  @Get('files/page')
  async filesPage(@Query() q: Record<string, string>, @Claims() claims?: SessionClaims | null) {
    const pid = Number(q.projectId);
    if (Number.isFinite(pid) && pid > 0) await this.access.assert(claims ?? null, pid);
    return this.service.filesPage(q, await this.seeProject(claims));
  }

  /** One file and its revisions. */
  @Get('files/:id/meta')
  async fileMeta(@Param('id') id: string, @Claims() claims?: SessionClaims | null) {
    const r = await this.service.fileWithVersions(id);
    await this.access.assert(claims ?? null, r.file.projectId);
    await this.folders.assertFile(claims ?? null, r.file as any);
    return r;
  }

  /** Projects, categories, folders and files — everything the tree needs. */
  @Get()
  async list(@Query('projectId') projectId?: string, @Claims() claims?: SessionClaims | null) {
    const pid = Number(projectId);
    const scoped = Number.isFinite(pid) && pid > 0 ? pid : undefined;
    if (scoped) await this.access.assert(claims ?? null, scoped);
    const all = await this.service.list(scoped);
    // Outside accounts, and staff on "Assigned projects", see only their projects; nobody sees inside a folder kept from them.
    const ok = await this.seeProject(claims);
    return { ...all, projects: all.projects.filter((p: any) => ok(p.id)), files: all.files.filter((f: any) => ok(f.projectId, f.folderPath)), folders: all.folders.filter((f: any) => ok(f.projectId, f.path)) };
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
    // The build set (drawings, selections, specs) is changed by those who manage the File Room.
    const top = Array.isArray(folderPath) ? String(folderPath[0] || '') : '';
    if (top && (await this.service.buildSetOf(Number(projectId))).some((f) => f.toLowerCase() === top.toLowerCase())) await this.assertManage(await this.auth.verify(auth));
    await this.folders.assertFile(await this.auth.verify(auth), { projectId: Number(projectId), folderPath: Array.isArray(folderPath) ? folderPath : [] });
    return this.service.upload(
      Number(projectId),
      Array.isArray(folderPath) ? folderPath : [],
      files,
      await this.auth.requireActor(auth),
    );
  }

  /** Files emailed from the File Room: for a project (?projectId=) or one file (?fileId=). */
  @Tiers('internal')
  @Get('shares')
  async shareHistory(@Query('projectId') projectId?: string, @Query('fileId') fileId?: string, @Claims() claims?: SessionClaims | null) {
    if (projectId) await this.access.assert(claims ?? null, Number(projectId));
    const rows = await this.service.shareHistory({ projectId: projectId ? Number(projectId) : undefined, fileId: fileId || undefined });
    return Array.isArray(rows) ? this.access.filter(claims ?? null, rows as any[], (r: any) => r.projectId) : rows;
  }

  /** View links for several files. */
  @Tiers('internal')
  @Post('files/share')
  async shareMany(@Body() dto: FileIdsDto, @Claims() claims?: SessionClaims | null) {
    for (const id of dto.ids || []) await this.seeFile(id, claims);
    return this.service.shareMany(dto.ids);
  }

  /** Several files in one email. */
  @Tiers('internal')
  @Post('files/email')
  async emailMany(@Body() dto: EmailFilesDto, @Headers('authorization') auth?: string, @Claims() claims?: SessionClaims | null) {
    for (const id of dto.ids || []) await this.seeFile(id, claims);
    return this.service.emailMany(dto.ids, dto.to, dto.note || '', await this.auth.actor(auth));
  }

  /** Move several files into one folder. */
  @Tiers('internal')
  @Put('files/move')
  async moveMany(@Body() dto: MoveFilesDto, @Claims() claims?: SessionClaims | null) {
    await this.assertManage(claims ?? null);
    return this.service.moveMany(dto.ids, dto.folderPath);
  }

  /**
   * A file's small copy: `thumb` (300 px square, for the grid) or `preview`
   * (1200 px, for a quick look). WebP; cached by the browser for good, since
   * the URL carries a version that changes when the copy is remade.
   */
  @Get('files/:id/small')
  async small(@Param('id') id: string, @Query('kind') kind: string, @Res() res: Response, @Claims() claims: SessionClaims | null) {
    const { file, body } = await this.service.small(id, kind === 'preview' ? 'preview' : 'thumb');
    if (!(await this.access.canSee(claims, (file as any).projectId)) || !(await this.folders.gate(claims))((file as any).projectId, (file as any).folderPath)) {
      res.status(403).json({ message: 'You don’t have access to this file.' });
      return;
    }
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.end(body);
  }

  /** How far the thumbnails are (Settings), and the switch for filling in older files. */
  @Get('previews/status')
  async previewStatus(@Claims() claims?: SessionClaims | null) {
    await this.assertManage(claims ?? null);
    return this.previews.status();
  }
  @Put('previews/backfill')
  async previewBackfill(@Body() dto: { on?: boolean }, @Claims() claims?: SessionClaims | null) {
    await this.assertManage(claims ?? null);
    await this.settings.set(BACKFILL_KEY, dto?.on ? 'on' : 'off');
    return this.previews.status();
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
    @Query('size') size?: string,
  ) {
    const { file, body, mimeType } = await this.service.content(id, thumb === '1', Number(size) || undefined);
    if (!(await this.access.canSee(claims, (file as any).projectId)) || !(await this.folders.gate(claims))((file as any).projectId, (file as any).folderPath)) {
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

  /**
   * Show a file in the browser: images and PDFs as they are, Office and Google
   * documents as a PDF. 415 when there's nothing to show (download it instead).
   */
  @Get('files/:id/preview')
  async preview(@Param('id') id: string, @Res() res: Response, @Claims() claims: SessionClaims | null) {
    const { file, body, mimeType, pdf } = await this.service.preview(id);
    if (!(await this.access.canSee(claims, (file as any).projectId)) || !(await this.folders.gate(claims))((file as any).projectId, (file as any).folderPath)) {
      await (body as any)?.cancel?.().catch?.(() => {});
      res.status(403).json({ message: 'You don’t have access to this file.' });
      return;
    }
    if (!body && !pdf) { res.status(415).json({ message: 'This kind of file can’t be previewed — download it instead.' }); return; }
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}${pdf ? '.pdf' : ''}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    if (pdf) { res.end(pdf); return; }
    Readable.fromWeb(body).pipe(res);
  }

  /** Restricted folders of a project (Nov 13): which are kept to some people (names of who, for managers). */
  @Get('folder-access')
  async folderAccess(@Query('projectId') projectId: string, @Claims() claims?: SessionClaims | null) {
    await this.access.assert(claims ?? null, Number(projectId));
    return this.folders.list(Number(projectId), claims ?? null);
  }

  /** Keep a folder (and what's inside it) to staff, or to picked people / roles / companies -- or open it to everyone again. */
  @Tiers('internal')
  @Put('folder-access')
  async setFolderAccess(@Body() dto: { projectId: number; path: string[]; audience: string; people?: unknown }, @Claims() claims?: SessionClaims | null) {
    await this.assertManage(claims ?? null);
    await this.access.assert(claims ?? null, Number(dto?.projectId));
    return this.folders.set(Number(dto?.projectId), dto, { name: claims?.name || 'Someone' });
  }

  /** Lay out the standard project folders (Settings -> File Room) for one project. */
  /** Mark which top-level folders are the project's build set: { folders: string[] }. */
  @Tiers('internal')
  @Put('projects/:pid/build-set')
  async setBuildSet(@Param('pid') pid: string, @Body() body: { folders?: string[] }, @Claims() claims?: SessionClaims | null) {
    await this.assertManage(claims ?? null);
    await this.access.assert(claims ?? null, Number(pid));
    return this.service.setBuildSet(Number(pid), body?.folders);
  }

  /** Existing projects (Batch 6): which template folders each lacks -- preview, then apply. Administrators. */
  @Tiers('internal')
  @Get('template/preview')
  async templatePreview(@Claims() claims?: SessionClaims | null) {
    if (claims?.roleKey !== 'admin') throw new ForbiddenException('Only administrators can lay out folders for every project.');
    return this.service.templatePreview();
  }

  @Tiers('internal')
  @Post('template/apply-all')
  async templateApplyAll(@Body() body: { projectIds?: number[] }, @Claims() claims?: SessionClaims | null) {
    if (claims?.roleKey !== 'admin') throw new ForbiddenException('Only administrators can lay out folders for every project.');
    return this.service.templateApplyAll(Array.isArray(body?.projectIds) ? body.projectIds.map(Number) : undefined);
  }

  @Tiers('internal')
  @Post('template')
  async template(@Query('projectId') projectId: string, @Claims() claims?: SessionClaims | null) {
    await this.assertManage(claims ?? null);
    return this.service.applyTemplate(Number(projectId));
  }

  @Tiers('internal')
  @Put('files/:id/move')
  async move(@Param('id') id: string, @Body() dto: MoveFileDto, @Claims() claims?: SessionClaims | null) {
    await this.assertManage(claims ?? null);
    return this.service.move(id, dto.folderPath);
  }

  @Tiers('internal')
  @Put('files/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateFileDto, @Claims() claims?: SessionClaims | null) {
    await this.assertManage(claims ?? null);
    return this.service.update(id, dto);
  }

  /** Make the file readable by anyone holding the link, and return that link. */
  @Tiers('internal')
  @Post('files/:id/share')
  async share(@Param('id') id: string, @Claims() claims?: SessionClaims | null) {
    await this.seeFile(id, claims);
    return this.service.shareLink(id);
  }

  @Tiers('internal')
  @Post('files/:id/email')
  async emailFile(@Param('id') id: string, @Body() dto: EmailFileDto, @Headers('authorization') auth?: string, @Claims() claims?: SessionClaims | null) {
    await this.seeFile(id, claims);
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
  async markLatest(@Param('id') id: string, @Claims() claims?: SessionClaims | null) {
    await this.assertManage(claims ?? null);
    return this.service.markLatest(id);
  }

  @Tiers('internal')
  @Delete('files/:id')
  async remove(@Param('id') id: string, @Claims() claims?: SessionClaims | null) {
    await this.assertManage(claims ?? null);
    return this.service.remove(id);
  }

  @Tiers('internal')
  @Post('folders')
  async createFolder(@Body() dto: CreateFolderDto, @Claims() claims?: SessionClaims | null) {
    await this.assertManage(claims ?? null);
    return this.service.createFolder(Number(dto.projectId), dto.path ?? [], dto.name);
  }

  @Tiers('internal')
  @Delete('folders/:id')
  async removeFolder(@Param('id') id: string, @Claims() claims?: SessionClaims | null) {
    await this.assertManage(claims ?? null);
    return this.service.removeFolder(id);
  }
}
