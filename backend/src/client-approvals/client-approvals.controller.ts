import { Body, Controller, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/guards/public.decorator';
import { Tiers } from '../auth/guards/roles.decorator';
import { Claims } from '../auth/guards/claims.decorator';
import type { SessionClaims } from '../auth/crypto.util';
import { AuthService } from '../auth/auth.service';
import { ProjectAccessService } from '../auth/project-access.service';
import { ClientApprovalsService } from './client-approvals.service';

/** Nov 17: client approval bundles. Staff build and send them; the client answers and signs from the emailed link. */
@Controller('client-approvals')
export class ClientApprovalsController {
  constructor(private readonly svc: ClientApprovalsService, private readonly access: ProjectAccessService, private readonly auth: AuthService) {}

  private async staff(claims: SessionClaims | null | undefined, projectId: number) {
    this.access.assertStaff(claims ?? null);
    await this.access.assert(claims ?? null, projectId);
  }

  @Tiers('internal')
  @Get('candidates')
  async candidates(@Query('projectId') projectId: string, @Claims() claims?: SessionClaims | null) {
    await this.staff(claims, Number(projectId));
    return this.svc.candidates(Number(projectId));
  }

  @Tiers('internal')
  @Get()
  async list(@Query('projectId') projectId: string, @Claims() claims?: SessionClaims | null) {
    await this.staff(claims, Number(projectId));
    return this.svc.list(Number(projectId));
  }

  @Tiers('internal')
  @Post()
  async create(@Body() dto: { projectId?: number; title?: string; items?: { kind?: string; id?: string }[] }, @Headers('authorization') a?: string, @Claims() claims?: SessionClaims | null) {
    await this.staff(claims, Number(dto?.projectId));
    return this.svc.create(Number(dto?.projectId), dto || {}, await this.auth.actor(a));
  }

  @Tiers('internal')
  @Post(':id/send')
  async send(@Param('id') id: string, @Body() dto: { to?: string; message?: string }, @Headers('authorization') a?: string, @Claims() claims?: SessionClaims | null) {
    await this.staff(claims, await this.svc.projectOf(id));
    return this.svc.send(id, dto || {}, await this.auth.actor(a));
  }

  @Public()
  @Get('public')
  view(@Query('token') token: string) { return this.svc.publicView(token); }

  @Public()
  @Post('public/sign')
  sign(@Query('token') token: string, @Body() dto: any, @Req() req: Request) { return this.svc.publicSign(token, dto || {}, { ip: req.ip }); }
}
