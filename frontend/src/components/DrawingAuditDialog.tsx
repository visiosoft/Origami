import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import type { FileRoomFile } from '../data/fileRoom';
import type { DrawingEvent } from './markup/DrawingSetPanel';

const KIND: Record<string, string> = { upload: 'Put in', approve: 'Approved', city: 'City flag', publish: 'Published', pending: 'Pending set', date: 'Date', layer: 'Review layer', rfi: 'RFI', share: 'Emailed', open: 'Opened' };
const when = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); };

/**
 * Nov 27 (Weekly Sync): the audit trail for the drawings in a tab -- who put
 * each revision in, approved it, flagged it, shared it and opened it -- in one
 * list, newest first. Reads each drawing's history (the 25 shown first).
 */
export function DrawingAuditDialog({ files, title, onClose }: { files: FileRoomFile[]; title: string; onClose: () => void }) {
  const drawings = files.filter((f) => f.drawingTab && f.drawingTab !== 'other').slice(0, 25);
  const [rows, setRows] = useState<(DrawingEvent & { file: string })[] | null>(null);
  const [kind, setKind] = useState('');
  useEffect(() => {
    let live = true;
    Promise.all(drawings.map((f) => api.fileRoom.drawingHistory(f.id).then((h) => h.map((e) => ({ ...e, file: f.name }))).catch(() => [])))
      .then((lists) => {
        if (!live) return;
        const seen = new Set<string>();
        // Revisions of one drawing share a history: keep each line once.
        setRows(lists.flat().filter((e) => { const k = `${e.kind}|${e.text}|${e.by}|${e.at}`; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => b.at.localeCompare(a.at)));
      });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const shown = (rows || []).filter((e) => !kind || e.kind === kind);
  const kinds = [...new Set((rows || []).map((e) => e.kind))];
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Audit trail" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(var(--rgb-shade), 0.35)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(720px, 100%)', maxHeight: '90vh', overflow: 'auto', display: 'grid', gap: 10, padding: 20, borderRadius: 16, background: 'var(--surface)', boxShadow: '0 20px 60px rgba(0,0,0,.2)', overflowWrap: 'anywhere' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)', flex: 1 }}>Audit trail — {title}</div>
          <button type="button" className="ak-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          {drawings.length} drawing{drawings.length === 1 ? '' : 's'} on this page{files.length > drawings.length ? ' (other files have no drawing history)' : ''}. Opens are logged once a day per person, from the Approved and Not city-approved tabs.
        </div>
        {kinds.length > 1 && (
          <select aria-label="What happened" value={kind} onChange={(e) => setKind(e.target.value)} style={{ justifySelf: 'start', padding: '5px 10px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), .14)', font: 'inherit', fontSize: 12, background: 'var(--surface)', color: 'var(--ink)' }}>
            <option value="">Everything</option>
            {kinds.map((k) => <option key={k} value={k}>{KIND[k] || k}</option>)}
          </select>
        )}
        {!rows && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Reading the drawings’ history…</div>}
        {rows && !shown.length && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Nothing recorded yet.</div>}
        <div style={{ display: 'grid', gap: 2 }}>
          {shown.slice(0, 400).map((e, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 150px) minmax(0, 1fr)', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(var(--rgb-shade), .06)', fontSize: 12.5 }}>
              <span style={{ color: 'var(--muted)' }}>{when(e.at)}</span>
              <span><b style={{ color: 'var(--ink)' }}>{e.file}</b> — {e.text} <span style={{ color: 'var(--muted)' }}>· {e.by}</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
