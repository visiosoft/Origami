import { useEffect, useState } from 'react';
import { api } from '../api';

/** What a task can be linked to: projects, and open leads (work starts before a contract is signed). */
export interface LinkTargets { projects: { id: number; name: string; stage?: string }[]; leads: { id: string; name: string; stage?: string }[] }
const EMPTY: LinkTargets = { projects: [], leads: [] };
let cached: Promise<LinkTargets> | null = null;

export function loadLinkTargets(fresh = false): Promise<LinkTargets> {
  if (!cached || fresh) cached = api.tasks.linkTargets().then((r) => ({ projects: r?.projects || [], leads: r?.leads || [] })).catch(() => { cached = null; return EMPTY; });
  return cached;
}

export function useLinkTargets(): LinkTargets {
  const [t, setT] = useState<LinkTargets>(EMPTY);
  useEffect(() => { let live = true; loadLinkTargets().then((r) => { if (live) setT(r); }); return () => { live = false; }; }, []);
  return t;
}

/** "Lead · Ruiz Bakery" -- how a lead link reads next to a project name. */
export const leadLabel = (name?: string | null) => (name ? `Lead · ${name}` : '');
