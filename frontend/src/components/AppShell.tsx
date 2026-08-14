import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Icon } from '../icons';
import { Logo, LogoMark } from './Logo';
import { useApp, type ViewMode } from '../AppContext';
import './AppShell.css';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  badge?: string;
  note?: string;
}

interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
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

const VIEW_MODES: ViewMode[] = ['internal', 'client', 'consultant'];

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { viewMode, setViewMode, toastMsg } = useApp();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const slug = location.pathname.slice(1) || 'dashboard';

  const activeItem = (() => {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (item.route === slug) return item;
      }
    }
    return null;
  })();

  const pageTitle = activeItem?.label ?? 'Module';
  const pageBadge = activeItem?.badge;

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: prev[key] === false ? true : false }));

  const isOpen = (key: string) => openGroups[key] !== false;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-full"><Logo markSize={30} /></div>
          <div className="brand-mark-only"><LogoMark size={28} /></div>
        </div>

        <nav className="nav om-nav-scroll">
          {NAV_GROUPS.map((group) => (
            <div key={group.key} className="nav-group">
              <div className="nav-group-header" onClick={() => toggleGroup(group.key)}>
                <span className="nav-group-label">{group.label}</span>
                <span
                  className="nav-group-chevron"
                  style={{ transform: isOpen(group.key) ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                >
                  ▼
                </span>
              </div>
              {isOpen(group.key) && (
                <div className="nav-group-items">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.route}
                      to={`/${item.route}`}
                      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                      <Icon name={item.icon} size={16} style={{ flexShrink: 0, opacity: 0.8 }} />
                      <span className="nav-item-label">{item.label}</span>
                      {item.note && <span className="nav-item-note">{item.note}</span>}
                      {item.badge && <span className="nav-item-badge">{item.badge}</span>}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="user-chip">
          <div className="user-avatar">EM</div>
          <div className="user-info">
            <span className="user-name">Edward M.</span>
            <span className="user-role">Admin</span>
          </div>
          <div className="user-signout" title="Sign out" onClick={() => navigate('/login')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            {slug !== 'dashboard' && (
              <div className="topbar-back" onClick={() => navigate(-1)} title="Back">
                <Icon name="back" size={18} stroke="#43514D" strokeWidth={2} />
              </div>
            )}
            <h1 className="page-title">{pageTitle}</h1>
            {pageBadge && <span className="page-badge">{pageBadge}</span>}
          </div>

          <div className="view-switch">
            <span className="view-switch-label">View as:</span>
            <div className="view-switch-track">
              {VIEW_MODES.map((m) => (
                <div
                  key={m}
                  className={`view-switch-pill ${viewMode === m ? 'active' : ''}`}
                  onClick={() => setViewMode(m)}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </div>
              ))}
            </div>
          </div>

          <div className="search-box">
            <Icon name="search" size={16} stroke="#7E9B93" strokeWidth={2} />
            <span className="search-placeholder">Search...</span>
            <span className="search-kbd">⌘K</span>
          </div>

          <div className="topbar-bell" title="Notifications">
            <Icon name="bell" size={18} stroke="#43514D" strokeWidth={2} />
            <span className="topbar-bell-dot" />
          </div>
        </header>

        <main className="content">
          <div className="content-inner">
            <Outlet />
          </div>
        </main>
      </div>

      {toastMsg && (
        <div className="success-toast">
          <div className="success-toast-check">
            <Icon name="check" size={13} stroke="white" strokeWidth={3} />
          </div>
          {toastMsg}
        </div>
      )}
    </div>
  );
}
