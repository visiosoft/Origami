import { ACTION_TAGS, cleanTags } from '../database/task.types';

/**
 * Tags (Oct 30 sync). The seven standard tags decide who sees an item
 * (Internal / Financial stay with our team); custom tags are anyone's words,
 * kept in a shared bank so they come back as suggestions and filters.
 */
export const STANDARD_LABELS: Record<string, string> = {
  internal: 'Internal', client: 'Client', external: 'External', financial: 'Financial', crm: 'CRM', design: 'Design', construction: 'Construction',
};

/** A custom tag as stored: trimmed, single spaces, no leading '#', at most 60 characters. */
export function cleanTagName(raw: unknown): string {
  return String(raw ?? '').trim().replace(/^#+/, '').replace(/\s+/g, ' ').trim().slice(0, 60);
}
export const tagKey = (name: string) => cleanTagName(name).toLowerCase();
export const isStandard = (name: string) => (ACTION_TAGS as readonly string[]).includes(tagKey(name));

/** Typed tags split into standard ones (by key) and custom ones (deduped, first spelling kept). */
export function splitTags(raw: unknown): { standard: string[]; custom: string[] } {
  const standard: string[] = [];
  const custom: string[] = [];
  const seen = new Set<string>();
  for (const t of Array.isArray(raw) ? raw : []) {
    const name = cleanTagName(t);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    if ((ACTION_TAGS as readonly string[]).includes(key)) standard.push(key);
    else custom.push(name);
  }
  return { standard, custom };
}

/** A personal tag ("Astrid private", "Ed's list"): it starts with someone's name. */
export function isPersonalTag(label: string, people: string[]): boolean {
  const l = cleanTagName(label).toLowerCase();
  return people.some((full) => {
    const n = String(full || '').trim().toLowerCase();
    if (!n) return false;
    const first = n.split(/\s+/)[0];
    return [n, first].some((x) => x.length >= 3 && (l === x || l.startsWith(x + ' ') || l.startsWith(x + "'") || l.startsWith(x + '’') || l.startsWith(x + '-')));
  });
}

export interface NewItemContext {
  /** What the person picked (standard keys); undefined when they picked nothing. */
  tags?: unknown;
  /** Custom tags on it. */
  labels?: string[];
  /** Made by a client or consultant account. */
  outsideCreator?: boolean;
  /** Assigned to a client ('client') or a consultant / third party ('external'). */
  outsideAssignee?: 'client' | 'external' | null;
  /** Made from a lead (CRM). */
  fromLead?: boolean;
  /** The project's stage, when it's on a project. */
  projectStage?: string | null;
  /** About money: linked to a change order, or made from finance. */
  financial?: boolean;
  /** Everyone's names, for personal tags. */
  people?: string[];
}

const CONSTRUCTION = /construct|build|close ?out|punch|warranty|site work/i;

/**
 * The standard tags a new special action starts with (the user's answers, Nov 3):
 * - Financial brings Internal (as before), and anything about money is Financial.
 * - Where it was made: a lead -> CRM; a project in construction -> Construction, otherwise Design.
 * - Internal by default, so nothing reaches a client until someone tags it Client --
 *   unless a client or consultant made it, or it's assigned to one (then Client / External).
 * - A personal custom tag ("Astrid private") keeps it Internal.
 * Everything can be untagged by hand afterwards.
 */
export function autoTags(c: NewItemContext): string[] {
  const picked = cleanTags(c.tags);
  const out = new Set(picked);
  if (c.financial) out.add('financial');
  if (c.fromLead) out.add('crm');
  else if (c.projectStage) out.add(CONSTRUCTION.test(c.projectStage) ? 'construction' : 'design');
  const shared = out.has('client') || out.has('external');
  if (!c.outsideCreator && !shared) {
    if (c.outsideAssignee) out.add(c.outsideAssignee);
    else out.add('internal');
  }
  if ((c.labels || []).some((l) => isPersonalTag(l, c.people || []))) out.add('internal');
  return cleanTags([...out]);
}

/** On an edit: a personal tag just added brings Internal. */
export function tagsAfterLabelEdit(tags: unknown, before: string[], after: string[], people: string[]): string[] {
  const had = new Set(before.map((l) => l.toLowerCase()));
  const added = after.filter((l) => !had.has(l.toLowerCase()));
  const list = cleanTags(tags);
  return added.some((l) => isPersonalTag(l, people)) && !list.includes('internal') ? cleanTags(['internal', ...list]) : list;
}
