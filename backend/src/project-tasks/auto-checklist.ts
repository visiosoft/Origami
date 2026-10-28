import type { ChecklistItem } from '../database/task.types';

/**
 * Checklist templates marked "add automatically to" (Oct 16): on create, the
 * items of every matching template are added, unticked. Targets:
 *   task               -- every task (board and Request Log)
 *   record / record:X  -- every FOR RECORD entry, or only topic X (Observation)
 *   label:x            -- tasks carrying label x
 * People can delete the items afterwards; nothing re-adds them.
 */
export interface AutoTarget { kind: 'task' | 'record'; type?: string; labels?: string[] }

export function cleanAutoFor(raw: unknown): string[] {
  const out = new Set<string>();
  for (const x of Array.isArray(raw) ? raw : []) {
    const s = String(x || '').trim();
    if (s === 'task' || s === 'record') out.add(s);
    else if (/^(record|label):.+/.test(s)) { const [k, ...v] = s.split(':'); const val = v.join(':').trim().slice(0, 60); if (val) out.add(`${k}:${val}`); }
  }
  return [...out].slice(0, 20);
}

export function matchesAuto(autoFor: string[] | null | undefined, t: AutoTarget): boolean {
  const labels = new Set((t.labels || []).map((l) => String(l).trim().toLowerCase()));
  return (autoFor || []).some((a) => {
    if (a === 'task') return t.kind === 'task';
    if (a === 'record') return t.kind === 'record';
    if (a.startsWith('record:')) return t.kind === 'record' && a.slice(7).toLowerCase() === String(t.type || '').toLowerCase();
    if (a.startsWith('label:')) return labels.has(a.slice(6).toLowerCase());
    return false;
  });
}

/** The checklist with every matching template's items appended (skipping ones already there). */
export function withAutoChecklists(
  templates: { id: string; items: { item: string }[] | null; autoFor?: string[] | null }[],
  target: AutoTarget, current: ChecklistItem[], stamp = Date.now().toString(36),
): ChecklistItem[] {
  const out = [...current];
  const have = new Set(out.map((c) => String(c.item || '').trim().toLowerCase()));
  for (const tpl of templates) {
    if (!matchesAuto(tpl.autoFor, target)) continue;
    (tpl.items || []).forEach((x, i) => {
      const item = String(x?.item || '').trim();
      if (!item || have.has(item.toLowerCase())) return;
      have.add(item.toLowerCase());
      out.push({ id: `ci-${stamp}-${tpl.id}-${i}`, item, done: false });
    });
  }
  return out;
}
