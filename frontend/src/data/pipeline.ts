// CRM & Leads (pipeline) fixtures ported from the Origami v4 prototype (getPipelineData).

export interface TimelineEvent { date: string; action: string; role: string; type: 'auto' | 'pc' | 'pm' }

export interface Deal {
  id: string;
  name: string;
  client: string;
  value: string;
  stage: string;
  stageIdx: number;
  assignedRole: string;
  assignee: string;
  assigneeInit: string;
  daysInStage: number;
  nextAction: string;
  nextDue: string;
  source: string;
  status: 'overdue' | 'awaiting_pm' | 'awaiting_client' | 'in_progress';
  phone: string;
  email: string;
  timeline: TimelineEvent[];
  notes: string;
  /** Set on a hold stage: the date to pick the lead back up. */
  holdUntil?: string;
  /** Off the board, history intact. Only hold and closed stages allow it. */
  archived?: boolean;
  archivedAt?: string;
  /** Set once converted, so the card can leave the board. */
  convertedProjectId?: number | null;
  /** Internal team on this pursuit, keyed by role. */
  roles?: Record<string, string>;
}

export interface Stage {
  key: string;
  name: string;
  idx: number;
  owner: string;
  ownerColor: string;
  ownerBg: string;
  isDecision?: boolean;
  isLost?: boolean;
  /** A parking stage that sets a follow-up date. */
  isHold?: boolean;
  holdMonths?: number;
  /** Terminal: off the active funnel, and archivable. */
  isClosed?: boolean;
}

export const STAGES: Stage[] = [
  { key: 'new_lead', name: 'New Lead', idx: 0, owner: 'PC', ownerColor: '#2F7D4A', ownerBg: '#D2EAD3' },
  { key: 'contact_attempted', name: 'Contact Attempted', idx: 1, owner: 'PC', ownerColor: '#2F7D4A', ownerBg: '#D2EAD3' },
  { key: 'initial_questions', name: 'Initial Questions', idx: 2, owner: 'PC', ownerColor: '#2F7D4A', ownerBg: '#D2EAD3' },
  { key: 'virtual_ff', name: 'Virtual F2F meeting', idx: 3, owner: 'PC', ownerColor: '#2F7D4A', ownerBg: '#D2EAD3' },
  { key: 'project_fit', name: 'Project Fit Review', idx: 4, owner: 'PM', ownerColor: '#173326', ownerBg: '#DCE7DE', isDecision: true },
  { key: 'site_visit', name: 'Schedule Site Visit', idx: 5, owner: 'PC', ownerColor: '#2F7D4A', ownerBg: '#D2EAD3' },
  { key: 'f2f', name: 'F2F Meet & Greet', idx: 6, owner: 'PM', ownerColor: '#173326', ownerBg: '#DCE7DE' },
  { key: 'zoning', name: 'Zoning Analysis', idx: 7, owner: 'PM', ownerColor: '#173326', ownerBg: '#DCE7DE' },
  { key: 'proposal', name: 'Proposal Sent', idx: 8, owner: 'PC', ownerColor: '#2F7D4A', ownerBg: '#D2EAD3' },
  { key: 'client_approval', name: 'Client Approval', idx: 9, owner: 'PM', ownerColor: '#173326', ownerBg: '#DCE7DE' },
  { key: 'rfp', name: 'RFP to Consultants', idx: 10, owner: 'PM', ownerColor: '#173326', ownerBg: '#DCE7DE' },
  // Parked leads. Each hold sets a follow-up date so the lead resurfaces
  // instead of going quiet -- see HOLD_MONTHS.
  { key: 'hold_1m', name: 'Hold - 1 Month', idx: 11, owner: 'PC', ownerColor: '#93520F', ownerBg: '#FBE9AE', isHold: true, holdMonths: 1 },
  { key: 'hold_3m', name: 'Hold - 3 Months', idx: 12, owner: 'PC', ownerColor: '#93520F', ownerBg: '#FBE9AE', isHold: true, holdMonths: 3 },
  { key: 'hold_6m', name: 'Hold - 6 Months', idx: 13, owner: 'PC', ownerColor: '#93520F', ownerBg: '#FBE9AE', isHold: true, holdMonths: 6 },
  { key: 'hold_12m', name: 'Hold - 12 Months+', idx: 14, owner: 'PC', ownerColor: '#93520F', ownerBg: '#FBE9AE', isHold: true, holdMonths: 12 },
  { key: 'cold', name: 'Cold Lead', idx: 15, owner: 'PC', ownerColor: '#2F6F68', ownerBg: '#D6E8E5', isClosed: true },
  { key: 'rejected', name: 'Cancelled / Rejected', idx: 16, owner: 'PM', ownerColor: '#8E2E0A', ownerBg: '#F2DFD4', isLost: true, isClosed: true },
];

export const STAGE_KEYS = ['new_lead', 'contact_attempted', 'initial_questions', 'virtual_ff', 'project_fit', 'site_visit', 'f2f', 'zoning', 'proposal', 'client_approval', 'rfp'];

export const STATUS_STYLES: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  overdue: { label: 'Overdue', bg: '#F2DFD4', color: '#8E2E0A', dot: '#B8410F' },
  awaiting_pm: { label: 'Awaiting PM', bg: '#DCE7DE', color: '#173326', dot: '#245C3A' },
  awaiting_client: { label: 'Awaiting Client', bg: '#FBE9AE', color: '#93520F', dot: '#E39A22' },
  in_progress: { label: 'In Progress', bg: '#D6E8E5', color: '#2F6F68', dot: '#7E9B93' },
};

export const DEALS: Deal[] = [
  { id: 'PL-001', name: 'Palm Jumeirah Villa Renovation', client: 'Al Futtaim Group', value: '$850K', stage: 'zoning', stageIdx: 7, assignedRole: 'PM', assignee: 'Ahmed K.', assigneeInit: 'AK', daysInStage: 3, nextAction: 'Zoning review due', nextDue: 'Jul 26', source: 'Referral', status: 'in_progress', phone: '+971 50 123 4567', email: 'ali@alfuttaim.ae',
    timeline: [
      { date: 'Jul 10', action: 'New lead received via referral', role: 'System', type: 'auto' },
      { date: 'Jul 10', action: 'Assigned to Sara R. (PC)', role: 'PC', type: 'pc' },
      { date: 'Jul 11', action: '1st contact attempted — no answer', role: 'PC', type: 'pc' },
      { date: 'Jul 12', action: '2nd contact attempted — voicemail left', role: 'PC', type: 'pc' },
      { date: 'Jul 13', action: 'Contact made — client interested', role: 'PC', type: 'pc' },
      { date: 'Jul 14', action: 'Initial questions completed — budget $850K, timeline 8 months', role: 'PC', type: 'pc' },
      { date: 'Jul 16', action: 'Site visit scheduled for Jul 18', role: 'PC', type: 'pc' },
      { date: 'Jul 16', action: 'SMS reminder sent to client', role: 'System', type: 'auto' },
      { date: 'Jul 18', action: 'F2F Meet & Greet completed — good fit', role: 'PM', type: 'pm' },
      { date: 'Jul 20', action: 'Zoning Analysis initiated — $500 paid', role: 'PM', type: 'pm' },
      { date: 'Jul 23', action: 'Zoning report under review', role: 'PM', type: 'pm' },
    ],
    notes: 'High-value residential renovation. Client referred by existing client (Downtown Penthouse). Very responsive, clear on budget. Villa is in Palm Jumeirah — zoning should be straightforward.' },
  { id: 'PL-009', name: 'Al Barsha Warehouse Convert', client: 'Nakheel Retail', value: '$540K', stage: 'project_fit', stageIdx: 4, assignedRole: 'PM', assignee: 'Ahmed K.', assigneeInit: 'AK', daysInStage: 2, nextAction: 'PM to approve/reject fit', nextDue: 'Jul 25', source: 'Referral', status: 'awaiting_pm', phone: '+971 50 222 3333', email: 'retail@nakheel.com',
    timeline: [
      { date: 'Jul 16', action: 'Referral received from existing client', role: 'System', type: 'auto' },
      { date: 'Jul 17', action: 'Contact made — warehouse to retail conversion', role: 'PC', type: 'pc' },
      { date: 'Jul 18', action: 'Initial questions — $540K, 10-week timeline, good budget fit', role: 'PC', type: 'pc' },
      { date: 'Jul 21', action: 'Escalated to PM for project fit decision', role: 'System', type: 'auto' },
    ],
    notes: 'Warehouse-to-retail conversion in Al Barsha. Budget is reasonable but scope is complex. PM needs to assess if this fits our current capacity and expertise.' },
  { id: 'PL-002', name: 'DIFC Office Fit-out', client: 'Emirates NBD', value: '$1.2M', stage: 'site_visit', stageIdx: 5, assignedRole: 'PC', assignee: 'Sara R.', assigneeInit: 'SR', daysInStage: 2, nextAction: 'Site visit this Friday', nextDue: 'Jul 25', source: 'Website', status: 'in_progress', phone: '+971 55 987 6543', email: 'procurement@emiratesnbd.com',
    timeline: [
      { date: 'Jul 8', action: 'Web inquiry received', role: 'System', type: 'auto' },
      { date: 'Jul 8', action: 'Auto-assigned to Sara R. (PC)', role: 'System', type: 'auto' },
      { date: 'Jul 9', action: 'Contact made — corporate procurement team', role: 'PC', type: 'pc' },
      { date: 'Jul 10', action: 'Initial questions — budget $1.2M, 12-week timeline', role: 'PC', type: 'pc' },
      { date: 'Jul 21', action: 'Site visit scheduled for Jul 25', role: 'PC', type: 'pc' },
    ],
    notes: 'Corporate fit-out. Procurement team is organized but slow on approvals. Need to prepare scope document before site visit.' },
  { id: 'PL-003', name: 'Silicon Oasis Villa', client: 'Private Client', value: '$450K', stage: 'initial_questions', stageIdx: 2, assignedRole: 'PC', assignee: 'Noor K.', assigneeInit: 'NK', daysInStage: 5, nextAction: 'Complete budget assessment', nextDue: 'Jul 22', source: 'Phone', status: 'overdue', phone: '+971 52 456 7890', email: 'villa.owner@gmail.com',
    timeline: [
      { date: 'Jul 14', action: 'Phone inquiry received', role: 'System', type: 'auto' },
      { date: 'Jul 14', action: 'Assigned to Noor K. (PC)', role: 'System', type: 'auto' },
      { date: 'Jul 15', action: 'Contact made — client wants villa extension', role: 'PC', type: 'pc' },
      { date: 'Jul 18', action: 'Initial questions started — budget unclear', role: 'PC', type: 'pc' },
    ],
    notes: 'Client unsure about budget. Needs guidance on realistic costs for villa extension in Silicon Oasis. Follow up on budget range.' },
  { id: 'PL-004', name: 'Meydan Retail Kiosk', client: 'Azizi Developments', value: '$180K', stage: 'new_lead', stageIdx: 0, assignedRole: 'PC', assignee: 'Unassigned', assigneeInit: '?', daysInStage: 8, nextAction: 'Assign & make first contact', nextDue: 'Jul 17', source: 'In Person', status: 'overdue', phone: '+971 50 111 2222', email: 'leasing@azizi.ae',
    timeline: [{ date: 'Jul 15', action: 'Walk-in inquiry at office', role: 'System', type: 'auto' }],
    notes: 'Small retail kiosk fit-out. Low value but could lead to larger Azizi projects. Needs assignment ASAP.' },
  { id: 'PL-005', name: 'JBR Restaurant Fit-out', client: 'Gates Hospitality', value: '$620K', stage: 'proposal', stageIdx: 8, assignedRole: 'PM', assignee: 'Ahmed K.', assigneeInit: 'AK', daysInStage: 1, nextAction: 'Client review deadline', nextDue: 'Jul 30', source: 'Referral', status: 'awaiting_client', phone: '+971 50 333 4444', email: 'projects@gateshospitality.com',
    timeline: [
      { date: 'Jul 6', action: 'Referral from industry partner', role: 'System', type: 'auto' },
      { date: 'Jul 6', action: 'Assigned to Sara R. (PC)', role: 'System', type: 'auto' },
      { date: 'Jul 7', action: 'Contact made — urgent timeline', role: 'PC', type: 'pc' },
      { date: 'Jul 8', action: 'Initial questions — F&B fit-out, 8 weeks', role: 'PC', type: 'pc' },
      { date: 'Jul 10', action: 'Site visit completed', role: 'PC', type: 'pc' },
      { date: 'Jul 12', action: 'F2F with Gates Hospitality management', role: 'PM', type: 'pm' },
      { date: 'Jul 15', action: 'Zoning approved — no issues', role: 'PM', type: 'pm' },
      { date: 'Jul 22', action: 'Proposal sent — $620K, 8-week delivery', role: 'PM', type: 'pm' },
    ],
    notes: 'Restaurant fit-out in JBR. Client wants fast turnaround. Proposal sent within 48 hrs of ZA approval. Awaiting client sign-off.' },
  { id: 'PL-006', name: 'Downtown Penthouse Remodel', client: 'Private Client', value: '$1.5M', stage: 'client_approval', stageIdx: 9, assignedRole: 'PM', assignee: 'Ahmed K.', assigneeInit: 'AK', daysInStage: 4, nextAction: 'Follow up on approval', nextDue: 'Jul 28', source: 'Website', status: 'awaiting_client', phone: '+971 55 999 8888', email: 'client.private@outlook.com',
    timeline: [
      { date: 'Jun 28', action: 'Web inquiry received', role: 'System', type: 'auto' },
      { date: 'Jun 29', action: 'Contact made — high-value residential', role: 'PC', type: 'pc' },
      { date: 'Jul 1', action: 'Initial questions — $1.5M budget', role: 'PC', type: 'pc' },
      { date: 'Jul 3', action: 'Site visit — penthouse inspection', role: 'PC', type: 'pc' },
      { date: 'Jul 5', action: 'F2F completed — client aligned on scope', role: 'PM', type: 'pm' },
      { date: 'Jul 8', action: 'Zoning approved', role: 'PM', type: 'pm' },
      { date: 'Jul 12', action: 'Proposal sent — full remodel package', role: 'PM', type: 'pm' },
      { date: 'Jul 19', action: 'Client requested minor revisions', role: 'System', type: 'auto' },
      { date: 'Jul 20', action: 'Revised proposal sent', role: 'PM', type: 'pm' },
    ],
    notes: 'Premium project. Client is detail-oriented, wants luxury finishes. Revised proposal addresses kitchen layout change. Expecting approval this week.' },
  { id: 'PL-007', name: 'Business Bay Tower Lobby', client: 'Damac Properties', value: '$2.1M', stage: 'contact_attempted', stageIdx: 1, assignedRole: 'PC', assignee: 'Sara R.', assigneeInit: 'SR', daysInStage: 2, nextAction: '2nd contact attempt', nextDue: 'Jul 24', source: 'Website', status: 'in_progress', phone: '+971 50 555 6666', email: 'facilities@damac.com',
    timeline: [
      { date: 'Jul 21', action: 'Web inquiry — lobby renovation', role: 'System', type: 'auto' },
      { date: 'Jul 21', action: 'Assigned to Sara R. (PC)', role: 'System', type: 'auto' },
      { date: 'Jul 22', action: '1st contact — no answer', role: 'PC', type: 'pc' },
    ],
    notes: 'Large corporate lobby renovation. Damac facilities team. High value, need to connect soon.' },
  { id: 'PL-008', name: 'Marina Walk Café', client: 'Coffee Planet', value: '$320K', stage: 'f2f', stageIdx: 6, assignedRole: 'PM', assignee: 'Ahmed K.', assigneeInit: 'AK', daysInStage: 1, nextAction: 'Schedule zoning analysis', nextDue: 'Jul 25', source: 'Phone', status: 'awaiting_pm', phone: '+971 50 777 8888', email: 'expansion@coffeeplanet.ae',
    timeline: [
      { date: 'Jul 10', action: 'Phone inquiry received', role: 'System', type: 'auto' },
      { date: 'Jul 10', action: 'Contact made — café fit-out', role: 'PC', type: 'pc' },
      { date: 'Jul 12', action: 'Initial questions — $320K, 6 weeks', role: 'PC', type: 'pc' },
      { date: 'Jul 15', action: 'Site visit completed', role: 'PC', type: 'pc' },
      { date: 'Jul 22', action: 'F2F completed — positive meeting', role: 'PM', type: 'pm' },
    ],
    notes: 'Café fit-out for Coffee Planet expansion. Good meeting, client wants to proceed quickly. Need to initiate ZA.' },
];
