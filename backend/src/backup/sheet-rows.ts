import { logSerialKind } from '../database/serials';

/**
 * The tabs of a project's backup Google Sheet (Oct 30 sync): enough to keep
 * working if the system is down. Each is a header row plus one row per record.
 */
export type Row = (string | number)[];
export interface Tab { title: string; rows: Row[] }
export const TAB_TITLES = ['Tasks', 'RFIs', 'Change orders', 'FOR RECORD', 'Meetings'] as const;

const s = (v: unknown) => (v == null ? '' : Array.isArray(v) ? v.map((x) => (typeof x === 'object' && x ? (x as any).name || (x as any).label || '' : String(x))).filter(Boolean).join(', ') : String(v));
const clip = (v: unknown, n = 2000) => s(v).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const byNumber = (a: Row, b: Row) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true });

export function buildTabs(d: { boardTasks: any[]; logTasks: any[]; rfis: any[]; changeOrders: any[]; meetings: any[] }): Tab[] {
  const tasks: Row[] = [
    ...d.boardTasks.map((t) => [s(t.serial || t.id), clip(t.title, 300), s(t.status), s(t.priority), s(t.assignee), s(t.dueDate), s([...(t.tags || []), ...(t.labels || [])]), 'Board', clip(t.description), s(t.archivedAt ? 'Archived' : ''), s(t.updatedAt)]),
    ...d.logTasks.filter((t) => logSerialKind(t.topicType) === 'task').map((t) => [s(t.serial || t.id), clip(t.subject || t.description, 300), s(t.status), s(t.priority), s(t.assignedTo), s(t.dueDate), s([...(t.tags || []), ...(t.labels || [])]), 'Special Actions Log', clip(t.description), s(t.archivedAt ? 'Archived' : ''), s(t.updatedAt)]),
  ].sort(byNumber);
  const record: Row[] = d.logTasks.filter((t) => logSerialKind(t.topicType) === 'record')
    .map((t) => [s(t.serial || t.id), s(t.topicType), clip(t.subject || t.description, 300), s(t.status), s(t.originator), s(t.meetingDate || t.createdAt), s(t.tags), clip(t.description)]).sort(byNumber);
  const rfis: Row[] = d.rfis.map((r) => [s(r.number), clip(r.subject, 300), s(r.status), s(r.priority), s(r.to), clip(r.question), clip(r.answer), s(r.answeredBy), s(r.createdAt)]).sort(byNumber);
  const cos: Row[] = d.changeOrders.map((c) => [s(c.number), clip(c.title, 300), s(c.status), c.amount == null ? '' : Number(c.amount), s(c.reason), Number(c.scheduleImpactDays) || 0, s(c.requestedBy), clip(c.description)]).sort(byNumber);
  const meetings: Row[] = d.meetings.map((m) => [s(m.serial || m.id), clip(m.title, 300), s(m.type), s(m.date), s(m.time), s(m.location), s(m.attendees)]).sort((a, b) => String(b[3]).localeCompare(String(a[3])));
  return [
    { title: 'Tasks', rows: [['Number', 'Title', 'Status', 'Priority', 'Assignee', 'Due', 'Tags', 'Where', 'Details', 'Archived', 'Updated'], ...tasks] },
    { title: 'RFIs', rows: [['Number', 'Subject', 'Status', 'Priority', 'To', 'Question', 'Answer', 'Answered by', 'Created'], ...rfis] },
    { title: 'Change orders', rows: [['Number', 'Title', 'Status', 'Amount', 'Reason', 'Schedule days', 'Requested by', 'Description'], ...cos] },
    { title: 'FOR RECORD', rows: [['Number', 'Type', 'Subject', 'Status', 'Originator', 'Date', 'Tags', 'Details'], ...record] },
    { title: 'Meetings', rows: [['Number', 'Title', 'Type', 'Date', 'Time', 'Location', 'Attendees'], ...meetings] },
  ];
}
