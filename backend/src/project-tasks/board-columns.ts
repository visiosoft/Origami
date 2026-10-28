/**
 * Every task board -- each project's and General -- carries the same column
 * headings (Oct 27 sync). A column change made by leadership applies to every
 * board, matching columns by name; "Make every board match this one" lines up
 * boards that had drifted. Pure, so the matching is tested without a database.
 */
export interface Column { id: string; name: string; order: number; projectId: number | null }

/** Who may add, rename, reorder or delete columns: the internal leadership ("i-2"). */
export const COLUMN_EDITORS = ['admin', 'principal'];

export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Group sections by board: projectId (null = General). */
export function byBoard(rows: Column[]): Map<number | null, Column[]> {
  const out = new Map<number | null, Column[]>();
  for (const r of rows) {
    const k = r.projectId ?? null;
    out.set(k, [...(out.get(k) || []), r]);
  }
  for (const list of out.values()) list.sort((a, b) => a.order - b.order);
  return out;
}

/**
 * What it takes for one board to carry exactly `names`, in that order:
 * columns kept (renamed to the template's spelling and re-ordered), columns
 * to create, and columns to remove -- whose tasks go to `moveTo`.
 */
export function alignPlan(names: string[], board: Column[]) {
  const keep: { id: string; name: string; order: number }[] = [];
  const create: { name: string; order: number }[] = [];
  const used = new Set<string>();
  names.forEach((name, order) => {
    const match = board.find((c) => !used.has(c.id) && sameName(c.name, name));
    if (match) { used.add(match.id); keep.push({ id: match.id, name, order }); }
    else create.push({ name, order });
  });
  const remove = board.filter((c) => !used.has(c.id)).map((c) => c.id);
  return { keep, create, remove };
}

/** A board's columns ordered by `names` (unknown ones keep their place after them). */
export function orderedBy(names: string[], board: Column[]): { id: string; order: number }[] {
  const rank = (c: Column) => { const i = names.findIndex((n) => sameName(n, c.name)); return i < 0 ? names.length + c.order : i; };
  return [...board].sort((a, b) => rank(a) - rank(b)).map((c, order) => ({ id: c.id, order }));
}
