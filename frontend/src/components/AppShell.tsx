import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Icon } from '../icons';
import { Logo, LogoMark } from './Logo';
import { Notifications } from './Notifications';
import { useApp, type ViewMode } from '../AppContext';
import { NAV_GROUPS } from '../data/nav';
import './AppShell.css';

const VIEW_MODES: ViewMode[] = ['internal', 'client', 'consultant'];

/**
 * TEMPORARY — modules considered ready to test, shown green in the sidebar.
 * Remove this set and the `ready` class below once everything has landed.
 */
const READY_FOR_TESTING = new Set(['pipeline', 'projects', 'people', 'tasks']);

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { viewMode, setViewMode, toastMsg, can, loadingAccess, currentUser, currentRole, tier, signOut } = useApp();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const slug = location.pathname.slice(1) || 'dashboard';

  // Route guard: if the current user's role can't view this module, bounce to dashboard.
  useEffect(() => {
    if (loadingAccess) return;
    if (slug === 'dashboard' || slug === 'help' || slug === 'login') return;
    if (!can(slug, 'view')) navigate('/dashboard', { replace: true });
  }, [slug, loadingAccess, can, navigate]);

  // Only show nav items the current role can view; drop groups left empty.
  const visibleGroups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((it) => can(it.route, 'view')) }))
    .filter((g) => g.items.length > 0);

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

  const userName = currentUser?.name ?? 'Edward M.';
  const userRoleName = currentRole?.name ?? 'Admin';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-full"><Logo markSize={30} /></div>
          <div className="brand-mark-only"><LogoMark size={28} /></div>
        </div>

        <nav className="nav om-nav-scroll">
          {visibleGroups.map((group) => (
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
                      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${READY_FOR_TESTING.has(item.route) ? 'ready' : ''}`}
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

        <div className="user-chip" style={{ position: 'relative' }}>
          <div className="user-avatar">{initialsOf(userName)}</div>
          <div className="user-info">
            <span className="user-name">{userName}</span>
            <span className="user-role">{userRoleName}</span>
          </div>
          <div className="user-signout" title="Sign out" onClick={() => { signOut(); navigate('/login', { replace: true }); }}>
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

          {tier === 'internal' && (
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
          )}

          <div className="search-box">
            <Icon name="search" size={16} stroke="#7E9B93" strokeWidth={2} />
            <span className="search-placeholder">Search...</span>
            <span className="search-kbd">⌘K</span>
          </div>

          <Notifications />
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
