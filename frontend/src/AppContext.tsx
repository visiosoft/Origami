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
  setCurrentUserId: (id: string) => void;
  refreshAccess: () => void;
  can: (moduleKey: string, action?: Action) => boolean;
  // Session
  authUser: User | null;
  authReady: boolean;
  signIn: (token: string, user?: User) => void;
  signOut: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>('internal');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [currentUserId, setCurrentUserIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(CURRENT_USER_KEY); } catch { return null; }
  });
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

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
  // server confirms it still resolves to a real user.
  useEffect(() => {
    if (!session.get()) { setAuthReady(true); return; }
    api.auth.me()
      .then((u) => { setAuthUser(u as User); setCurrentUserIdState((u as User).id); })
      .catch(() => { session.clear(); setAuthUser(null); })
      .finally(() => setAuthReady(true));
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
    session.clear();
    setAuthUser(null);
    try { localStorage.removeItem(CURRENT_USER_KEY); } catch { /* ignore */ }
  }, []);

  const setCurrentUserId = useCallback((id: string) => {
    setCurrentUserIdState(id);
    try { localStorage.setItem(CURRENT_USER_KEY, id); } catch { /* ignore */ }
  }, []);

  // Resolve the acting user: the signed-in account, else the stored id,
  // else the first admin, else the first user.
  const currentUser =
    (authUser && users.find((u) => u.id === authUser.id)) ||
    authUser ||
    users.find((u) => u.id === currentUserId) ||
    users.find((u) => u.roleKey === 'admin') ||
    users[0];
  const currentRole = roles.find((r) => r.key === currentUser?.roleKey);
  const tier: Tier = currentUser?.tier ?? 'internal';

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
        setCurrentUserId, refreshAccess, can,
        authUser, authReady, signIn, signOut,
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
