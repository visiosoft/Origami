import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { api, session, tokenExpiry, SESSION_EXPIRED_EVENT, SESSION_RESTORED_EVENT } from './api';
import { can as canFor, type User, type Role, type Tier, type Action } from './data/users';

export type ViewMode = 'internal' | 'client' | 'consultant';

const CURRENT_USER_KEY = 'origami.currentUserId';

interface AppContextValue {
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  toast: (msg: string) => void;
  toastMsg: string | null;
  // Users & access
  users: User[];
  roles: Role[];
  currentUser: User | undefined;
  currentRole: Role | undefined;
  tier: Tier;
  loadingAccess: boolean;
  refreshAccess: () => void;
  can: (moduleKey: string, action?: Action) => boolean;
  // Session
  authUser: User | null;
  authReady: boolean;
  /** True while the server can't be reached to confirm the session (e.g. it's restarting). */
  reconnecting: boolean;
  signIn: (token: string, user?: User) => void;
  signOut: () => void;
  /** True when the session ran out mid-work: the app asks the person to sign in again in place. */
  sessionExpired: boolean;
  /** Back in after an expiry: keeps the page, and unsaved work is sent. */
  restoreSession: (token: string, user?: User) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>('internal');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [, setCurrentUserIdState] = useState<string | null>(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const refreshAccess = useCallback(() => {
    // The full user list is admin-only; everyone else gets the staff directory,
    // so assignee and collaborator pickers aren't empty for non-admins.
    Promise.all([
      api.users.list().catch(() => api.users.directory().catch(() => null)),
      api.roles.list().catch(() => null),
    ])
      .then(([u, r]) => {
        if (Array.isArray(u)) setUsers(u as User[]);
        if (Array.isArray(r)) setRoles(r as Role[]);
      })
      .catch(() => { })
      .finally(() => setLoadingAccess(false));
  }, []);


  // Restore the session on load: the stored token is only trusted after the
  // server confirms it still resolves to a real user. Only a real "not signed
  // in" (401) signs you out -- if the server is restarting (a deploy, a network
  // blip) we keep the session and keep trying, instead of dropping you on the
  // log-in screen and losing what you were doing.
  useEffect(() => {
    if (!session.get()) { setAuthReady(true); return; }
    let stopped = false;
    let timer: number | undefined;
    const attempt = (n: number) => {
      api.auth.me()
        .then((u) => { if (stopped) return; setAuthUser(u as User); setCurrentUserIdState((u as User).id); setReconnecting(false); setAuthReady(true); })
        .catch((e: any) => {
          if (stopped) return;
          if (e?.status === 401) { session.clear(); setAuthUser(null); setReconnecting(false); setAuthReady(true); return; }
          setReconnecting(true);
          timer = window.setTimeout(() => attempt(n + 1), Math.min(2000 * (n + 1), 10000));
        });
    };
    attempt(0);
    return () => { stopped = true; window.clearTimeout(timer); };
  }, []);

  // Load the user and role lists once we know who's signed in -- again after a
  // reconnect, so a first load during a server restart doesn't leave them empty.
  const authId = authUser?.id;
  useEffect(() => { if (authId) refreshAccess(); }, [authId, refreshAccess]);

  const signIn = useCallback((token: string, user?: User) => {
    session.set(token);
    setAuthReady(true);
    if (user) {
      setAuthUser(user);
      setCurrentUserIdState(user.id);
      try { localStorage.setItem(CURRENT_USER_KEY, user.id); } catch { /* ignore */ }
    }
    api.auth.me()
      .then((u) => { setAuthUser(u as User); setCurrentUserIdState((u as User).id); })
      .catch(() => { /* keep the optimistic user */ });
  }, []);

  // ---- Keeping a working session alive ----
  // Sessions last 12 hours. While someone is active, renew before it runs out, so
  // nobody is signed out halfway through an edit. A tab left idle still expires.
  const [sessionExpired, setSessionExpired] = useState(false);
  useEffect(() => {
    if (!authId) return;
    let lastActive = Date.now();
    const mark = () => { lastActive = Date.now(); };
    const keepAlive = () => {
      const exp = tokenExpiry(session.get());
      if (!exp) return;
      const left = exp * 1000 - Date.now();
      if (left <= 0 || left > 6 * 3600e3 || Date.now() - lastActive > 45 * 60e3) return;
      api.auth.refresh().then((r) => { if (r?.token) session.set(r.token); }).catch(() => { /* the next request will notice */ });
    };
    const onVisible = () => { if (document.visibilityState === 'visible') { mark(); keepAlive(); } };
    const evs = ['keydown', 'mousedown', 'touchstart'] as const;
    evs.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(keepAlive, 5 * 60e3);
    keepAlive();
    return () => {
      evs.forEach((e) => window.removeEventListener(e, mark));
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [authId]);

  // A request came back "not signed in": check it really is the session (not one
  // endpoint's own rule) before asking the person to sign in again.
  useEffect(() => {
    if (!authId) return;
    const onExpired = () => {
      api.auth.me().then(() => { /* still signed in */ }).catch((e: any) => { if (e?.status === 401) setSessionExpired(true); });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [authId]);

  const restoreSession = useCallback((token: string, user?: User) => {
    session.set(token);
    setSessionExpired(false);
    api.auth.me()
      .then((u) => {
        // Someone else signed in on this screen: start fresh rather than saving the old person's edits as them.
        if (authId && (u as User).id !== authId) { window.location.assign('/dashboard'); return; }
        setAuthUser(u as User);
        window.dispatchEvent(new Event(SESSION_RESTORED_EVENT));
      })
      .catch(() => { if (user) setAuthUser(user); window.dispatchEvent(new Event(SESSION_RESTORED_EVENT)); });
  }, [authId]);

  // Signed back in from the Google pop-up (another window): pick up its new token here.
  useEffect(() => {
    if (!sessionExpired) return;
    const onStorage = (e: StorageEvent) => { if (e.key === session.key && e.newValue) restoreSession(e.newValue); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [sessionExpired, restoreSession]);

  const signOut = useCallback(() => {
    // Clear the cookie too, or the browser would still be signed in for the
    // file and image URLs that authenticate with it.
    api.auth.logout().catch(() => { /* signing out locally matters more */ });
    session.clear();
    setSessionExpired(false);
    setAuthUser(null);
    try { localStorage.removeItem(CURRENT_USER_KEY); } catch { /* ignore */ }
  }, []);

  // The acting user is the signed-in account, full stop. Impersonating another
  // user was a stand-in from before real authentication existed; leaving it in
  // would let anyone act as an administrator.
  const currentUser = (authUser && users.find((u) => u.id === authUser.id)) || authUser || undefined;
  const tier: Tier = currentUser?.tier ?? 'internal';
  // Only administrators can read the role list, so everyone's own role (name
  // and permissions) comes with who-am-I. Without it a non-admin had no role
  // here, and the app fell back to showing every page.
  const currentRole = roles.find((r) => r.key === currentUser?.roleKey)
    || (authUser?.rolePermissions
      ? { key: authUser.roleKey, name: authUser.roleName || authUser.roleKey, tier, order: 0, isSystem: true, permissions: authUser.rolePermissions }
      : undefined);

  const can = useCallback(
    (moduleKey: string, action: Action = 'view'): boolean => {
      // Nothing is allowed until we know who's signed in. Your own role (from
      // who-am-I) decides even while the full role list is still loading -- this
      // used to allow everything while loading, so a refresh during a server
      // restart showed a superintendent every page in the menu.
      if (!authUser) return false;
      if (authUser.roleKey === 'admin') return true;
      if (!currentRole) return false;
      return canFor(currentRole, moduleKey, action);
    },
    [authUser, currentRole],
  );

  return (
    <AppContext.Provider
      value={{
        viewMode, setViewMode, toast, toastMsg,
        users, roles, currentUser, currentRole, tier, loadingAccess,
        refreshAccess, can,
        authUser, authReady, reconnecting, signIn, signOut, sessionExpired, restoreSession,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
