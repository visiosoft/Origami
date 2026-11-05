import { GoogleNotesService } from './google-notes.service';
import { Body, Controller, Delete, Get, Headers, NotFoundException, Param, Post, Put, Optional } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { MeetingsService } from './meetings.service';
import { MeetingActionDto, MeetingDto } from './dto';
import { Perm } from '../auth/guards/perm.guard';
import { ProjectAccessService } from '../auth/project-access.service';
import { Claims } from '../auth/guards/claims.decorator';
import type { SessionClaims } from '../auth/crypto.util';

@Tiers('internal')
@Perm('meetings', 'tasks', 'observations')
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly service: MeetingsService, private readonly auth: AuthService, private readonly access: ProjectAccessService, @Optional() private readonly googleNotes?: GoogleNotesService) {}

  /** Staff on "Assigned projects" (Oct 30 sync): meetings on their projects, or on none that they attend. */
  private async mine<T extends { projectId?: number | null; attendees?: { id?: string; name?: string }[] | null }>(rows: T[], claims: SessionClaims | null) {
    const ids = await this.access.allowedIds(claims);
    if (ids === 'all') return rows;
    return rows.filter((m) => (m.projectId != null ? ids.has(Number(m.projectId)) : (m.attendees || []).some((a) => a?.id === claims?.sub)));
  }

  @Get() async list(@Claims() claims: SessionClaims | null) { return this.mine(await this.service.list(), claims); }
  /** "Notes by Gemini" Docs from the last 30 days, each with its meeting (Nov 5: import even when the meeting isn't in Origami). */
  @Get('google-notes') async googleNotesList() { if (!this.googleNotes) throw new NotFoundException('Not available'); return this.googleNotes.recentDocs(); }
  /** Import one Doc onto its meeting, or onto a new meeting made from the Doc's name. */
  @Post('google-notes/import') async googleNotesImport(@Body() body: { docId?: string; link?: string }, @Headers('authorization') a?: string) {
    if (!this.googleNotes) throw new NotFoundException('Not available');
    return this.googleNotes.importDoc(body || {}, await this.auth.actor(a));
  }
  @Get(':id') async get(@Param('id') id: string, @Claims() claims: SessionClaims | null) {
    const m = await this.service.get(id);
    if (!(await this.mine([m as any], claims)).length) throw new NotFoundException('Meeting not found');
    return m;
  }
  @Post() async create(@Body() dto: MeetingDto, @Headers('authorization') a?: string) { return this.service.create(dto, await this.auth.actor(a)); }
  @Put(':id') async update(@Param('id') id: string, @Body() dto: MeetingDto, @Headers('authorization') a?: string) { return this.service.update(id, dto, await this.auth.actor(a)); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
  /** Raise a task, or a FOR RECORD item (FYI, observation, decision) from the meeting (a Request Log entry linked to it). */
  /** Pull the meeting's notes from Google: { link } to a Doc, or found by title and date (Nov 3 sync). */
  @Post(':id/import-google') async importGoogle(@Param('id') id: string, @Body() body: { link?: string }) { if (!this.googleNotes) throw new NotFoundException('Not available'); return this.googleNotes.importOne(id, body?.link); }
  @Post(':id/actions') async addAction(@Param('id') id: string, @Body() dto: MeetingActionDto, @Headers('authorization') a?: string) {
    return this.service.addAction(id, dto, await this.auth.actor(a));
  }
}
