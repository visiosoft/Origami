/** Fields that change on every save, or aren't the client's details. */
const SKIP = new Set(['updatedAt', 'createdAt', 'id', 'expectedUpdatedAt', 'version']);

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');

/** field -> { from, to } for every detail that differs between two copies of a lead. */
export function leadChanges(before: Record<string, any>, after: Record<string, any>): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (SKIP.has(k)) continue;
    if (!same(before[k], after[k])) out[k] = { from: before[k] ?? null, to: after[k] ?? null };
  }
  return out;
}
