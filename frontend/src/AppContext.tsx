import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type ViewMode = 'internal' | 'client' | 'consultant';

interface AppContextValue {
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  toast: (msg: string) => void;
  toastMsg: string | null;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>('internal');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 2600);
  }, []);

  return (
    <AppContext.Provider value={{ viewMode, setViewMode, toast, toastMsg }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
