import { STAGES } from '../seed-data/pipeline';

/**
 * Nov 19 (Edward: "we still need to assign roles at CRM ... so that as this
 * moves along, everyone knows if the task is theirs"): a lead's task filed
 * under a pipeline stage (label "section:<stage name>") belongs to whoever
 * holds that stage's owner role on the lead -- PC stages to the Project
 * Coordinator, PM stages to the Project Manager.
 */
const ROLE_OF: Record<string, string> = { PC: 'projectCoordinator', PM: 'projectManager' };

export function stageRoleKey(labels: string[] | null | undefined): string | null {
  const section = (labels || []).find((l) => /^section:/i.test(String(l)));
  if (!section) return null;
  const name = section.slice('section:'.length).trim().toLowerCase();
  const stage = STAGES.find((s) => s.name.toLowerCase() === name || s.key === name);
  return stage ? ROLE_OF[stage.owner] || null : null;
}

export const roleLabel = (key: string) => (key === 'projectCoordinator' ? 'Project Coordinator' : key === 'projectManager' ? 'Project Manager' : key);
