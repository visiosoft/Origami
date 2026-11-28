import { useEffect, useState } from 'react';
import { api } from '../api';

export interface BoardAction {
  id: string; serial?: string | null; title: string; status?: string | null; completed?: boolean; assignee?: string | null; assigneeId?: string | null;
  dueDate?: string | null; projectId: number | null; meetingId: string; archivedAt?: string | null;
}

/**
 * Nov 27 (Weekly Sync): "meeting tasks go on the board". Open Tasks raised in
 * meetings before this still sit in the Request Log. An administrator sees
 * them here first; Apply moves each to its project's board (or General) with
 * its history, comments and files, and closes the log entry with a note.
 * Nothing is deleted. Shows nothing when there's nothing to move.
 */
export function MoveMeetingTasksBanner({ onApplied }: { onApplied?: () => void }) {
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof api.meetings.moveToBoardPlan>> | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.meetings.moveToBoardPlan().then(setPlan).catch(() => setPlan(null)); }, []);
  if (done) return <div role="status" className="mt-banner" style={banner}>✓ {done}</div>;
  if (!plan?.count) return null;
  const apply = async () => {
    setBusy(true); setErr('');
    try {
      const r = await api.meetings.moveToBoardApply();
      setDone(`${r.count} meeting task${r.count === 1 ? '' : 's'} moved to the boards. Each log entry is closed with a note pointing to its board task.`);
      onApplied?.();
    } catch (e) { setErr((e as Error).message || 'Not moved'); }
    finally { setBusy(false); }
  };
  const byProject = plan.rows.reduce<Record<string, number>>((m, r) => { m[r.projectName] = (m[r.projectName] || 0) + 1; return m; }, {});
  return (
    <div className="mt-banner" style={banner}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ flex: '1 1 260px' }}>
          <b>{plan.count} open meeting task{plan.count === 1 ? '' : 's'}</b> still in the Request Log. Meeting tasks now go on the project boards — move these too?
          <span className="mt-muted"> {Object.entries(byProject).map(([p, n]) => `${p} ${n}`).join(' · ')}</span>
        </span>
        <button type="button" className="ak-btn" onClick={() => setOpen((v) => !v)}>{open ? 'Hide the list' : 'Preview'}</button>
        {open && <button type="button" className="ak-btn is-dark" disabled={busy} onClick={() => void apply()}>{busy ? 'Moving…' : `Apply — move ${plan.count}`}</button>}
      </div>
      {open && (
        <div style={{ display: 'grid', gap: 2, marginTop: 10, maxHeight: 320, overflow: 'auto' }}>
          {plan.rows.map((r) => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 160px)', gap: 10, fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid rgba(var(--rgb-shade), .06)' }}>
              <span style={{ overflowWrap: 'anywhere' }}><b>{r.serial ? `${r.serial} · ` : ''}{r.subject}</b> <span className="mt-muted">{[r.assignee && 'to ' + r.assignee, r.dueDate && 'due ' + r.dueDate, r.status].filter(Boolean).join(' · ')}</span></span>
              <span>→ {r.projectName} board</span>
            </div>
          ))}
          <div className="mt-muted" style={{ fontSize: 11.5, marginTop: 6 }}>Each comes along with its history, comments, files, people and dates. The log entry is closed with “Moved to the board → T-…”; nothing is deleted.</div>
        </div>
      )}
      {err && <div role="alert" style={{ color: '#8E2E0A', fontSize: 12.5, marginTop: 6 }}>⚠ {err}</div>}
    </div>
  );
}

const banner: React.CSSProperties = { padding: '12px 14px', borderRadius: 12, background: 'var(--amber-light, #FBEFD5)', fontSize: 13, color: 'var(--ink)', marginBottom: 12 };
