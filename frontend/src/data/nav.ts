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
  { key: 'actions', label: 'Special Actions', hint: 'Manages all: meetings, observations, FYI, RFI, task and change orders', items: [
    { label: 'Meetings', route: 'meetings', icon: 'cal', desc: 'Manage, track and create meetings; generate the actions below from them' },
    { label: 'Observations & FYI', route: 'observations', icon: 'q', desc: 'Manage, track and create observations and FYIs' },
    { label: 'RFI', route: 'rfis', icon: 'q', desc: 'Manage, track and create RFIs' },
    { label: 'Task', route: 'requests', perm: 'tasks', icon: 'check', desc: 'Manage, track and create tasks raised in meetings (Request Log)' },
    { label: 'Change Orders', route: 'changeorders', icon: 'swap', desc: 'Manage, track and create change orders' },
  ] },
  { key: 'mine', label: 'My Stuff', items: [
    { label: 'Calendar', route: 'my-calendar', icon: 'cal' },
    { label: 'Timesheets', route: 'my-timesheet', icon: 'clip', personal: true },
    { label: 'Tasks', route: 'tasks', icon: 'check' },
    { label: 'Daily Log (field)', route: 'daily-log', icon: 'clip', superintendent: true },
  ] },
  { key: 'crm', label: 'CRM', items: [
    { label: 'CRM & Leads', route: 'pipeline', icon: 'chart', desc: 'Lead and referral intake to initial contract' },
    { label: 'Holding & Refer Out', route: 'crm_holding', icon: 'swap', desc: 'Leads that are not active, and leads referred out' },
    { label: 'Warranty', route: 'warranty', icon: 'shielda', desc: 'Construction, equipment and material warranties, and any required warranty work' },
  ] },
  { key: 'design', label: 'Design & Preconstruction', items: [
    { label: 'Design', route: 'design', icon: 'pen', note: 'Board', desc: 'Design work, board view' },
    { label: 'Selections & Specifications', route: 'selections', icon: 'list', desc: 'Our library, and one place to make selections, manage orders and track orders' },
    { label: 'Estimating', route: 'estimating', icon: 'calc', desc: 'Estimating tools for design and/or build work that needs estimating' },
    { label: 'Plan & File Room', route: 'planroom', icon: 'files', desc: 'File management, tracking the latest files, and sending and managing RFPs' },
    { label: 'Manpower & Resource Management', route: 'manpower_pre', perm: 'manpower_con', icon: 'crew', desc: 'RFPs for several projects for design, and timesheets for design' },
    { label: 'Consultant & Subcontractor Prequalifying', route: 'prequal', icon: 'shieldc', desc: 'Who is coming due for licences, insurance and the rest' },
    { label: 'Special Actions', route: 'actions_design', perm: 'design', icon: 'q', desc: 'Design: meetings, observations, FYI, RFI, task and change orders' },
  ] },
  { key: 'construction', label: 'Construction', items: [
    { label: 'Project Management', route: 'pm', icon: 'clip', note: 'Board', desc: 'Construction work, board view' },
    { label: 'Quality & Safety', route: 'quality', icon: 'shielda', desc: 'Quality and safety inspections and checklists, toolbox meetings, incident reports' },
    { label: 'Schedule', route: 'schedule', icon: 'cal', desc: 'All projects and their timelines' },
    { label: 'Manpower & Resource Management', route: 'manpower_con', icon: 'crew', desc: 'RFPs for build, equipment, timesheets, labor and resource projection, deliveries and daily reports' },
    { label: 'Daily Reports', route: 'daily_reports', icon: 'clip', desc: 'Every site’s daily log: crew, hours, cost codes and notes' },
    { label: 'Special Actions', route: 'actions_con', perm: 'pm', icon: 'q', desc: 'Construction: meetings, observations, FYI, RFI, task and change orders' },
  ] },
  { key: 'financial', label: 'Financial', items: [
    { label: 'Business', route: 'fin_business', icon: 'bank', desc: 'Rolls up all projects, design and build' },
    { label: 'Project', route: 'fin_project', icon: 'dollar', desc: 'Project finance: client, internal staff, subcontractors, consultants, vendors' },
    { label: 'Reimbursements', route: 'reimbursement', icon: 'receipt' },
    { label: 'Resources', route: 'fin_resources', icon: 'crew', desc: 'Resource costs, rate cards and utilization' },
    { label: 'Affiliates', route: 'affiliates', icon: 'people', desc: 'Affiliates and their rates, contracted projects, and amounts due, paid and overdue' },
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
export const PERM_BY_ROUTE: Record<string, string> = Object.fromEntries(NAV_GROUPS.flatMap((g) => g.items.map((it) => [it.route, permOf(it)])));

/** Routes every internal user may open regardless of role. */
export const PERSONAL_ROUTES = new Set(NAV_GROUPS.flatMap((g) => g.items.filter((it) => it.personal).map((it) => it.route)));
