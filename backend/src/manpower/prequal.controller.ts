import { Body, Controller, Get, Headers, Param, Post, Put, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ManageWrites } from '../auth/guards/perm.guard';
import { Tiers } from '../auth/guards/roles.decorator';
import { Public } from '../auth/guards/public.decorator';
import { AuthService } from '../auth/auth.service';
import { MAX_FILE_BYTES } from '../google/attachments.service';
import { PrequalService } from './prequal.service';

/** GC & Sub Prequalify (Nov 13 sync): the list, the form and the decision. */
@Tiers('internal')
@ManageWrites('sub_prequal', 'manpower_con', 'fin_resources')
@Controller('prequal')
export class PrequalController {
  constructor(private readonly prequal: PrequalService, private readonly auth: AuthService) {}

  @Get()
  list() { return this.prequal.list(); }

  @Put(':id')
  async save(@Param('id') id: string, @Body() dto: any, @Headers('authorization') a?: string) {
    return this.prequal.save(id, dto, (await this.auth.actor(a)).name || 'Staff');
  }

  @Post(':id/decision')
  async decide(@Param('id') id: string, @Body() dto: { decision: 'approved' | 'rejected' | 'pending'; notes?: string }, @Headers('authorization') a?: string) {
    return this.prequal.decide(id, dto?.decision, String(dto?.notes || ''), (await this.auth.actor(a)).name || 'Staff');
  }

  @Post(':id/link')
  async link(@Param('id') id: string, @Headers('authorization') a?: string) {
    return this.prequal.sendLink(id, (await this.auth.actor(a)).name || 'Origami');
  }
}

/** The sub's own form, from the private link -- no account. */
@Public()
@Controller('prequal-public')
export class PrequalPublicController {
  constructor(private readonly prequal: PrequalService) {}

  @Get()
  view(@Query('token') token: string) { return this.prequal.publicView(token); }

  @Post()
  submit(@Body() dto: any) { return this.prequal.publicSubmit(String(dto?.token || ''), dto); }

  @Post('files')
  @UseInterceptors(FilesInterceptor('files', 5, { limits: { fileSize: MAX_FILE_BYTES } }))
  upload(@Query('token') token: string, @UploadedFiles() files: any[]) { return this.prequal.publicUpload(token, files); }
}
