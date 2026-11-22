import { useEffect, useState } from 'react';
import { api } from '../../api';

type Callout = { id: string; n: number; fileId: string; page: number; kind: string; note: string; authorName: string; draft: boolean };

/**
 * Nov 17 (Edward): the drawings for an RFI, with numbered callouts, at the
 * top of the RFI -- so a reviewer sees where to look. Markups made for an RFI
 * sit on its own draft layer that only our team sees; once the RFI is
 * answered, "Publish to the drawing set" puts them where everyone sees them.
 */
export function RfiCallouts({ rfi, drawings, canManage, onPublished }: {
  rfi: { id: string; number: string; status: string };
  drawings: { fileId: string; name: string }[];
  canManage: boolean;
  onPublished?: () => void;
}) {
  const [rows, setRows] = useState<Callout[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const load = () => { api.rfis.callouts(rfi.id).then(setRows).catch(() => setRows([])); };
  useEffect(load, [rfi.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const markUp = async (fileId: string) => {
    setBusy(true);
    try {
      const r = await api.rfis.draftLayer(rfi.id, fileId);
      window.open(`/planroom?file=${encodeURIComponent(fileId)}&rfi=${encodeURIComponent(rfi.id)}&rfiNumber=${encodeURIComponent(r.number)}&layer=${encodeURIComponent(r.layer)}`, '_blank', 'noopener');
    } catch (e) { setMsg((e as Error).message || 'Could not open the drawing'); }
    finally { setBusy(false); }
  };
  const publish = async () => {
    if (!window.confirm('Publish this RFI’s markups to the drawing set? Everyone who sees the drawing will see them.')) return;
    setBusy(true);
    try { const r = await api.rfis.publishMarkups(rfi.id); setMsg(`${r.published} markup${r.published === 1 ? '' : 's'} published on layer “${r.layer}”.`); load(); onPublished?.(); }
    catch (e) { setMsg((e as Error).message || 'Could not publish'); }
    finally { setBusy(false); }
  };
  const nameOf = (fileId: string) => drawings.find((d) => d.fileId === fileId)?.name || 'Drawing';
  const drafts = (rows || []).filter((c) => c.draft).length;
  const answered = rfi.status === 'answered' || rfi.status === 'closed';
  const chip = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), .14)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--ink)' } as const;

  return (
    <div className="rfi-callouts" style={{ display: 'grid', gap: 10 }}>
      {!drawings.length && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>No drawing linked yet — link one under Reference, then mark it up here.</div>}
      {drawings.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {drawings.map((d) => (
            <span key={d.fileId} style={{ display: 'inline-flex', gap: 4 }}>
              <a href={`/planroom?file=${encodeURIComponent(d.fileId)}`} target="_blank" rel="noopener noreferrer" style={{ ...chip, textDecoration: 'none' }}>📐 {d.name}</a>
              {canManage && <button type="button" disabled={busy} onClick={() => markUp(d.fileId)} style={chip} title="Draw on this RFI’s own layer — only our team sees it until it’s published">✎ Mark up for this RFI</button>}
            </span>
          ))}
        </div>
      )}
      {rows && rows.length > 0 && (
        <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
          {rows.map((c) => (
            <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
              <span aria-label={`Callout ${c.n}`} style={{ width: 22, height: 22, borderRadius: 999, background: c.draft ? '#B0662F' : 'var(--forest)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{c.n}</span>
              <a href={`/planroom?file=${encodeURIComponent(c.fileId)}&markup=${encodeURIComponent(c.id)}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ink)', textDecoration: 'none', fontWeight: 600 }}>
                {c.note || c.kind} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· {nameOf(c.fileId)} p. {c.page}{c.draft ? ' · draft (our team only)' : ' · on the set'}</span>
              </a>
            </li>
          ))}
        </ol>
      )}
      {canManage && drafts > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" disabled={busy || !answered} onClick={publish} style={{ ...chip, background: answered ? 'var(--forest)' : 'var(--surface)', color: answered ? '#fff' : 'var(--muted)', borderColor: answered ? 'var(--forest)' : undefined }}>
            Publish {drafts} to the drawing set
          </button>
          {!answered && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Available once the RFI is answered, so only vetted markups reach the trades.</span>}
        </div>
      )}
      {msg && <div role="status" style={{ fontSize: 12, color: 'var(--body)' }}>{msg}</div>}
    </div>
  );
}
