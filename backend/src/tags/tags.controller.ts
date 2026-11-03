import { Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import { Roles, Tiers } from '../auth/guards/roles.decorator';
import type { AuthedRequest } from '../auth/guards/session.guard';
import { TagsService } from './tags.service';

/** The shared tag bank (Oct 30 sync). Anyone on the team adds; admins tidy up. */
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Tiers('internal')
  @Get()
  list() {
    return this.tags.list();
  }

  @Tiers('internal')
  @Post()
  add(@Body() body: { name?: string }, @Req() req: AuthedRequest) {
    return this.tags.add(body?.name, { name: req.claims?.name });
  }

  @Roles('admin')
  @Put(':key')
  rename(@Param('key') key: string, @Body() body: { name?: string }) {
    return this.tags.rename(key, body?.name);
  }

  @Roles('admin')
  @Delete(':key')
  remove(@Param('key') key: string) {
    return this.tags.remove(key);
  }
}
