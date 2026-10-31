/**
 * What each task priority means (Oct 2026, "Define priority meaning"). The
 * due-date window stays fixed (frontend data/priority.ts sets due dates from
 * it); the meaning is the office's wording, editable in Settings.
 */
export const PRIORITY_DEFS_KEY = 'tasks.priorityDefinitions';
export const PRIORITY_NAMES = ['Emergency', 'Urgent', 'High', 'Medium', 'Low', 'Very Low'] as const;
export type PriorityName = (typeof PRIORITY_NAMES)[number];
export interface PriorityDef { priority: PriorityName; window: string; meaning: string }

export const PRIORITY_WINDOWS: Record<PriorityName, string> = {
  Emergency: 'Due within 1 to 3 hours',
  Urgent: 'Due within 24 hours',
  High: 'Due within 5 business days',
  Medium: 'Due within 2 weeks',
  Low: 'Due within a month',
  'Very Low': 'Due in more than a month',
};

export const DEFAULT_PRIORITY_MEANINGS: Record<PriorityName, string> = {
  Emergency: 'Someone\'s safety, the site or the building is at risk right now (a leak, a collapse, an injury, a site shut down). Stop and deal with it within the next few hours.',
  Urgent: 'Work on site, a client or someone\'s safety is stopped or at risk, or money or a permit is on the line. Drop other work and deal with it today.',
  High: 'Holds up the schedule, a client decision or someone else\'s work if it slips. Get it done this week.',
  Medium: 'Normal project work with a real deadline. Plan it into the next two weeks.',
  Low: 'Needs doing this month, but nothing is waiting on it yet.',
  'Very Low': 'Useful, but nothing is waiting on it. Do it when there\'s time.',
};

/** The definitions as stored (JSON {Urgent: "…", …} or a list), with the defaults for anything missing or blank. */
export function parsePriorityDefs(raw: unknown): PriorityDef[] {
  let v: any = raw;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = null; } }
  const byName: Record<string, string> = {};
  if (Array.isArray(v)) for (const d of v) { if (d && typeof d.priority === 'string') byName[d.priority] = d.meaning; }
  else if (v && typeof v === 'object') Object.assign(byName, v);
  return PRIORITY_NAMES.map((p) => {
    const m = typeof byName[p] === 'string' ? byName[p].trim().slice(0, 500) : '';
    return { priority: p, window: PRIORITY_WINDOWS[p], meaning: m || DEFAULT_PRIORITY_MEANINGS[p] };
  });
}

/** What's stored: only the meanings, keyed by priority. */
export const storePriorityDefs = (defs: PriorityDef[]) => JSON.stringify(Object.fromEntries(defs.map((d) => [d.priority, d.meaning])));
