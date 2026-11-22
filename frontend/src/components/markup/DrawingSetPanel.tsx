import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../AppContext';

export interface DrawingState {
  fileId: string; rev: string | null; revMajor: number | null; revMinor: number | null; base: boolean;
  approved: { id: string; rev: string; at?: string | null; by?: string | null } | null; isApproved: boolean;
  notCityApproved: boolean; cityNote: string | null;
  revisions: { id: string; rev: string | null; isLatest: boolean; approved: boolean; uploadedBy?: string; at?: string }[];
  /** Nov 22: the architect's date on the sheets, and pending city-approval sets linked to this drawing. */
  drawingDate?: string | null;
  pendingSets?: { id: string; name: string; cityNote?: string | null }[];
}
/** Nov 22 (Edward p6-7): one revision in the drawing log. */
export interface LogRevision { id: string; rev: string; heading: string; drawingDate: string | null; lines: string[]; events: { at: string; by: string; text: string }[]; audit: { at: string; text: string }[] }
export interface DrawingEvent { at: string; by: string; kind: string; text: string; layer?: string | null }

/** A review layer's code: I1, I2 (our team), X1, X2 (outside). */
export const isReviewLayer = (name: string) => /^[IX]\d{1,3}$/i.test(name.trim());

/** Where a drawing stands in its set, reloaded after a change. */
export function useDrawingState(fileId: string) {
  const [state, setState] = useState<DrawingState | null>(null);
  const load = useCallback(() => { api.fileRoom.drawing(fileId).then(setState).catch(() => setState(null)); }, [fileId]);
  useEffect(load, [load]);
  return { state, reload: load, setState };
}

/**
 * Nov 20 (Edward: "consultants risk operating on incorrect drawings"): the bar
 * under the drawing's title -- not city-approved, and "you're not on the
 * approved set" with a way back to it.
 */
export function DrawingSetBanner({ state, fileId, reviewLayersShown, onOpenFile, onHideReview }: {
  state: DrawingState | null; fileId: string; reviewLayersShown: boolean;
  onOpenFile?: (id: string) => void; onHideReview: () => void;
}) {
  if (!state || !state.base) return null;
  const offApproved = !!state.approved && state.approved.id !== fileId;
  return (
    <>
      {state.notCityApproved && (
        <div role="alert" className="mk-set-banner" style={{ padding: '7px 14px', background: '#FBEFD5', color: '#7A4B00', fontSize: 12.5, fontWeight: 700 }}>
          ⚠ Not city-approved — for early work only{state.cityNote ? `: ${state.cityNote}` : ''}
        </div>
      )}
      {!!state.pendingSets?.length && (
        <div role="note" className="mk-set-banner" style={{ padding: '6px 14px', background: '#FFF6E5', color: '#7A4B00', fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <b>Pending city approval:</b>
          {state.pendingSets.map((p) => (
            <button key={p.id} type="button" className="mk-btn" disabled={!onOpenFile} onClick={() => onOpenFile?.(p.id)} title="Not part of the approved base set — opens with the warning">{p.name} →</button>
          ))}
        </div>
      )}
      {(offApproved || (state.approved?.id === fileId && reviewLayersShown)) && (
        <div role="status" className="mk-set-banner" style={{ padding: '7px 14px', background: '#F7E4DB', color: '#8E2E0A', fontSize: 12.5, fontWeight: 700, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{offApproved
            ? `You’re not on the approved set (${state.approved!.rev})${state.rev ? ` — this is ${state.rev}` : ''}.`
            : 'Warning: you are not working on the approved base drawing set by using this file/layer — layers that aren’t approved are showing.'}</span>
          <button type="button" className="mk-btn is-dark" onClick={() => { onHideReview(); if (offApproved && onOpenFile) onOpenFile(state.approved!.id); }}>Back to approved set</button>
        </div>
      )}
    </>
  );
}

/**
 * The side panel's "Drawing set" section: the revision, approving it, the
 * city flag, publishing reviewed layers as the next revision (i-1 / i-2), and
 * the drawing's history, filterable by layer or person.
 */
export function DrawingSetSection({ state, fileId, isLead, canFlag, layers, onChanged, onOpenFile, projectFiles = [] }: {
  state: DrawingState | null; fileId: string; isLead: boolean; canFlag: boolean;
  layers: { key: string; name: string; count: number; state?: string | null }[];
  onChanged: () => void; onOpenFile?: (id: string) => void;
  /** The project's other PDFs, to link a pending city-approval set. */
  projectFiles?: { id: string; name: string }[];
}) {
  const { toast } = useApp();
  const [busy, setBusy] = useState('');
  const [publishing, setPublishing] = useState<Set<string> | null>(null);
  const [log, setLog] = useState<LogRevision[] | null>(null);
  const [who, setWho] = useState('');
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => { setLog(null); api.fileRoom.drawingLog(fileId).then(setLog).catch(() => setLog([])); }, [fileId, state?.approved?.id, state?.rev, state?.notCityApproved, state?.drawingDate, state?.pendingSets?.length]);
  if (!state || !state.base) return null;

  const run = (key: string, p: Promise<unknown>, ok: string) => {
    setBusy(key);
    p.then(() => { toast(ok); onChanged(); }).catch((e: Error) => toast('⚠ ' + e.message)).finally(() => setBusy(''));
  };
  const publish = () => {
    if (!publishing?.size) return;
    setBusy('publish');
    api.fileRoom.publishLayers(fileId, [...publishing]).then((r) => {
      toast(`Published as ${r.rev} (${r.markups} markup${r.markups === 1 ? '' : 's'})`);
      setPublishing(null); onChanged();
      if (onOpenFile && window.confirm(`Open ${r.rev} now?`)) onOpenFile(r.id);
    }).catch((e: Error) => toast('⚠ ' + e.message)).finally(() => setBusy(''));
  };
  const printLog = () => {
    const w = window.open('', '_blank');
    if (!w || !log) return;
    const esc = (x: string) => x.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!));
    w.document.write(`<html><head><title>Drawing log</title><style>body{font:13px Arial;margin:32px;color:#111}h1{font-size:18px}h2{font-size:14px;margin:18px 0 4px}li{margin:2px 0}.a{color:#A35A00}</style></head><body><h1>Drawing log</h1>${log.map((r) => `<h2>${esc(r.heading)}</h2><ul>${r.lines.map((l) => `<li>${esc(l)}</li>`).join('')}${r.events.map((e) => `<li>${esc(e.text)} — ${esc(e.by)}, ${esc(when(e.at))}</li>`).join('')}${r.audit.length ? `<li class="a">Audit trail:<ul>${r.audit.map((a) => `<li>${esc(a.text)}</li>`).join('')}</ul></li>` : ''}</ul>`).join('')}</body></html>`);
    w.document.close(); w.focus(); w.print();
  };
  const people = [...new Set((log || []).flatMap((r) => r.events.map((e) => e.by)).filter(Boolean))] as string[];
  const when = (iso: string) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

  return (
    <section className="mk-set" aria-label="Drawing set">
      <h4>Drawing set {state.rev && <span style={{ fontWeight: 700, color: 'var(--forest)' }}>· {state.rev}</span>}</h4>
      <p className="mk-muted" style={{ margin: '0 0 6px' }}>
        {state.isApproved ? `✓ Approved working set${state.approved?.by ? ` (${state.approved.by})` : ''}` : state.approved ? `Approved set: ${state.approved.rev}` : 'No revision approved yet.'}
      </p>
      {state.revisions.length > 1 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {state.revisions.map((r) => (
            <button key={r.id} type="button" className={'mk-chip' + (r.id === fileId ? ' is-on' : '')} disabled={r.id === fileId || !onOpenFile} onClick={() => onOpenFile?.(r.id)}
              title={`${r.uploadedBy || ''} ${when(r.at || '')}`.trim()} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), .15)', background: r.id === fileId ? 'var(--ink)' : 'var(--surface)', color: r.id === fileId ? '#fff' : 'var(--body)', cursor: r.id === fileId ? 'default' : 'pointer' }}>
              {r.rev || 'unnumbered'}{r.approved ? ' ✓' : ''}
            </button>
          ))}
        </div>
      )}
      {isLead && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {!state.isApproved
            ? <button type="button" className="mk-btn" disabled={!!busy} onClick={() => run('approve', api.fileRoom.approveDrawing(fileId, true), 'Approved as the working set')}>Approve this revision</button>
            : <button type="button" className="mk-btn" disabled={!!busy} onClick={() => run('approve', api.fileRoom.approveDrawing(fileId, false), 'No longer the approved set')}>Un-approve</button>}
          <button type="button" className="mk-btn" disabled={!!busy || !layers.length} onClick={() => setPublishing(publishing ? null : new Set(layers.filter((l) => l.state ? l.state === 'approved' || l.state === 'modified' : isReviewLayer(l.name)).map((l) => l.key)))}>Publish layers…</button>
        </div>
      )}
      {publishing && (
        <div style={{ display: 'grid', gap: 4, padding: 8, borderRadius: 8, background: 'var(--panel)', marginBottom: 6 }}>
          <span style={{ fontSize: 12 }}>Draw these layers into the drawing and save it as the next revision ({state.revMajor ?? 0}.{String((state.revMinor ?? 0) + 1).padStart(2, '0')}):</span>
          {layers.map((l) => (
            <label key={l.key} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>
              <input type="checkbox" checked={publishing.has(l.key)} onChange={() => { const n = new Set(publishing); if (n.has(l.key)) n.delete(l.key); else n.add(l.key); setPublishing(n); }} />
              {l.state ? `(${l.state === 'modified' ? 'Modified Approved' : l.state[0].toUpperCase() + l.state.slice(1)}) ` : ''}{l.name} <span className="mk-muted">({l.count})</span>
            </label>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="mk-btn is-dark" disabled={!publishing.size || busy === 'publish'} onClick={publish}>{busy === 'publish' ? 'Publishing…' : `Publish ${publishing.size} layer${publishing.size === 1 ? '' : 's'}`}</button>
            <button type="button" className="mk-btn" onClick={() => setPublishing(null)}>Cancel</button>
          </div>
        </div>
      )}
      {canFlag && (
        note === null ? (
          <button type="button" className="mk-btn is-text" disabled={!!busy} onClick={() => (state.notCityApproved ? run('city', api.fileRoom.setCity(fileId, { notCityApproved: false }), 'City flag cleared') : setNote(''))}>
            {state.notCityApproved ? 'Clear “not city-approved”' : 'Mark not city-approved…'}
          </button>
        ) : (
          <div style={{ display: 'grid', gap: 4, marginBottom: 6 }}>
            <input aria-label="City approval note" placeholder="e.g. Structural — foundation only" value={note} onChange={(e) => setNote(e.target.value)} style={{ fontSize: 12.5, padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(var(--rgb-shade), .15)' }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="mk-btn is-dark" onClick={() => { run('city', api.fileRoom.setCity(fileId, { notCityApproved: true, cityNote: note }), 'Marked not city-approved'); setNote(null); }}>Mark it</button>
              <button type="button" className="mk-btn" onClick={() => setNote(null)}>Cancel</button>
            </div>
          </div>
        )
      )}
      {isLead && (
        <div style={{ display: 'grid', gap: 6, margin: '8px 0' }}>
          <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>Drawing date (on the sheets)
            <input type="date" aria-label="Drawing date" value={state.drawingDate || ''} onChange={(e) => run('date', api.fileRoom.setDrawingDate(fileId, e.target.value || null), 'Drawing date saved')} style={{ fontSize: 12 }} />
          </label>
          <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>Pending city-approval set
            <select aria-label="Link a pending city-approval set" value="" onChange={(e) => { const v = e.target.value; if (v) run('pending', api.fileRoom.setPendingSets(fileId, [...(state.pendingSets || []).map((p) => p.id), v]), 'Linked — it opens with the warning'); }} style={{ fontSize: 12, maxWidth: 200 }}>
              <option value="">Link one…</option>
              {projectFiles.filter((f) => f.id !== fileId && /\.pdf$/i.test(f.name) && !(state.pendingSets || []).some((p) => p.id === f.id)).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          {(state.pendingSets || []).map((p) => (
            <span key={p.id} style={{ fontSize: 12 }}>⚠ {p.name} <button type="button" className="mk-btn is-text" onClick={() => run('pending', api.fileRoom.setPendingSets(fileId, (state.pendingSets || []).filter((x) => x.id !== p.id).map((x) => x.id)), 'Unlinked')}>Unlink</button></span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <h4 style={{ margin: 0, flex: 1 }}>Drawing log</h4>
        {!!log?.length && <button type="button" className="mk-btn is-text" onClick={printLog}>Print</button>}
      </div>
      {people.length > 1 && (
        <select aria-label="Log for" value={who} onChange={(e) => setWho(e.target.value)} style={{ fontSize: 12, margin: '4px 0' }}>
          <option value="">Everyone</option>
          {people.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      )}
      {!log && <p className="mk-muted">Loading…</p>}
      {log && !log.length && <p className="mk-muted">Nothing yet.</p>}
      <div style={{ display: 'grid', gap: 10, maxHeight: 340, overflowY: 'auto' }}>
        {(log || []).map((r) => (
          <div key={r.id} style={{ fontSize: 12, lineHeight: 1.45 }}>
            <b style={{ color: r.id === fileId ? 'var(--forest)' : 'var(--ink)' }}>{r.heading}</b>
            <ul style={{ margin: '2px 0 0', paddingLeft: 16 }}>
              {r.lines.map((l, i) => <li key={'l' + i}>{l}</li>)}
              {r.events.filter((e) => !who || e.by === who).map((e, i) => <li key={'e' + i} className="mk-muted">{e.text} — {e.by}, {when(e.at)}</li>)}
              {r.audit.length > 0 && (
                <li style={{ color: '#A35A00' }}>Audit trail:
                  <ul style={{ margin: 0, paddingLeft: 16 }}>{r.audit.map((a, i) => <li key={'a' + i}>{a.text}</li>)}</ul>
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
