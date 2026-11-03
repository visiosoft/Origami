import { useEffect, useState } from 'react';
import { api } from '../api';

/** A tag in the shared bank (Oct 30 sync). Standard ones decide who sees an item. */
export interface TagInfo { key: string; name: string; standard: boolean; uses: number }

let cache: { at: number; list: TagInfo[] } | null = null;
let inflight: Promise<TagInfo[]> | null = null;
const listeners = new Set<(l: TagInfo[]) => void>();

/** The bank, shared by every picker on the page; refetched after a minute or when asked. */
export function loadTagBank(force = false): Promise<TagInfo[]> {
  if (!force && cache && Date.now() - cache.at < 60_000) return Promise.resolve(cache.list);
  if (!inflight) {
    inflight = api.tags.list()
      .then((list) => { cache = { at: Date.now(), list: Array.isArray(list) ? list : [] }; listeners.forEach((f) => f(cache!.list)); return cache.list; })
      .catch(() => cache?.list || [])
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function useTagBank(): TagInfo[] {
  const [list, setList] = useState<TagInfo[]>(cache?.list || []);
  useEffect(() => {
    listeners.add(setList);
    void loadTagBank();
    return () => { listeners.delete(setList); };
  }, []);
  return list;
}

/** The custom tags to offer while typing: matching the text first, unused by this item, at most `max`. */
export function tagSuggestions(bank: string[], have: string[], draft: string, max = 8): string[] {
  const used = new Set(have.map((h) => h.toLowerCase()));
  const q = draft.trim().toLowerCase();
  const seen = new Set<string>();
  const pool = bank.filter((b) => { const k = b.toLowerCase(); if (used.has(k) || seen.has(k)) return false; seen.add(k); return true; });
  const hits = q ? pool.filter((b) => b.toLowerCase().includes(q)).sort((a, b) => Number(!b.toLowerCase().startsWith(q)) - Number(!a.toLowerCase().startsWith(q))) : pool;
  return hits.slice(0, max);
}
