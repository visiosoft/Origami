import { useEffect, useState } from 'react';
import { api } from '../api';
import { BidPackages } from './estimate/BidPackages';

type Pkg = { id: string; projectId: number; projectName?: string; estimateId: string; estimateNumber: string; number: string; title: string; dueDate?: string | null; status: string; invited: number; submitted: number; attending: number; openQuestions: number; siteVisit?: { date: string; time?: string | null } | null };
const STATUS: Record<string, string> = { draft: 'Draft', out: 'Out for pricing', closed: 'Closed' };
const pill = (dark?: boolean) => ({ padding: '7px 14px', borderRadius: 999, border: dark ? 0 : '1px solid rgba(var(--rgb-shade), .14)', background: dark ? 'var(--ink)' : 'var(--surface)', color: dark ? '#fff' : 'var(--body)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' });
const field = { padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.15)', font: 'inherit', fontSize: 13, background: 'var(--surface)' } as const;

/**
 * Nov 19 (Edward: "I don't want to manage the bidding / RFP / prequalify from
 * Estimating"): every bid package across projects, run from GC & Sub
 * Prequalify & RFP -- instructions, site visit, invites, questions, leveling.
 * Packages are still made from an estimate's scopes.
 */
export function RfpPackages({ canEdit, start }: { canEdit: boolean; start?: { projectId: number; estimateId: string } | null }) {
  const [rows, setRows] = useState<Pkg[] | null>(null);
  const [open, setOpen] = useState<{ projectId: number; estimateId: string } | null>(start || null);
  const [making, setMaking] = useState(false);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [pid, setPid] = useState(0);
  const [ests, setEsts] = useState<{ id: string; number: string; rev: number; title?: string | null }[]>([]);
  const [show, setShow] = useState<'open' | 'all'>('open');
  const load = () => api.finance.bidPackagesAll().then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
  useEffect(() => { void load(); (api.projects.list() as Promise<any>).then((r) => setProjects((Array.isArray(r) ? r : []).map((p: any) => ({ id: p.id, name: p.name })))).catch(() => undefined); }, []);
  useEffect(() => { if (!pid) { setEsts([]); return; } (api.finance.estimates(pid) as Promise<any>).then((r) => setEsts(r?.rows || [])).catch(() => setEsts([])); }, [pid]);
  const shown = (rows || []).filter((r) => show === 'all' || r.status !== 'closed');

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', flex: 1, minWidth: 260 }}>Send scopes out for pricing: bid instructions, a site visit, invites (subs whose licences match the scope come first), questions from bidders, and the price comparison. Subs never see our amounts.</div>
        <button type="button" style={pill(show === 'open')} onClick={() => setShow('open')}>Open</button>
        <button type="button" style={pill(show === 'all')} onClick={() => setShow('all')}>All</button>
        {canEdit && <button type="button" style={pill(true)} onClick={() => setMaking((x) => !x)}>+ New package</button>}
      </div>
      {making && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: 12, borderRadius: 12, background: 'var(--panel)' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>From which estimate?</span>
          <select aria-label="Project" value={pid} onChange={(e) => setPid(Number(e.target.value))} style={field}><option value={0}>Project…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <select aria-label="Estimate" disabled={!pid} value="" onChange={(e) => { if (e.target.value) { setOpen({ projectId: pid, estimateId: e.target.value }); setMaking(false); } }} style={field}>
            <option value="">{pid && !ests.length ? 'No estimates on this project' : 'Estimate…'}</option>
            {ests.map((x) => <option key={x.id} value={x.id}>{x.number} Rev {x.rev}{x.title ? ` · ${x.title}` : ''}</option>)}
          </select>
        </div>
      )}
      <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid rgba(var(--rgb-shade), .06)', overflowX: 'auto' }}>
        {rows === null ? <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>Loading…</div> : !shown.length ? <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>No bid packages{show === 'open' ? ' out' : ''} yet.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760, fontSize: 13 }}>
            <thead><tr style={{ textAlign: 'left', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {['Package', 'Project · estimate', 'Due', 'Site visit', 'Invited', 'Prices in', 'Questions', 'Status'].map((h) => <th key={h} style={{ padding: '9px 12px' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} onClick={() => setOpen({ projectId: r.projectId, estimateId: r.estimateId })} style={{ borderTop: '1px solid rgba(var(--rgb-shade), .05)', cursor: 'pointer' }}>
                  <td style={{ padding: '9px 12px' }}><b>{r.number}</b> {r.title}</td>
                  <td style={{ padding: '9px 12px', color: 'var(--muted)' }}>{r.projectName} · {r.estimateNumber}</td>
                  <td style={{ padding: '9px 12px' }}>{r.dueDate || '—'}</td>
                  <td style={{ padding: '9px 12px' }}>{r.siteVisit ? `${r.siteVisit.date}${r.siteVisit.time ? ` ${r.siteVisit.time}` : ''} · ${r.attending} coming` : '—'}</td>
                  <td style={{ padding: '9px 12px' }}>{r.invited}</td>
                  <td style={{ padding: '9px 12px' }}>{r.submitted}</td>
                  <td style={{ padding: '9px 12px', fontWeight: r.openQuestions ? 700 : 400, color: r.openQuestions ? '#8A4B12' : 'var(--muted)' }}>{r.openQuestions ? `${r.openQuestions} to answer` : '—'}</td>
                  <td style={{ padding: '9px 12px' }}>{STATUS[r.status] || r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {open && <BidPackages projectId={open.projectId} estimateId={open.estimateId} canEdit={canEdit} onClose={() => { setOpen(null); void load(); }} onUsed={() => { setOpen(null); void load(); }} />}
    </div>
  );
}
