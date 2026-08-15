// Single source of truth for the sidebar navigation. The Admin role permission
// matrix and the access `can()` checks derive their module list from this, so
// nav and permissions never drift.

export interface NavItem {
  label: string;
  route: string;
  icon: string;
  badge?: string;
  note?: string;
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { key: 'main', label: 'Main', items: [{ label: 'Dashboard', route: 'dashboard', icon: 'dash' }] },
  {
    key: 'crm',
    label: 'Projects & CRM',
    items: [
      { label: 'CRM & Leads', route: 'pipeline', icon: 'chart', badge: '9' },
      { label: 'Projects', route: 'projects', icon: 'folder' },
      { label: 'People', route: 'people', icon: 'people' },
      { label: 'Tasks', route: 'tasks', icon: 'check', badge: '32' },
    ],
  },
  {
    key: 'precon',
    label: 'Design & Preconstruction',
    items: [
      { label: 'Design', route: 'design', icon: 'pen', note: 'Board' },
      { label: 'Selections & Specifications', route: 'selections', icon: 'list' },
      { label: 'Estimating', route: 'estimating', icon: 'calc' },
      { label: 'Plan & File Room', route: 'planroom', icon: 'files' },
      { label: 'Manpower & Resources', route: 'manpower_pre', icon: 'crew' },
      { label: 'Consultant & Sub Prequalifying', route: 'prequal', icon: 'shieldc' },
    ],
  },
  {
    key: 'construction',
    label: 'Construction',
    items: [
      { label: 'Project Management', route: 'pm', icon: 'clip', note: 'Board' },
      { label: 'Quality & Safety', route: 'quality', icon: 'shielda' },
      { label: 'Schedule', route: 'schedule', icon: 'cal' },
      { label: 'RFIs', route: 'rfis', icon: 'q' },
      { label: 'Change Orders', route: 'changeorders', icon: 'swap' },
      { label: 'Reimbursement', route: 'reimbursement', icon: 'receipt' },
      { label: 'Manpower & Resources', route: 'manpower_con', icon: 'crew' },
    ],
  },
  {
    key: 'financial',
    label: 'Financial',
    items: [
      { label: 'Business', route: 'fin_business', icon: 'bank' },
      { label: 'Project', route: 'fin_project', icon: 'dollar' },
      { label: 'Resources', route: 'fin_resources', icon: 'db' },
    ],
  },
  {
    key: 'insight',
    label: 'Insight & Documents',
    items: [
      { label: 'Reports & Analytics', route: 'reports', icon: 'chart' },
      { label: 'Document & Template Library', route: 'library', icon: 'book' },
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    items: [
      { label: 'Settings', route: 'settings', icon: 'key' },
      { label: 'User Access & Roles', route: 'users', icon: 'key' },
      { label: 'Help & Support', route: 'help', icon: 'life' },
    ],
  },
];

export interface ModuleRef {
  key: string;   // = route
  label: string;
  group: string; // nav group label
}

// Flat, ordered list of every module (used by the role permission matrix).
export const MODULES: ModuleRef[] = NAV_GROUPS.flatMap((g) =>
  g.items.map((it) => ({ key: it.route, label: it.label, group: g.label })),
);
