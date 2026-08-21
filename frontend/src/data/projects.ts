import type { ProjectPhase, ProjectTask } from './projectTasks';
// Projects fixtures + workflow ported from the Origami v4 prototype (getProjects / getProjectWorkflow).

export interface Project {
  id: number;
  priority: 'High' | 'Medium' | 'Low';
  name: string;
  location: string;
  typeOfWork: string;
  contractType: string;
  contractAmt: string;
  estStart: string;
  duration: string;
  scope: string;
  stage: 'Leads' | 'Design' | 'Construction' | 'Closeout';
  progress: number;
  referral: string;
  contactedBy: string;
  imgColor: string;
  img: string;
  leadId?: string; // originating lead (intake questionnaire) shown on the Press Release & Project Info task
  introLetterSentAt?: string; // ISO timestamp when the Introduction Letter was sent (marks that step complete)
}

export const PROJECTS: Project[] = [
  { id: 1, priority: 'High', name: 'Narvaes Residence (91-1062 Kuhina St, Ewa Beach)', location: 'Ewa Beach, HI', typeOfWork: 'Residential · Renovation', contractType: 'Design + Build', contractAmt: '$780,000', estStart: 'Sep 2025', duration: '10 mos', scope: 'Full home remodel with lanai addition', stage: 'Construction', progress: 58, referral: 'Repeat client', contactedBy: 'Sara R.', imgColor: '#7E9B93', img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&h=200&fit=crop' },
  { id: 2, priority: 'High', name: 'Chelliah Residence (4255 Nerissa Circle, Fremont)', location: 'Fremont', typeOfWork: 'Residential · Renovation + ADU', contractType: 'Design + Build', contractAmt: '$640,000', estStart: 'Nov 2025', duration: '9 mos', scope: '1st floor remodel with detached ADU', stage: 'Design', progress: 32, referral: 'Jayaraman referral', contactedBy: 'Origami', imgColor: '#173326', img: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=200&fit=crop' },
  { id: 3, priority: 'Medium', name: "Alejandra's Work Requests", location: 'Multi-site', typeOfWork: 'Service · Work Requests', contractType: 'T&M', contractAmt: '$95,000', estStart: 'Ongoing', duration: 'Rolling', scope: 'Punch list and small-works requests across active homes', stage: 'Construction', progress: 45, referral: '', contactedBy: 'Edward', imgColor: '#D2822E', img: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&h=200&fit=crop' },
  { id: 4, priority: 'High', name: 'Jayaraman (4202 Nerissa Circle, Fremont)', location: 'Fremont', typeOfWork: 'ADU', contractType: 'Design + Build', contractAmt: '$455,000', estStart: 'Feb 2025', duration: '6 mos', scope: '1st Floor Remodel · 2nd Floor Addition', stage: 'Construction', progress: 88, referral: '', contactedBy: 'Origami', imgColor: '#D9B94F', img: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&h=200&fit=crop' },
  { id: 5, priority: 'Medium', name: 'Hadland (610 Woodrow SC)', location: 'Santa Cruz', typeOfWork: 'Residential · Ground Up · Wood Frame', contractType: 'Build', contractAmt: '$1,150,000', estStart: 'Jan 2026', duration: '13 mos', scope: '2-story single family with attached garage', stage: 'Design', progress: 24, referral: 'Lido Jarrod Design', contactedBy: 'Noor K.', imgColor: '#2F6F68', img: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=200&fit=crop' },
  { id: 6, priority: 'High', name: 'Perez Cottage (724 Happy Valley, SC)', location: 'Santa Cruz', typeOfWork: 'Residential · Cottage Build', contractType: 'Design + Build', contractAmt: '$520,000', estStart: 'Oct 2025', duration: '8 mos', scope: 'Detached cottage build — Evans/Contreras scope', stage: 'Construction', progress: 66, referral: 'Evans / Contreras', contactedBy: 'Ahmed K.', imgColor: '#B87A22', img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=200&fit=crop' },
  { id: 7, priority: 'Low', name: 'Design & Permit Sequence DETAILED DATES', location: 'Program-wide', typeOfWork: 'Design · Permitting Program', contractType: 'Consulting', contractAmt: '$68,000', estStart: 'Ongoing', duration: 'Rolling', scope: 'Master permit and design milestone tracking across all active jobs', stage: 'Design', progress: 40, referral: '', contactedBy: 'Edward', imgColor: '#2C5F58', img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=200&fit=crop' },
];

export const STAGE_CONFIG = [
  { name: 'Leads', color: '#7E9B93' },
  { name: 'Design', color: '#245C3A' },
  { name: 'Construction', color: '#173326' },
  { name: 'Closeout', color: '#0F2417' },
] as const;

export const PR_COLORS: Record<string, { bg: string; c: string }> = {
  High: { bg: '#F2DFD4', c: '#8E2E0A' },
  Medium: { bg: '#FBE9AE', c: '#93520F' },
  Low: { bg: '#D6E8E5', c: '#2F6F68' },
};


export const TEAM_COLORS: Record<string, string> = { 'Project Management': '#173326', 'Admin & Coordination': '#245C3A', Architecture: '#2F6F68', Design: '#2F6F68', Interiors: '#D2822E', 'Permits & Compliance': '#8E2E0A', Finance: '#2F7D4A', 'Legal & Contracts': '#0F2417', 'Client / Owner': '#0B1A12', Automation: '#D2822E', 'Field Operations': '#1C5230' };
export const TEAM_BGS: Record<string, string> = { 'Project Management': '#DCE7DE', 'Admin & Coordination': '#EEF3EE', Architecture: '#D6E8E5', Design: '#D3EAE6', Interiors: '#FBE9AE', 'Permits & Compliance': '#F2DFD4', Finance: '#D2EAD3', 'Legal & Contracts': '#DCE7DE', 'Client / Owner': '#EFEDE8', Automation: '#FBE9AE', 'Field Operations': '#D2EAD3' };
export const WF_ST_COLORS: Record<string, { bg: string; c: string }> = { Done: { bg: '#D2EAD3', c: '#1C5230' }, Open: { bg: '#EFEDE8', c: '#3A423E' }, 'In Progress': { bg: '#D6E8E5', c: '#2F6F68' } };

/** A phase plus the progress numbers the board header shows. */
export interface ComputedPhase extends ProjectPhase {
  tasks: ProjectTask[];
  count: number; doneCount: number; progress: number; locked: boolean;
  isComplete: boolean; isLocked: boolean; isActive: boolean; statusLabel: string;
  statusBg: string; statusC: string; headerOpacity: string;
}

/**
 * Group a project's real tasks under its phases and derive the header state.
 *
 * A phase stays locked until the one before it finishes — the same rule the
 * board has always shown, now driven by actual task status rather than fixtures.
 * An empty phase counts as incomplete, so adding no tasks never marks it done.
 */
export function computeWorkflow(phases: ProjectPhase[], tasks: ProjectTask[]): ComputedPhase[] {
  let prevComplete = true;
  return [...phases]
    .sort((a, b) => a.order - b.order)
    .map((ph, idx) => {
      const mine = tasks
        .filter((t) => t.phaseId === ph.id && !t.parentId)
        .sort((a, b) => a.order - b.order);
      const done = mine.filter((t) => t.status === 'Done' || t.completed).length;
      const allDone = mine.length > 0 && done === mine.length;
      const hasInProgress = mine.some((t) => t.status === 'In progress' || t.status === 'Blocked');
      const locked = idx > 0 && !prevComplete;
      const statusLabel = allDone
        ? 'Complete'
        : hasInProgress || done > 0
          ? 'In Progress'
          : locked
            ? 'Locked'
            : 'Not Started';
      const result: ComputedPhase = {
        ...ph,
        tasks: mine,
        count: mine.length,
        doneCount: done,
        progress: mine.length ? Math.round((done / mine.length) * 100) : 0,
        locked,
        isComplete: allDone,
        isLocked: locked,
        isActive: !locked && !allDone,
        statusLabel,
        statusBg: allDone ? '#D2EAD3' : locked ? '#EFEDE8' : '#D6E8E5',
        statusC: allDone ? '#1C5230' : locked ? '#9AA39D' : '#2F6F68',
        headerOpacity: locked ? '0.45' : '1',
      };
      prevComplete = allDone;
      return result;
    });
}
