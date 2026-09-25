import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

/** The hold fields a project carries (set only through /projects/:id/hold and /resume). */
export interface HoldFields {
  id: number;
  name: string;
  holdSince?: string;
  holdUntil?: string;
  holdReason?: string;
  holdBy?: string;
  holdTaskId?: string;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const plus = (days: number, months = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** "Oct 25" (or "Oct 25, 2027" when it isn't this year). */
export const holdDay = (iso?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return iso || '';
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
};
export const isOnHold = (p?: Partial<HoldFields> | null) => !!p?.holdSince;
export const holdDue = (p?: Partial<HoldFields> | null) => !!p?.holdUntil && p.holdUntil.slice(0, 10) <= today();

/** "On hold · Oct 25" -- amber, red once the follow-up date has come. */
export function HoldBadge({ project, size = 'sm' }: { project: Partial<HoldFields>; size?: 'sm' | 'md' }) {
  if (!isOnHold(project)) return null;
  const due = holdDue(project);
  return (
    <span title={project.holdReason ? `On hold: ${project.holdReason}` : 'On hold'} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: size === 'md' ? '3px 11px' : '2px 8px', borderRadius: 999,
      fontSize: size === 'md' ? 10.5 : 9.5, fontWeight: 700, whiteSpace: 'nowrap',
      background: due ? '#F2DFD4' : '#FBE9AE', color: due ? '#8E2E0A' : '#93520F',
    }}>
      <svg width={size === 'md' ? 10 : 9} height={size === 'md' ? 10 : 9} viewBox="0 0 24 24" fill="currentColor"><rect x={6} y={4} width={4} height={16} rx={1} /><rect x={14} y={4} width={4} height={16} rx={1} /></svg>
      On hold{project.holdUntil ? ` · ${due ? 'follow up now' : holdDay(project.holdUntil)}` : ''}
    </span>
  );
}

const PRESETS: { label: string; days: number; months: number }[] = [
  { label: '2 weeks', days: 14, months: 0 },
  { label: '1 month', days: 0, months: 1 },
  { label: '2 months', days: 0, months: 2 },
  { label: '3 months', days: 0, months: 3 },
];

const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.14)', fontSize: 13, fontFamily: 'inherit', background: 'white', color: '#0B1A12' };
const label: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 };

/**
 * The hold strip under a project's header: the banner while it's on hold
 * (why, since when, who follows up and when -- with Change / Resume), and the
 * form that puts it on hold. Putting a project on hold creates a follow-up
 * task for the chosen person, due on the date, so it lands on their task list
 * and in their reminder email.
 */
export function ProjectHoldPanel({ project, open, canManage, onOpen, onClose, onSaved }: {
  project: HoldFields;
  open: boolean;
  canManage: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSaved: (updated: HoldFields) => void;
}) {
  const { users, currentUser, toast } = useApp();
  const staff = users
    .filter((u) => u.status !== 'suspended' && (!u.tier || u.tier === 'internal'))
    .sort((a, b) => a.name.localeCompare(b.name));
  const onHold = isOnHold(project);

  const [until, setUntil] = useState('');
  const [reason, setReason] = useState('');
  const [followUpId, setFollowUpId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Start the form from the current hold (when changing it) or a month out.
  useEffect(() => {
    if (!open) return;
    setUntil(project.holdUntil || plus(0, 1));
    setReason(project.holdReason || '');
    setFollowUpId(currentUser?.id || '');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project.id]);

  const submit = () => {
    if (!until) { setError('Pick the date to follow up.'); return; }
    setBusy(true); setError('');
    api.projects.hold(project.id, { until, reason, followUpId: followUpId || undefined })
      .then((p: any) => {
        const who = staff.find((u) => u.id === followUpId)?.name || 'you';
        toast(onHold ? 'Hold updated' : `${project.name} is on hold — follow-up task for ${who}, due ${holdDay(until)}`);
        onSaved(p);
        onClose();
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  const resume = () => {
    setBusy(true); setError('');
    api.projects.resume(project.id)
      .then((p: any) => { toast(`${project.name} is active again`); onSaved(p); onClose(); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  if (!onHold && !open) return null;
  const due = holdDue(project);

  return (
    <div style={{ padding: '12px 20px', background: due ? '#FBEDE6' : '#FDF6DC', borderBottom: '1px solid rgba(20,8,31,0.06)', flexShrink: 0 }}>
      {onHold && !open && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: due ? '#8E2E0A' : '#93520F' }}>
              On hold since {holdDay(project.holdSince)}{project.holdBy ? ` (${project.holdBy})` : ''} — {due ? 'follow-up is due' : `follow up ${holdDay(project.holdUntil)}`}
            </div>
            {project.holdReason && <div style={{ fontSize: 12.5, color: '#43514D', marginTop: 3, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{project.holdReason}</div>}
            <div style={{ fontSize: 11.5, color: '#7E9B93', marginTop: 3 }}>The follow-up is a task on this project, so it shows on the Tasks page and in the reminder email.</div>
          </div>
          {canManage && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={onOpen} disabled={busy} style={{ padding: '7px 14px', borderRadius: 999, border: '1px solid rgba(20,8,31,0.14)', background: 'white', fontSize: 12, fontWeight: 700, color: '#173326', cursor: 'pointer', fontFamily: 'inherit' }}>Change</button>
              <button type="button" onClick={resume} disabled={busy} style={{ padding: '7px 14px', borderRadius: 999, border: 'none', background: '#173326', fontSize: 12, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>{busy ? 'Saving…' : 'Resume project'}</button>
            </div>
          )}
        </div>
      )}

      {open && (
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0B1A12', marginBottom: 10 }}>{onHold ? 'Change the hold' : `Put ${project.name} on hold`}</div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
            <div>
              <div style={label}>Follow up on</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                {PRESETS.map((p) => {
                  const d = plus(p.days, p.months);
                  return (
                    <span key={p.label} onClick={() => setUntil(d)} style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', background: until === d ? '#173326' : 'white', color: until === d ? 'white' : '#43514D', border: '1px solid ' + (until === d ? '#173326' : 'rgba(20,8,31,0.12)') }}>{p.label}</span>
                  );
                })}
              </div>
              <input type="date" value={until} min={today()} onChange={(e) => setUntil(e.target.value)} style={input} />
            </div>
            <div>
              <div style={label}>Who follows up</div>
              <select value={followUpId} onChange={(e) => setFollowUpId(e.target.value)} style={input}>
                {!staff.some((u) => u.id === followUpId) && <option value="">Me</option>}
                {staff.map((u) => <option key={u.id} value={u.id}>{u.name}{u.id === currentUser?.id ? ' (me)' : ''}</option>)}
              </select>
              <div style={{ fontSize: 11, color: '#7E9B93', marginTop: 5, lineHeight: 1.45 }}>Gets a task due on that date, and the usual reminder email.</div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={label}>Why is it on hold?</div>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Client waiting on financing; check back after their bank appraisal" style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} />
          </div>
          {error && <div style={{ fontSize: 12, fontWeight: 600, color: '#8E2E0A', marginTop: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={submit} disabled={busy} style={{ padding: '8px 16px', borderRadius: 999, border: 'none', background: '#173326', fontSize: 12.5, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
              {busy ? 'Saving…' : onHold ? 'Save changes' : 'Put on hold'}
            </button>
            <button type="button" onClick={onClose} disabled={busy} style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid rgba(20,8,31,0.14)', background: 'white', fontSize: 12.5, fontWeight: 700, color: '#43514D', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
