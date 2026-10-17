import { Body, Controller, Delete, Get, Param, Post, Query, UnauthorizedException } from '@nestjs/common';
import { Claims } from '../auth/guards/claims.decorator';
import type { SessionClaims } from '../auth/crypto.util';
import { ViewsService } from './views.service';

const me = (c: SessionClaims | null) => { if (!c?.sub) throw new UnauthorizedException(); return c.sub; };

/** The caller's own saved views -- never anyone else's. */
@Controller('views')
export class ViewsController {
  constructor(private readonly views: ViewsService) {}

  @Get() list(@Query('page') page: string, @Claims() c: SessionClaims | null) { return this.views.list(me(c), page); }
  @Post() save(@Body() dto: any, @Claims() c: SessionClaims | null) { return this.views.save(me(c), dto || {}); }
  @Delete(':id') remove(@Param('id') id: string, @Claims() c: SessionClaims | null) { return this.views.remove(me(c), id); }
}
