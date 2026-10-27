import { useEffect, useState } from 'react';
import { api } from '../api';

/**
 * Task numbers carry their project's code (Oct 27 backlog): NARV-T-2026-0007,
 * GEN-T-2026-0003 for tasks on no project. Codes come from the server
 * (projects' `taskCode`, set by hand or made from the name).
 */
export const GENERAL_CODE = 'GEN';
export const taskNo = (serial?: string | null, code?: string | null) => (serial ? `${code || GENERAL_CODE}-${serial}` : '');

interface Codes { byId: Map<number, string>; byName: Map<string, string> }
let current: Codes = { byId: new Map(), byName: new Map() };
let pending: Promise<Codes> | null = null;
const listeners = new Set<(c: Codes) => void>();

export function loadProjectCodes(force = false): Promise<Codes> {
  if (!pending || force) {
    pending = api.projects.list().then((rows: any) => {
      const list = Array.isArray(rows) ? rows : [];
      current = {
        byId: new Map(list.filter((p: any) => p.taskCode).map((p: any) => [Number(p.id), String(p.taskCode)])),
        byName: new Map(list.filter((p: any) => p.taskCode).map((p: any) => [String(p.name), String(p.taskCode)])),
      };
      listeners.forEach((f) => f(current));
      return current;
    }).catch(() => current);
  }
  return pending;
}

/** The number to show for a task: by its project id (board) or project name (Request Log). */
export function useTaskNumber() {
  const [codes, setCodes] = useState<Codes>(current);
  useEffect(() => {
    listeners.add(setCodes);
    void loadProjectCodes();
    return () => { listeners.delete(setCodes); };
  }, []);
  return (t: { serial?: string | null; projectId?: number | null; project?: string | null }) => {
    if (!t.serial) return '';
    const code = t.projectId != null ? codes.byId.get(Number(t.projectId)) : t.project ? codes.byName.get(t.project) : GENERAL_CODE;
    // A project whose code hasn't loaded yet shows the plain number rather than a wrong prefix.
    return code ? taskNo(t.serial, code) : t.projectId == null && !t.project ? taskNo(t.serial, GENERAL_CODE) : t.serial;
  };
}
