import { ProjectAccessService } from '../auth/project-access.service';
import { Claims } from '../auth/guards/claims.decorator';
import type { SessionClaims } from '../auth/crypto.util';
import { ForbiddenException, Controller, Get, Post, Put, Delete, Param, Body, Headers, Optional } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { Tiers } from '../auth/guards/roles.decorator';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { Perm, ManageWrites } from '../auth/guards/perm.guard';

@Tiers('internal')
@Perm('pipeline', 'crm_holding')
@ManageWrites('pipeline', 'crm_holding')
@Controller('leads')
export class LeadsController {
    constructor(private readonly leadsService: LeadsService, @Optional() private readonly auth?: AuthService, @Optional() private readonly access?: ProjectAccessService) { }

    /** "Assigned projects" holds for CRM too (Nov 3 sync). */
    private async allowed(claims: SessionClaims | null) {
        return this.access ? this.access.allowedLeadIds(claims) : 'all';
    }

    @Get()
    async findAll(@Claims() claims?: SessionClaims | null) {
        const rows = await this.leadsService.findAll();
        const ok = await this.allowed(claims ?? null);
        return ok === 'all' ? rows : rows.filter((r: any) => ok.has(String(r.id)));
    }

    @Get('options')
    getOptions() {
        return this.leadsService.getOptions();
    }

    @Get(':id')
    async findOne(@Param('id') id: string, @Claims() claims?: SessionClaims | null) {
        const ok = await this.allowed(claims ?? null);
        if (ok !== 'all' && !ok.has(String(id))) throw new ForbiddenException('That lead isn’t one of yours.');
        return this.leadsService.findOne(id);
    }

    @Post()
    create(@Body() dto: CreateLeadDto) {
        return this.leadsService.create(dto);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() dto: Partial<CreateLeadDto>, @Headers('authorization') auth?: string) {
        const by = this.auth ? (await this.auth.actor(auth).catch(() => null))?.name : undefined;
        return this.leadsService.update(id, dto, by);
    }

    /** What each save changed, newest first (Full Details). */
    @Get(':id/versions')
    versions(@Param('id') id: string) {
        return this.leadsService.versionsOf(id);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.leadsService.remove(id);
    }
}
