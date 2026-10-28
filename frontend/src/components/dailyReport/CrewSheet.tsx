import { useRef, useState, type CSSProperties } from 'react';
import { CARRIED, INK, LINE, MUTED, ACCENT } from './ReportBits';

export interface Entry { employeeId: string; csiCodeId?: string; hours?: number; taskDetail?: string; taskStatus?: string; team?: string }
export interface Emp { id: string; name: string; workerId?: string; tradeId?: string; trade?: string; designation?: string; employmentStatus?: string; status?: string }
export interface Code { id: string; code: string; division: string; active: boolean }

const STATUSES: [string, string][] = [['start', 'Start'], ['continued', 'Cont.'], ['completing', 'Done']];
const QUICK_HOURS = [4, 8, 10, 12];
const TEAMS = ['A', 'B', 'C', 'D'];
// Columns: worker · hours · cost code · task · team · work done
const COLS = 'minmax(190px, 1.3fr) 250px minmax(150px, 1fr) 150px 128px minmax(170px, 1.4fr)';

const cellBtn = (on: boolean, disabled?: boolean): CSSProperties => ({
  minWidth: 30, height: 28, padding: '0 7px', borderRadius: 7, fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
  cursor: disabled ? 'default' : 'pointer', border: '1px solid ' + (on ? ACCENT : 'rgba(var(--rgb-shade), .12)'),
  background: on ? ACCENT : 'var(--surface)', color: on ? 'white' : INK, whiteSpace: 'nowrap', opacity: disabled && !on ? 0.55 : 1,
});
const cellInput: CSSProperties = {
  boxSizing: 'border-box', height: 30, borderRadius: 7, border: '1px solid rgba(var(--rgb-shade), .12)', padding: '0 8px',
  fontSize: 12.5, fontFamily: 'inherit', background: 'var(--surface)', color: INK, outline: 'none', width: '100%', minWidth: 0,
};
const pill = (on: boolean): CSSProperties => ({
  padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
  border: '1px solid ' + (on ? ACCENT : 'rgba(var(--rgb-shade), .12)'), background: on ? ACCENT : 'var(--surface)', color: on ? 'white' : 'var(--body)',
});

/**
 * Section III's timesheet: every worker deployed to the project is a row; an
 * hours button puts them on the day. Cost code, task, team and work done sit on
 * the row; "fill down" sets everyone at once; ↑ ↓ and Enter move between rows.
 * Rows copied from the previous day and not changed are highlighted yellow.
 */
export function CrewSheet({ employees, codes, onSite, entries, setEntries, editable, carried }: {
  employees: Emp[]; codes: Code[]; onSite: Map<string, string>; entries: Entry[];
  setEntries: (fn: (e: Entry[]) => Entry[]) => void; editable: boolean; carried?: (e: Entry) => boolean;
}) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [pickQ, setPickQ] = useState('');
  const sheetRef = useRef<HTMLDivElement>(null);

  const entryOf = (id: string) => entries.find((e) => e.employeeId === id);
  const inLog = new Set(entries.map((e) => e.employeeId));
  const q = query.trim().toLowerCase();
  const rows = employees
    .filter((e) => inLog.has(e.id) || onSite.has(e.id))
    .filter((e) => !q || [e.name, e.workerId, e.trade, e.designation].filter(Boolean).join(' ').toLowerCase().includes(q))
    .sort((a, b) => Number(inLog.has(b.id)) - Number(inLog.has(a.id)) || Number(onSite.has(b.id)) - Number(onSite.has(a.id)) || a.name.localeCompare(b.name));
  const orphans = entries.filter((e) => !employees.some((x) => x.id === e.employeeId));
  const codeOf = (id?: string) => codes.find((c) => c.id === id);
  const lastCode = entries.map((e) => e.csiCodeId).filter(Boolean).pop() || '';

  const patch = (id: string, p: Partial<Entry>) => setEntries((es) => (es.some((e) => e.employeeId === id)
    ? es.map((e) => (e.employeeId === id ? { ...e, ...p } : e))
    : [...es, { employeeId: id, hours: 8, taskStatus: 'continued', csiCodeId: lastCode, taskDetail: '', team: '', ...p }]));
  const remove = (id: string) => setEntries((es) => es.filter((e) => e.employeeId !== id));
  const setHours = (id: string, h: number) => (h > 0 ? patch(id, { hours: h }) : remove(id));
  const everyone = (p: Partial<Entry>) => setEntries((es) => es.map((e) => ({ ...e, ...p })));
  const addCrew = () => setEntries((es) => [...es, ...employees.filter((e) => onSite.has(e.id) && !es.some((x) => x.employeeId === e.id)).map((e) => ({ employeeId: e.id, hours: 8, taskStatus: 'continued', csiCodeId: lastCode, taskDetail: '', team: '' }))]);
  const totalHours = entries.reduce((a, e) => a + (Number(e.hours) || 0), 0);
  const noCode = entries.filter((e) => !e.csiCodeId).length;
  const crewMissing = employees.filter((e) => onSite.has(e.id) && !inLog.has(e.id)).length;

  const move = (ev: React.KeyboardEvent<HTMLElement>, col: string, row: number) => {
    const dir = ev.key === 'ArrowDown' || (ev.key === 'Enter' && !ev.shiftKey) ? 1 : ev.key === 'ArrowUp' || (ev.key === 'Enter' && ev.shiftKey) ? -1 : 0;
    if (!dir) return;
    const next = sheetRef.current?.querySelector<HTMLElement>(`[data-cell="${col}-${row + dir}"]`);
    if (next) { ev.preventDefault(); next.focus(); if (next instanceof HTMLInputElement) next.select(); }
  };

  const row = (emp: Emp | undefined, id: string, i: number) => {
    const e = entryOf(id);
    const on = !!e;
    const code = codeOf(e?.csiCodeId);
    const hl = on && !!carried?.(e!);
    return (
      <div key={id} title={hl ? 'Carried over from the previous report — not changed yet' : undefined}
        style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, alignItems: 'center', padding: '8px 14px', borderTop: '1px solid ' + LINE, minWidth: 1100,
          background: on ? (e!.csiCodeId ? '#F6FAF6' : '#FFF9E6') : 'var(--surface)', ...(hl ? { ...CARRIED, borderRadius: 0, boxShadow: 'inset 3px 0 0 rgba(245, 196, 67, 1)' } : {}) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, flex: 'none', background: on ? '#2E8B57' : 'transparent', border: on ? 'none' : '1.5px solid rgba(var(--rgb-shade), .18)' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp?.name || 'Unknown worker'}</div>
            <div style={{ fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[emp?.workerId, emp?.trade || emp?.designation].filter(Boolean).join(' · ')}</div>
            {!onSite.has(id) && <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--c-8a6d12)' }}>Not deployed here</div>}
            {!!onSite.get(id) && <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED }}>Deployment {onSite.get(id)}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input data-cell={`h-${i}`} type="number" min={0} max={24} step={0.5} disabled={!editable} value={on ? e!.hours ?? '' : ''} placeholder="0"
            onChange={(ev) => setHours(id, Math.min(24, Math.max(0, Number(ev.target.value) || 0)))} onKeyDown={(ev) => move(ev, 'h', i)}
            style={{ ...cellInput, width: 52, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} aria-label={`Hours for ${emp?.name || id}`} />
          {QUICK_HOURS.map((h) => <button key={h} type="button" disabled={!editable} onClick={() => setHours(id, on && e!.hours === h ? 0 : h)} style={cellBtn(on && Number(e!.hours) === h, !editable)}>{h}</button>)}
          {on && editable && <button type="button" title="Take off the log" onClick={() => remove(id)} style={{ ...cellBtn(false), color: '#8E2E0A', minWidth: 26, padding: 0 }}>×</button>}
        </div>
        <select data-cell={`c-${i}`} disabled={!editable} value={e?.csiCodeId || ''} onChange={(ev) => patch(id, { csiCodeId: ev.target.value })} onKeyDown={(ev) => move(ev, 'c', i)}
          title={code ? `${code.code} — ${code.division}` : ''} style={{ ...cellInput, borderColor: on && !e!.csiCodeId ? '#D9B650' : 'rgba(var(--rgb-shade), .12)', color: code ? INK : MUTED }}>
          <option value="">{on ? 'Pick a code…' : '—'}</option>
          {codes.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.division}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 3 }}>
          {STATUSES.map(([k, l]) => <button key={k} type="button" disabled={!editable || !on} onClick={() => patch(id, { taskStatus: k })} style={cellBtn(on && (e!.taskStatus || 'continued') === k, !editable || !on)}>{l}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {TEAMS.map((t) => <button key={t} type="button" disabled={!editable || !on} onClick={() => patch(id, { team: e?.team === t ? '' : t })} style={cellBtn(on && e!.team === t, !editable || !on)}>{t}</button>)}
        </div>
        <input data-cell={`w-${i}`} disabled={!editable} value={e?.taskDetail || ''} placeholder={on ? 'What they worked on' : ''}
          onChange={(ev) => (on || ev.target.value ? patch(id, { taskDetail: ev.target.value }) : undefined)} onKeyDown={(ev) => move(ev, 'w', i)} style={cellInput} />
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: MUTED, fontVariantNumeric: 'tabular-nums' }}><b style={{ color: INK }}>{entries.length}</b> on the timesheet · <b style={{ color: INK }}>{totalHours}</b> h{noCode ? <span style={{ color: 'var(--c-8a6d12)' }}> · {noCode} need a cost code</span> : null}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: MUTED }}><b style={{ color: INK }}>{onSite.size}</b> assigned to this project</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a person…" style={{ ...cellInput, width: 170, height: 32, borderRadius: 999, padding: '0 12px' }} />
      </div>
      {editable && (
        <div style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--panel)', borderRadius: 'var(--r-12)', position: 'relative', zIndex: 6 }}>
          {crewMissing > 0 && <button type="button" onClick={addCrew} style={pill(true)}>+ Put the crew on ({crewMissing}) · 8 h</button>}
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => { setAdding((a) => !a); setPickQ(''); }} style={pill(adding)}>+ Add worker</button>
            {adding && (() => {
              const pq = pickQ.trim().toLowerCase();
              const others = employees.filter((e) => !inLog.has(e.id) && (!pq || [e.name, e.workerId, e.trade, e.designation].filter(Boolean).join(' ').toLowerCase().includes(pq)))
                .sort((a, b) => Number(onSite.has(b.id)) - Number(onSite.has(a.id)) || a.name.localeCompare(b.name)).slice(0, 8);
              return (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 20, width: 300, background: 'var(--surface)', border: '1px solid ' + LINE, borderRadius: 'var(--r-12)', boxShadow: '0 12px 32px rgba(var(--rgb-ink), .14)', padding: 8 }}>
                  <input autoFocus value={pickQ} onChange={(e) => setPickQ(e.target.value)} placeholder="Name, worker ID or trade…" style={{ ...cellInput, height: 34 }}
                    onKeyDown={(e) => { if (e.key === 'Escape') setAdding(false); if (e.key === 'Enter' && others[0]) { patch(others[0].id, {}); setAdding(false); } }} />
                  <div style={{ display: 'grid', marginTop: 6, maxHeight: 280, overflowY: 'auto' }}>
                    {others.map((e) => (
                      <button key={e.id} type="button" onClick={() => { patch(e.id, {}); setAdding(false); }}
                        style={{ display: 'grid', textAlign: 'left', padding: '7px 8px', border: 0, borderRadius: 8, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{e.name}</span>
                        <span style={{ fontSize: 11, color: MUTED }}>{[e.workerId, e.trade || e.designation, onSite.has(e.id) ? 'assigned here' : 'not deployed here'].filter(Boolean).join(' · ')}</span>
                      </button>
                    ))}
                    {!others.length && <span style={{ fontSize: 12.5, color: MUTED, padding: 8 }}>No one else matches.</span>}
                  </div>
                </div>
              );
            })()}
          </div>
          {entries.length > 1 && (
            <>
              <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.07em', marginLeft: 4 }}>Fill down</span>
              {QUICK_HOURS.map((h) => <button key={h} type="button" onClick={() => everyone({ hours: h })} style={cellBtn(false)}>{h} h</button>)}
              <select value="" onChange={(ev) => ev.target.value && everyone({ csiCodeId: ev.target.value })} style={{ ...cellInput, width: 180, height: 28 }}>
                <option value="">Cost code for everyone…</option>
                {codes.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.division}</option>)}
              </select>
              {STATUSES.map(([k, l]) => <button key={k} type="button" onClick={() => everyone({ taskStatus: k })} style={cellBtn(false)}>{l}</button>)}
              {TEAMS.map((t) => <button key={t} type="button" onClick={() => everyone({ team: t })} style={cellBtn(false)}>Team {t}</button>)}
            </>
          )}
          {crewMissing === 0 && entries.length <= 1 && <span style={{ fontSize: 12.5, color: MUTED }}>Click an hours button on a row to put that person on the timesheet. ↑ ↓ and Enter move between rows.</span>}
        </div>
      )}
      <div style={{ border: '1px solid ' + LINE, borderRadius: 'var(--r-12)', overflow: 'hidden' }}>
        <div ref={sheetRef} style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: '10px 14px', background: 'var(--panel)', fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.07em', minWidth: 1100 }}>
            <span>Worker</span><span>Hours</span><span>Cost code</span><span>Task</span><span>Team</span><span>Work done</span>
          </div>
          {rows.map((emp, i) => row(emp, emp.id, i))}
          {orphans.map((e, k) => row(undefined, e.employeeId, rows.length + k))}
          {!rows.length && !orphans.length && (
            <div style={{ padding: 22, fontSize: 13, color: MUTED, textAlign: 'center', borderTop: '1px solid ' + LINE }}>
              {q ? 'No one matches that search.' : <>Nobody is assigned to this project for this day yet. Use <b style={{ color: INK }}>+ Add worker</b> to add anyone who worked here — the office assigns the regular crew in Manpower → Deployment.</>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
