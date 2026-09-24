import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * Save and autosave, the same way on every editor.
 *
 * An editor keeps a local draft of the record. The hook compares it with what
 * the server last confirmed and, 3 seconds after typing stops, sends only the
 * fields that changed -- one request at a time, never one per keystroke.
 * Nothing is cached in the browser: every save goes straight to the server.
 * The Save button saves at once; closing the editor or leaving the page saves
 * whatever is still pending. A brand-new record is created by the first save
 * (once `enabled` says its required fields are there) and updated after that.
 */

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
export const AUTOSAVE_DELAY = 3000;

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The fields of `draft` that differ from `base`. */
export function changedFields<T extends Record<string, any>>(draft: T, base: T, fields?: (keyof T)[]): Partial<T> {
  const keys = (fields || (Object.keys(draft) as (keyof T)[]));
  const out: Partial<T> = {};
  for (const k of keys) if (!same(draft[k], base[k])) out[k] = draft[k];
  return out;
}

/**
 * The draft to show after a save came back: the server's record, except for
 * fields edited again while the save was on its way (they differ from the
 * draft that was sent) -- those keep the newer text, so nobody loses what they
 * typed during a save.
 */
export function mergeSaved<T extends Record<string, any>>(current: T, server: T, sentDraft: T): T {
  const next: Record<string, any> = { ...current, ...server };
  for (const k of Object.keys(current)) if (!same(current[k], sentDraft[k])) next[k] = current[k];
  return next as T;
}

/**
 * A server reply to something other than a field save (a comment, an upload):
 * take the server's record, but keep the draft's own edits to the tracked
 * fields, which the autosave still owes the server.
 */
export function keepEdits<T extends Record<string, any>>(draft: T, server: T, fields: readonly (keyof T)[]): T {
  const next: Record<string, any> = { ...server };
  for (const k of fields) next[k as string] = draft[k];
  return next as T;
}

// ------------------------------------------------------------------ one editor

export interface AutosaveOptions<T extends Record<string, any>> {
  /** What the person is editing now. */
  draft: T;
  /** What the server has -- the record as loaded (null for a record not created yet). */
  saved: T | null;
  /** Send the changes. For a new record `isNew` is true and `changes` is the whole draft. Return the server's record. */
  save: (changes: Partial<T>, ctx: { isNew: boolean; draft: T }) => Promise<T | void>;
  /** Called with the server's record after each successful save, and the draft as it was when sent (for mergeSaved). */
  onSaved?: (row: T, sentDraft: T) => void;
  /** Only these fields are compared and sent (default: every field of the draft). */
  fields?: (keyof T)[];
  /** False holds autosave (e.g. no permission, or a required field is empty); Save still reports why. */
  enabled?: boolean;
  delay?: number;
  /** Shown in the top bar while saving ("Saving task…"). */
  label?: string;
}

export interface Autosave {
  state: SaveState;
  dirty: boolean;
  lastSavedAt: number | null;
  error: string;
  /** Save now (the Save button). Resolves true when everything is saved. */
  saveNow: () => Promise<boolean>;
}

export function useAutosave<T extends Record<string, any>>(o: AutosaveOptions<T>): Autosave {
  const delay = o.delay ?? AUTOSAVE_DELAY;
  const enabled = o.enabled ?? true;
  const [state, setState] = useState<SaveState>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Refs, so timers and unmount always see the latest values.
  const latest = useRef(o);
  latest.current = o;
  const base = useRef<T | null>(o.saved);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<number | null>(null);

  const pending = useCallback((): Partial<T> | null => {
    const { draft, fields } = latest.current;
    if (!base.current) return Object.keys(draft || {}).length ? { ...draft } : null;
    const c = changedFields(draft, base.current, fields);
    return Object.keys(c).length ? c : null;
  }, []);

  const run = useCallback(async (): Promise<boolean> => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    if (inFlight.current) {
      // One request at a time: wait for it, then send whatever changed meanwhile.
      await inFlight.current;
      return run();
    }
    const changes = pending();
    if (!changes) { setState('saved'); return true; }
    const isNew = !base.current;
    const sentDraft = latest.current.draft;
    setState('saving');
    const job = (async () => {
      try {
        const row = await latest.current.save(changes, { isNew, draft: sentDraft });
        const server = (row && typeof row === 'object' ? row : { ...(base.current || {}), ...changes }) as T;
        base.current = server;
        setLastSavedAt(Date.now());
        setError('');
        latest.current.onSaved?.(server, sentDraft);
        return true;
      } catch (e: any) {
        setError(e?.message || 'Could not save');
        setState('error');
        return false;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = job;
    const ok = await job;
    if (!ok) return false;
    // Typed more while it was saving? Save that too, after the usual pause.
    if (pending()) { setState('dirty'); schedule(); } else setState('saved');
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const schedule = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { timer.current = null; if (latest.current.enabled ?? true) void run(); }, delay);
  }, [delay, run]);

  // The record was reloaded from outside (another id, or a fresh copy with nothing pending): take it as the baseline.
  const savedKey = o.saved ? JSON.stringify((o.saved as any).id ?? null) : 'new';
  const lastKey = useRef(savedKey);
  useEffect(() => {
    if (lastKey.current !== savedKey) { lastKey.current = savedKey; base.current = o.saved; setError(''); setState(pending() ? 'dirty' : 'saved'); return; }
    if (o.saved && !pending() && state !== 'saving') base.current = o.saved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey, o.saved]);

  // Every edit: mark unsaved and (re)start the pause.
  const draftKey = JSON.stringify(o.fields ? o.fields.map((k) => o.draft[k]) : o.draft);
  useEffect(() => {
    if (!pending()) { if (state === 'dirty') setState('saved'); return; }
    if (state !== 'saving') setState(state === 'error' ? 'error' : 'dirty');
    if (enabled) schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, enabled]);

  // Leaving: closing the editor saves what's pending; closing the tab asks first.
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!pending() || !(latest.current.enabled ?? true)) return;
      void run();
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      if (timer.current) window.clearTimeout(timer.current);
      if (pending() && (latest.current.enabled ?? true)) void run();
    };
  }, [pending, run]);

  const dirty = state === 'dirty' || state === 'error' || !!pending();
  const saveNow = useCallback(() => run(), [run]);
  useRegister(o.label || 'changes', state, dirty, enabled || dirty);
  return { state, dirty, lastSavedAt, error, saveNow };
}

// ------------------------------------------------------------------ the top-bar indicator

type Entry = { label: string; state: SaveState; dirty: boolean; at: number };
const Registry = createContext<{ set: (id: number, e: Entry | null) => void } | null>(null);
const Summary = createContext<Entry[]>([]);
let nextId = 1;

function useRegister(label: string, state: SaveState, dirty: boolean, active: boolean) {
  const reg = useContext(Registry);
  const id = useRef(0);
  if (!id.current) id.current = nextId++;
  useEffect(() => { reg?.set(id.current, active ? { label, state, dirty, at: Date.now() } : null); }, [reg, label, state, dirty, active]);
  useEffect(() => () => reg?.set(id.current, null), [reg]);
}

/** Collects every open editor's save state, for the indicator in the top bar. */
export function AutosaveProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Map<number, Entry>>(new Map());
  const reg = useMemo(() => ({
    set: (id: number, e: Entry | null) => setEntries((prev) => {
      const next = new Map(prev);
      if (e) next.set(id, e); else next.delete(id);
      return next;
    }),
  }), []);
  return <Registry.Provider value={reg}><Summary.Provider value={[...entries.values()]}>{children}</Summary.Provider></Registry.Provider>;
}

const tone = {
  saving: { c: '#7E9B93', dot: '#C7A64A', text: 'Saving…' },
  saved: { c: '#2F7D4A', dot: '#2F7D4A', text: 'All changes saved' },
  dirty: { c: '#8A6D12', dot: '#E0B84A', text: 'Unsaved changes' },
  error: { c: '#8E2E0A', dot: '#8E2E0A', text: "Couldn't save" },
};

/** "Saving… / All changes saved / Couldn't save" for whatever is open. Hidden when nothing is being edited. */
export function AutosaveIndicator() {
  const entries = useContext(Summary);
  if (!entries.length) return null;
  const s: SaveState = entries.some((e) => e.state === 'error') ? 'error' : entries.some((e) => e.state === 'saving') ? 'saving' : entries.some((e) => e.dirty) ? 'dirty' : 'saved';
  const t = tone[s];
  return (
    <div title="Changes save automatically a few seconds after you stop typing" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: t.c, whiteSpace: 'nowrap' }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: t.dot, animation: s === 'saving' ? 'pulse 1s ease-in-out infinite' : undefined }} />
      {s === 'dirty' ? 'Autosave on' : t.text}
    </div>
  );
}

// ------------------------------------------------------------------ the Save button, the same everywhere

const ago = (t: number | null) => {
  if (!t) return '';
  const s = Math.round((Date.now() - t) / 1000);
  return s < 10 ? 'just now' : s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`;
};

/**
 * Save status and the Save button. `blocked` explains why it can't save yet
 * (e.g. "Add a name to save").
 */
export function SaveBar({ auto, blocked, compact }: { auto: Autosave; blocked?: string; compact?: boolean }) {
  const [, tick] = useState(0);
  const [flash, setFlash] = useState(false);
  useEffect(() => { const i = window.setInterval(() => tick((n) => n + 1), 15000); return () => window.clearInterval(i); }, []);
  useEffect(() => { if (!flash) return; const t = window.setTimeout(() => setFlash(false), 2200); return () => window.clearTimeout(t); }, [flash]);
  const { state, dirty, lastSavedAt, error } = auto;
  const status = blocked && dirty ? blocked
    : state === 'saving' ? 'Saving…'
    : state === 'error' ? `Couldn't save — ${error}`
    : state === 'dirty' ? 'Unsaved · autosaves in a moment'
    : lastSavedAt ? `Saved ${ago(lastSavedAt)}` : 'All changes saved';
  const color = state === 'error' ? '#8E2E0A' : state === 'dirty' || (blocked && dirty) ? '#8A6D12' : '#7E9B93';
  const canSave = dirty && state !== 'saving' && !blocked;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', minWidth: 0 }}>
      {!compact && <span style={{ fontSize: 11.5, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{status}</span>}
      <button
        type="button"
        disabled={!canSave}
        onClick={() => { void auto.saveNow().then((ok) => { if (ok) setFlash(true); }); }}
        title={compact ? status : undefined}
        style={{
          padding: '7px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
          border: '1px solid ' + (canSave ? '#173326' : flash ? '#2F7D4A' : 'rgba(20,8,31,.14)'), background: canSave ? '#173326' : flash ? '#D2EAD3' : '#fff', color: canSave ? '#fff' : flash ? '#1E6B36' : '#7E9B93',
          cursor: canSave ? 'pointer' : 'default',
        }}
      >
        {state === 'saving' ? 'Saving…' : state === 'error' ? 'Retry save' : dirty ? 'Save' : flash ? '✓ Saved' : 'Saved'}
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ an inline editor's draft

/**
 * Holds a draft of `record` for an editor written inline in a page. Mount it
 * with `key={record.id}`: switching records or closing the editor unmounts it,
 * which saves anything still pending.
 */
export function DraftScope<T extends Record<string, any>>({ record, fields, enabled = true, label, save, onSaved, children }: {
  record: T | null;
  fields: (keyof T)[];
  enabled?: boolean;
  label?: string;
  save: (changes: Partial<T>) => Promise<T | void>;
  onSaved?: (row: T) => void;
  children: (api: { draft: T; set: (patch: Partial<T>) => void; auto: Autosave; applied: (server: T) => void }) => ReactNode;
}) {
  const [draft, setDraft] = useState<T>((record || {}) as T);
  const auto = useAutosave<T>({
    draft, saved: record, fields, enabled: enabled && !!record, label,
    save: (changes) => save(changes),
    onSaved: (row, sent) => { setDraft((cur) => mergeSaved(cur, row, sent)); onSaved?.(row); },
  });
  const set = useCallback((patch: Partial<T>) => setDraft((prev) => ({ ...prev, ...patch })), []);
  const applied = useCallback((server: T) => { setDraft((cur) => keepEdits(cur, server, fields)); onSaved?.(server); }, [fields, onSaved]);
  return <>{children({ draft, set, auto, applied })}</>;
}
