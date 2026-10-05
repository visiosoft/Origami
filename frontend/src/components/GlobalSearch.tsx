import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { Icon } from '../icons';
import { taskHeadline } from '../data/tasks';
import { buildIndex, searchIndex, type SearchItem, type SearchKind } from './globalSearchIndex';
import './GlobalSearch.css';

export interface SearchPage { label: string; route: string; icon: string }

const KIND_LABEL: Record<SearchKind, string> = {
  page: 'Pages', project: 'Projects', deal: 'Leads', person: 'People', employee: 'Employees', task: 'Tasks',
};
const KIND_ICON: Record<SearchKind, string> = {
  page: 'dash', project: 'folder', deal: 'crm', person: 'people', employee: 'crew', task: 'check',
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * The top-bar search: click it or press ⌘K / Ctrl+K. Searches the records the
 * signed-in user can open (pages, projects, leads, people, employees and
 * tasks) and jumps straight to the one picked.
 */
export function GlobalSearch({ pages }: { pages: SearchPage[] }) {
  const navigate = useNavigate();
  const { can } = useApp();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch fresh records each time the search opens; whatever loaded last stays
  // searchable meanwhile, and a source that fails is simply left out.
  const load = useCallback(async () => {
    setLoading(true);
    const get = <T,>(allowed: boolean, fn: () => Promise<unknown>) =>
      allowed ? fn().then((r) => (Array.isArray(r) ? (r as T[]) : [])).catch(() => [] as T[]) : Promise.resolve([] as T[]);
    const [projects, deals, people, employees, projectTasks, logTasks] = await Promise.all([
      get<any>(can('projects', 'view'), () => api.projects.list()),
      get<any>(can('pipeline', 'view'), () => api.pipeline.list()),
      get<any>(can('people', 'view'), () => api.people.list()),
      get<any>(can('manpower_con', 'view'), () => api.employees.list()),
      get<any>(can('tasks', 'view'), () => api.projectTasks.list()),
      get<any>(can('tasks', 'view'), () => api.tasks.list()),
    ]);
    setItems(buildIndex({ pages, projects, deals, people, employees, projectTasks, logTasks, headline: (t) => taskHeadline(t).title }));
    setLoading(false);
  }, [can, pages]);

  const show = useCallback(() => { setOpen(true); setQuery(''); setActive(0); load(); }, [load]);
  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open ? hide() : show(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, show, hide]);

  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 10); }, [open]);

  const results = useMemo(() => searchIndex(items.length ? items : buildIndex({ pages }), query), [items, pages, query]);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (it: SearchItem | undefined) => {
    if (!it) return;
    hide();
    navigate(it.to);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); hide(); }
  };

  let lastKind: SearchKind | null = null;

  return (
    <>
      <button type="button" className="search-box" onClick={show} aria-label="Search" title={`Search (${isMac ? '⌘' : 'Ctrl+'}K)`}>
        <Icon name="search" size={16} stroke="var(--muted)" strokeWidth={2} />
        <span className="search-placeholder">Search...</span>
        <span className="search-kbd">{isMac ? '⌘K' : 'Ctrl K'}</span>
      </button>

      {open && (
        <div className="gsearch-overlay" onMouseDown={hide}>
          <div className="gsearch" role="dialog" aria-label="Search" onMouseDown={(e) => e.stopPropagation()}>
            <div className="gsearch-input-row">
              <Icon name="search" size={18} stroke="var(--muted)" strokeWidth={2} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Search projects, leads, people, tasks…"
                aria-label="Search"
                className="gsearch-input"
              />
              {loading && <span className="gsearch-spin" aria-label="Loading" />}
              <button type="button" className="gsearch-esc" onClick={hide}>Esc</button>
            </div>
            <div className="gsearch-list" ref={listRef}>
              {results.length === 0 && (
                <div className="gsearch-empty">{query.trim() ? `Nothing matches “${query.trim()}”.` : loading ? 'Loading…' : 'Start typing to search.'}</div>
              )}
              {results.map((it, i) => {
                const head = it.kind !== lastKind ? KIND_LABEL[it.kind] : null;
                lastKind = it.kind;
                return (
                  <div key={it.kind + ':' + it.id}>
                    {head && <div className="gsearch-group">{head}</div>}
                    <div
                      data-idx={i}
                      className={'gsearch-item' + (i === active ? ' is-active' : '')}
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(it)}
                    >
                      <span className="gsearch-icon"><Icon name={it.icon || KIND_ICON[it.kind]} size={15} strokeWidth={1.9} /></span>
                      <span className="gsearch-text">
                        <span className="gsearch-title">{it.title}</span>
                        {it.sub && <span className="gsearch-sub">{it.sub}</span>}
                      </span>
                      {it.badge && <span className="gsearch-badge">{it.badge}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="gsearch-foot">
              <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
              <span><kbd>Enter</kbd> open</span>
              <span><kbd>Esc</kbd> close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
