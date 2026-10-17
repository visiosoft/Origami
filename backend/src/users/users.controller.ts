import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { Roles, Tiers } from '../auth/guards/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AccessImportService } from './access-import.service';

@Roles('admin')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService, private readonly access: AccessImportService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  /**
   * The team, for people pickers (assignee, collaborators): names and roles
   * only, for any staff member -- the full list above stays admin-only. Without
   * this, the pickers were empty for everyone who isn't an administrator.
   */
  @Roles()
  @Tiers('internal')
  @Get('directory')
  directory() {
    return this.usersService.directory();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  /** Re-send the "set your password" email for a user. */
  @Post(':id/resend-invite')
  resendInvite(@Param('id') id: string) {
    return this.usersService.resendInvite(id);
  }

  /** A person's access: their role's settings and their own changes from them. */
  @Get(':id/access')
  getAccess(@Param('id') id: string) {
    return this.access.overrides(id);
  }

  /** Set a person's own access changes ({ dataType: { level, extent } }); leaving one out puts it back to the role's. */
  @Put(':id/access')
  setAccess(@Param('id') id: string, @Body() dto: any) {
    return this.access.setOverrides(id, dto?.overrides);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateUserDto>) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
