/**
 * Structures on one project (Batch 6): a lot with a main house and an ADU is
 * built as two buildings, each with its own run of phases. The main
 * structure's phases are the project's ordinary ones (no structure key);
 * every other structure's phases are copies of the programme's, keyed
 * "<phase key>@<structure key>". Pure, so it can be tested on its own.
 */
export interface Structure { key: string; name: string }
export const MAIN_STRUCTURE: Structure = { key: 'main', name: 'Main house' };

/** "framing@adu" → "framing": template lookups (category, gating, weeks) use the base key. */
export const baseKey = (key: string) => String(key || '').split('@')[0];
/** "framing@adu" → "adu"; a plain key belongs to the main structure. */
export const structureOfKey = (key: string) => (String(key || '').includes('@') ? String(key).split('@')[1] : MAIN_STRUCTURE.key);

/** A short key from a name, unique among the ones already used. */
export function structureKey(name: string, taken: string[]): string {
  const base = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'structure';
  let k = base === MAIN_STRUCTURE.key ? 'main-2' : base;
  for (let n = 2; taken.includes(k); n++) k = `${base}-${n}`;
  return k;
}

interface ProgrammePhase { key: string; dependsOn?: string[]; tasks: { id: string }[] }
/** The programme's phases re-keyed for one structure, task ids too (they key the seeded task rows). */
export function programmeFor<T extends ProgrammePhase>(plan: T[], sKey: string): T[] {
  return plan.map((p) => ({
    ...p,
    key: `${p.key}@${sKey}`,
    dependsOn: p.dependsOn?.map((d) => `${d}@${sKey}`),
    tasks: p.tasks.map((t) => ({ ...t, id: `${t.id}@${sKey}` })),
  }));
}

/** What a phase's dependencies are on the board, kept inside its own structure. */
export const scopedDeps = (key: string, deps: string[]) => {
  const s = structureOfKey(key);
  return s === MAIN_STRUCTURE.key ? deps : deps.map((d) => `${baseKey(d)}@${s}`);
};
