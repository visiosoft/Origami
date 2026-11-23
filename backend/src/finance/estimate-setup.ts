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

/**
 * Nov 23 (Edward p30): set-up across several estimates of one project.
 * The first estimate set up sets the contract value; each later one adds its
 * total to it (Main house + ADU, or the bank part + the owner part).
 */
export function contractAfter(current: number, otherSetups: number, add: number) {
  return otherSetups > 0 ? { mode: 'add' as const, value: current + add } : { mode: 'set' as const, value: add };
}

/** A draft subcontract an earlier "Set up the job" made. */
export interface SetupDraft { id: string; number: string; status: string; contractorId: string | null; vendorName: string; structureKey: string | null; scope: string | null }

/**
 * Which earlier draft each sub's lines join. Same sub (by contractor, else
 * by name) and same building -> one subcontract (Scenario 2: split only by
 * who pays). A different building -> its own subcontract (Scenario 1). Only
 * drafts made by a set-up ("From EST-…") are joined; approved ones never.
 */
export function matchSubcontracts(subs: SetupPlan['subcontracts'], drafts: SetupDraft[], structureKey: string | null) {
  return subs.map((s) => {
    const sameSub = (d: SetupDraft) => (s.contractorId ? d.contractorId === s.contractorId : !d.contractorId && (d.vendorName || '').trim().toLowerCase() === s.key);
    const madeBySetup = (d: SetupDraft) => /^From EST-/.test(d.scope || '');
    const candidates = drafts.filter((d) => sameSub(d) && madeBySetup(d) && (d.structureKey || null) === (structureKey || null));
    const draft = candidates.find((d) => d.status === 'draft') || null;
    const approved = !draft && candidates.find((d) => d.status !== 'draft' && d.status !== 'void');
    return { key: s.key, joins: draft, note: draft ? `adds to ${draft.number}` : approved ? `${approved.number} is already ${approved.status} — a new subcontract` : 'new subcontract' };
  });
}
