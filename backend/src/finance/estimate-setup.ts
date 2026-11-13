import type { EstimateResult } from './estimate.calc';

/**
 * K9 (Nov 13): what "Set up the job" makes from an accepted estimate --
 * worked out here, purely, so the preview and the run use the same figures.
 * Amounts are cents.
 */
export interface SetupPlan {
  contract: number;
  budget: { csiCodeId: string | null; label: string; amount: number }[];
  subcontracts: { key: string; contractorId: string | null; vendorName: string; title: string; total: number; lines: { description: string; csiCodeId: string | null; amount: number }[] }[];
  milestones: { name: string; amount: number }[];
}
export type SetupStep = 'contract' | 'budget' | 'subcontracts' | 'milestones';
export const SETUP_STEPS: SetupStep[] = ['contract', 'budget', 'subcontracts', 'milestones'];

export function setupPlan(input: {
  scopes: { id: string; title?: string | null; csiCodeId?: string | null }[];
  lines: { id: string; scopeId: string; kind?: string | null; description?: string | null; pricing?: string | null; strategy?: string | null; contractorId?: string | null; subName?: string | null }[];
  payments: { label: string }[];
  result: EstimateResult;
  csi: { id: string; code: string; division?: string | null }[];
}): SetupPlan {
  const { result: r } = input;
  const out = new Map(r.lines.map((l) => [l.id, l]));
  const scope = new Map(input.scopes.map((s) => [s.id, s]));
  const csiLabel = (id: string | null) => {
    const c = id ? input.csi.find((x) => x.id === id) : null;
    return c ? `${c.code}${c.division ? ` — ${c.division}` : ''}` : 'No CSI code';
  };
  const items = input.lines.filter((l) => (!l.kind || l.kind === 'item') && out.get(l.id)?.counted && scope.has(l.scopeId));

  // Budget: direct cost (before markup) per the scope's CSI code; GR and General Liability under division 01.
  const budget = new Map<string, { csiCodeId: string | null; label: string; amount: number }>();
  const add = (csiCodeId: string | null, amount: number, label?: string) => {
    if (!amount) return;
    const k = csiCodeId || '';
    const b = budget.get(k) || { csiCodeId, label: label || csiLabel(csiCodeId), amount: 0 };
    b.amount += amount; budget.set(k, b);
  };
  for (const l of items) add(scope.get(l.scopeId)!.csiCodeId || null, out.get(l.id)!.cost);
  const div01 = input.csi.find((c) => /^0?1(\D|$)/.test(c.code.trim()));
  add(div01?.id || null, r.totals.grTotal + (r.totals.gl || 0), div01 ? csiLabel(div01.id) : 'General Requirements');

  // Draft subcontracts: one per named sub on "Subcontract used" lines, their sub cost per line.
  const subs = new Map<string, SetupPlan['subcontracts'][number]>();
  for (const l of items) {
    if (l.strategy !== 'sub_used') continue;
    const name = (l.subName || '').trim();
    if (!name && !l.contractorId) continue;
    const key = l.contractorId || name.toLowerCase();
    const s = subs.get(key) || { key, contractorId: l.contractorId || null, vendorName: name, title: '', total: 0, lines: [] };
    const amount = out.get(l.id)!.cost;
    s.lines.push({ description: (l.description || '').trim() || scope.get(l.scopeId)!.title || 'Work', csiCodeId: scope.get(l.scopeId)!.csiCodeId || null, amount });
    s.total += amount;
    subs.set(key, s);
  }
  for (const s of subs.values()) {
    const titles = [...new Set(s.lines.map((x) => csiLabel(x.csiCodeId).replace(/^.*— /, '')))].slice(0, 3);
    s.title = titles.join(', ') || 'Subcontract';
  }

  // Billing: one milestone per payment on the schedule, else the whole contract as one.
  const milestones = input.payments.length
    ? input.payments.map((p, i) => ({ name: p.label || `Payment ${i + 1}`, amount: r.payments[i]?.amount ?? 0 })).filter((m) => m.amount > 0)
    : [{ name: 'Contract (lump sum)', amount: r.totals.totalProject }];

  return { contract: r.totals.totalProject, budget: [...budget.values()], subcontracts: [...subs.values()], milestones };
}
