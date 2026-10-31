import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { outcomeLabel } from '../data/contractorBids';
import { INTERACTION_KINDS, companyOf, type ContactActivity as Activity, type ContactInteraction, type Person } from '../data/people';
import { Skeleton } from './Skeleton';

const head: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 };
const input: React.CSSProperties = { boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 12.5, color: 'var(--ink)', outline: 'none', minWidth: 0 };
const ALERT_LABEL: Record<string, string> = { responsiveness: 'Responsiveness', interactions: 'Interactions', pulse: 'Pulse' };
const today = () => new Date().toISOString().slice(0, 10);
const day = (v?: string | null) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(v.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const kindLabel = (k: string) => (INTERACTION_KINDS.find(([x]) => x === k) || [k, k])[1];

/**
 * A contact's Activity (Oct 27 backlog): the alerts (responsiveness, proposals
 * without an award, no contact in 12 months), the company's point of contact,
 * interactions logged by hand, and their RFPs / estimates.
 */
export function ContactActivity({ person, canManage, onChanged }: { person: Person; canManage: boolean; onChanged: () => void }) {
  const { toast } = useApp();
  const [a, setA] = useState<Activity | null>(null);
  const [draft, setDraft] = useState<{ kind: ContactInteraction['kind']; at: string; note: string } | null>(null);
  const load = () => api.people.activity(person.id).then(setA).catch(() => setA(null));
  useEffect(() => { setA(null); setDraft(null); void load(); }, [person.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const company = companyOf(person);
  const isFirm = ['Consultant', 'Sub', 'Authority', 'Vendor'].includes(person.kind);
  const fail = (e: unknown) => toast('⚠ ' + ((e as Error).message || 'Not saved'));
  const save = async () => {
    if (!draft) return;
    try { await api.people.logInteraction(person.id, { kind: draft.kind, at: draft.at, note: draft.note }); setDraft(null); await load(); onChanged(); toast('Logged'); } catch (e) { fail(e); }
  };
  const remove = async (i: ContactInteraction) => {
    if (!confirm('Delete this entry?')) return;
    try { await api.people.removeInteraction(person.id, i.id); await load(); } catch (e) { fail(e); }
  };
  const togglePoc = async (on: boolean) => {
    try { await api.people.setPointOfContact(person.id, on); await load(); onChanged(); } catch (e) { fail(e); }
  };

  return (
    <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)', display: 'grid', gap: 14 }}>
      <div style={{ ...head, marginBottom: 0 }}>Activity</div>
      {!a ? <Skeleton label="Loading…" /> : <>
        {a.alerts.length > 0 && (
          <div role="alert" style={{ display: 'grid', gap: 6, padding: '11px 13px', borderRadius: 10, background: '#FFF6E5', border: '1px solid #F1D29A' }}>
            {a.alerts.map((x, i) => (
              <div key={i} style={{ fontSize: 12.5, color: '#7A4A0B', lineHeight: 1.45 }}><b>{ALERT_LABEL[x.kind]}:</b> {x.text}</div>
            ))}
          </div>
        )}

        {company && (
          <div style={{ fontSize: 12.5, color: 'var(--body)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {!isFirm ? (
              <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', cursor: canManage ? 'pointer' : 'default' }}>
                <input type="checkbox" disabled={!canManage} checked={a.pointOfContact?.id === person.id} onChange={(e) => void togglePoc(e.target.checked)} />
                Point of contact for {company}
              </label>
            ) : null}
            {(isFirm || (a.pointOfContact && a.pointOfContact.id !== person.id)) && (
              <span style={{ color: 'var(--muted)' }}>{isFirm ? 'Point of contact' : `${company}'s point of contact`}: <b style={{ color: 'var(--ink)' }}>{a.pointOfContact?.name || 'not set — tick it on the person'}</b></span>
            )}
          </div>
        )}

        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>Interactions</span>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Last known: {day(a.lastInteractionAt)}</span>
            {canManage && !draft && <button type="button" onClick={() => setDraft({ kind: 'call', at: today(), note: '' })} style={{ marginLeft: 'auto', border: 0, background: 'transparent', padding: 0, font: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--forest)', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Log</button>}
          </div>
          {draft && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6, marginBottom: 8, padding: 10, borderRadius: 10, background: 'var(--panel)' }}>
              <select aria-label="Kind" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as ContactInteraction['kind'] })} style={input}>{INTERACTION_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <input aria-label="When" type="date" value={draft.at} max={today()} onChange={(e) => setDraft({ ...draft, at: e.target.value })} style={input} />
              <input aria-label="What happened" placeholder={draft.kind === 'note' ? 'The note' : 'What it was about (optional)'} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} style={{ ...input, gridColumn: '1 / -1' }} />
              <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button type="button" onClick={() => void save()} style={{ padding: '7px 14px', borderRadius: 999, border: 0, background: 'var(--forest)', color: '#fff', font: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Log it</button>
                <button type="button" onClick={() => setDraft(null)} style={{ border: 0, background: 'transparent', padding: 0, font: 'inherit', fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>Cancel</button>
              </span>
            </div>
          )}
          {a.interactions.length === 0 && !draft && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nothing logged yet.</div>}
          <div style={{ display: 'grid', gap: 4 }}>
            {a.interactions.slice(0, 12).map((i) => (
              <div key={i.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '7px 10px', borderRadius: 8, background: 'var(--panel)', fontSize: 12.5 }}>
                <span style={{ width: 92, flexShrink: 0, color: 'var(--muted)' }}>{day(i.at)}</span>
                <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)', overflowWrap: 'anywhere' }}><b>{kindLabel(i.kind)}</b>{i.note ? ` — ${i.note}` : ''}{i.byName ? <span style={{ color: 'var(--muted)' }}> · {i.byName}</span> : null}</span>
                {canManage && <button type="button" aria-label="Delete entry" onClick={() => void remove(i)} style={{ border: 0, background: 'transparent', padding: 0, color: '#8E2E0A', cursor: 'pointer' }}>×</button>}
              </div>
            ))}
          </div>
        </div>

        {a.bids.length > 0 && (
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>RFPs &amp; proposals</div>
            <div style={{ display: 'grid', gap: 4 }}>
              {a.bids.slice(0, 10).map((b) => (
                <div key={b.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '7px 10px', borderRadius: 8, background: 'var(--panel)', fontSize: 12.5 }}>
                  <span style={{ width: 92, flexShrink: 0, color: 'var(--muted)' }}>{day(b.dateReceived)}</span>
                  <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)', overflowWrap: 'anywhere' }}>
                    {b.projectName || 'RFP'}
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--body)' }}>{outcomeLabel(b.outcome)}{b.dueDate && (b.outcome === 'invited' || b.outcome === 'interested') ? ` · due ${day(b.dueDate)}` : ''}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </>}
    </div>
  );
}
