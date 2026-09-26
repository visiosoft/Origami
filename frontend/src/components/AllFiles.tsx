import { useEffect, useMemo, useState } from 'react';
import { api, attachmentUrl } from '../api';

type Source = 'lead' | 'client' | 'lead-task' | 'project-task' | 'rfi' | 'file-room';
interface IndexedFile {
  n: number; id: string; name: string; kind: string; mimeType?: string; size?: number; uploadedAt?: string; uploadedBy?: string;
  source: Source; where: string; taskNumber?: string; scope: 'lead-files' | 'tasks' | 'project-tasks' | 'rfis' | 'file-room'; ownerId: string; url?: string;
}

const INK = '#0B1A12';
const MUTED = '#7E9B93';
const SOURCES: [Source | 'all' | 'tasks', string][] = [['all', 'All'], ['lead', 'Lead stages'], ['client', 'From the client'], ['tasks', 'Tasks'], ['rfi', 'RFIs'], ['file-room', 'Plan & File Room']];
const TONE: Record<Source, [string, string]> = {
  lead: ['#EEF3EE', '#173326'], client: ['#E4EFE5', '#145C33'], 'lead-task': ['#FBF0CC', '#8A6D12'], 'project-task': ['#FBF0CC', '#8A6D12'],
  rfi: ['#D6E8E5', '#2F6F68'], 'file-room': ['#E6EAF2', '#3C5C8A'],
};
const size = (b?: number) => (!b ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const day = (d?: string) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

/** Where the browser opens a file from, by where it lives. */
function openUrl(f: IndexedFile) {
  if (f.kind === 'link' && f.url) return f.url;
  if (f.scope === 'file-room') return `/planroom?file=${encodeURIComponent(f.id)}`;
  return attachmentUrl(f.scope as any, f.ownerId, f.id);
}

/**
 * Every file on a lead -- and on the project it became -- in one numbered
 * list: the lead's stage files, what the client uploaded, files on its tasks
 * (with the task number in front), and on a project also its board tasks,
 * RFIs and the Plan & File Room. #1 is the first file ever added; numbers
 * never change as more arrive.
 */
export function AllFiles({ leadId, projectId, reloadKey }: { leadId?: string; projectId?: number; reloadKey?: unknown }) {
  const [data, setData] = useState<{ files: IndexedFile[] } | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [q, setQ] = useState('');
  useEffect(() => {
    const p = projectId != null ? api.leadFiles.allForProject(projectId) : api.leadFiles.all(leadId!);
    p.then((r) => { setData(r as any); setError(''); }).catch((e: Error) => setError(e.message));
  }, [leadId, projectId, reloadKey]);

  const files = data?.files || [];
  const present = useMemo(() => new Set<string>(files.map((f) => (f.source === 'lead-task' || f.source === 'project-task' ? 'tasks' : f.source))), [files]);
  const shown = files.filter((f) => (filter === 'all' || (filter === 'tasks' ? f.source === 'lead-task' || f.source === 'project-task' : f.source === filter))
    && (!q.trim() || `${f.name} ${f.where} ${f.uploadedBy || ''}`.toLowerCase().includes(q.trim().toLowerCase())));

  if (error) return <div style={{ fontSize: 12.5, color: '#8E2E0A' }}>{error}</div>;
  if (!data) return <div style={{ fontSize: 12.5, color: MUTED }}>Loading files…</div>;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {SOURCES.filter(([k]) => k === 'all' || present.has(k)).map(([k, label]) => {
          const n = k === 'all' ? files.length : files.filter((f) => (k === 'tasks' ? f.source === 'lead-task' || f.source === 'project-task' : f.source === k)).length;
          return (
            <span key={k} onClick={() => setFilter(k)} style={{ padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + (filter === k ? '#173326' : 'rgba(20,8,31,0.12)'), background: filter === k ? '#173326' : 'white', color: filter === k ? 'white' : '#43514D' }}>
              {label} <span style={{ opacity: 0.7 }}>{n}</span>
            </span>
          );
        })}
        {files.length > 8 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files…" style={{ marginLeft: 'auto', padding: '6px 11px', borderRadius: 999, border: '1px solid rgba(20,8,31,0.12)', fontSize: 12.5, fontFamily: 'inherit', width: 180 }} />}
      </div>
      {!files.length ? (
        <div style={{ fontSize: 12.5, color: MUTED, padding: '10px 0' }}>No files yet — anything added to this {projectId != null ? 'project' : 'lead'}, its tasks{projectId != null ? ', RFIs or the Plan & File Room' : ' or by the client'} shows here.</div>
      ) : (
        <div style={{ border: '1px solid rgba(20,8,31,0.08)', borderRadius: 12, background: 'white', overflow: 'hidden' }}>
          {shown.map((f) => {
            const [bg, fg] = TONE[f.source];
            const where = f.taskNumber ? f.where.replace(`Task ${f.taskNumber}`, '').replace(/^ · /, '') : f.where;
            return (
              <a key={`${f.scope}-${f.ownerId}-${f.id}`} href={openUrl(f)} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid rgba(20,8,31,0.05)', textDecoration: 'none', color: INK }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#FBF8F2'; }} onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: MUTED, minWidth: 30, fontVariantNumeric: 'tabular-nums' }}>#{f.n}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.taskNumber && <span style={{ fontWeight: 800, color: '#8A6D12', marginRight: 6 }}>Task {f.taskNumber}</span>}{f.name}
                  </span>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: bg, color: fg, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{where || 'Task'}</span>
                    <span style={{ fontSize: 11, color: MUTED }}>{[f.uploadedBy, day(f.uploadedAt), size(f.size), f.kind === 'link' ? 'link' : ''].filter(Boolean).join(' · ')}</span>
                  </span>
                </span>
              </a>
            );
          })}
          {!shown.length && <div style={{ padding: 12, fontSize: 12.5, color: MUTED }}>No files match.</div>}
        </div>
      )}
    </div>
  );
}
