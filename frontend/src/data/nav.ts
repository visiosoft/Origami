// Single source of truth for the sidebar navigation. The Admin role permission
// matrix and the access `can()` checks derive their module list from this, so
// nav and permissions never drift.

export interface NavItem {
  label: string;
  route: string;
  icon: string;
  badge?: string;
  note?: string;
  /** What the module is for, shown when hovering the menu item. */
  desc?: string;
  /** Permission key when it differs from the route: a second menu entry for a module that already has one. */
  perm?: string;
  /** About the signed-in person themselves (their own timesheet): shown to every internal user, not a role permission. */
  personal?: boolean;
  /** Only for site superintendents -- not a role permission either. */
  superintendent?: boolean;
  /** Not in the menu (opened from another page) but still a module with its own permission. */
  hidden?: boolean;
}

export interface NavGroup {
  key: string;
  label: string;
  /** What the section as a whole covers, shown when hovering its heading. */
  hint?: string;
  items: NavItem[];
}

/** The permission key a menu item is checked against. */
export const permOf = (it: Pick<NavItem, 'route' | 'perm'>) => it.perm || it.route;

export const NAV_GROUPS: NavGroup[] = [
  { key: 'main', label: 'Main', items: [
    { label: 'Dashboard', route: 'dashboard', icon: 'dash' },
    { label: 'Projects', route: 'projects', icon: 'folder', desc: 'All project cards: CRM, design, construction and closed' },
    { label: 'People', route: 'people', icon: 'people', desc: 'Internal executive, internal staff, clients, consultants, subs, authorities and vendors' },
    { label: 'All Files', route: 'allfiles', icon: 'files', desc: 'Every file in the business Google Drive. Limited access' },
  ] },
  { key: 'actions', label: 'Special Actions', hint: 'Your calendar and timesheets, and everything that needs action: meetings, FOR RECORD (observations, FYI, decisions), RFI, tasks, change orders and approvals', items: [
    { label: 'My Calendar', route: 'my-calendar', icon: 'cal', desc: 'Your calendar: meetings, due dates and Google Calendar' },
    { label: 'My Timesheets', route: 'my-timesheet', icon: 'clip', personal: true, desc: 'Your own hours, week by week' },
    { label: 'Meetings', route: 'meetings', icon: 'cal', desc: 'Manage, track and create meetings; generate the actions below from them' },
    { label: 'FOR RECORD', route: 'observations', icon: 'q', desc: 'Observations, FYIs and decisions on record; link them to tasks and change orders' },
    { label: 'RFI', route: 'rfis', icon: 'q', desc: 'Manage, track and create RFIs' },
    { label: 'Task', route: 'tasks', icon: 'check', desc: 'The task board and the Request Log: manage, track and create tasks' },
    { label: 'Change Orders', route: 'changeorders', icon: 'swap', desc: 'Manage, track and create change orders' },
    { label: 'Approvals', route: 'approvals', icon: 'check', personal: true, desc: 'Everything waiting on a decision: finance items, daily reports, timesheets and workforce requests' },
  ] },
  { key: 'crm', label: 'CRM', items: [
    { label: 'CRM & Leads', route: 'pipeline', icon: 'chart', desc: 'Lead and referral intake to initial contract' },
    { label: 'Holding & Refer Out', route: 'crm_holding', icon: 'swap', desc: 'Leads that are not active, and leads referred out' },
    { label: 'Feedback', route: 'feedback', icon: 'q', desc: 'Feedback from lead and referral intake to initial contract' },
    { label: 'Warranty', route: 'warranty', icon: 'shielda', desc: 'Construction, equipment and material warranties, and any required warranty work' },
  ] },
  { key: 'design', label: 'Design', items: [
    { label: 'Consultant Prequalifying & RFP', route: 'prequal', icon: 'shieldc', desc: 'Consultants: who is coming due for licences and insurance, RFPs sent and answered' },
    { label: 'Design', route: 'design', icon: 'pen', note: 'Board', desc: 'Design work, board view' },
  ] },
  { key: 'precon', label: 'Preconstruction', items: [
    { label: 'Estimating', route: 'estimating', icon: 'calc', desc: 'Estimating tools for design and/or build work that needs estimating' },
    { label: 'Selections & Specifications', route: 'selections', icon: 'list', desc: 'Our library, and one place to make selections, manage orders and track orders' },
    { label: 'Schedule', route: 'schedule', icon: 'cal', desc: 'All projects and their timelines' },
    { label: 'Plan & File Room', route: 'planroom', icon: 'files', desc: 'File management, tracking the latest files, and sending and managing RFPs' },
    { label: 'GC & Sub Prequalify & RFP', route: 'sub_prequal', icon: 'shieldc', desc: 'General contractors and subcontractors: prequalification and RFPs' },
  ] },
  { key: 'construction', label: 'Construction', items: [
    { label: 'Project Management', route: 'pm', icon: 'clip', note: 'Board', desc: 'Construction work, board view' },
    { label: 'QA/QC', route: 'quality', icon: 'shielda', desc: 'Inspections and checklists for quality assurance and quality control' },
    { label: 'Safety', route: 'safety', icon: 'shielda', desc: 'Safety inspections and checklists, toolbox meetings, incident reports' },
    { label: 'Schedule', route: 'schedule_con', perm: 'schedule', icon: 'cal', desc: 'All projects and their timelines' },
    { label: 'Equipment Management', route: 'equipment', icon: 'crew', desc: 'Equipment across projects: where it is, rentals, maintenance and cost' },
    { label: 'Procurement Management', route: 'procurement', icon: 'receipt', desc: 'Purchasing and deliveries for build: orders, lead times and receiving' },
    { label: 'Daily Report (field)', route: 'daily-log', icon: 'clip', superintendent: true, desc: 'Fill in today’s Daily Report for your site' },
    { label: 'Daily Reports', route: 'daily_reports', icon: 'clip', desc: 'Every site’s daily report, and the weekly report' },
    { label: 'Manpower & Resource (Build)', route: 'manpower_build', perm: 'manpower_con', icon: 'crew', desc: 'RFPs for several projects for build, equipment, timesheets for build, labor and resource projection, deliveries and daily reports' },
    { label: 'Progress Photos', route: 'progress_photos', icon: 'files', desc: 'Site progress photos by project and date' },
  ] },
  { key: 'financial', label: 'Financial & Resource', items: [
    { label: 'Business', route: 'fin_business', icon: 'bank', desc: 'Rolls up all projects, design and build' },
    { label: 'Project Invoicing', route: 'fin_project', icon: 'dollar', desc: 'Payables and receivables, including reimbursables and change orders: client, internal staff, subcontractors, consultants, vendors' },
    { label: 'Manpower & Resource Management', route: 'manpower_con', icon: 'crew', desc: 'Plan and run the week(s) for subs, labor and admin, and manage timesheets' },
    { label: 'Accounting', route: 'accounting', icon: 'calc', desc: 'For the accountant and bookkeeper' },
    { label: 'Affiliates', route: 'affiliates', icon: 'people', desc: 'Affiliates and their rates, contracted projects, and amounts due, paid and overdue' },
    // Opened from Project Invoicing and Approvals / from Manpower; kept as their own permissions.
    { label: 'Reimbursements', route: 'reimbursement', icon: 'receipt', hidden: true },
    { label: 'Resources', route: 'fin_resources', icon: 'crew', hidden: true, desc: 'Resource costs, rate cards and utilization' },
  ] },
  { key: 'insight', label: 'Insight & Documents', items: [
    { label: 'Reports & Analytics', route: 'reports', icon: 'chart' },
    { label: 'Document & Template Library', route: 'library', icon: 'book' },
  ] },
  { key: 'admin', label: 'Admin', items: [
    { label: 'User Access & Roles', route: 'users', icon: 'key', desc: 'Users, roles, and notification type and frequency preferences' },
    { label: 'Settings', route: 'settings', icon: 'key' },
    { label: 'Help & Support', route: 'help', icon: 'life' },
  ] },
];

export interface ModuleRef {
  key: string;   // = route
  label: string;
  group: string; // nav group label
}

// Flat, ordered list of every module (used by the role permission matrix).
// A second entry for a module (perm set) shares that module's permission, so it is not listed again.
export const MODULES: ModuleRef[] = NAV_GROUPS.flatMap((g) =>
  g.items.filter((it) => !it.personal && !it.superintendent && !it.perm).map((it) => ({ key: it.route, label: it.label, group: g.label })),
);

/** Route -> permission key, for the route guard. */
export const PERM_BY_ROUTE: Record<string, string> = {
  ...Object.fromEntries(NAV_GROUPS.flatMap((g) => g.items.map((it) => [it.route, permOf(it)]))),
  // Pages without their own menu entry: the Request Log opens inside Tasks; the phase lists of special actions.
  requests: 'tasks',
  actions_design: 'design',
  actions_con: 'pm',
};

/** Routes every internal user may open regardless of role. */
export const PERSONAL_ROUTES = new Set(NAV_GROUPS.flatMap((g) => g.items.filter((it) => it.personal).map((it) => it.route)));
