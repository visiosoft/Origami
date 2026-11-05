import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeetingEntity } from '../database/entities';
import { GoogleService } from '../google/google.service';
import { docIdFrom, endedBefore, notesQuery, parseNotesDocName, sameMeeting, splitGeminiDoc } from './google-notes';
import { MeetingsService } from './meetings.service';
import type { Actor } from '../manpower/manpower-access.service';

/**
 * Meeting notes arrive by themselves (Nov 3 sync): every hour, meetings that
 * ended in the last three days and have no notes yet are matched to their
 * "Notes by Gemini" Doc in Drive; its notes and transcript are saved on the
 * meeting, ready to review into tasks and FOR RECORD items. The Doc must be
 * shared with the connected Google account (invite it to the meeting).
 */
@Injectable()
export class GoogleNotesService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('MeetingNotes');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(MeetingEntity) private readonly meetings: Repository<MeetingEntity>,
    @Optional() private readonly google?: GoogleService,
    @Optional() private readonly meetingsService?: MeetingsService,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => { void this.sweep(); }, 3600_000);
    this.timer.unref?.();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  /** Meetings that ended in the last 3 days with no notes yet: look for their Doc. */
  async sweep(now = new Date()) {
    if (!this.google || !(await this.google.isConnected().catch(() => false))) return { checked: 0, imported: 0 };
    const since = new Date(now.getTime() - 3 * 864e5).toISOString().slice(0, 10);
    const due = (await this.meetings.find()).filter((m) => !m.notesDocId && !String(m.minutes || '').trim() && (m.date || '') >= since && endedBefore(m.date, m.time, now));
    let imported = 0;
    for (const m of due) {
      try { if (await this.importFor(m)) imported++; }
      catch (e) { this.log.warn(`Notes for ${m.id}: ${(e as Error).message}`); }
    }
    return { checked: due.length, imported };
  }

  /** Find (or use the given link to) the meeting's notes Doc and save it on the meeting. Returns the meeting, or null when none was found. */
  async importFor(m: MeetingEntity, link?: string, docId?: string): Promise<MeetingEntity | null> {
    if (!this.google) throw new BadRequestException('Google isn’t set up.');
    let id = docId || (link ? docIdFrom(link) : null);
    if (link && !id) throw new BadRequestException('Paste the link to the Google Doc (docs.google.com/document/d/…).');
    if (!id) {
      const found = await this.google.findDocs(notesQuery(m.title, m.date), 5);
      id = found[0]?.id || null;
      if (!id) return null;
    }
    const doc = await this.google.exportDocText(id);
    const { notes, transcript } = splitGeminiDoc(doc.text);
    if (!notes) return null;
    m.minutes = notes;
    if (transcript && !String(m.transcript || '').trim()) m.transcript = transcript;
    if (!String(m.transcriptUrl || '').trim()) m.transcriptUrl = doc.link;
    m.notesDocId = id;
    m.notesImportedAt = new Date().toISOString();
    // Notes exist, so the meeting happened: it's ready to review.
    if (['scheduled', 'rescheduled', '', undefined, null].includes(m.status as any)) m.status = 'occurred';
    m.updatedAt = m.notesImportedAt;
    return this.meetings.save(m);
  }

  /** "Import from Google" on one meeting: a pasted link, or a search by title and date. */
  async importOne(meetingId: string, link?: string) {
    const m = await this.meetings.findOneBy({ id: meetingId });
    if (!m) throw new NotFoundException('Meeting not found');
    if (!this.google || !(await this.google.isConnected())) throw new BadRequestException('Connect Google Workspace first (Settings → Google).');
    const saved = await this.importFor(m, link);
    if (!saved) throw new NotFoundException(`No “Notes by Gemini” Doc for “${m.title}” on ${m.date} is shared with the connected Google account. Paste the Doc’s link instead, or invite that account to the meeting so the notes are shared with it.`);
    return saved;
  }

  /**
   * "Import notes from Google" on the Meetings page: the "Notes by Gemini" Docs
   * the connected account can open from the last `days` days, each with the
   * meeting it belongs to (by title and date) and whether it's already in.
   */
  async recentDocs(days = 30) {
    if (!this.google || !(await this.google.isConnected().catch(() => false))) throw new BadRequestException('Connect Google Workspace first (Settings → Google).');
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const docs = await this.google.findDocs(`name contains 'Notes by Gemini' and modifiedTime > '${since}'`, 50);
    const meetings = await this.meetings.find();
    return docs.map((d: any) => {
      const p = parseNotesDocName(d.name);
      const imported = meetings.find((m) => m.notesDocId === d.id);
      const match = imported || meetings.find((m) => sameMeeting(m, p));
      return { id: d.id, name: d.name, link: d.webViewLink || null, modifiedTime: d.modifiedTime || null, title: p.title, date: p.date, time: p.time,
        meetingId: match?.id || null, meetingTitle: match?.title || null, imported: !!imported };
    });
  }

  /**
   * Bring one Doc in: onto the meeting it belongs to (by title and date), or
   * onto a new meeting made from the Doc's name when there's none in Origami.
   */
  async importDoc(input: { docId?: string; link?: string }, actor: Actor) {
    if (!this.google || !(await this.google.isConnected().catch(() => false))) throw new BadRequestException('Connect Google Workspace first (Settings → Google).');
    const id = input.docId || (input.link ? docIdFrom(input.link) : null);
    if (!id) throw new BadRequestException('Pick a notes Doc, or paste its link (docs.google.com/document/d/…).');
    const doc = await this.google.exportDocText(id);
    const p = parseNotesDocName(doc.name);
    const all = await this.meetings.find();
    let m = all.find((x) => x.notesDocId === id) || all.find((x) => sameMeeting(x, p)) || null;
    let created = false;
    if (!m) {
      if (!this.meetingsService) throw new BadRequestException('Meetings aren’t available.');
      m = await this.meetingsService.create({ title: p.title, date: p.date || new Date().toISOString().slice(0, 10), time: p.time || undefined, locationType: 'virtual', status: 'occurred' } as any, actor) as MeetingEntity;
      created = true;
    }
    const saved = await this.importFor(m, undefined, id);
    if (!saved) throw new NotFoundException('That Doc has no notes in it.');
    return { meeting: saved, created };
  }
}
