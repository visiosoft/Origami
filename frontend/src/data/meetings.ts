/** A meeting and what came out of it; see the backend MeetingEntity. */
export interface Attendee { id?: string; name: string; email?: string }
export interface Meeting {
  id: string; title: string; type: string; projectId?: number | null; project?: string; date: string; time?: string; location?: string;
  attendees?: Attendee[] | null; agenda?: string; minutes?: string; status: 'scheduled' | 'held' | 'cancelled'; rfiIds?: string[] | null;
  createdBy?: string; createdAt?: string; updatedAt?: string;
}
export const MEETING_TYPES = ['Internal', 'Client', 'Consultant', 'Subcontractor', 'Site'];
export const MEETING_FIELDS: (keyof Meeting)[] = ['title', 'type', 'projectId', 'project', 'date', 'time', 'location', 'attendees', 'agenda', 'minutes', 'status', 'rfiIds'];
