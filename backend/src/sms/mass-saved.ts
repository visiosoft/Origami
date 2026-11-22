/**
 * Nov 19 (Edward: "Can we make templated messages and saved groupings with
 * messages?"): mass-text templates (a name and a message) and saved groups
 * (a name, the people and leads in it, and optionally its usual message).
 * Shared by the office; stored as one settings value.
 */
export interface MassTemplate { id: string; name: string; body: string }
export interface MassGroup { id: string; name: string; people: number[]; leads: string[]; body?: string }
export interface MassSaved { templates: MassTemplate[]; groups: MassGroup[] }

const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

export function cleanSaved(raw: unknown): MassSaved {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const templates = (Array.isArray(r.templates) ? r.templates : []).slice(0, 100).map((t: any) => ({ id: text(t?.id, 40) || id('MT'), name: text(t?.name, 80), body: text(t?.body, 1200) }))
    .filter((t) => t.name && t.body);
  const groups = (Array.isArray(r.groups) ? r.groups : []).slice(0, 100).map((g: any) => ({
    id: text(g?.id, 40) || id('MG'), name: text(g?.name, 80),
    people: [...new Set((Array.isArray(g?.people) ? g.people : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0))].slice(0, 2000) as number[],
    leads: [...new Set((Array.isArray(g?.leads) ? g.leads : []).map((x: unknown) => text(x, 60)).filter(Boolean))].slice(0, 2000) as string[],
    ...(text(g?.body, 1200) ? { body: text(g?.body, 1200) } : {}),
  })).filter((g) => g.name && (g.people.length || g.leads.length));
  return { templates, groups };
}
