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
  leadId?: string; // originating lead (intake questionnaire) shown on the Project Info task
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

export interface WfTask {
  title: string;
  status: 'Done' | 'Open' | 'In Progress';
  auto: boolean;
  assignee: string;
  team: string;
  autoLabel?: string;
  start: string;
  end: string;
  dur: string;
  deps: string[];
}
export interface WfPhase { id: string; name: string; color: string; start: string; end: string; tasks: WfTask[] }

export const PROJECT_WORKFLOW: WfPhase[] = [
  { id: 'programming', name: 'Project Programming', color: '#0E5A8A', start: 'Mar 1', end: 'Mar 29', tasks: [
    { title: 'Project Info', status: 'Done', auto: false, assignee: 'Alejandra', team: 'Admin & Coordination', start: 'Mar 1', end: 'Mar 5', dur: '5d', deps: [] },
    { title: 'Introduction Letter', status: 'Done', auto: false, assignee: 'Manju', team: 'Legal & Contracts', start: 'Mar 1', end: 'Mar 3', dur: '3d', deps: [] },
    { title: 'Project Program DRAFT', status: 'Done', auto: false, assignee: 'Edward', team: 'Project Management', start: 'Mar 4', end: 'Mar 12', dur: '7d', deps: ['Project Info'] },
    { title: 'Municipality: Zoning Analysis, Permit History, Review Procedure', status: 'Done', auto: true, assignee: '', team: 'Automation', autoLabel: 'Auto-pull zoning records', start: 'Mar 4', end: 'Mar 8', dur: '5d', deps: ['Project Info'] },
    { title: 'Client Review — Project Program', status: 'Done', auto: false, assignee: 'Owner', team: 'Client / Owner', start: 'Mar 13', end: 'Mar 18', dur: '4d', deps: ['Project Program DRAFT'] },
    { title: 'Site & Client Meeting', status: 'Done', auto: false, assignee: 'Edward', team: 'Project Management', start: 'Mar 19', end: 'Mar 19', dur: '1d', deps: ['Client Review — Project Program'] },
    { title: 'Schedule of Services (Fee Proposal)', status: 'Done', auto: true, assignee: '', team: 'Automation', autoLabel: 'Auto-generate from scope template', start: 'Mar 20', end: 'Mar 22', dur: '3d', deps: ['Site & Client Meeting'] },
    { title: 'Finance Payment #1 — Contract Retainer', status: 'Done', auto: true, assignee: '', team: 'Finance', autoLabel: 'Auto-invoice on contract sign', start: 'Mar 25', end: 'Mar 29', dur: '5d', deps: ['Schedule of Services (Fee Proposal)'] },
  ] },
  { id: 'schematic', name: 'Schematic Design', color: '#0F7C7C', start: 'Apr 1', end: 'May 17', tasks: [
    { title: 'Client Review Meeting #2', status: 'Done', auto: false, assignee: 'Edward', team: 'Project Management', start: 'Apr 1', end: 'Apr 1', dur: '1d', deps: [] },
    { title: 'SD Perspective and Renderings (Elite Series)', status: 'Done', auto: false, assignee: 'Langston', team: 'Design', start: 'Apr 2', end: 'Apr 12', dur: '9d', deps: ['Client Review Meeting #2'] },
    { title: 'Schematic Design', status: 'Done', auto: false, assignee: 'Edward', team: 'Architecture', start: 'Apr 2', end: 'Apr 19', dur: '14d', deps: ['Client Review Meeting #2'] },
    { title: 'Client Review Meeting #3', status: 'Done', auto: false, assignee: 'Edward', team: 'Project Management', start: 'Apr 22', end: 'Apr 22', dur: '1d', deps: ['Schematic Design'] },
    { title: 'Schematic Design #4', status: 'Done', auto: false, assignee: 'Edward', team: 'Architecture', start: 'Apr 23', end: 'May 3', dur: '9d', deps: ['Client Review Meeting #3'] },
    { title: 'Client Review #4', status: 'Done', auto: false, assignee: 'Owner', team: 'Client / Owner', start: 'May 6', end: 'May 8', dur: '3d', deps: ['Schematic Design #4'] },
    { title: 'Schematic Design — Client Approval', status: 'Done', auto: false, assignee: 'Owner', team: 'Client / Owner', start: 'May 9', end: 'May 13', dur: '3d', deps: ['Client Review #4'] },
    { title: 'Finance Payment — Schematic Design', status: 'Done', auto: true, assignee: '', team: 'Finance', autoLabel: 'Auto-invoice on phase approval', start: 'May 14', end: 'May 17', dur: '4d', deps: ['Schematic Design — Client Approval'] },
  ] },
  { id: 'dd', name: 'Design Development & Plans', color: '#6B2FA0', start: 'May 20', end: 'Jul 12', tasks: [
    { title: 'Design Development Drawings, Elevations & Lighting Fixtures, Structural Diagrams', status: 'Done', auto: false, assignee: 'Edward', team: 'Architecture', start: 'May 20', end: 'Jun 14', dur: '20d', deps: [] },
    { title: 'AEC Team Contract and Schedules', status: 'Done', auto: false, assignee: 'Alejandra', team: 'Admin & Coordination', start: 'May 20', end: 'May 24', dur: '5d', deps: [] },
    { title: 'Client Review & Approval', status: 'Done', auto: false, assignee: 'Owner', team: 'Client / Owner', start: 'Jun 17', end: 'Jun 21', dur: '5d', deps: ['Design Development Drawings, Elevations & Lighting Fixtures, Structural Diagrams'] },
    { title: 'Design Development Resources', status: 'Done', auto: false, assignee: 'Edward', team: 'Project Management', start: 'Jun 17', end: 'Jun 28', dur: '10d', deps: ['AEC Team Contract and Schedules'] },
    { title: 'Municipal Planning Resubmission — Residential', status: 'Done', auto: false, assignee: 'Alejandra', team: 'Permits & Compliance', start: 'Jun 24', end: 'Jul 5', dur: '10d', deps: ['Client Review & Approval'] },
    { title: 'Municipal Planning Resubmission — Approval', status: 'Done', auto: true, assignee: '', team: 'Automation', autoLabel: 'Auto-track approval status', start: 'Jul 5', end: 'Jul 10', dur: '4d', deps: ['Municipal Planning Resubmission — Residential'] },
    { title: 'Invoice — Planning/Entitlement Approval', status: 'Done', auto: true, assignee: '', team: 'Finance', autoLabel: 'Auto-invoice on entitlement', start: 'Jul 10', end: 'Jul 12', dur: '3d', deps: ['Municipal Planning Resubmission — Approval'] },
  ] },
  { id: 'cd', name: 'Construction Contract Docs', color: '#C77A0A', start: 'Jul 15', end: 'Oct 4', tasks: [
    { title: 'Drawing Permit (Auto-Renew)', status: 'In Progress', auto: true, assignee: '', team: 'Automation', autoLabel: 'Auto-renew permit tracking', start: 'Jul 15', end: 'Aug 2', dur: '15d', deps: [] },
    { title: 'Municipality: Building Permit Resubmission and Process', status: 'In Progress', auto: false, assignee: 'Alejandra', team: 'Permits & Compliance', start: 'Jul 15', end: 'Aug 9', dur: '20d', deps: [] },
    { title: 'AEC Team Coordination', status: 'In Progress', auto: false, assignee: 'Edward', team: 'Project Management', start: 'Jul 15', end: 'Jul 26', dur: '10d', deps: [] },
    { title: 'CD Design Package 60% (Building Permit Submittal)', status: 'Done', auto: false, assignee: 'Edward', team: 'Architecture', start: 'Jul 15', end: 'Aug 9', dur: '20d', deps: ['AEC Team Coordination'] },
    { title: 'Municipality: Building Permit', status: 'In Progress', auto: true, assignee: '', team: 'Automation', autoLabel: 'Auto-track permit status', start: 'Aug 12', end: 'Sep 6', dur: '20d', deps: ['CD Design Package 60% (Building Permit Submittal)', 'Municipality: Building Permit Resubmission and Process'] },
    { title: 'DD Drawing Package 90% — Detail Floor Plans, Mirror Schedules', status: 'Open', auto: false, assignee: 'Edward', team: 'Architecture', start: 'Sep 1', end: 'Sep 19', dur: '15d', deps: ['CD Design Package 60% (Building Permit Submittal)'] },
    { title: 'Municipality: Ten-inch Community', status: 'Open', auto: false, assignee: 'Alejandra', team: 'Permits & Compliance', start: 'Sep 9', end: 'Sep 20', dur: '10d', deps: ['Municipality: Building Permit'] },
    { title: 'CD Design Package 100%', status: 'Open', auto: false, assignee: 'Edward', team: 'Architecture', start: 'Sep 22', end: 'Oct 4', dur: '10d', deps: ['DD Drawing Package 90% — Detail Floor Plans, Mirror Schedules', 'Municipality: Ten-inch Community'] },
  ] },
  { id: 'interior', name: 'Interior Design', color: '#A81E4D', start: 'Oct 7', end: 'Nov 22', tasks: [
    { title: 'Interior Narrative and Inspiration Boards', status: 'Open', auto: false, assignee: 'Langston', team: 'Interiors', start: 'Oct 7', end: 'Oct 18', dur: '10d', deps: [] },
    { title: 'Interior Conceptual Designs (MFS)', status: 'Open', auto: false, assignee: 'Langston', team: 'Interiors', start: 'Oct 21', end: 'Nov 1', dur: '10d', deps: ['Interior Narrative and Inspiration Boards'] },
    { title: 'Interior Schematic Design', status: 'Open', auto: false, assignee: 'Langston', team: 'Interiors', start: 'Nov 4', end: 'Nov 15', dur: '10d', deps: ['Interior Conceptual Designs (MFS)'] },
    { title: 'Interior Construction Details', status: 'Open', auto: false, assignee: 'Edward', team: 'Architecture', start: 'Nov 4', end: 'Nov 15', dur: '10d', deps: ['Interior Conceptual Designs (MFS)'] },
    { title: 'Procurement Schedules', status: 'Open', auto: true, assignee: '', team: 'Automation', autoLabel: 'Auto-generate from selections', start: 'Nov 18', end: 'Nov 22', dur: '5d', deps: ['Interior Schematic Design', 'Interior Construction Details'] },
  ] },
  { id: 'ca', name: 'Construction Administration', color: '#145C33', start: 'Nov 25', end: 'Mar 14, 2025', tasks: [
    { title: 'Construction Kick-off Meeting', status: 'Open', auto: false, assignee: 'Edward', team: 'Project Management', start: 'Nov 25', end: 'Nov 25', dur: '1d', deps: [] },
    { title: 'Request for Information / Clarifications', status: 'Open', auto: true, assignee: '', team: 'Automation', autoLabel: 'Auto-log from field reports', start: 'Nov 26', end: 'Mar 7', dur: 'Ongoing', deps: ['Construction Kick-off Meeting'] },
    { title: 'Change Orders / Clarifications', status: 'Open', auto: true, assignee: '', team: 'Automation', autoLabel: 'Auto-track CO approvals', start: 'Nov 26', end: 'Mar 7', dur: 'Ongoing', deps: ['Construction Kick-off Meeting'] },
    { title: 'Shop Drawing Memo', status: 'Open', auto: false, assignee: 'Edward', team: 'Architecture', start: 'Dec 2', end: 'Dec 13', dur: '10d', deps: ['Construction Kick-off Meeting'] },
    { title: 'Process: Site Inspections', status: 'Open', auto: true, assignee: '', team: 'Field Operations', autoLabel: 'Auto-schedule inspections', start: 'Dec 16', end: 'Feb 28', dur: 'Ongoing', deps: ['Shop Drawing Memo'] },
    { title: 'Punchlist & Substantial Completion', status: 'Open', auto: false, assignee: 'Edward', team: 'Project Management', start: 'Mar 3', end: 'Mar 14', dur: '10d', deps: ['Process: Site Inspections'] },
  ] },
];

export const TEAM_COLORS: Record<string, string> = { 'Project Management': '#173326', 'Admin & Coordination': '#245C3A', Architecture: '#2F6F68', Design: '#2F6F68', Interiors: '#D2822E', 'Permits & Compliance': '#8E2E0A', Finance: '#2F7D4A', 'Legal & Contracts': '#0F2417', 'Client / Owner': '#0B1A12', Automation: '#D2822E', 'Field Operations': '#1C5230' };
export const TEAM_BGS: Record<string, string> = { 'Project Management': '#DCE7DE', 'Admin & Coordination': '#EEF3EE', Architecture: '#D6E8E5', Design: '#D3EAE6', Interiors: '#FBE9AE', 'Permits & Compliance': '#F2DFD4', Finance: '#D2EAD3', 'Legal & Contracts': '#DCE7DE', 'Client / Owner': '#EFEDE8', Automation: '#FBE9AE', 'Field Operations': '#D2EAD3' };
export const WF_ST_COLORS: Record<string, { bg: string; c: string }> = { Done: { bg: '#D2EAD3', c: '#1C5230' }, Open: { bg: '#EFEDE8', c: '#3A423E' }, 'In Progress': { bg: '#D6E8E5', c: '#2F6F68' } };

export interface ComputedPhase extends WfPhase {
  count: number; doneCount: number; progress: number; locked: boolean;
  isComplete: boolean; isLocked: boolean; isActive: boolean; statusLabel: string;
  statusBg: string; statusC: string; headerOpacity: string;
}

export function computeWorkflow(): ComputedPhase[] {
  let prevComplete = true;
  return PROJECT_WORKFLOW.map((ph, idx) => {
    const done = ph.tasks.filter((t) => t.status === 'Done').length;
    const allDone = done === ph.tasks.length;
    const hasInProgress = ph.tasks.some((t) => t.status === 'In Progress');
    const locked = idx > 0 && !prevComplete;
    const phaseStatus = allDone ? 'Complete' : hasInProgress || (done > 0 && !allDone) ? 'In Progress' : locked ? 'Locked' : 'Not Started';
    const result: ComputedPhase = {
      ...ph, count: ph.tasks.length, doneCount: done,
      progress: Math.round((done / ph.tasks.length) * 100),
      locked,
      isComplete: allDone, isLocked: locked, isActive: !locked && !allDone,
      statusLabel: phaseStatus,
      statusBg: allDone ? '#D2EAD3' : locked ? '#EFEDE8' : '#D6E8E5',
      statusC: allDone ? '#1C5230' : locked ? '#9AA39D' : '#2F6F68',
      headerOpacity: locked ? '0.45' : '1',
    };
    prevComplete = allDone;
    return result;
  });
}
