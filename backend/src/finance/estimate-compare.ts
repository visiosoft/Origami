/**
 * Nov 19 (Edward: "compare previous estimates of the same project"): several
 * estimates of one project side by side -- any estimate numbers or revisions.
 * One row per trade (CSI code; the scope title when it has none), each
 * estimate's low (its total) and high (total × the scope's range factor), and
 * the change from the estimate before it. Amounts in cents.
 */
export interface CmpScope { csiCodeId?: string | null; csiLabel?: string | null; title: string; low: number; high: number }
export interface CmpEstimate { id: string; label: string; date?: string | null; scopes: CmpScope[]; totalLow: number; totalHigh: number }

const keyOf = (s: CmpScope) => (s.csiCodeId ? `csi:${s.csiCodeId}` : `t:${s.title.trim().toLowerCase()}`);

export function compareEstimates(list: CmpEstimate[]) {
  const order: string[] = [];
  const label = new Map<string, string>();
  for (const e of list) for (const s of e.scopes) {
    const k = keyOf(s);
    if (!label.has(k)) { order.push(k); label.set(k, s.csiLabel || s.title || 'Scope'); }
  }
  const rows = order.map((k) => {
    const cells = list.map((e) => {
      const hits = e.scopes.filter((s) => keyOf(s) === k);
      return hits.length ? { low: hits.reduce((a, s) => a + s.low, 0), high: hits.reduce((a, s) => a + s.high, 0) } : null;
    });
    const changes = cells.slice(1).map((c, i) => {
      const prev = cells[i];
      return { low: (c?.low ?? 0) - (prev?.low ?? 0), high: (c?.high ?? 0) - (prev?.high ?? 0) };
    });
    return { key: k, label: label.get(k)!, cells, changes };
  });
  const totals = list.map((e) => ({ low: e.totalLow, high: e.totalHigh }));
  const totalChanges = totals.slice(1).map((t, i) => ({ low: t.low - totals[i].low, high: t.high - totals[i].high }));
  return { estimates: list.map((e) => ({ id: e.id, label: e.label, date: e.date || null })), rows, totals, totalChanges };
}

/** Without the rights to see prices, the amounts are blanked (the trades still show). */
export function redactAcross<T extends ReturnType<typeof compareEstimates>>(c: T, canSee: boolean): T {
  if (canSee) return c;
  const blank = () => null as unknown as { low: number; high: number };
  return { ...c, rows: c.rows.map((r) => ({ ...r, cells: r.cells.map((x) => (x ? blank() : null)), changes: r.changes.map(blank) })), totals: c.totals.map(blank), totalChanges: c.totalChanges.map(blank) };
}
