import { Controller, Get, Post, Put, Delete, Param, Body, Headers, Optional } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { Tiers } from '../auth/guards/roles.decorator';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';

@Tiers('internal')
@Controller('leads')
export class LeadsController {
    constructor(private readonly leadsService: LeadsService, @Optional() private readonly auth?: AuthService) { }

    @Get()
    findAll() {
        return this.leadsService.findAll();
    }

    @Get('options')
    getOptions() {
        return this.leadsService.getOptions();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
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
