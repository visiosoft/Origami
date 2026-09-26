import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { EmailLink, PhoneLink } from './ContactLinks';

const INK = '#0B1A12';
const MUTED = '#7E9B93';
const DANGER = '#8E2E0A';
const AMBER = '#93520F';

interface SubRow {
  key: string; contractorId?: string; company: string; contactPerson?: string; phone?: string; email?: string; trades: string[];
  licenseNumber?: string; licenseExpiry?: string; licenseState: string; insuranceExpiry?: string; insuranceState: string;
  status?: string; portal: boolean;
  subcontracts: { id: string; number: string; type: string; title: string; status: string; total?: number; billed?: number; remaining?: number }[];
}
interface SubsView {
  canSeeMoney: boolean; canManage: boolean; rows: SubRow[];
  unlinked: { personId: number; name: string; company?: string; role?: string; phone?: string; email?: string }[];
}

const usd0 = (n?: number) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const day = (iso?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
};
const TYPE: Record<string, string> = { subcontract: 'Subcontract', purchase_order: 'Purchase order', service: 'Service' };
const STATUS: Record<string, [string, string, string]> = {
  draft: ['Draft', '#EFEDE8', '#5C6B65'], approved: ['Approved', '#E4EFE5', '#145C33'], closed: ['Closed', '#EFEDE8', '#5C6B65'], void: ['Void', '#F2DFD4', DANGER],
};

/** "Licence expired Jan 1, 2020" in red; within 30 days in amber; otherwise plain. */
function Expiry({ label, date, state }: { label: string; date?: string; state: string }) {
  if (!state) return <span style={{ color: '#B5BDB8' }}>{label}: not on file</span>;
  const tone = state === 'expired' ? DANGER : state === 'soon' ? AMBER : MUTED;
  return <span style={{ color: tone, fontWeight: state === 'ok' ? 400 : 700 }}>{label} {state === 'expired' ? 'expired' : 'expires'} {day(date)}</span>;
}

/**
 * A project's Subcontractors tab -- always there, even when empty. Every
 * company with a subcontract or PO on the job, how to reach them, whether
 * their licence and insurance are current, and (for those who may see
 * costs) what's committed, billed and left. Subs linked to the project in
 * People without a subcontract yet are listed underneath.
 */
export function ProjectSubcontractors({ projectId, onAddSubcontract }: { projectId: number; onAddSubcontract?: () => void }) {
  const navigate = useNavigate();
  const [v, setV] = useState<SubsView | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setV(null); setError('');
    api.finance.projectSubcontractors(projectId).then((r) => setV(r as SubsView)).catch((e: Error) => setError(e.message));
  }, [projectId]);

  if (error) return <div style={{ padding: 16, fontSize: 13, color: DANGER }}>{error}</div>;
  if (!v) return <div style={{ padding: 16, fontSize: 13, color: MUTED }}>Loading subcontractors…</div>;

  const live = v.rows.flatMap((r) => r.subcontracts).filter((s) => s.status === 'approved');
  const committed = live.reduce((a, s) => a + (s.total || 0), 0);
  const billed = live.reduce((a, s) => a + (s.billed || 0), 0);
  const flagged = v.rows.filter((r) => r.licenseState === 'expired' || r.insuranceState === 'expired').length;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12.5, color: MUTED, marginRight: 'auto' }}>
          {v.rows.length} compan{v.rows.length === 1 ? 'y' : 'ies'} on this project
          {v.canSeeMoney && live.length > 0 && <> · {usd0(committed)} committed · {usd0(billed)} billed to us</>}
          {flagged > 0 && <> · <b style={{ color: DANGER }}>{flagged} with an expired licence or insurance</b></>}
        </div>
        <span onClick={() => navigate('/manpower_con')} style={{ fontSize: 12, fontWeight: 700, color: '#173326', cursor: 'pointer' }} title="The contractor directory: licences, insurance, workers, portal access">Contractors directory</span>
        {v.canManage && onAddSubcontract && (
          <div onClick={onAddSubcontract} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white' }}>+ Subcontract</div>
        )}
      </div>

      {!v.rows.length && (
        <div style={{ padding: '26px 20px', textAlign: 'center', fontSize: 13, color: MUTED, background: '#FBF8F2', borderRadius: 12 }}>
          No subcontracts on this project yet.{v.canManage ? ' Add one with “+ Subcontract” — it lands in Financial → Job cost → Subcontracts & POs.' : ''}
        </div>
      )}

      {v.rows.map((r) => (
        <div key={r.key} style={{ background: 'white', border: '1px solid rgba(20,8,31,0.08)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: INK }}>{r.company}</span>
            {r.status && r.status !== 'active' && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#F2DFD4', color: DANGER, textTransform: 'capitalize' }}>{r.status}</span>}
            {r.portal && <span title="Can sign in to the subcontractor portal" style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#D6E8E5', color: '#2F6F68' }}>Portal access</span>}
            {!r.contractorId && <span title="Not in the contractor directory -- a vendor name on a PO" style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#EFEDE8', color: '#5C6B65' }}>Vendor</span>}
          </div>
          {r.trades.length > 0 && <div style={{ fontSize: 12, color: '#43514D', marginTop: 3 }}>{r.trades.join(' · ')}</div>}
          <div style={{ display: 'flex', gap: '4px 14px', flexWrap: 'wrap', fontSize: 12.5, color: '#43514D', marginTop: 6 }}>
            {r.contactPerson && <span>{r.contactPerson}</span>}
            {r.phone && <PhoneLink phone={r.phone} />}
            {r.email && <EmailLink email={r.email} />}
          </div>
          {r.contractorId && (
            <div style={{ display: 'flex', gap: '4px 16px', flexWrap: 'wrap', fontSize: 12, marginTop: 6 }}>
              <span>{r.licenseNumber ? <span style={{ color: '#43514D' }}>Licence #{r.licenseNumber} · </span> : null}<Expiry label="Licence" date={r.licenseExpiry} state={r.licenseState} /></span>
              <Expiry label="Insurance" date={r.insuranceExpiry} state={r.insuranceState} />
            </div>
          )}
          <div style={{ marginTop: 10, borderTop: '1px solid rgba(20,8,31,0.06)' }}>
            {r.subcontracts.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid rgba(20,8,31,0.04)', fontSize: 12.5 }}>
                <span style={{ fontWeight: 700, color: '#173326', fontVariantNumeric: 'tabular-nums', minWidth: 62 }}>{s.number}</span>
                <span style={{ color: INK, flex: 1, minWidth: 160 }}>{s.title} <span style={{ color: MUTED }}>· {TYPE[s.type] || s.type}</span></span>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: (STATUS[s.status] || STATUS.draft)[1], color: (STATUS[s.status] || STATUS.draft)[2] }}>{(STATUS[s.status] || [s.status])[0]}</span>
                {v.canSeeMoney && s.total != null && (
                  <span style={{ color: '#43514D', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {usd0(s.total)} committed · {usd0(s.billed)} billed{s.status === 'approved' ? ` · ${usd0(s.remaining)} left` : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {v.unlinked.length > 0 && (
        <div style={{ background: '#FBF8F2', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>On this project in People — no subcontract yet</div>
          {v.unlinked.map((p) => (
            <div key={p.personId} style={{ display: 'flex', gap: '4px 14px', flexWrap: 'wrap', fontSize: 12.5, color: '#43514D', padding: '5px 0' }}>
              <b style={{ color: INK }}>{p.company || p.name}</b>
              {p.company && <span>{p.name}</span>}
              {p.role && <span style={{ color: MUTED }}>{p.role}</span>}
              {p.phone && <PhoneLink phone={p.phone} />}
              {p.email && <EmailLink email={p.email} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
