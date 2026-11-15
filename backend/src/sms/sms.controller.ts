import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MassTextsService, type Pick } from './mass-texts.service';
import { Claims } from '../auth/guards/claims.decorator';
import type { SessionClaims } from '../auth/crypto.util';
import { SmsLogService, type TextInput } from './sms-log.service';
import { SmsService } from './sms.service';
import { Roles, Tiers } from '../auth/guards/roles.decorator';
import { assertFilled } from '../email-templates/placeholders';
import { ForbiddenException } from '@nestjs/common';
import { ProjectAccessService } from '../auth/project-access.service';

@Tiers('internal')
@Controller('sms')
export class SmsController {
  constructor(private readonly sms: SmsService, private readonly texts: SmsLogService, private readonly access: ProjectAccessService, private readonly mass: MassTextsService) {}

  // ------------------------------------------------------------ mass texts (Nov 13)
  /** People who change People may mass-text; picking CRM leads also needs sight of client contacts. */
  private async massAllowed(claims: SessionClaims | null | undefined, pick?: Pick) {
    if (!(await this.access.canManage(claims ?? null, 'people'))) throw new ForbiddenException('Your role doesn’t allow mass texts.');
    if (pick?.leads?.length && !this.access.seesClientContacts(claims ?? null)) throw new ForbiddenException('Texts with clients are kept with the office.');
  }

  @Post('mass/preview')
  async massPreview(@Body() body: Pick, @Claims() claims?: SessionClaims | null) {
    await this.massAllowed(claims, body);
    return this.mass.preview(body || {});
  }

  @Post('mass')
  async massSend(@Body() body: Pick & { body: string }, @Claims() claims?: SessionClaims | null) {
    await this.massAllowed(claims, body);
    assertFilled(body?.body);
    return this.mass.start(body || {}, body?.body, claims ? { id: claims.sub, name: claims.name } : null);
  }

  @Get('mass')
  async massList(@Claims() claims?: SessionClaims | null) {
    await this.massAllowed(claims);
    return this.mass.list();
  }

  @Get('mass/:id')
  async massGet(@Param('id') id: string, @Claims() claims?: SessionClaims | null) {
    await this.massAllowed(claims);
    return this.mass.get(id);
  }

  @Post('mass/:id/stop')
  async massStop(@Param('id') id: string, @Claims() claims?: SessionClaims | null) {
    await this.massAllowed(claims);
    return this.mass.stop(id);
  }

  /** An admin records a number's choice (e.g. someone asked by phone to stop). */
  @Roles('admin')
  @Post('opt-out')
  optOut(@Body() body: { phone: string; stopAll?: boolean; off?: string[] }) {
    return this.sms.setPreference(body?.phone, { stopAll: body?.stopAll !== false, off: body?.off }, 'admin');
  }

  /** Whether SMS is set up, without returning the auth token. */
  @Get('status')
  status() {
    return this.sms.status();
  }

  /** Send a text; with entityType/entityId it's recorded against that lead, contact or project. */
  @Post('send')
  send(@Body() body: TextInput, @Claims() claims?: SessionClaims | null) {
    assertFilled(body?.body);
    return this.texts.send(body || ({} as TextInput), claims ? { id: claims.sub, name: claims.name } : null);
  }

  /** The texts sent from one lead, contact or project. */
  @Get('messages')
  async messages(@Query('entityType') entityType: string, @Query('entityId') entityId: string, @Claims() claims?: SessionClaims | null) {
    // Texts carry clients' numbers (Nov 10): a project's for its team; a lead's or contact's only above field roles.
    if (entityType === 'project') await this.access.assert(claims ?? null, Number(entityId));
    else if (!this.access.seesClientContacts(claims ?? null)) throw new ForbiddenException('Texts with clients are kept with the office.');
    return this.texts.list(String(entityType || ''), String(entityId || ''));
  }

  /** Prove the credentials work before relying on them. */
  @Roles('admin')
  @Post('test')
  test(@Body() body: { to: string }) {
    return this.sms.send({
      to: body?.to,
      body: 'Test message from Origami. If you received this, SMS is set up correctly.',
    });
  }
}
