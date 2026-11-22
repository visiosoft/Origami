import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../AppContext';

export interface DrawingState {
  fileId: string; rev: string | null; revMajor: number | null; revMinor: number | null; base: boolean;
  approved: { id: string; rev: string; at?: string | null; by?: string | null } | null; isApproved: boolean;
  notCityApproved: boolean; cityNote: string | null;
  revisions: { id: string; rev: string | null; isLatest: boolean; approved: boolean; uploadedBy?: string; at?: string }[];
}
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
      {(offApproved || (state.approved?.id === fileId && reviewLayersShown)) && (
        <div role="status" className="mk-set-banner" style={{ padding: '7px 14px', background: '#F7E4DB', color: '#8E2E0A', fontSize: 12.5, fontWeight: 700, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{offApproved
            ? `You’re not on the approved set (${state.approved!.rev})${state.rev ? ` — this is ${state.rev}` : ''}.`
            : 'Review layers (not yet published) are showing over the approved set.'}</span>
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
export function DrawingSetSection({ state, fileId, isLead, canFlag, layers, onChanged, onOpenFile }: {
  state: DrawingState | null; fileId: string; isLead: boolean; canFlag: boolean;
  layers: { key: string; name: string; count: number; state?: string | null }[];
  onChanged: () => void; onOpenFile?: (id: string) => void;
}) {
  const { toast } = useApp();
  const [busy, setBusy] = useState('');
  const [publishing, setPublishing] = useState<Set<string> | null>(null);
  const [history, setHistory] = useState<DrawingEvent[] | null>(null);
  const [who, setWho] = useState('');
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => { setHistory(null); api.fileRoom.drawingHistory(fileId).then(setHistory).catch(() => setHistory([])); }, [fileId, state?.approved?.id, state?.rev, state?.notCityApproved]);
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
  const people = [...new Set((history || []).map((e) => e.layer || e.by).filter(Boolean))] as string[];
  const shown = (history || []).filter((e) => !who || e.layer === who || e.by === who);
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
      <h4 style={{ marginTop: 10 }}>History</h4>
      {people.length > 1 && (
        <select aria-label="History for" value={who} onChange={(e) => setWho(e.target.value)} style={{ fontSize: 12, marginBottom: 4 }}>
          <option value="">Everyone and every layer</option>
          {people.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      )}
      {!history && <p className="mk-muted">Loading…</p>}
      {history && !shown.length && <p className="mk-muted">Nothing yet.</p>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
        {shown.map((e, i) => (
          <li key={i} style={{ fontSize: 12, lineHeight: 1.4 }}>
            <b style={{ color: 'var(--ink)' }}>{e.text}</b>
            <div className="mk-muted" style={{ fontSize: 11 }}>{e.by} · {when(e.at)}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
