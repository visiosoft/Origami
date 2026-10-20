/**
 * @mentions in a task comment (Oct 20 sync): "@Andrea Castillo can you check?"
 * or just "@Andrea" when only one person goes by that first name. Returns the
 * mentioned accounts' ids, longest names matched first.
 */
export function mentionedIds(text: string, users: { id: string; name?: string | null }[]): string[] {
  const body = ' ' + String(text || '').toLowerCase();
  const found = new Set<string>();
  const named = users.filter((u) => String(u.name || '').trim()).map((u) => ({ id: u.id, full: String(u.name).trim().toLowerCase().replace(/\s+/g, ' ') }));
  const at = (name: string) => new RegExp(`(^|[^\\w@])@${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`, 'i').test(body);
  for (const u of [...named].sort((a, b) => b.full.length - a.full.length)) if (at(u.full)) found.add(u.id);
  // First names that belong to one person only.
  const firsts = new Map<string, string[]>();
  for (const u of named) { const f = u.full.split(' ')[0]; firsts.set(f, [...(firsts.get(f) || []), u.id]); }
  for (const [first, ids] of firsts) if (ids.length === 1 && at(first)) found.add(ids[0]);
  return [...found];
}
