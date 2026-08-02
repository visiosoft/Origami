import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { PeopleService } from './people.service';
import { CreatePersonDto } from './dto/create-person.dto';

@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Get()
  findAll(@Query('project') project?: string) {
    return this.peopleService.findAll(project);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.peopleService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePersonDto) {
    return this.peopleService.create(dto);
  }
}
