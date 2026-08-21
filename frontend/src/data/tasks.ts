// Tasks fixtures + lead-time logic ported from the Origami v4 prototype (getAllTasks / getLeadTime).

import type { Attachment, TaskComment, ActivityEvent, ChecklistItem } from './projectTasks';

export interface Task {
  id: string;
  meetingType: 'Internal' | 'Owner' | 'Subcontractor';
  meetingDate: string;
  assignedTo: string;
  status: 'Open' | 'Closed' | 'In Progress';
  originator: string;
  topicType: 'Task' | 'FYI' | 'RFI';
  description: string;
  dueDate: string;
  dateClosed: string;
  daysOpen: number;
  resolution: string;
  linkedFile: string;
  project: string;
  tab?: TaskTab;
  /** users.id — `assignedTo` is kept alongside as the display name. */
  assignedToId?: string;
  attachments?: Attachment[];
  comments?: TaskComment[];
  activity?: ActivityEvent[];
  checklist?: ChecklistItem[];
  labels?: string[];
  updatedAt?: string;
}

export type TaskTab = 'internal' | 'owner' | 'subcontractor';

export const ALL_TASKS: Record<TaskTab, Task[]> = {
  internal: [
    { id: '20240405-01', meetingType: 'Internal', meetingDate: 'Apr 5', assignedTo: 'Edward', status: 'Closed', originator: 'Edward', topicType: 'Task', description: 'Pranav to get the same letter from the special inspection agency for California as well', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240405-02', meetingType: 'Internal', meetingDate: 'Apr 5', assignedTo: 'Edward', status: 'Closed', originator: '', topicType: 'Task', description: 'Get the letter to reduce the sheer wall from engineering', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240405-03', meetingType: 'Internal', meetingDate: 'Apr 5', assignedTo: 'Langston', status: 'Closed', originator: '', topicType: 'Task', description: 'Jerrod is working with roofer to get estimate and approve with owner.', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240405-05', meetingType: 'Internal', meetingDate: 'Apr 5', assignedTo: 'Alejandra', status: 'Closed', originator: 'Alejandra', topicType: 'Task', description: 'Alejandra to go over with Dave: Plumbing change orders, schedule zoom call, go over new electrical changes, verify sanitary sewer and water service from street to house.', dueDate: '', dateClosed: '', daysOpen: 0, resolution: 'Talked to Dave, confirmed all change orders. Pending cost for new panel location. Added RFI for sanitary sewer.', linkedFile: '', project: '1390 California St' },
    { id: '20240405-06', meetingType: 'Internal', meetingDate: 'Apr 5', assignedTo: '', status: 'Closed', originator: 'George', topicType: 'FYI', description: 'Roofer will do the outside soffit and fascia', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240405-08', meetingType: 'Internal', meetingDate: 'Apr 5', assignedTo: 'George', status: 'Closed', originator: 'Edward', topicType: 'Task', description: 'George Change orders: Price to Grout all steel columns, Fix subflooring, Pony wall at kitchen island, Estimate for reframing upstairs bedrooms egress windows, Estimate to finish structural stairs framing.', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240405-10', meetingType: 'Internal', meetingDate: 'Apr 5', assignedTo: 'Alejandra', status: 'Closed', originator: 'Edward', topicType: 'Task', description: 'Livio has to provide an EOR confirmation letter on framing, Alejandra to follow up with Pranav on this.', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240426-01', meetingType: 'Internal', meetingDate: 'Apr 26', assignedTo: 'Alejandra', status: 'Closed', originator: '', topicType: 'Task', description: 'Reach out to Adam to check when he is planning on doing the payment to schedule the team', dueDate: 'Apr 26', dateClosed: '', daysOpen: 811, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240426-03', meetingType: 'Internal', meetingDate: 'Apr 26', assignedTo: 'Alejandra', status: 'Closed', originator: '', topicType: 'Task', description: 'Stucco contract for California', dueDate: 'Apr 29', dateClosed: '', daysOpen: 808, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240503-04', meetingType: 'Internal', meetingDate: 'May 3', assignedTo: 'Edward', status: 'Closed', originator: '', topicType: 'Task', description: 'Edward to work with HVAC to figure out where to put the vents in the bathroom and range hood', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240503-13', meetingType: 'Internal', meetingDate: 'May 3', assignedTo: 'Edward', status: 'Closed', originator: '', topicType: 'Task', description: 'Edward to reach out to PG&E and let them know that the panel relocation has been approved in front of the laundry in the ADU.', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240516-07', meetingType: 'Internal', meetingDate: 'May 16', assignedTo: 'Edward', status: 'Open', originator: '', topicType: 'Task', description: 'Edward needs to finish up change orders for California', dueDate: '', dateClosed: '', daysOpen: 62, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240516-08', meetingType: 'Internal', meetingDate: 'May 16', assignedTo: 'Edward', status: 'Open', originator: '', topicType: 'Task', description: 'Edward needs to engage with Livio for insulation and drywall and flooring', dueDate: '', dateClosed: '', daysOpen: 62, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240822-01', meetingType: 'Internal', meetingDate: 'Aug 22', assignedTo: 'Alejandra', status: 'Closed', originator: 'Edward', topicType: 'Task', description: 'Accounting reconciliation', dueDate: 'Aug 27', dateClosed: '', daysOpen: 688, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240822-06', meetingType: 'Internal', meetingDate: 'Aug 22', assignedTo: 'Alejandra', status: 'In Progress', originator: '', topicType: 'Task', description: 'Discuss with Jerrod plumbing fixtures, need to be ordered ASAP it is stopping invoicing on plumbing and inspections', dueDate: 'Aug 22', dateClosed: '', daysOpen: 693, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240905-05', meetingType: 'Internal', meetingDate: 'Sep 5', assignedTo: 'Alejandra', status: 'In Progress', originator: '', topicType: 'Task', description: 'Alejandra to check directory for QII and reach out to them', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240926-01', meetingType: 'Internal', meetingDate: 'Sep 26', assignedTo: 'Alejandra', status: 'Closed', originator: '', topicType: 'Task', description: 'Schedule Rough inspections: 10/09 Rough MEP & Fire Sprinkler, electrical service panel, Lath & Plaster for the 10/15', dueDate: '', dateClosed: '', daysOpen: 0, resolution: 'Inspection happened on Wednesday 10/09. Mostly minor items. Fire rated wall between Stair and ADU needs Architect/Engineer solution letter. Inspector wants HVAC equipment in place and third party engineer letter for rough framing.', linkedFile: '', project: '1390 California St' },
    { id: '20240912-02', meetingType: 'Internal', meetingDate: 'Sep 12', assignedTo: 'Alejandra', status: 'Open', originator: '', topicType: 'Task', description: 'Alejandra to go over every single link and make sure the materials are in stock, valid and linked', dueDate: 'Sep 17', dateClosed: '', daysOpen: 667, resolution: '', linkedFile: '', project: '1390 California St' },
  ],
  owner: [
    { id: '20240410-01', meetingType: 'Owner', meetingDate: 'Apr 10', assignedTo: '', status: 'Closed', originator: '', topicType: 'FYI', description: 'We will have exhibit A with the amount remaining in the bank and Manju will add Exhibit C which is the money that Livio is bringing for Ed. Exhibit B will be Allowances.', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240410-02', meetingType: 'Owner', meetingDate: 'Apr 10', assignedTo: 'Manju', status: 'Closed', originator: '', topicType: 'Task', description: 'Livio will create a new contract with Ed for Exhibit C.', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240410-07', meetingType: 'Owner', meetingDate: 'Apr 10', assignedTo: 'Manju', status: 'Closed', originator: '', topicType: 'Task', description: 'Manju will update the Exhibit A with the amount matching the bank budget, Exhibit B remains as is for allowances and will add Exhibit C where Livio brings that money for Edward.', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240410-08', meetingType: 'Owner', meetingDate: 'Apr 10', assignedTo: 'Manju', status: 'Closed', originator: '', topicType: 'Task', description: 'Livio performed concrete and framing — takes 100% warranty on these two trades. Manju will put together a termination agreement document for all parties.', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240410-09', meetingType: 'Owner', meetingDate: 'Apr 10', assignedTo: 'Manju', status: 'Closed', originator: '', topicType: 'Task', description: 'Liquidated Damages: From Livio start of construction (pending confirm March 2023) till framing inspection (March 2024) plus 6 months = ~18 months. Livio will calculate LD of $100/day delay. Beyond that Ed takes over charges.', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240410-11', meetingType: 'Owner', meetingDate: 'Apr 10', assignedTo: 'Owner', status: 'Open', originator: 'Edward', topicType: 'RFI', description: 'Ed will follow up with Adam and Allie on pending invoice. Adam will reach out to the bank.', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240410-14', meetingType: 'Owner', meetingDate: 'Apr 10', assignedTo: 'Manju', status: 'Closed', originator: '', topicType: 'Task', description: 'Manju will send current contract without Livio logo with update of agreement to be between Edward and owner, adding all information discussed including Exhibit C and Addendum.', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240410-15', meetingType: 'Owner', meetingDate: 'Apr 10', assignedTo: 'Edward', status: 'Closed', originator: 'Manju', topicType: 'Task', description: 'Edward will add company logo and information to the contract provided by Manju.', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240410-22', meetingType: 'Owner', meetingDate: 'Apr 10', assignedTo: 'Edward', status: 'Open', originator: 'Owner', topicType: 'Task', description: 'Send requested documentation via email on March 11th to get bank approval as a GC. Loop Manju in the email.', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240725-06', meetingType: 'Owner', meetingDate: 'Jul 25', assignedTo: 'Owner', status: 'Closed', originator: '', topicType: 'Task', description: 'Adam to sign Change order', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
  ],
  subcontractor: [
    { id: '20240502-01', meetingType: 'Subcontractor', meetingDate: 'May 2', assignedTo: 'Edward', status: 'Closed', originator: '', topicType: 'Task', description: "Get receipt from Adam's payment to golden state", dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240502-02', meetingType: 'Subcontractor', meetingDate: 'May 2', assignedTo: '', status: 'Closed', originator: '', topicType: 'FYI', description: 'Livio to do all grouting COs', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240502-03', meetingType: 'Subcontractor', meetingDate: 'May 2', assignedTo: '', status: 'Open', originator: '', topicType: 'FYI', description: 'Blocker: Stairs CO needs to be completed by next week', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
    { id: '20240502-04', meetingType: 'Subcontractor', meetingDate: 'May 2', assignedTo: '', status: 'Closed', originator: '', topicType: 'FYI', description: 'Blockers for roofing: Backings for Fascia', dueDate: '', dateClosed: '', daysOpen: 0, resolution: '', linkedFile: '', project: '1390 California St' },
  ],
};

export const ST_COLORS: Record<string, { bg: string; c: string }> = {
  Closed: { bg: '#D2EAD3', c: '#1C5230' },
  Open: { bg: '#F2DFD4', c: '#8E2E0A' },
  'In Progress': { bg: '#D6E8E5', c: '#2F6F68' },
};
export const TT_COLORS: Record<string, { bg: string; c: string }> = {
  Task: { bg: '#DCE7DE', c: '#173326' },
  FYI: { bg: '#FBE9AE', c: '#93520F' },
  RFI: { bg: '#D6E8E5', c: '#2F6F68' },
};
export const MT_COLORS: Record<string, { bg: string; c: string }> = {
  Internal: { bg: '#DCE7DE', c: '#173326' },
  Owner: { bg: '#D2EAD3', c: '#1C5230' },
  Subcontractor: { bg: '#FBE9AE', c: '#93520F' },
};

export interface AuditEntry { what: string; by: string; when: string; chip: string; chipBg: string; chipC: string; dot: string }

export function getLeadTime(t: Task) {
  const digits = (String(t.id).match(/\d/g) || []).reduce((a, d) => a + Number(d), 0);
  const leadMap: Record<string, number> = { Task: 14, RFI: 7, FYI: 5 };
  const leadTime = leadMap[t.topicType] || 14;
  const openDays = t.daysOpen > 0 ? t.daysOpen : (digits % 26) + 2;
  const variance = openDays - leadTime;
  const closed = t.status === 'Closed';
  const ok = variance <= 0;
  const label = closed ? (ok ? 'Closed on time' : 'Closed ' + variance + ' days late') : ok ? 'Within lead time' : variance + ' days over lead time';
  const source = (leadMap[t.topicType] ? t.topicType : 'Task') + ' template · ' + leadTime + '-day default';
  const audit: AuditEntry[] = [
    { what: 'Due date set from template (+' + leadTime + ' days)', by: 'System', when: t.meetingDate, chip: 'Auto', chipBg: '#EFEDE8', chipC: '#43514D', dot: '#7E9B93' },
  ];
  if (variance > 3) audit.unshift({ what: 'Due date moved out by ' + Math.min(variance, 10) + ' days', by: (t.assignedTo || 'Unassigned') + ' → approved by Edward M.', when: 'Approved ' + (t.dueDate || 'pending'), chip: 'Approved', chipBg: '#D2EAD3', chipC: '#1C5230', dot: '#2F7D4A' });
  if (!closed && variance > 8) audit.unshift({ what: 'Second extension requested', by: t.assignedTo || 'Unassigned', when: 'Awaiting owner approval', chip: 'Pending', chipBg: '#FBE9AE', chipC: '#93520F', dot: '#D2822E' });
  return { leadTime, openDays, variance, source, audit, label, bg: ok ? '#D2EAD3' : '#F2DFD4', color: ok ? '#1C5230' : '#8E2E0A' };
}

export const NEW_TASK_FIELDS = [
  { label: 'Meeting Type', value: 'Internal', valColor: '#0B1A12', span: 'auto', required: true },
  { label: 'Meeting Date', value: 'Select date', valColor: '#7E9B93', span: 'auto', required: true },
  { label: 'Assigned To', value: 'Select person', valColor: '#7E9B93', span: 'auto', required: false },
  { label: 'Originator', value: 'Select person', valColor: '#7E9B93', span: 'auto', required: false },
  { label: 'Topic Type', value: 'Task', valColor: '#0B1A12', span: 'auto', required: true },
  { label: 'Status', value: 'Open', valColor: '#0B1A12', span: 'auto', required: true },
  { label: 'Due Date', value: 'Select date', valColor: '#7E9B93', span: 'auto', required: false },
  { label: 'Project', value: 'Select project', valColor: '#7E9B93', span: 'auto', required: false },
  { label: 'Description', value: 'Describe the task...', valColor: '#7E9B93', span: '1 / -1', required: true },
  { label: 'Link to File', value: 'Attach or paste link', valColor: '#7E9B93', span: '1 / -1', required: false },
];
