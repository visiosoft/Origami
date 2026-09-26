import { useEffect, useState } from 'react';
import { api } from '../api';

/** Manpower picklists (Manpower -> Setup -> Picklists): what the employee form's dropdowns offer. */
export interface Picklists { departments: string[]; designations: string[]; skills: string[] }

const EMPTY: Picklists = { departments: [], designations: [], skills: [] };
let current: Picklists = EMPTY;
let pending: Promise<Picklists> | null = null;
const listeners = new Set<(p: Picklists) => void>();
const publish = (p: Picklists) => { current = p; listeners.forEach((f) => f(p)); };

export function loadPicklists(force = false): Promise<Picklists> {
  if (!pending || force) pending = api.picklists.get().then((p) => { publish(p as Picklists); return p as Picklists; }).catch(() => current);
  return pending;
}
export const setPicklists = (p: Picklists) => { pending = Promise.resolve(p); publish(p); };

/** The lists, loaded once for the whole app. */
export function usePicklists() {
  const [p, setP] = useState<Picklists>(current);
  useEffect(() => { listeners.add(setP); void loadPicklists(); return () => { listeners.delete(setP); }; }, []);
  return p;
}
