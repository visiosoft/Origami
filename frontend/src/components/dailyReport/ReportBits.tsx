import { createContext, useContext, useState, type CSSProperties, type ReactNode } from 'react';
import type { Delay, YesNo } from '../../data/dailyReport';

export const INK = 'var(--ink)';
export const MUTED = 'var(--muted)';
export const ACCENT = 'var(--forest)';
export const LINE = 'rgba(var(--rgb-shade), .08)';
export const BG = 'var(--font-display)';

export const input: CSSProperties = {
  boxSizing: 'border-box', height: 36, borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), .14)', padding: '0 10px',
  fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: INK, outline: 'none', width: '100%', minWidth: 0,
};
export const area: CSSProperties = { ...input, height: 'auto', minHeight: 72, padding: 10, lineHeight: 1.5, resize: 'vertical' };
export const pill = (on: boolean, disabled?: boolean): CSSProperties => ({
  padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
  border: '1px solid ' + (on ? ACCENT : 'rgba(var(--rgb-shade), .14)'), background: on ? ACCENT : 'var(--surface)', color: on ? 'white' : 'var(--body)', opacity: disabled && !on ? 0.55 : 1,
});

/** Copied from the previous day and not changed yet: a soft yellow, until it's edited. */
export const CARRIED: CSSProperties = { background: 'rgba(245, 196, 67, 0.22)', boxShadow: '0 0 0 2px rgba(245, 196, 67, 0.75)', borderRadius: 10 };

/** The report's editing context: whether fields can change, and how to test a path for "carried over". */
export const ReportCtx = createContext<{ editable: boolean; carried: (path: string) => boolean }>({ editable: true, carried: () => false });
export const useReport = () => useContext(ReportCtx);

/** Wraps a field so a carried-over value shows yellow. */
export function Carry({ path, on, children, style }: { path?: string; on?: boolean; children: ReactNode; style?: CSSProperties }) {
  const { carried } = useReport();
  const hl = on ?? (path ? carried(path) : false);
  return <div className={hl ? 'dr-carried' : undefined} title={hl ? 'Carried over from the previous report — not changed yet' : undefined} style={{ padding: hl ? 6 : 0, margin: hl ? -6 : 0, transition: 'background .2s, box-shadow .2s', ...(hl ? CARRIED : {}), ...style }}>{children}</div>;
}

export function Label({ code, children, hint }: { code?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 2, marginBottom: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{code && <span style={{ color: MUTED, fontWeight: 600, marginRight: 6 }}>{code}</span>}{children}</span>
      {hint && <span style={{ fontSize: 11.5, color: MUTED }}>{hint}</span>}
    </div>
  );
}

/** A big YES / NO choice -- the questions that open or close the rest of a section. */
export function YesNoPick({ value, onChange, path, yes = 'Yes', no = 'No' }: { value: YesNo; onChange: (v: YesNo) => void; path?: string; yes?: string; no?: string }) {
  const { editable } = useReport();
  return (
    <Carry path={path} style={{ display: 'inline-flex' }}>
      <div role="radiogroup" style={{ display: 'inline-flex', gap: 6 }}>
        {(['yes', 'no'] as const).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} disabled={!editable}
            onClick={() => onChange(value === v ? '' : v)} style={{ ...pill(value === v, !editable), minWidth: 70 }}>{v === 'yes' ? yes : no}</button>
        ))}
      </div>
    </Carry>
  );
}

/**
 * One section of the report: "II. Activity". Closed sections show their answer
 * in the header; "N/A" sections (no work today) are collapsed and dimmed so the
 * signature is quick to reach.
 */
export function SectionCard({ roman, title, summary, na, children, defaultOpen = true }: {
  roman: string; title: string; summary?: ReactNode; na?: boolean; children: ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const shown = open && !na;
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid ' + LINE, borderRadius: 'var(--r-14)', opacity: na ? 0.6 : 1, minWidth: 0 }}>
      <button type="button" onClick={() => !na && setOpen((o) => !o)} aria-expanded={shown}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', border: 0, background: 'transparent', cursor: na ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit', color: INK }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0, background: 'var(--panel)', fontSize: 12.5, fontWeight: 800, color: 'var(--body)' }}>{roman}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: BG, fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</span>
          {(na || summary) && <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 1 }}>{na ? 'N/A — no work today' : summary}</span>}
        </span>
        {!na && <span aria-hidden style={{ fontSize: 11, color: MUTED, transform: shown ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▶</span>}
      </button>
      {shown && <div style={{ padding: '4px 18px 18px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>{children}</div>}
    </section>
  );
}

/**
 * Get-well date (known / unknown), details, and "Convert to task" -- the same
 * block under every delay and every inspection that didn't pass.
 */
export function DelayBlock({ value, onChange, path, onConvert, convertTitle }: {
  value: Delay; onChange: (d: Delay) => void; path: string;
  onConvert?: (details: string) => Promise<string | null>; convertTitle?: string;
}) {
  const { editable } = useReport();
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Delay>) => onChange({ ...value, ...p });
  return (
    <div style={{ display: 'grid', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'var(--panel)' }}>
      <Carry path={`${path}.getWell`}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: INK }}>
            <input type="checkbox" disabled={!editable} checked={value.getWell === 'known'} onChange={(e) => set({ getWell: e.target.checked ? 'known' : '' })} />
            Known estimated “get well” date
          </label>
          {value.getWell === 'known' && (
            <Carry path={`${path}.date`}><input type="date" disabled={!editable} value={value.date || ''} onChange={(e) => set({ date: e.target.value })} style={{ ...input, width: 170, height: 32 }} aria-label="Get well date" /></Carry>
          )}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: INK }}>
            <input type="checkbox" disabled={!editable} checked={value.getWell === 'unknown'} onChange={(e) => set({ getWell: e.target.checked ? 'unknown' : '', date: e.target.checked ? '' : value.date })} />
            Unknown get well date
          </label>
        </div>
      </Carry>
      <Carry path={`${path}.details`}>
        <textarea disabled={!editable} value={value.details || ''} onChange={(e) => set({ details: e.target.value })} rows={2} placeholder="Details" style={area} />
      </Carry>
      {onConvert && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {value.taskId
            ? <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-1e6b36)' }}>✓ Task created{convertTitle ? ` — “${convertTitle}”` : ''}</span>
            : <button type="button" disabled={!editable || busy || !(value.details || '').trim()}
                title={(value.details || '').trim() ? 'Add this to the project’s To Do list — the details stay here too' : 'Write the details first'}
                onClick={async () => { setBusy(true); try { const id = await onConvert((value.details || '').trim()); if (id) set({ taskId: id }); } finally { setBusy(false); } }}
                style={{ ...pill(false, !editable || !(value.details || '').trim()), padding: '5px 12px', fontSize: 12 }}>{busy ? 'Creating…' : 'Convert to task'}</button>}
        </div>
      )}
    </div>
  );
}

/** A plain "Convert to task" for a line of text (visitors, notes). */
export function ConvertButton({ taskId, text, onConvert, onDone }: { taskId?: string; text: string; onConvert: (t: string) => Promise<string | null>; onDone: (id: string) => void }) {
  const { editable } = useReport();
  const [busy, setBusy] = useState(false);
  if (taskId) return <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-1e6b36)', whiteSpace: 'nowrap' }}>✓ Task created</span>;
  const ok = editable && !busy && !!text.trim();
  return (
    <button type="button" disabled={!ok} onClick={async () => { setBusy(true); try { const id = await onConvert(text.trim()); if (id) onDone(id); } finally { setBusy(false); } }}
      title={text.trim() ? 'Add this to the project’s To Do list — the text stays here too' : 'Write something first'}
      style={{ ...pill(false, !ok), padding: '5px 12px', fontSize: 12, flexShrink: 0 }}>{busy ? 'Creating…' : 'Convert to task'}</button>
  );
}

export function AddRow({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  const { editable } = useReport();
  if (!editable) return null;
  return <button type="button" onClick={onClick} style={{ ...pill(false), justifySelf: 'start', borderStyle: 'dashed' }}>{children}</button>;
}

export function RemoveRow({ onClick, label = 'Remove' }: { onClick: () => void; label?: string }) {
  const { editable } = useReport();
  if (!editable) return null;
  return <button type="button" onClick={onClick} aria-label={label} title={label} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), .14)', background: 'var(--surface)', color: '#8E2E0A', cursor: 'pointer', fontSize: 15, lineHeight: 1, flexShrink: 0 }}>×</button>;
}
