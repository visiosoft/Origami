import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeetingEntity } from '../database/entities';
import { GoogleService } from '../google/google.service';
import { docIdFrom, endedBefore, notesQuery, splitGeminiDoc } from './google-notes';

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
  async importFor(m: MeetingEntity, link?: string): Promise<MeetingEntity | null> {
    if (!this.google) throw new BadRequestException('Google isn’t set up.');
    let id = link ? docIdFrom(link) : null;
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
}
