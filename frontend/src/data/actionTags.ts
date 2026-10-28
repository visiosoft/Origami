/**
 * Access tags on a special action (Oct 26 review notes), one or more. Anything
 * Financial comes in Internal too (it can be untagged later); Internal or
 * Financial items are never shown to client or consultant accounts. Mirrors
 * backend database/task.types.ts.
 */
export const ACTION_TAGS: [string, string][] = [
  ['internal', 'Internal'], ['client', 'Client'], ['external', 'External'], ['financial', 'Financial'],
  ['crm', 'CRM'], ['design', 'Design'], ['construction', 'Construction'],
];
export const tagLabel = (k: string) => ACTION_TAGS.find(([x]) => x === k)?.[1] || k;

/** Toggle one tag; switching Financial on brings Internal with it. */
export function toggleTag(tags: string[], key: string): string[] {
  const on = tags.includes(key);
  const next = on ? tags.filter((t) => t !== key) : [...tags, key];
  if (!on && key === 'financial' && !next.includes('internal')) next.push('internal');
  return ACTION_TAGS.map(([k]) => k).filter((k) => next.includes(k));
}
