import { BadRequestException, Body, Controller, Get, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsArray, IsBoolean, IsOptional } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tiers } from '../auth/guards/roles.decorator';
import { GoogleService } from '../google/google.service';
import { PersonEntity, ProjectEntity } from '../database/entities';
import { PeopleService } from './people.service';
import { IMPORT_COLUMNS, planImport } from './people-import';

export class ImportPeopleDto {
  @IsArray() rows: Record<string, unknown>[];
  @IsBoolean() @IsOptional() dryRun?: boolean;
  @IsBoolean() @IsOptional() update?: boolean;
}

/**
 * Bulk import into People from a spreadsheet (F8): the columns (for the
 * template), an Excel -> CSV step, and the import itself -- always previewed
 * first (dryRun), then applied. Rows go through PeopleService, so a sub
 * becomes a contractor and staff become employees exactly as if added by hand.
 */
@Tiers('internal')
@Controller('people/import')
export class PeopleImportController {
  constructor(
    private readonly people: PeopleService,
    private readonly google: GoogleService,
    @InjectRepository(PersonEntity) private readonly repo: Repository<PersonEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
  ) {}

  @Get('columns')
  columns() {
    return IMPORT_COLUMNS;
  }

  /** An .xlsx / .xls / .ods upload -> CSV text (first sheet), via the connected Google Drive. */
  @Post('convert')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async convert(@UploadedFile() file?: { originalname: string; mimetype: string; buffer: Buffer }) {
    if (!file?.buffer?.length) throw new BadRequestException('No file was uploaded.');
    if (!(await this.google.isConnected())) throw new BadRequestException('Reading Excel files needs the Google account connected (Settings → Integrations) — or save the sheet as CSV and upload that.');
    const mime = file.mimetype && file.mimetype !== 'application/octet-stream'
      ? file.mimetype
      : /\.xls$/i.test(file.originalname) ? 'application/vnd.ms-excel'
        : /\.ods$/i.test(file.originalname) ? 'application/vnd.oasis.opendocument.spreadsheet'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return { csv: await this.google.spreadsheetToCsv(file.buffer, mime, `Import ${file.originalname}`) };
  }

  @Post()
  async import(@Body() dto: ImportPeopleDto) {
    const rows = (dto.rows || []).slice(0, 2000);
    const [existing, projects] = await Promise.all([this.repo.find(), this.projects.find()]);
    const plan = planImport(rows, existing, projects.map((p) => p.name), { update: !!dto.update });
    const summary = () => ({
      create: plan.filter((p) => p.action === 'create').length, update: plan.filter((p) => p.action === 'update').length,
      skip: plan.filter((p) => p.action === 'skip').length, error: plan.filter((p) => p.action === 'error').length,
    });
    if (dto.dryRun) return { dryRun: true, summary: summary(), rows: plan.map(({ person: _p, ...r }) => r) };

    const done: { row: number; action: string; id?: number; error?: string }[] = [];
    for (const p of plan) {
      try {
        if (p.action === 'create') { const saved = await this.people.create({ ...p.person, since: new Date().toISOString().slice(0, 10), last: 'Imported' }); done.push({ row: p.row, action: 'created', id: saved.id }); }
        else if (p.action === 'update' && p.matchId) { await this.people.update(String(p.matchId), p.person); done.push({ row: p.row, action: 'updated', id: p.matchId }); }
      } catch (e) {
        done.push({ row: p.row, action: 'failed', error: (e as Error).message });
      }
    }
    return {
      dryRun: false,
      created: done.filter((d) => d.action === 'created').length,
      updated: done.filter((d) => d.action === 'updated').length,
      failed: done.filter((d) => d.action === 'failed'),
    };
  }
}
