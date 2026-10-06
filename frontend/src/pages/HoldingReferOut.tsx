import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { STAGES, type Deal } from '../data/pipeline';
import { AkDate, AkPage, AkPill, AkRow, AkSeg, AkStats, akDay, akDaysFrom, akToday } from '../components/ActionKit';

type View = 'hold' | 'referred' | 'closed';
const stageOf = (k: string) => STAGES.find((s) => s.key === k);
const isReferred = (d: Deal) => d.stage === 'referred_monitoring' || d.rejectionType === 'referred';
const isHold = (d: Deal) => !!stageOf(d.stage)?.isHold;
const isClosedNotReferred = (d: Deal) => !!stageOf(d.stage)?.isClosed && !isReferred(d);

/**
 * CRM -> Holding & Refer Out: leads that aren't active. On hold (with the date to
 * pick each back up), referred out (to whom), and cold or cancelled leads -- all
 * straight from the CRM, opening the lead on the CRM board.
 */
export function HoldingReferOut() {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [view, setView] = useState<View>('hold');
  const [q, setQ] = useState('');
  const [archived, setArchived] = useState(false);
  useEffect(() => { api.pipeline.list().then((r: any) => setDeals(Array.isArray(r) ? r : [])).catch(() => setDeals([])); }, []);

  const all = (deals || []).filter((d) => archived || !d.archived);
  const hold = all.filter(isHold);
  const referred = all.filter(isReferred);
  const closed = all.filter(isClosedNotReferred);
  const today = akToday();
  const dueBack = hold.filter((d) => d.holdUntil && d.holdUntil.slice(0, 10) <= today);
  const soon = hold.filter((d) => d.holdUntil && akDaysFrom(d.holdUntil) > 0 && akDaysFrom(d.holdUntil) <= 14);

  const needle = q.trim().toLowerCase();
  const list = useMemo(() => {
    const base = view === 'hold' ? hold : view === 'referred' ? referred : closed;
    const f = base.filter((d) => !needle || [d.name, d.client, d.assignee, d.referredToName, d.referredToCompany, d.rejectionReason, d.email].filter(Boolean).join(' ').toLowerCase().includes(needle));
    return view === 'hold'
      ? f.sort((a, b) => String(a.holdUntil || '9999').localeCompare(String(b.holdUntil || '9999')))
      : f.sort((a, b) => String(b.stageEnteredAt || '').localeCompare(String(a.stageEnteredAt || '')));
  }, [view, hold, referred, closed, needle]);

  const holdWhen = (d: Deal) => {
    if (!d.holdUntil) return <AkPill tone="soft">No pick-up date</AkPill>;
    const n = akDaysFrom(d.holdUntil);
    if (n < 0) return <AkPill tone="dark">Overdue · was {akDay(d.holdUntil)}</AkPill>;
    if (n === 0) return <AkPill tone="yellow">Pick up today</AkPill>;
    if (n <= 14) return <AkPill tone="yellow">Pick up {akDay(d.holdUntil)}</AkPill>;
    return <AkPill tone="outline">Pick up {akDay(d.holdUntil)}</AkPill>;
  };

  return (
    <AkPage
      lead="Leads that aren’t active: on hold until a date, referred out to someone else, or gone cold. Click one to open it on the CRM board."
      action={<button type="button" className="ak-btn" onClick={() => navigate('/pipeline')}>Open CRM board</button>}
    >
      <AkStats items={[
        { key: 'due', label: 'Due to pick back up', value: deals ? dueBack.length : '—', sub: soon.length ? `${soon.length} more in the next 2 weeks` : 'on or past their date', tone: dueBack.length ? 'yellow' : undefined, onClick: () => setView('hold') },
        { key: 'hold', label: 'On hold', value: deals ? hold.length : '—', sub: '1, 3, 6 and 12-month holds', onClick: () => setView('hold'), on: view === 'hold' },
        { key: 'ref', label: 'Referred out', value: deals ? referred.length : '—', sub: 'handed to a partner', onClick: () => setView('referred'), on: view === 'referred' },
        { key: 'closed', label: 'Cold or cancelled', value: deals ? closed.length : '—', sub: 'not referred', onClick: () => setView('closed'), on: view === 'closed' },
      ]} />

      <div className="ak-tools">
        <AkSeg<View> value={view} onChange={setView} options={[['hold', 'On hold', hold.length], ['referred', 'Referred out', referred.length], ['closed', 'Cold & cancelled', closed.length]]} />
        <input className="ak-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lead, client, partner…" />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Include archived
        </label>
      </div>

      <section className="ak-card">
        {deals === null && <div className="ak-empty">Loading…</div>}
        {deals && !list.length && <div className="ak-empty">{needle ? 'No lead matches.' : view === 'hold' ? 'No leads on hold.' : view === 'referred' ? 'No leads referred out.' : 'No cold or cancelled leads.'}</div>}
        {list.map((d, i) => (
          <AkRow key={d.id} index={i} muted={d.archived} onClick={() => navigate(`/pipeline?open=${encodeURIComponent(d.id)}`)}
            lead={<AkDate iso={view === 'hold' ? d.holdUntil : d.stageEnteredAt} />}
            title={d.name}
            sub={view === 'referred'
              ? ['Referred to ' + ([d.referredToName, d.referredToCompany].filter(Boolean).join(', ') || 'a partner'), d.client, d.rejectionReason].filter(Boolean).join(' · ')
              : view === 'closed'
                ? [stageOf(d.stage)?.name, d.client, d.rejectionReason].filter(Boolean).join(' · ')
                : [stageOf(d.stage)?.name, d.client, d.assignee && 'with ' + d.assignee].filter(Boolean).join(' · ')}
            right={<>
              {d.value && <span className="ak-hide-sm">{d.value}</span>}
              {view === 'hold' ? holdWhen(d) : view === 'referred' ? <AkPill tone="green">Monitoring</AkPill> : <AkPill tone="soft">{stageOf(d.stage)?.name || d.stage}</AkPill>}
              {d.archived && <AkPill tone="outline">Archived</AkPill>}
            </>}
          />
        ))}
      </section>
    </AkPage>
  );
}
