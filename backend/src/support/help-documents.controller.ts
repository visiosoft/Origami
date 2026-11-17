import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { HelpDocumentEntity } from '../database/entities';
import { Roles, Tiers } from '../auth/guards/roles.decorator';
import { Claims } from '../auth/guards/claims.decorator';
import type { SessionClaims } from '../auth/crypto.util';
import { cleanHelpDoc } from './help-documents';

/** Nov 17: SOPs, service levels and disaster recovery under Help -> Policies. Staff read; administrators edit. */
@Tiers('internal')
@Controller('help-documents')
export class HelpDocumentsController {
  constructor(@InjectRepository(HelpDocumentEntity) private readonly repo: Repository<HelpDocumentEntity>) {}

  @Get()
  async list() {
    return (await this.repo.find()).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  }

  @Roles('admin')
  @Post()
  async create(@Body() body: any, @Claims() claims?: SessionClaims | null) {
    const d = cleanHelpDoc(body);
    return this.repo.save(this.repo.create({ id: 'HD-' + randomBytes(5).toString('hex'), ...d, updatedBy: claims?.name || null, updatedAt: new Date().toISOString() }));
  }

  @Roles('admin')
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any, @Claims() claims?: SessionClaims | null) {
    const row = await this.repo.findOneBy({ id });
    if (!row) throw new NotFoundException('That document is no longer listed.');
    Object.assign(row, cleanHelpDoc({ ...row, ...body }), { updatedBy: claims?.name || null, updatedAt: new Date().toISOString() });
    return this.repo.save(row);
  }

  @Roles('admin')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.repo.delete({ id });
    return { ok: true };
  }
}
