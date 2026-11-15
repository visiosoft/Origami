import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { Roles } from '../auth/guards/roles.decorator';
import { ProjectSheetService } from './project-sheet.service';

/** Backup sheets (Oct 30 sync): admins switch them on and refresh them. */
@Roles('admin')
@Controller('backup/sheets')
export class BackupController {
  constructor(private readonly sheets: ProjectSheetService) {}

  @Get()
  status() { return this.sheets.status(); }

  @Put()
  set(@Body() body: { enabled?: boolean; folder?: string }) { return body && 'folder' in body ? this.sheets.setFolder(String(body.folder ?? '')) : this.sheets.setEnabled(!!body?.enabled); }

  /** Refresh now: every active project, or { projectId }. */
  @Post('run')
  run(@Body() body: { projectId?: number }) { return this.sheets.runAll(body?.projectId ? Number(body.projectId) : undefined); }
}
