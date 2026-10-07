import { useEffect, useState } from 'react';
import { api, type FileShare } from '../api';

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** The record of File Room files emailed to people -- for a project, or for one file. */
export function ShareHistory({ projectId, fileId, refreshKey = 0, onOpenFile, empty }: {
  projectId?: number; fileId?: string; refreshKey?: number; onOpenFile?: (id: string) => void; empty?: string;
}) {
  const [rows, setRows] = useState<FileShare[] | null>(null);
  useEffect(() => {
    let live = true;
    api.fileRoom.shares({ projectId, fileId }).then((r) => { if (live) setRows(Array.isArray(r) ? r : []); }).catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [projectId, fileId, refreshKey]);
  if (!rows) return <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</div>;
  if (!rows.length) return <div style={{ fontSize: 12, color: 'var(--muted)' }}>{empty || 'Nothing emailed yet.'}</div>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.map((s) => (
        <div key={s.id} style={{ background: 'var(--panel)', borderRadius: 10, padding: '10px 12px', display: 'grid', gap: 4 }}>
          <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.45 }}>
            <b>{s.sentByName}</b> emailed {fileId ? 'this file' : `${s.files.length} file${s.files.length === 1 ? '' : 's'}`} to <b style={{ wordBreak: 'break-word' }}>{s.to}</b>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{when(s.sentAt)}{fileId && s.files.length > 1 ? ` · with ${s.files.length - 1} other file${s.files.length === 2 ? '' : 's'}` : ''}</div>
          {!fileId && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {s.files.map((f) => (
                <span key={f.id} onClick={onOpenFile ? () => onOpenFile(f.id) : undefined} title={(f.folderPath || []).join(' › ') || 'Project root'}
                  style={{ fontSize: 11.5, padding: '2px 9px', borderRadius: 999, background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), 0.1)', cursor: onOpenFile ? 'pointer' : 'default' }}>{f.name}</span>
              ))}
            </div>
          )}
          {s.note && <div style={{ fontSize: 12, color: 'var(--body)', fontStyle: 'italic' }}>“{s.note}”</div>}
        </div>
      ))}
    </div>
  );
}
