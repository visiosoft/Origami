import { useEffect, useState } from 'react';
import { api } from '../api';
import { changeText, headline, unseen, type AuditRow } from '../data/audit';

const seenKey = (projectId: number) => `origami.auditSeen.${projectId}`;
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * A project's audit trail on its Overview (Oct 27 sync): who changed what and
 * when. Entries since you last looked are marked New and pulse briefly, so
 * fresh updates stand out; opening the trail counts as seeing them.
 */
export function ProjectAuditTrail({ projectId }: { projectId: number }) {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [seenAt] = useState<string | null>(() => { try { return localStorage.getItem(seenKey(projectId)); } catch { return null; } });
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    let live = true;
    api.audit.project(projectId)
      .then((r) => { if (!live) return; const list = Array.isArray(r) ? r : []; setRows(list); try { if (list[0]) localStorage.setItem(seenKey(projectId), list[0].at); } catch { /* private mode */ } })
      .catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [projectId]);
  if (!rows) return null;
  const fresh = new Set(unseen(rows, seenAt).map((r) => r.id));
  const list = showAll ? rows : rows.slice(0, 8);
  return (
    <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>Audit trail</span>
        {fresh.size > 0 && <span style={{ padding: '1px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: 'var(--c-fbf0cc)', color: '#6B540C' }}>{fresh.size} new</span>}
      </div>
      {!rows.length ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>No changes recorded on this project yet.</div> : (
        <div style={{ display: 'grid', gap: 6 }}>
          {list.map((r) => {
            const isNew = fresh.has(r.id);
            return (
              <div key={r.id} style={{ display: 'flex', gap: 10, padding: '8px 10px', borderRadius: 9, background: isNew ? 'var(--c-fbf0cc)' : 'var(--panel)', animation: isNew ? 'pulse 1.2s ease-in-out 3' : undefined }}>
                <span aria-hidden="true" style={{ width: 7, height: 7, marginTop: 6, borderRadius: 99, flexShrink: 0, background: isNew ? '#C7A64A' : 'rgba(var(--rgb-shade), 0.2)' }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 600, overflowWrap: 'anywhere' }}>{isNew && <b style={{ color: '#6B540C' }}>New · </b>}{headline(r)}</div>
                  {r.changes.length > 0 && <div style={{ fontSize: 11.5, color: 'var(--body)', marginTop: 2, overflowWrap: 'anywhere' }}>{r.changes.slice(0, 3).map(changeText).join(' · ')}{r.changes.length > 3 ? ` · +${r.changes.length - 3} more` : ''}</div>}
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{when(r.at)}</span>
              </div>
            );
          })}
          {rows.length > 8 && <button type="button" onClick={() => setShowAll(!showAll)} style={{ justifySelf: 'start', border: 0, background: 'none', padding: 0, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--forest)', cursor: 'pointer' }}>{showAll ? 'Show fewer' : `Show all ${rows.length}`}</button>}
        </div>
      )}
    </div>
  );
}
