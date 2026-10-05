/**
 * The global search's index and matching, kept free of React and the API so it
 * can be unit tested. Each record becomes a SearchItem with the text it is
 * found by and the link that opens it.
 */
export type SearchKind = 'page' | 'project' | 'deal' | 'person' | 'employee' | 'task';

export interface SearchItem {
  kind: SearchKind;
  id: string;
  title: string;
  sub?: string;
  badge?: string;
  icon?: string;
  /** Where picking it goes. */
  to: string;
  /** Lower-cased text matched against (title first). */
  hay: string;
}

/** Order the groups appear in. */
const KIND_ORDER: SearchKind[] = ['page', 'project', 'deal', 'person', 'employee', 'task'];
/** At most this many of each kind are listed. */
export const PER_KIND = 6;

const norm = (s: unknown) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const join = (...parts: unknown[]) => parts.filter((p) => p !== undefined && p !== null && p !== '').join(' · ');

export interface IndexSources {
  pages?: { label: string; route: string; icon: string }[];
  projects?: any[];
  deals?: any[];
  people?: any[];
  employees?: any[];
  projectTasks?: any[];
  logTasks?: any[];
  /** First line of a request-log description, used as its title. */
  headline?: (text: string) => string;
}

export function buildIndex(src: IndexSources): SearchItem[] {
  const out: SearchItem[] = [];
  const add = (it: Omit<SearchItem, 'hay'>, ...extra: unknown[]) =>
    out.push({ ...it, hay: norm([it.title, it.sub, ...extra].join(' ')) });

  for (const p of src.pages || []) add({ kind: 'page', id: p.route, title: p.label, icon: p.icon, to: '/' + p.route });

  const projectName = new Map<number, string>();
  for (const p of src.projects || []) {
    if (p?.id === undefined || !p.name) continue;
    projectName.set(Number(p.id), p.name);
    add({ kind: 'project', id: String(p.id), title: p.name, sub: join(p.location, p.typeOfWork), badge: p.stage, to: `/projects?open=${p.id}` },
      p.contractType, p.client, p.address);
  }
  for (const d of src.deals || []) {
    if (!d?.id || !d.name) continue;
    add({ kind: 'deal', id: String(d.id), title: d.name, sub: join(d.client, d.assignee), badge: d.stage, to: `/pipeline?open=${encodeURIComponent(d.id)}` },
      d.email, d.phone, d.address);
  }
  for (const p of src.people || []) {
    if (p?.id === undefined || !p.name) continue;
    add({ kind: 'person', id: String(p.id), title: p.name, sub: join(p.role, p.company), badge: p.kind, to: `/people?open=${p.id}` },
      p.email, p.phone);
  }
  for (const e of src.employees || []) {
    if (!e?.id || !e.name) continue;
    add({ kind: 'employee', id: String(e.id), title: e.name, sub: join(e.workerId, e.designation || e.jobTitle, e.department), badge: e.status,
      to: `/manpower_con?employee=${encodeURIComponent(e.id)}` }, e.email, e.phone, e.trade);
  }
  for (const t of src.projectTasks || []) {
    if (!t?.id || !t.title) continue;
    const proj = t.projectId === null || t.projectId === undefined ? 'General Tasks' : projectName.get(Number(t.projectId)) || `Project ${t.projectId}`;
    add({ kind: 'task', id: 'p:' + t.id, title: t.title, sub: join(proj, t.assignee), badge: t.completed ? 'Done' : undefined,
      to: `/tasks?task=${encodeURIComponent(t.id)}&project=${t.projectId ?? 'null'}` }, t.description);
  }
  for (const t of src.logTasks || []) {
    if (!t?.id) continue;
    const title = (src.headline ? src.headline(t.description || '') : String(t.description || '').split('\n')[0]) || 'Untitled request';
    add({ kind: 'task', id: 'l:' + t.id, title, sub: join('Request log', t.project, t.assignedTo), badge: t.status,
      to: `/tasks?task=${encodeURIComponent(t.id)}&type=log` }, t.description, t.originator);
  }
  return out;
}

/**
 * Items matching every word of the query, best first within each kind:
 * title starts with the query, then a title word starts with it, then any match.
 * An empty query lists only the pages.
 */
export function searchIndex(items: SearchItem[], query: string, perKind = PER_KIND): SearchItem[] {
  const q = norm(query);
  if (!q) return items.filter((i) => i.kind === 'page').slice(0, 8);
  const words = q.split(' ');
  const scored: { it: SearchItem; score: number }[] = [];
  for (const it of items) {
    if (!words.every((w) => it.hay.includes(w))) continue;
    const t = norm(it.title);
    const score = t === q ? 0 : t.startsWith(q) ? 1 : t.split(/[\s(·,-]+/).some((w) => w.startsWith(words[0])) ? 2 : t.includes(q) ? 3 : 4;
    scored.push({ it, score });
  }
  const out: SearchItem[] = [];
  for (const kind of KIND_ORDER) {
    out.push(...scored.filter((s) => s.it.kind === kind)
      .sort((a, b) => a.score - b.score || a.it.title.localeCompare(b.it.title))
      .slice(0, perKind).map((s) => s.it));
  }
  return out;
}
