import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { api, session } from './api';
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
    Promise.all([api.users.list(), api.roles.list()])
      .then(([u, r]) => {
        if (Array.isArray(u)) setUsers(u as User[]);
        if (Array.isArray(r)) setRoles(r as Role[]);
      })
      .catch(() => { })
      .finally(() => setLoadingAccess(false));
  }, []);

  useEffect(() => { refreshAccess(); }, [refreshAccess]);

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
    refreshAccess();
  }, [refreshAccess]);

  const signOut = useCallback(() => {
    // Clear the cookie too, or the browser would still be signed in for the
    // file and image URLs that authenticate with it.
    api.auth.logout().catch(() => { /* signing out locally matters more */ });
    session.clear();
    setAuthUser(null);
    try { localStorage.removeItem(CURRENT_USER_KEY); } catch { /* ignore */ }
  }, []);

  // The acting user is the signed-in account, full stop. Impersonating another
  // user was a stand-in from before real authentication existed; leaving it in
  // would let anyone act as an administrator.
  const currentUser = (authUser && users.find((u) => u.id === authUser.id)) || authUser || undefined;
  const tier: Tier = currentUser?.tier ?? 'internal';
  // Outside accounts can't read the role list (admin only), so their own role's
  // permissions come with who-am-I; staff keep today's behaviour.
  const currentRole = roles.find((r) => r.key === currentUser?.roleKey)
    || (authUser?.rolePermissions && tier !== 'internal'
      ? { key: authUser.roleKey, name: authUser.roleKey, tier, order: 0, isSystem: true, permissions: authUser.rolePermissions }
      : undefined);

  const can = useCallback(
    (moduleKey: string, action: Action = 'view'): boolean => {
      // Before access data has loaded, don't hide anything (avoids a nav flash).
      if (loadingAccess || !currentRole) return true;
      return canFor(currentRole, moduleKey, action);
    },
    [loadingAccess, currentRole],
  );

  return (
    <AppContext.Provider
      value={{
        viewMode, setViewMode, toast, toastMsg,
        users, roles, currentUser, currentRole, tier, loadingAccess,
        refreshAccess, can,
        authUser, authReady, reconnecting, signIn, signOut,
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
