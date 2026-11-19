/**
 * Nov 19 (Edward): who asked for a programme task -- the project's Architect
 * for design work, its Project / Construction Manager otherwise (whoever is
 * set). Null when the project's team has neither.
 */
export function programmeSourceKey(phase: { key?: string | null; name?: string | null }, roles: Record<string, string> | null | undefined): string | null {
  const r = roles || {};
  const design = /design|concept|schematic|feasib|entitle|permit|drawing|programming|survey/i.test(`${phase.key || ''} ${phase.name || ''}`);
  const order = design ? ['architect', 'designer', 'projectManager'] : ['projectManager', 'architect'];
  return order.find((k) => r[k]) || null;
}
