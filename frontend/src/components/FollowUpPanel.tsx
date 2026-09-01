import { useState } from 'react';
import { api } from '../api';
import type { User } from '../data/users';

/** The coordinator gets three chases before the lead is handed on. */
export const MAX_FOLLOW_UPS = 3;

const METHODS = ['Called', 'WhatsApp', 'Voice note', 'Email', 'SMS', 'In person', 'Other'];
const OUTCOMES = ['No answer', 'No reply', 'Spoke to them', 'Call back later', 'Not interested', 'Wrong number'];

/** What each attempt is for, shown before it has been made. */
const PLAN = [
  'First chase',
  'Second chase',
  `Last chase · assign to project manager / admin`,
];

export interface FollowUp {
  attempt: number;
  method: string;
  outcome: string;
  note: string;
  target: string;
  contactName: string;
  at: string;
  by: string;
  assignedTo?: string;
}

const chip = (on: boolean, tone: 'method' | 'outcome'): React.CSSProperties => ({
  padding: '5px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', userSelect: 'none',
  border: '1px solid ' + (on ? (tone === 'method' ? '#5B2BC9' : '#C77A0A') : 'rgba(20,8,31,0.12)'),
  background: on ? (tone === 'method' ? '#F1ECFC' : '#FBEEDC') : 'white',
  color: on ? (tone === 'method' ? '#5B2BC9' : '#8a5a1e') : '#5c5666',
});

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.12)', background: 'white', fontSize: 12.5,
  fontFamily: 'inherit', color: '#0B1A12', outline: 'none',
};

const shortWhen = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

interface Props {
  dealId: string;
  followUps: FollowUp[];
  /** Internal people the lead can be handed to on the last attempt. */
  users: User[];
  onLogged: (followUps: FollowUp[], assignee?: string) => void;
}

/**
 * Chasing a lead that has not replied.
 *
 * Three attempts, then it is handed to a manager rather than chased a fourth
 * time by the same person. Each attempt records how it was tried, what came of
 * it, and whether it went to the lead or one of their referrals.
 */
export function FollowUpPanel({ dealId, followUps, users, onLogged }: Props) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState('Called');
  const [outcome, setOutcome] = useState('No answer');
  const [note, setNote] = useState('');
  const [target, setTarget] = useState<'lead' | 'referral'>('lead');
  const [contactName, setContactName] = useState('');
  const [assignToId, setAssignToId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const done = followUps.length;
  const attempt = Math.min(done + 1, MAX_FOLLOW_UPS);
  const isLast = attempt === MAX_FOLLOW_UPS;
  const exhausted = done >= MAX_FOLLOW_UPS;
  const internal = users.filter((u) => u.tier === 'internal' && u.status !== 'suspended');

  const submit = () => {
    if (isLast && !assignToId) { setError('Choose who the lead is handed to.'); return; }
    if (target === 'referral' && !contactName.trim()) { setError('Who did you contact?'); return; }
    setSaving(true);
    setError('');
    const assignTo = internal.find((u) => u.id === assignToId);
    api.pipeline.logFollowUp(dealId, {
      method, outcome, note: note.trim(), target,
      contactName: contactName.trim(),
      assignToId: isLast ? assignToId : undefined,
      assignToName: isLast ? assignTo?.name : undefined,
    })
      .then((deal: any) => {
        onLogged((deal?.followUps || []) as FollowUp[], deal?.assignee);
        setOpen(false); setNote(''); setContactName(''); setTarget('lead');
        setMethod('Called'); setOutcome('No answer'); setAssignToId('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false));
  };

  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0B1A12' }}>Follow-up</span>
        {!exhausted && (
          <span onClick={() => setOpen((v) => !v)} style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#5B2BC9', cursor: 'pointer' }}>
            {open ? 'Cancel' : '+ Log an attempt'}
          </span>
        )}
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#14081F', marginBottom: 8 }}>
        {exhausted ? `All ${MAX_FOLLOW_UPS} attempts made` : `Attempt ${attempt} of ${MAX_FOLLOW_UPS}`}
      </div>

      {/* The three chases: what was done, or what is planned. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {Array.from({ length: MAX_FOLLOW_UPS }, (_, i) => {
          const made = followUps[i];
          const isNext = !made && i === done;
          return (
            <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', opacity: made || isNext ? 1 : 0.5 }}>
              <span style={{
                width: 18, height: 18, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9.5, fontWeight: 700,
                background: made ? '#173326' : isNext ? '#EDE3CF' : '#F0EEE9',
                color: made ? 'white' : '#756E80',
              }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {made ? (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0B1A12' }}>
                      {PLAN[i].split(' · ')[0]} · {made.method} · {made.outcome}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#7E9B93', marginTop: 1 }}>
                      {shortWhen(made.at)} · {made.by}
                      {made.target === 'referral' && made.contactName ? ` · via ${made.contactName}` : ''}
                      {made.assignedTo ? ` · handed to ${made.assignedTo}` : ''}
                    </div>
                    {made.note && (
                      <div style={{ fontSize: 11, color: '#4A4357', marginTop: 4, padding: '6px 9px', background: '#FBF8F2', borderRadius: 7, lineHeight: 1.4 }}>
                        {made.note}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: '#756E80' }}>{PLAN[i]}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {open && !exhausted && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: '#F9F7FE', border: '1px solid rgba(91,43,201,0.12)' }}>
          {error && <div style={{ fontSize: 11.5, fontWeight: 600, color: '#8E2E0A', marginBottom: 8 }}>{error}</div>}

          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#43514D', marginBottom: 6 }}>Who did you contact?</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <span onClick={() => setTarget('lead')} style={chip(target === 'lead', 'method')}>The lead</span>
            <span onClick={() => setTarget('referral')} style={chip(target === 'referral', 'method')}>A referral</span>
          </div>
          {target === 'referral' && (
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name of the person you contacted" style={{ ...inputStyle, marginBottom: 10 }} />
          )}

          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#43514D', marginBottom: 6 }}>How did you try?</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {METHODS.map((m) => <span key={m} onClick={() => setMethod(m)} style={chip(method === m, 'method')}>{m}</span>)}
          </div>

          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#43514D', marginBottom: 6 }}>What happened?</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {OUTCOMES.map((o) => <span key={o} onClick={() => setOutcome(o)} style={chip(outcome === o, 'outcome')}>{o}</span>)}
          </div>

          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Anything worth remembering…" style={{ ...inputStyle, resize: 'vertical', marginBottom: 10 }} />

          {isLast && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#43514D', marginBottom: 5 }}>
                Hand to <span style={{ color: '#8E2E0A' }}>*</span>
              </div>
              <select value={assignToId} onChange={(e) => setAssignToId(e.target.value)} style={inputStyle}>
                <option value="">Choose a project manager or admin…</option>
                {internal.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <div style={{ fontSize: 10.5, color: '#7E9B93', marginTop: 4, lineHeight: 1.45 }}>
                This is the last chase, so the lead moves to them rather than being called a fourth time.
              </div>
            </div>
          )}

          <div onClick={saving ? undefined : submit} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, textAlign: 'center', cursor: saving ? 'default' : 'pointer', background: saving ? '#9AB0A4' : '#173326', color: 'white' }}>
            {saving ? 'Saving…' : `Log attempt ${attempt}`}
          </div>
        </div>
      )}
    </div>
  );
}
