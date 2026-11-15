import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { Roles } from '../auth/guards/roles.decorator';
import { DbBackupService } from './db-backup.service';

/** Weekly database copy (Batch 6): administrators only. */
@Roles('admin')
@Controller('backup/database')
export class DbBackupController {
  constructor(private readonly backups: DbBackupService) {}

  @Get()
  status() { return this.backups.status(); }

  @Put()
  set(@Body() body: { enabled?: boolean }) { return this.backups.setEnabled(!!body?.enabled); }

  /** Make a copy now. */
  @Post('run')
  run() { return this.backups.run(); }
}
