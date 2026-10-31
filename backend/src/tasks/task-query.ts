import { pageArgs, pageOf, sortRows } from '../common/paging';
import { ACTION_TAGS } from '../database/task.types';

/**
 * The Special Actions Log's filters, worked out on the server so the browser
 * gets one page at a time. Mirrors the rules the page used on the full list
 * (frontend/src/components/TaskScope.tsx, pages/Tasks.tsx).
 */
export interface Person { id: string; name: string }
export interface MineParts { assigned: boolean; collab: boolean; originated: boolean }
export type Scope = 'all' | 'mine' | 'fromMe' | 'assigned' | 'from';
export const TABS = ['internal', 'owner', 'subcontractor'] as const;
export const ALL_PROJECTS = 'All projects';
export const GENERAL_PF = 'General (no project)';
export const leadLabel = (name?: string | null) => (name ? `Lead · ${name}` : '');

type T = Record<string, any>;
const norm = (s?: string | null) => String(s || '').trim().toLowerCase();

export function isMine(t: T, u?: Person): boolean {
  if (!u) return false;
  const id = t.assigneeId ?? t.assignedToId;
  if (id) return id === u.id;
  const name = t.assignee ?? t.assignedTo;
  return !!name && norm(name) === norm(u.name);
}
export function raisedByUser(t: T, u?: Person): boolean {
  if (!u) return false;
  if (t.createdById && t.createdById === u.id) return true;
  const created = Array.isArray(t.activity) ? t.activity.find((a: any) => a?.type === 'created') : undefined;
  if (created?.byId && created.byId === u.id) return true;
  return !!t.originator && norm(t.originator) === norm(u.name);
}
export const fromMe = (t: T, u?: Person) => raisedByUser(t, u) && !isMine(t, u);
export function mineByParts(t: T, u: Person | undefined, parts: MineParts): boolean {
  if (!u) return false;
  return (parts.assigned && isMine(t, u)) || (parts.collab && (t.collaborators || []).some((c: any) => c?.id === u.id)) || (parts.originated && raisedByUser(t, u));
}
const hasAssignee = (t: T) => !!(t.assigneeId || t.assignedToId || String(t.assignee || t.assignedTo || '').trim());

/** Free-text search: number, subject, description, who it's with, labels. */
export function matchesQuery(t: T, q: string): boolean {
  const s = norm(q);
  if (!s) return true;
  return [t.serial, t.subject, t.description, t.assignee, t.assignedTo, ...(t.labels ?? [])].filter(Boolean).join(' ').toLowerCase().includes(s);
}

/** "Subject", else the description's first line, else the id -- as the list shows it. */
export function logTitle(t: T): string {
  const first = String(t.description || '').replace(/\r\n/g, '\n').trim().split('\n')[0].trim();
  return String(t.subject || '').trim() || first || t.id || '';
}

const SORTS: Record<string, (t: T) => string | number | null | undefined> = {
  id: (t) => t.id, type: (t) => t.topicType, subject: logTitle, status: (t) => t.status, who: (t) => t.assignedTo, date: (t) => t.meetingDate, due: (t) => t.dueDate,
};

export interface LogQuery {
  tab?: string; pf?: string; archived?: boolean; q?: string; tag?: string;
  scope?: Scope; person?: Person; parts?: MineParts; restricted?: boolean;
  sort?: string; dir?: 'asc' | 'desc'; page?: unknown; size?: unknown;
}

export function queryLog(all: T[], viewer: Person, o: LogQuery) {
  const parts = o.parts ?? { assigned: true, collab: true, originated: true };
  const pf = o.pf || ALL_PROJECTS;
  const byProject = (list: T[]) =>
    pf === ALL_PROJECTS ? list
      : pf === GENERAL_PF ? list.filter((x) => !x.project && !x.leadId)
        : pf.startsWith('Lead · ') ? list.filter((x) => leadLabel(x.leadName) === pf)
          : list.filter((x) => x.project === pf);
  const scope = o.restricted ? 'all' : (o.scope || 'all');
  const scoped = (list: T[]) => {
    if (scope === 'mine') return list.filter((t) => mineByParts(t, viewer, parts));
    if (scope === 'fromMe') return list.filter((t) => fromMe(t, viewer));
    if (scope === 'assigned') return o.person ? list.filter((t) => isMine(t, o.person)) : list.filter(hasAssignee);
    if (scope === 'from') return o.person ? list.filter((t) => raisedByUser(t, o.person)) : list;
    return list;
  };

  const live = all.filter((x) => (o.archived ? !!x.archivedAt : !x.archivedAt));
  const tab = (TABS as readonly string[]).includes(o.tab || '') ? o.tab! : 'internal';
  const tabs = Object.fromEntries(TABS.map((t) => [t, scoped(byProject(live.filter((x) => x.tab === t))).length]));
  const inTab = byProject(live.filter((x) => x.tab === tab));
  const filtered = scoped(inTab).filter((t) => matchesQuery(t, o.q || '') && (!o.tag || (Array.isArray(t.tags) && t.tags.includes(o.tag))));
  const sorted = sortRows(filtered, o.sort ? SORTS[o.sort] : undefined, o.dir);

  // The project picker lists projects first, then leads, in the order they first appear.
  const projects: string[] = [];
  for (const x of all) if (x.project && !projects.includes(x.project)) projects.push(x.project);
  for (const x of all) { const l = leadLabel(x.leadName); if (l && !projects.includes(l)) projects.push(l); }

  return {
    ...pageOf(sorted, pageArgs(o.page, o.size)),
    counts: {
      tabs,
      archived: all.filter((x) => x.archivedAt).length,
      mine: inTab.filter((t) => isMine(t, viewer)).length,
      scope: {
        all: inTab.length,
        mine: inTab.filter((t) => mineByParts(t, viewer, parts)).length,
        fromMe: inTab.filter((t) => fromMe(t, viewer)).length,
        assigned: inTab.filter(hasAssignee).length,
      },
    },
    facets: {
      projects,
      hasGeneral: all.some((x) => !x.project && !x.leadId),
      labels: [...new Set(all.flatMap((t) => (Array.isArray(t.labels) ? t.labels : [])))].sort(),
      tags: Object.fromEntries(ACTION_TAGS.map((g) => [g, inTab.filter((t) => Array.isArray(t.tags) && t.tags.includes(g)).length])),
    },
  };
}
