import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Put(':key')
  update(@Param('key') key: string, @Body() dto: Partial<CreateRoleDto>) {
    return this.rolesService.update(key, dto);
  }

  @Delete(':key')
  remove(@Param('key') key: string) {
    return this.rolesService.remove(key);
  }
}
