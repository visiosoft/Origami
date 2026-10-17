import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { Roles } from '../auth/guards/roles.decorator';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { AccessImportService } from './access-import.service';

@Roles('admin')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService, private readonly accessImport: AccessImportService) {}

  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  /**
   * The PEOPLE ACCESS sheet (its rows, as read from the spreadsheet): a preview
   * (dryRun) of the roles and accounts it means, or -- dryRun false -- applied.
   */
  @Post('import-matrix')
  importMatrix(@Body() dto: any) {
    return this.accessImport.importMatrix(dto?.rows || [], { dryRun: dto?.dryRun !== false, mapping: dto?.mapping || {}, invite: dto?.invite !== false, updateExisting: dto?.updateExisting !== false });
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
