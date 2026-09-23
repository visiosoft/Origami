import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/employee.dto';

@Tiers('internal')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateEmployeeDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
