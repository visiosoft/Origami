import { useEffect, useState } from 'react';
import { api } from '../api';
import { DEFAULT_PRIORITY_DEFS, type PriorityDef } from './priority';

// One copy for every priority picker on the page, loaded once.
let current: PriorityDef[] = DEFAULT_PRIORITY_DEFS;
let pending: Promise<PriorityDef[]> | null = null;
const listeners = new Set<(l: PriorityDef[]) => void>();
const publish = (l: PriorityDef[]) => { current = l; listeners.forEach((f) => f(l)); };

export function loadPriorityDefs(force = false): Promise<PriorityDef[]> {
  if (!pending || force) {
    pending = api.tasks.priorities()
      .then((l) => { const list = Array.isArray(l) && l.length === 4 ? l : DEFAULT_PRIORITY_DEFS; publish(list); return list; })
      .catch(() => current);
  }
  return pending;
}
/** After Settings saves new wording. */
export const setPriorityDefs = (l: PriorityDef[]) => { pending = Promise.resolve(l); publish(l); };

/** What each priority means, as set in Settings (the defaults until they load). */
export function usePriorityDefs() {
  const [list, setList] = useState<PriorityDef[]>(current);
  useEffect(() => {
    listeners.add(setList);
    void loadPriorityDefs();
    return () => { listeners.delete(setList); };
  }, []);
  return list;
}
