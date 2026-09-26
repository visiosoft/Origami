/**
 * Release notes -- what changed, in the office's words, newest first. Shown
 * under Help & Support -> What's new; the sidebar marks Help as "New" until
 * someone has seen the latest release. Add a release at the top with each
 * deploy that changes something people will notice.
 */
export interface ReleaseItem {
  area: string;
  /** One line: what's different, in plain words. */
  text: string;
  /** Where to find it, e.g. "People → Import from spreadsheet". */
  where?: string;
  kind?: 'new' | 'improved' | 'fixed';
}
export interface Release { id: string; date: string; title: string; items: ReleaseItem[] }

export const RELEASES: Release[] = [
  {
    id: '2026-09-26',
    date: '2026-09-26',
    title: 'RFIs, one record per subcontractor, logins for clients and subs, spreadsheet import',
    items: [
      { area: 'Files', kind: 'new', text: 'Every file on a lead and on the project it becomes, in one numbered list — stage files, client uploads, and task files with the task number in front.', where: 'Lead → Files · Project → Files' },
      { area: 'Leads', kind: 'new', text: 'Welcome email for the client: a thank-you, a summary of what they told us, the documents we need, and a private upload link (no account, 30 days). Their uploads land in the lead’s Files.', where: 'Lead → Files → Send welcome email' },
      { area: 'Leads', kind: 'new', text: 'Files on every lead stage — site visit photos, surveys, the client’s plans — tagged with the stage they were added in.', where: 'Lead → Overview / Files' },
      { area: 'People', kind: 'new', text: 'Import people from a spreadsheet (CSV or Excel) with a template, a row-by-row preview, and matching to people already in the system.', where: 'People → Import from spreadsheet' },
      { area: 'People', kind: 'new', text: 'A subcontractor is one record: added in People or in Contractors it appears in both, and name, contact, licence, insurance and login stay the same everywhere.', where: 'People → Sub · Manpower → Contractors' },
      { area: 'People', kind: 'new', text: 'Anyone can be given a login from their People record — clients, consultants and subs (Subcontractor portal or project access). They get an email to set their own password.', where: 'People → a person → Login' },
      { area: 'Projects', kind: 'new', text: 'RFIs: numbered per project, emailed with a PDF, answered, closed — linked to the drawings in the File Room, and turned into a change order when there’s a cost.', where: 'RFIs · Project → Tasks & RFIs' },
      { area: 'Projects', kind: 'new', text: 'Subcontractors tab on every project: the companies on the job, their contacts, licence and insurance expiry, and their subcontracts.', where: 'Project → Subcontractors' },
      { area: 'Projects', kind: 'improved', text: 'Project layout: work at the top (Tasks & RFIs), money at the bottom; the Overview opens with open and overdue tasks and RFIs and ends with contract, billed and received.', where: 'Projects → a project' },
      { area: 'Change orders', kind: 'improved', text: 'Statuses now read Pending → Under client review → Approved / Rejected, and “Approve & send to client” emails the change order as a PDF for signature.', where: 'Project → Financial → Change orders' },
      { area: 'Tasks', kind: 'improved', text: '“Blocked” and “On hold” are one status, On hold; on a board with an On Hold column, the column and the status move together.', where: 'Project → Tasks & RFIs' },
      { area: 'Tasks', kind: 'new', text: 'Administrators can set the Request Log’s own statuses and choose which ones count as closed.', where: 'Settings → Request Log statuses' },
      { area: 'Manpower', kind: 'new', text: 'Payroll reports: taxes withheld and other deductions by employee or by pay run for any period, with CSV export.', where: 'Manpower → Payroll → Reports' },
      { area: 'Manpower', kind: 'new', text: 'Vacation and sick leave on each employee — balances side by side with their own “Record” — and a per-person yearly allowance.', where: 'Manpower → an employee → Overview' },
      { area: 'Manpower', kind: 'new', text: 'Picklists for departments, designations and skills & trades; new worker IDs carry the start year (W-2026-0012).', where: 'Manpower → Setup → Picklists' },
      { area: 'CRM', kind: 'fixed', text: 'Addresses on some leads (e.g. Qamaria Coffee, Joel Rodriguez) showed as missing or couldn’t be edited.' },
      { area: 'Projects', kind: 'fixed', text: 'The address on a project card is plain text again — clicking the card opens the project.' },
    ],
  },
  {
    id: '2026-09-25',
    date: '2026-09-25',
    title: 'Project hold, due-date reminders, maps and tap-to-call, autosave everywhere',
    items: [
      { area: 'Projects', kind: 'new', text: 'Put a project on hold with a reason and a follow-up date — the follow-up becomes a task for whoever picks it back up.', where: 'Project → Put on hold' },
      { area: 'Tasks', kind: 'improved', text: 'Due-date reminder emails: choose every morning, Mondays or off; tasks you collaborate on are included; each task links straight to it.', where: 'Settings → Notifications' },
      { area: 'Projects', kind: 'fixed', text: 'Construction projects no longer show on the Design board; construction phases (GC selection, CA, closeout) sit on the Construction side.' },
      { area: 'CRM', kind: 'new', text: 'Addresses open Google Maps and phone numbers dial on a phone; projects show the street address from the lead.' },
      { area: 'Manpower', kind: 'new', text: 'Each submitted daily log is emailed as a PDF and an Excel sheet as a backup.', where: 'Settings → Daily log backup' },
      { area: 'CRM', kind: 'improved', text: 'The proposal amount becomes the lead’s and the project’s contract amount — no retyping.' },
      { area: 'Everywhere', kind: 'new', text: 'A Save button and autosave (3 seconds after you stop typing) on tasks, leads, projects, people and Manpower.' },
      { area: 'People', kind: 'improved', text: 'People and Employees are one record, with the login managed on the employee record.' },
      { area: 'Manpower', kind: 'new', text: 'A daily log made for the superintendent’s phone on site.', where: 'Daily log (on a phone)' },
      { area: 'Tasks', kind: 'new', text: 'Collaborators on tasks, notes that collapse to two lines, and notes that turn into full tasks.' },
      { area: 'Everywhere', kind: 'new', text: 'A banner tells everyone when the system is about to update, and you stay signed in while it restarts.' },
    ],
  },
  {
    id: '2026-09-24',
    date: '2026-09-24',
    title: 'Project financials and the Manpower module',
    items: [
      { area: 'Finance', kind: 'new', text: 'Project financials: contract, schedule of values, invoices and payments; change orders, reimbursables and retention; job cost, profitability and reports.', where: 'Project → Financial' },
      { area: 'Finance', kind: 'new', text: 'Subcontractor portal: subs see their subcontracts, send invoices and follow payment.' },
      { area: 'Manpower', kind: 'new', text: 'Manpower & Resources: employees, deployment, timesheets, payroll, overtime, advances, leave, shifts, assets, housing and transport.', where: 'Manpower' },
      { area: 'Settings', kind: 'new', text: 'Company cost codes (CSI) and subcontractor trade classifications.', where: 'Settings → Cost Codes' },
    ],
  },
];

export const LATEST_RELEASE = RELEASES[0]?.id || '';
const SEEN_KEY = 'origami.releaseSeen';
export const releaseSeen = () => { try { return localStorage.getItem(SEEN_KEY) === LATEST_RELEASE; } catch { return true; } };
export const markReleaseSeen = () => { try { localStorage.setItem(SEEN_KEY, LATEST_RELEASE); window.dispatchEvent(new Event('origami:release-seen')); } catch { /* private window */ } };
