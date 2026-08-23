import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';

@Tiers('internal')
@Controller('leads')
export class LeadsController {
    constructor(private readonly leadsService: LeadsService) { }

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
    update(@Param('id') id: string, @Body() dto: Partial<CreateLeadDto>) {
        return this.leadsService.update(id, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.leadsService.remove(id);
    }
}
