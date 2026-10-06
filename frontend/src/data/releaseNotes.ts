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
    id: '2026-10-06j',
    date: '2026-10-06',
    title: 'Your meetings on the Dashboard week',
    items: [
      { area: 'Dashboard', kind: 'new', text: 'The “This week” card on the Dashboard now shows your Google Calendar meetings for Monday to Sunday next to your tasks due, each with its time, earliest first. Click a meeting to open it in Google Calendar. If your calendar isn’t connected yet, the card offers a Connect Google Calendar button.', where: 'Dashboard → This week (New look)' },
    ],
  },
  {
    id: '2026-10-06i',
    date: '2026-10-06',
    title: 'Reimbursements page rebuilt around your expenses',
    items: [
      { area: 'Reimbursement', kind: 'improved', text: 'In the New look the Reimbursement page now follows how expenses actually move: four totals at the top (waiting for approval, approved and ready to bill, billed to clients, spent this month vs last), a status filter with counts, project filter and search, then every expense grouped by month with its amount, markup, receipt and status. Approve straight from the list; click an expense to open, edit or reject it. Spend by project and by category sits on the right, and expenses missing a receipt are called out.', where: 'Financial → Reimbursements' },
    ],
  },
  {
    id: '2026-10-06h',
    date: '2026-10-06',
    title: 'Projects board in the New look',
    items: [
      { area: 'Projects', kind: 'improved', text: 'In the New look the Projects board has light rounded cards instead of the dark banners: the project name in large type with its address underneath, the contract type and kind of work as small tags, the contract amount written in dollars (e.g. “2,413,262” shows as $2,413,262), a yellow progress bar, start and duration, and who it’s with. High-priority projects get a yellow tag. Drag and drop between CRM, Design, Construction and Closed works as before.', where: 'Projects' },
    ],
  },
  {
    id: '2026-10-06g',
    date: '2026-10-06',
    title: 'Dashboard shows your real numbers',
    items: [
      { area: 'Dashboard', kind: 'improved', text: 'In the New look every card on the Dashboard now comes from Origami: active projects, your open tasks, live leads, work done / invoiced / collected across contracts, client payments collected per month, and the share of contracts invoiced. The dark project card highlights the project with the most overdue invoices (or overdue tasks). The sample charts that used to sit below are hidden in the New look.', where: 'Dashboard (New look)' },
      { area: 'Dashboard', kind: 'improved', text: '“Needs attention” now lists your latest open tasks from both the Task Board and the Request Log, with overdue ones flagged. Click one to open it.', where: 'Dashboard → Needs attention' },
    ],
  },
  {
    id: '2026-10-06f',
    date: '2026-10-06',
    title: 'See who created a task',
    items: [
      { area: 'Tasks', kind: 'new', text: 'Every task now shows who created it and when (“Created by Sara R. · Oct 1”, plus “reassigned by …” when someone else handed it on) under its subject in the Request Log, under the assignee when a task is open, on the Task Board, and in My tasks. It comes from the task’s history, so tasks assigned before today show it too. A new request’s Originator is filled in with whoever created it.', where: 'Tasks → Request Log / Task Board · Dashboard → My tasks' },
    ],
  },
  {
    id: '2026-10-06e',
    date: '2026-10-06',
    title: 'Tasks have a Subject and a Description',
    items: [
      { area: 'Tasks', kind: 'improved', text: 'A new task now has a Subject (its name) and a separate Description. Before, the description’s first line doubled as the task’s name, so the name appeared twice. The subject can be edited at the top of an open task; older tasks keep showing their first line until a subject is typed.', where: 'Tasks → Request Log → + New Task' },
    ],
  },
  {
    id: '2026-10-06d',
    date: '2026-10-06',
    title: 'Projects by CRM, Design, Construction, Closed; people by level',
    items: [
      { area: 'Projects', kind: 'improved', text: 'The project board’s columns now read CRM, Design, Construction and Closed. CRM holds leads and won work that hasn’t started; Closed is what used to be Closeout.', where: 'Projects' },
      { area: 'People', kind: 'new', text: 'The internal team is split by level: Executive, Staff, Super, Foreman and Labor, each with its own filter. A level is suggested from the person’s role title (Principal → Executive, Superintendent → Super, Foreman, Laborer → Labor) and can be set by hand on their record.', where: 'People → filter chips · person form → Internal level' },
    ],
  },
  {
    id: '2026-10-06c',
    date: '2026-10-06',
    title: 'A new menu',
    items: [
      { area: 'Everywhere', kind: 'improved', text: 'The menu is reorganised into Main, My Stuff, Special Actions, CRM, Design, Preconstruction, Construction, Financial & Resource, Insight & Documents and Admin. Hover over an item to see what it is for.' },
      { area: 'Everywhere', kind: 'new', text: 'New entries: All Files (every project’s Drive files in one place, limited access), Special Actions → Task (opens the Request Log), and Schedule under Construction as well as Preconstruction. Modules still to be built (Meetings, Observations & FYI, Holding & Refer Out, Feedback, Warranty, GC and Subcontractor Prequalifying & RFP, Safety, Equipment, Deliveries, Daily Reports, Affiliates) show what they will do.' },
      { area: 'Admin', kind: 'improved', text: 'The new modules appear in User Access & Roles. Except where a menu entry reuses an existing page (Task, the second Schedule), roles see them only once an administrator ticks them.', where: 'Admin → User Access & Roles' },
    ],
  },
  {
    id: '2026-10-06b',
    date: '2026-10-06',
    title: 'New-look Dashboard, People and Reimbursement',
    items: [
      { area: 'Dashboard', kind: 'improved', text: 'In the New look the dashboard opens with a greeting, headline bars (budget used, time used, collected, overdue) and big numbers, then cards: a project that needs a look, monthly collections, a budget ring, what is closest to slipping, the lead funnel and team workload, and this week’s due dates.', where: 'Dashboard (New look)' },
      { area: 'People', kind: 'improved', text: 'People is now a clean list in the New look: search, filter chips with counts, tick boxes (ticked rows can be exported to a spreadsheet) and a Compliance chip when insurance or a licence needs attention.', where: 'People (New look)' },
      { area: 'Finance', kind: 'improved', text: 'Reimbursement is a month board in the New look: projects on the left, the month’s spend with a calendar in the middle, and the chosen expense with its receipts and Approve button on the right.', where: 'Reimbursement → Reimbursables (New look)' },
    ],
  },
  {
    id: '2026-10-06',
    date: '2026-10-06',
    title: 'Search everything from the top bar',
    items: [
      { area: 'Everywhere', kind: 'new', text: 'The search box in the top bar now works. Click it or press Ctrl+K (⌘K on a Mac), type a few letters, and jump straight to a project, lead, person, employee, task or page. It only shows what your role can open. Use ↑ ↓ and Enter to pick, Esc to close.', where: 'Top bar → Search' },
      { area: 'CRM', kind: 'fixed', text: 'Picking “Other” in a lead’s drop-downs (pronouns, lead source and the rest) is recognised again, so the box to say what the other thing is appears.', where: 'CRM & Leads → lead details' },
    ],
  },
  {
    id: '2026-10-05',
    date: '2026-10-05',
    title: 'A new look, and the classic one is a click away',
    items: [
      { area: 'Everywhere', kind: 'new', text: 'New look across the app: a warm cream background with a soft yellow glow, rounded cream cards, black pill buttons and one yellow highlight colour. The menu is a floating card and the page you are on is a black pill. Headings and numbers use a lighter, larger font, pages ease in, and dashboard figures count up.' },
      { area: 'Everywhere', kind: 'new', text: 'Prefer the original green look? Switch between the New and Classic looks with the round button next to the notifications bell. Your choice is remembered on that computer or phone.', where: 'Top bar → theme button (sun / leaf)' },
      { area: 'Everywhere', kind: 'improved', text: 'The New look now covers every page: cards lift softly off the cream background, small capital labels become calm sentence-case labels, buttons and chips are pills, the chosen tab is a black pill, inputs and drop-downs are rounded, and pop-ups blur what is behind them.' },
    ],
  },
  {
    id: '2026-09-28',
    date: '2026-09-28',
    title: 'A home screen made for the superintendent',
    items: [
      { area: 'Manpower', kind: 'new', text: 'Superintendents can request workers by trade from their dashboard, follow each request through approval and allocation, and fix and resend a rejected one. HR is emailed when a request is waiting for approval.', where: 'Dashboard → Workforce requests · Manpower → Workforce Requests' },
      { area: 'Manpower', kind: 'improved', text: 'The daily log is now a sheet inside the app: one row per employee deployed to that project. Click an hours button to put someone on the log, pick the cost code, task and team on the same row, fill down for everyone, and move with ↑ ↓ / Enter.', where: 'Daily Log (field)' },
      { area: 'Dashboard', kind: 'new', text: 'Superintendents get their own dashboard: today’s daily log, their tasks (overdue first), requests they’ve raised for others, their daily log history and their timesheets — no company figures or charts.', where: 'Dashboard (Site Superintendent role)' },
      { area: 'Tasks', kind: 'new', text: 'A superintendent’s Tasks page shows only their own tasks and the requests they’ve raised, with “+ New request” to ask the office or a team member for something. They can update their own tasks.', where: 'Tasks (Site Superintendent role)' },
      { area: 'Settings', kind: 'improved', text: 'The Site Superintendent role no longer includes the Projects page or the Plan & File Room; its menu is Dashboard, My Timesheet, Daily Log (field) and Tasks.', where: 'User Access & Roles → Site Superintendent' },
    ],
  },
  {
    id: '2026-09-27',
    date: '2026-09-27',
    title: 'Superintendents: a short menu and the daily log',
    items: [
      { area: 'Everywhere', kind: 'fixed', text: 'Staff who aren’t administrators saw every page and “Admin” under their name, whatever their role. Each login now sees only its role’s pages, with the right role name.' },
      { area: 'Manpower', kind: 'improved', text: 'On an employee whose designation is Superintendent, the Login card starts on the Site Superintendent role, and flags a login that has a different role with a one-click “Switch to Site Superintendent”.', where: 'Manpower → an employee → Login' },
      { area: 'Settings', kind: 'improved', text: 'The Site Superintendent role now shows just Dashboard, My Timesheet, Daily Log (field), Projects, Tasks and the Plan & File Room — the rest is hidden. Change it any time under User Access & Roles.', where: 'User Access & Roles → Site Superintendent' },
      { area: 'Manpower', kind: 'improved', text: 'The phone daily log shows in the menu only for superintendents — the Site Superintendent role or an employee whose designation is Superintendent. Everyone else sees and approves daily logs in Manpower.', where: 'Daily Log (field) · Manpower → Daily Log' },
    ],
  },
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
