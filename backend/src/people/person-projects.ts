/**
 * People are linked to projects by project id (Nov 13, Batch 4). Before
 * that, a person's projects were the project *names*, so renaming a project
 * silently cut people off. A person's `projectIds` is the record once set;
 * until then their names are matched to today's projects (case and spacing
 * ignored). The names stay alongside, kept in step, for display and export.
 */
export interface ProjectRef { id: number; name: string }
export interface PersonProjects { projects?: string[] | null; projectIds?: number[] | null }

export const normName = (s: unknown) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/** The ids of the projects this person is on. */
export function personProjectIds(person: PersonProjects, projects: ProjectRef[]): number[] {
  if (Array.isArray(person.projectIds)) return [...new Set(person.projectIds.map(Number).filter(Number.isFinite))];
  const byName = new Map(projects.map((p) => [normName(p.name), p.id]));
  return [...new Set((person.projects || []).map((n) => byName.get(normName(n))).filter((x): x is number => x != null))];
}

/** Is this person on that project? */
export function personOnProject(person: PersonProjects, project: ProjectRef, projects: ProjectRef[]): boolean {
  return personProjectIds(person, projects).includes(project.id);
}

/**
 * What to store when someone's projects are saved: ids are the record, and
 * the names follow them. Accepts ids (the People screen) or names only
 * (imports, older callers), never both out of step.
 */
export function projectsToStore(input: { projectIds?: unknown; projects?: unknown }, projects: ProjectRef[]): { projectIds: number[]; projects: string[] } {
  const byId = new Map(projects.map((p) => [p.id, p.name]));
  if (Array.isArray(input.projectIds)) {
    const ids = [...new Set(input.projectIds.map(Number).filter((id) => byId.has(id)))];
    return { projectIds: ids, projects: ids.map((id) => byId.get(id)!) };
  }
  const names = Array.isArray(input.projects) ? input.projects.map(String) : [];
  const ids = personProjectIds({ projects: names }, projects);
  // Names that match no project are kept (shown for fixing) but carry no access.
  const matched = new Set(ids.map((id) => normName(byId.get(id))));
  return { projectIds: ids, projects: [...ids.map((id) => byId.get(id)!), ...names.filter((n) => n.trim() && !matched.has(normName(n)))] };
}

/** The one-off move to ids: per person, what their names become and which match nothing. */
export function projectIdPlan(people: ({ id: number; name: string } & PersonProjects)[], projects: ProjectRef[]) {
  return people
    .filter((p) => !Array.isArray(p.projectIds) && (p.projects || []).length)
    .map((p) => {
      const byName = new Map(projects.map((x) => [normName(x.name), x]));
      const found = (p.projects || []).map((n) => ({ name: n, project: byName.get(normName(n)) || null }));
      return { id: p.id, name: p.name, projects: found.filter((f) => f.project).map((f) => ({ id: f.project!.id, name: f.project!.name })), unmatched: found.filter((f) => !f.project).map((f) => f.name) };
    });
}

/** A project was renamed: the people on it, with the new name in place of the old (ids unchanged). */
export function renamedPeople<T extends PersonProjects & { projectPhases?: Record<string, string[]> | null }>(people: T[], id: number, from: string, to: string): T[] {
  if (!from || !to || from === to) return [];
  const out: T[] = [];
  for (const p of people) {
    const onIt = Array.isArray(p.projectIds) ? p.projectIds.includes(id) : (p.projects || []).some((x) => normName(x) === normName(from));
    if (!onIt) continue;
    const projects = (p.projects || []).some((x) => normName(x) === normName(from)) ? (p.projects || []).map((x) => (normName(x) === normName(from) ? to : x)) : [...(p.projects || []), to];
    let projectPhases = p.projectPhases ?? null;
    if (projectPhases && from in projectPhases) { projectPhases = { ...projectPhases, [to]: projectPhases[from] }; delete projectPhases[from]; }
    out.push({ ...p, projects, projectPhases });
  }
  return out;
}
