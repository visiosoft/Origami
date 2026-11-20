import { GoogleNotesService } from './google-notes.service';
import { BadRequestException, Body, Controller, Delete, Get, Headers, NotFoundException, Param, Post, Put, Optional, Query } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { MeetingsService } from './meetings.service';
import { MeetingActionDto, MeetingDto } from './dto';
import { ManageWrites, Perm } from '../auth/guards/perm.guard';
import { SettingsService } from '../settings/settings.service';
import { CalendarSyncService } from './calendar-sync.service';
import { ProjectAccessService } from '../auth/project-access.service';
import { Claims } from '../auth/guards/claims.decorator';
import type { SessionClaims } from '../auth/crypto.util';

/** Meetings that exist only as Special Actions Log entries, hidden from Meetings (Nov 19). */
const HIDDEN_GROUPS = 'meetings.hiddenGroups';
const MANAGE = ['meetings', 'tasks', 'observations'];

@Tiers('internal')
@Perm('meetings', 'tasks', 'observations')
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly service: MeetingsService, private readonly auth: AuthService, private readonly access: ProjectAccessService, @Optional() private readonly googleNotes?: GoogleNotesService, @Optional() private readonly settings?: SettingsService, @Optional() private readonly calSync?: CalendarSyncService) {}

  /** Staff on "Assigned projects" (Oct 30 sync): meetings on their projects, or on none that they attend. */
  private async mine<T extends { projectId?: number | null; attendees?: { id?: string; name?: string }[] | null }>(rows: T[], claims: SessionClaims | null) {
    const ids = await this.access.allowedIds(claims);
    if (ids === 'all') return rows;
    // Their projects' meetings; others only if they attend or created them.
    return rows.filter((m) => (m.projectId != null && ids.has(Number(m.projectId)))
      || (m.attendees || []).some((a) => a?.id === claims?.sub)
      || (!!claims?.sub && (m as { createdById?: string | null }).createdById === claims.sub));
  }

  @Get() async list(@Claims() claims: SessionClaims | null, @Query('archived') archived?: string) { return this.mine(await this.service.list(archived === '1'), claims); }

  /** Nov 19: the grouped "From Special Actions Log" meetings someone hid. The entries themselves stay in the log. */
  @Get('hidden-groups') async hiddenGroups() { return this.readHidden(); }
  @ManageWrites(...MANAGE)
  @Post('hidden-groups') async setHidden(@Body() body: { keys?: string[]; hidden?: boolean }) {
    const keys = (Array.isArray(body?.keys) ? body.keys : []).map(String).filter((k) => k && k.length < 400);
    if (!keys.length) throw new BadRequestException('Pick at least one.');
    const now = new Set(await this.readHidden());
    for (const k of keys) { if (body.hidden === false) now.delete(k); else now.add(k); }
    await this.settings?.set(HIDDEN_GROUPS, JSON.stringify([...now]));
    return [...now];
  }
  private async readHidden(): Promise<string[]> {
    try { const v = JSON.parse((await this.settings?.get(HIDDEN_GROUPS)) || '[]'); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
  }

  /** Nov 19: archive, bring back or delete several meetings at once (needs manage rights). */
  @ManageWrites(...MANAGE)
  @Post('bulk') async bulk(@Body() body: { ids?: string[]; action?: string }, @Headers('authorization') a?: string) {
    const ids = (Array.isArray(body?.ids) ? body.ids : []).map(String).filter(Boolean);
    if (!ids.length) throw new BadRequestException('Pick at least one meeting.');
    if (body.action === 'archive' || body.action === 'unarchive') return this.service.setArchived(ids, body.action === 'archive', await this.auth.actor(a));
    if (body.action === 'delete') {
      const r = await this.service.removeMany(ids);
      await this.calSync?.skip(r.calendarEventIds); // a deleted meeting isn't brought back from the calendar
      return { removed: r.removed };
    }
    throw new BadRequestException('Unknown action.');
  }
  @ManageWrites(...MANAGE)
  @Post(':id/archive') async archive(@Param('id') id: string, @Headers('authorization') a?: string) { return this.service.setArchived([id], true, await this.auth.actor(a)); }
  @ManageWrites(...MANAGE)
  @Post(':id/unarchive') async unarchive(@Param('id') id: string, @Headers('authorization') a?: string) { return this.service.setArchived([id], false, await this.auth.actor(a)); }
  /**
   * Nov 19: meetings from Google Calendar -- since Nov 20, each person's own
   * connected calendar. Status, a preview of the first run, Apply (then it
   * runs hourly), and on/off.
   */
  @Get('calendar-sync') async calendarSync(@Headers('authorization') a?: string) { return this.needSync().status((await this.auth.actor(a)).id); }
  @ManageWrites(...MANAGE)
  @Post('calendar-sync/preview') async calendarPreview() { return this.needSync().preview(); }
  @ManageWrites(...MANAGE)
  @Post('calendar-sync/apply') async calendarApply(@Headers('authorization') a?: string) { const actor = await this.auth.actor(a); return this.needSync().apply({ name: `Google Calendar (${actor.name})` }); }
  @ManageWrites(...MANAGE)
  @Post('calendar-sync/settings') async calendarOn(@Body() body: { on?: boolean }) { return this.needSync().setOn(body?.on !== false); }
  private needSync() { if (!this.calSync) throw new NotFoundException('Not available'); return this.calSync; }

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
  @ManageWrites(...MANAGE)
  @Delete(':id') async remove(@Param('id') id: string) {
    const r = await this.service.remove(id);
    if (r.calendarEventId) await this.calSync?.skip([r.calendarEventId]);
    return { ok: true };
  }
  /** Raise a task, or a FOR RECORD item (FYI, observation, decision) from the meeting (a Request Log entry linked to it). */
  /** Pull the meeting's notes from Google: { link } to a Doc, or found by title and date (Nov 3 sync). */
  @Post(':id/import-google') async importGoogle(@Param('id') id: string, @Body() body: { link?: string }) { if (!this.googleNotes) throw new NotFoundException('Not available'); return this.googleNotes.importOne(id, body?.link); }
  @Post(':id/actions') async addAction(@Param('id') id: string, @Body() dto: MeetingActionDto, @Headers('authorization') a?: string) {
    return this.service.addAction(id, dto, await this.auth.actor(a));
  }
}
