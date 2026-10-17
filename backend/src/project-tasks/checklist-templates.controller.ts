import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { Claims } from '../auth/guards/claims.decorator';
import type { SessionClaims } from '../auth/crypto.util';
import { ChecklistTemplatesService } from './checklist-templates.service';

const who = (c: SessionClaims | null) => ({ id: c?.sub, name: c?.name || 'Unknown', roleKey: c?.roleKey });

@Tiers('internal')
@Controller('checklist-templates')
export class ChecklistTemplatesController {
  constructor(private readonly service: ChecklistTemplatesService) {}

  @Get() list() { return this.service.list(); }
  @Post() save(@Body() dto: any, @Claims() c: SessionClaims | null) { return this.service.save(dto || {}, who(c)); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: any, @Claims() c: SessionClaims | null) { return this.service.update(id, dto || {}, who(c)); }
  @Delete(':id') remove(@Param('id') id: string, @Claims() c: SessionClaims | null) { return this.service.remove(id, who(c)); }
}
