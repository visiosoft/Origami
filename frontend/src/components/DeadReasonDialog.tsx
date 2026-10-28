import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DEAD_KINDS, KINDS_FOR_STAGE, deadReasonMissing, type DeadKind, type DeadReason } from '../data/deadReasons';

/**
 * Why a lead died (Oct 26 review notes): moving a lead to Cold / Lost asks Cold
 * or Lost, to Cancelled / Pass asks Cancelled or Pass, then the reasons (one or
 * more; Cancelled's in groups), notes, and what each kind needs (the last
 * conversation date for Cold, where a bad review was found for Reputation).
 * Resolves with the answer, or null when cancelled (the move doesn't happen).
 */
export function askDeadReason(name: string, stage: 'cold' | 'rejected', kind?: DeadKind): Promise<DeadReason | null> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (v: DeadReason | null) => { root.unmount(); host.remove(); resolve(v); };
    root.render(<DeadReasonDialog name={name} stage={stage} initialKind={kind} onDone={done} />);
  });
}

const chip = (on: boolean) => ({
  padding: '6px 12px', borderRadius: 999, border: '1px solid ' + (on ? 'var(--forest)' : 'rgba(var(--rgb-shade), 0.14)'),
  background: on ? 'var(--forest)' : 'var(--surface)', color: on ? '#fff' : 'var(--body)', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left' as const,
});
const field = { boxSizing: 'border-box' as const, width: '100%', padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--panel)', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)' };
const small = { fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' };

function DeadReasonDialog({ name, stage, initialKind, onDone }: { name: string; stage: 'cold' | 'rejected'; initialKind?: DeadKind; onDone: (v: DeadReason | null) => void }) {
  const kinds = KINDS_FOR_STAGE[stage];
  const [kind, setKind] = useState<DeadKind>(initialKind && kinds.includes(initialKind) ? initialKind : kinds[0]);
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [lastContactAt, setLastContactAt] = useState('');
  const [reviewWhere, setReviewWhere] = useState('');
  const [clientScore, setClientScore] = useState('');
  const def = DEAD_KINDS[kind];
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone(null); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onDone]);

  const pickKind = (k: DeadKind) => { setKind(k); setReasons([]); };
  const toggle = (code: string) => setReasons((cur) => def.single ? [code] : cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]);
  const answer: DeadReason = {
    kind, reasons, note: note.trim() || undefined,
    ...(kind === 'cold' ? { lastContactAt } : {}),
    ...(kind === 'lost' && reasons.includes('reputation') ? { reviewWhere: reviewWhere.trim() } : {}),
    ...(kind === 'pass' && clientScore.trim() ? { clientScore: clientScore.trim() } : {}),
  };
  const missing = deadReasonMissing(answer);

  return (
    <div onClick={() => onDone(null)} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(var(--rgb-shade), 0.45)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div role="dialog" aria-label={stage === 'cold' ? 'Why did it go cold or get lost' : 'Why was it cancelled or passed'} onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box', background: 'var(--surface)', borderRadius: 'var(--r-12)', padding: 20, boxShadow: '0 18px 50px rgba(var(--rgb-ink), 0.25)', display: 'grid', gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{stage === 'cold' ? 'Cold or lost — why?' : 'Cancelled or passed — why?'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', overflowWrap: 'anywhere' }}>{name}</div>
        </div>

        <div role="radiogroup" aria-label="What happened" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {kinds.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => pickKind(k)} style={{ ...chip(kind === k), borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 13 }}>{DEAD_KINDS[k].label}</div>
              <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.85, marginTop: 2 }}>{DEAD_KINDS[k].hint}</div>
            </button>
          ))}
        </div>

        <div>
          <div style={{ ...small, marginBottom: 6 }}>{def.single ? 'Reason' : 'Reasons (one or more)'}</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {def.reasons.map((r) => r.subs ? (
              <div key={r.code}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 5 }}>{r.label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {r.subs.map((s) => { const code = `${r.code}.${s.code}`; return (
                    <button key={code} type="button" role="checkbox" aria-checked={reasons.includes(code)} onClick={() => toggle(code)} style={chip(reasons.includes(code))}>{s.label}</button>
                  ); })}
                </div>
              </div>
            ) : (
              <button key={r.code} type="button" role={def.single ? 'radio' : 'checkbox'} aria-checked={reasons.includes(r.code)} onClick={() => toggle(r.code)} title={r.hint} style={chip(reasons.includes(r.code))}>
                {r.label}{r.hint && <span style={{ fontWeight: 500, opacity: 0.8 }}> — {r.hint}</span>}
              </button>
            ))}
          </div>
        </div>

        {kind === 'cold' && (
          <label style={{ display: 'grid', gap: 5 }}>
            <span style={small}>Last known conversation</span>
            <input type="date" value={lastContactAt} onChange={(e) => setLastContactAt(e.target.value)} style={field} />
          </label>
        )}
        {kind === 'lost' && reasons.includes('reputation') && (
          <label style={{ display: 'grid', gap: 5 }}>
            <span style={small}>Where was the bad review found?</span>
            <input value={reviewWhere} onChange={(e) => setReviewWhere(e.target.value)} placeholder="e.g. Yelp, Google, Nextdoor — a link if you have one" style={field} />
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>A high-priority task to follow it up is made for the lead’s owner.</span>
          </label>
        )}
        {kind === 'pass' && (
          <label style={{ display: 'grid', gap: 5 }}>
            <span style={small}>Client score (if we have one)</span>
            <input value={clientScore} onChange={(e) => setClientScore(e.target.value)} placeholder="e.g. 42 / 100" style={field} />
          </label>
        )}
        <label style={{ display: 'grid', gap: 5 }}>
          <span style={small}>Our notes</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Anything worth remembering about this one" style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} />
        </label>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          {missing && <span style={{ marginRight: 'auto', fontSize: 11.5, color: 'var(--muted)' }}>{missing}</span>}
          <button type="button" onClick={() => onDone(null)} style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--body)', cursor: 'pointer' }}>Cancel</button>
          <button type="button" disabled={!!missing} onClick={() => onDone(answer)} style={{ padding: '8px 16px', borderRadius: 999, border: 0, background: missing ? 'var(--c-c9d4cc)' : 'var(--forest)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: '#fff', cursor: missing ? 'default' : 'pointer' }}>Save</button>
        </div>
      </div>
    </div>
  );
}
