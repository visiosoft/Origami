import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { Logo } from '../components/Logo';
import { ACCENT, ACCENT_BG, BG, DANGER, INK, LINE, MUTED, Badge, Label, btn, card, fmtDate, input, todayISO } from '../components/manpowerUi';

// ------------------------------------------------------------------ shapes

interface Sub {
  id: string; number: string; title: string; status: string; dateIssued?: string; projectName: string;
  committed: number; billed: number; submitted: number; approved: number; paid: number; toBePaid: number; remaining: number; milestones: number; sharedFiles: number;
}
interface Invoice {
  id: string; reference: string; date: string; subcontractId?: string; subcontractNumber?: string; projectName?: string; total: number;
  status: 'submitted' | 'approved' | 'paid' | 'returned'; paidDate?: string; paymentRef?: string; returnedReason?: string; submittedAt?: string; fromPortal: boolean;
  lines: { id: string; description: string; amount: number; status: string; returnedReason?: string }[];
  files: { id: string; entryId: string; name: string; kind: string; url?: string }[];
}
interface Overview {
  vendor: { name: string; contactPerson?: string; email?: string };
  subcontracts: Sub[];
  totals: { committed: number; paid: number; awaitingApproval: number; approvedUnpaid: number; toBePaid: number };
  recentInvoices: Invoice[];
}
interface Milestone {
  id: string; description: string; amount: number; billed: number; paid: number; remaining: number;
  progress: { done: number; total: number } | null; tasks: { id: string; title: string; status: string; notes: string }[];
}
interface Detail {
  id: string; number: string; title: string; scope?: string; status: string; dateIssued?: string; projectName: string;
  committed: number; billed: number; paid: number; toBePaid: number; remaining: number;
  milestones: Milestone[]; files: { id: string; name: string; kind: string; url?: string; uploadedAt?: string }[]; invoices: Invoice[];
}

const usd = (n: number) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUS: Record<Invoice['status'], [string, 'amber' | 'blue' | 'green' | 'red']> = {
  submitted: ['Waiting for approval', 'amber'], approved: ['Approved · payment pending', 'blue'], paid: ['Paid', 'green'], returned: ['Returned', 'red'],
};
const PAPER = '#FBF8F2';

// ------------------------------------------------------------------ frame

/**
 * The subcontractor portal: a subcontractor's own subcontracts and milestones,
 * the invoices they send against them, and where each one stands. It sits
 * outside the main app on purpose -- portal accounts see nothing else.
 */
export function Portal() {
  const { currentUser, signOut, toastMsg } = useApp();
  const navigate = useNavigate();
  const [ov, setOv] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const reload = () => api.portal.overview().then((r: any) => { setOv(r); setError(''); }).catch((e: any) => setError(e.message || 'Could not load your portal'));
  useEffect(() => { reload(); }, []);

  return (
    <div style={{ minHeight: '100vh', background: PAPER, color: INK, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{'@media (max-width: 640px) { .portal-who { display: none; } }'}</style>
      <header style={{ background: '#fff', borderBottom: '1px solid ' + LINE }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Link to="/portal" style={{ display: 'flex', alignItems: 'center' }}><Logo markSize={26} /></Link>
          <div className="portal-who" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: MUTED, borderLeft: '1px solid ' + LINE, paddingLeft: 14 }}>Subcontractor portal</div>
          <nav style={{ display: 'flex', gap: 4 }}>
            <NavPill to="/portal" label="Overview" />
            <NavPill to="/portal/invoices" label="Invoices" />
          </nav>
          <div style={{ flex: 1 }} />
          <div className="portal-who" style={{ textAlign: 'right', fontSize: 12, lineHeight: 1.35 }}>
            <div style={{ fontWeight: 700 }}>{ov?.vendor.name || currentUser?.name}</div>
            <div style={{ color: MUTED }}>{currentUser?.email}</div>
          </div>
          <div onClick={() => { signOut(); navigate('/login', { replace: true }); }} style={btn()}>Sign out</div>
        </div>
      </header>
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '22px 16px 60px' }}>
        {error ? (
          <div style={{ ...card, padding: '22px 20px', fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ fontFamily: BG, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>We couldn’t open your portal</div>
            <div style={{ color: MUTED }}>{error}</div>
          </div>
        ) : !ov ? (
          <div style={{ fontSize: 13, color: MUTED }}>Loading…</div>
        ) : (
          <Routes>
            <Route index element={<Home ov={ov} />} />
            <Route path="subcontracts/:id" element={<SubcontractPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="invoices/new" element={<NewInvoice ov={ov} onSent={reload} />} />
            <Route path="*" element={<Home ov={ov} />} />
          </Routes>
        )}
      </main>
      {toastMsg && (
        <div style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', background: INK, color: '#fff', padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.18)', zIndex: 50, maxWidth: 'calc(100vw - 32px)' }}>{toastMsg}</div>
      )}
    </div>
  );
}

function NavPill({ to, label }: { to: string; label: string }) {
  const here = window.location.pathname.replace(/\/$/, '');
  const on = to === '/portal' ? here === '/portal' || here.startsWith('/portal/subcontracts') : here.startsWith(to);
  return <Link to={to} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, textDecoration: 'none', color: on ? ACCENT : MUTED, background: on ? ACCENT_BG : 'transparent' }}>{label}</Link>;
}

function Figure({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div style={{ ...card, padding: '14px 16px', minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</div>
      <div style={{ fontFamily: BG, fontSize: 22, fontWeight: 700, color: tone || INK, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {hint && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

/** Paid, then approved, then waiting, against the whole subcontract. */
function MoneyBar({ committed, paid, approved, submitted }: { committed: number; paid: number; approved: number; submitted: number }) {
  const pct = (n: number) => (committed > 0 ? Math.min(100, (n / committed) * 100) : 0);
  return (
    <div style={{ height: 8, borderRadius: 999, background: '#EFEDE8', overflow: 'hidden', display: 'flex' }}>
      <div style={{ width: pct(paid) + '%', background: '#2F7D4A' }} />
      <div style={{ width: pct(approved) + '%', background: '#6D8FBF' }} />
      <div style={{ width: pct(submitted) + '%', background: '#E0B84A' }} />
    </div>
  );
}

function Legend() {
  const dot = (c: string, t: string) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: c }} />{t}</span>;
  return <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: MUTED }}>{dot('#2F7D4A', 'Paid')}{dot('#6D8FBF', 'Approved')}{dot('#E0B84A', 'Waiting for approval')}{dot('#EFEDE8', 'Not invoiced yet')}</div>;
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <h2 style={{ fontFamily: BG, fontSize: 17, fontWeight: 700, margin: 0, flex: 1 }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// ------------------------------------------------------------------ overview

function Home({ ov }: { ov: Overview }) {
  const navigate = useNavigate();
  const first = (ov.vendor.contactPerson || '').split(/\s+/)[0];
  const open = ov.subcontracts.filter((s) => s.status === 'approved');
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: MUTED }}>{ov.vendor.name}</div>
          <h1 style={{ fontFamily: BG, fontSize: 28, fontWeight: 700, margin: '4px 0 2px', textWrap: 'balance' as any }}>{first ? `Hello, ${first}.` : 'Your work with us'}</h1>
          <div style={{ fontSize: 13, color: MUTED }}>Your subcontracts, what you’ve invoiced, and where each payment stands.</div>
        </div>
        {open.length > 0 && <div onClick={() => navigate('/portal/invoices/new')} style={btn(true)}>+ Send an invoice</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginTop: 18 }}>
        <Figure label="Your subcontracts" value={usd(ov.totals.committed)} hint={`${ov.subcontracts.length} subcontract${ov.subcontracts.length === 1 ? '' : 's'}`} />
        <Figure label="Paid to you" value={usd(ov.totals.paid)} tone="#1E6B36" />
        <Figure label="Waiting for approval" value={usd(ov.totals.awaitingApproval)} tone={ov.totals.awaitingApproval ? '#8A6D12' : INK} />
        <Figure label="Approved, being paid" value={usd(ov.totals.approvedUnpaid)} tone={ov.totals.approvedUnpaid ? '#3C5C8A' : INK} />
        <Figure label="Still to be paid" value={usd(ov.totals.toBePaid)} hint="on your subcontracts" />
      </div>

      <Section title="Your subcontracts" action={<Legend />}>
        {!ov.subcontracts.length && <div style={{ ...card, padding: '20px', fontSize: 13, color: MUTED }}>No subcontracts are open with you yet. Once one is approved it appears here.</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {ov.subcontracts.map((s) => (
            <div key={s.id} onClick={() => navigate(`/portal/subcontracts/${s.id}`)} style={{ ...card, padding: '16px 18px', cursor: 'pointer', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600 }}>{s.projectName}</div>
                  <div style={{ fontFamily: BG, fontSize: 16, fontWeight: 700, marginTop: 2 }}>{s.number} · {s.title}</div>
                </div>
                {s.status === 'closed' && <Badge tone="grey">Closed</Badge>}
              </div>
              <MoneyBar committed={s.committed} paid={s.paid} approved={s.approved} submitted={s.submitted} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 12 }}>
                <div><div style={{ color: MUTED }}>Value</div><b style={{ fontVariantNumeric: 'tabular-nums' }}>{usd(s.committed)}</b></div>
                <div><div style={{ color: MUTED }}>Paid</div><b style={{ fontVariantNumeric: 'tabular-nums', color: '#1E6B36' }}>{usd(s.paid)}</b></div>
                <div><div style={{ color: MUTED }}>Left to invoice</div><b style={{ fontVariantNumeric: 'tabular-nums' }}>{usd(s.remaining)}</b></div>
              </div>
              <div style={{ fontSize: 11.5, color: MUTED }}>{s.milestones} milestone{s.milestones === 1 ? '' : 's'}{s.sharedFiles ? ` · ${s.sharedFiles} shared file${s.sharedFiles === 1 ? '' : 's'}` : ''} · open →</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Latest invoices" action={<Link to="/portal/invoices" style={{ fontSize: 12.5, fontWeight: 700, color: ACCENT, textDecoration: 'none' }}>All invoices →</Link>}>
        <InvoiceList rows={ov.recentInvoices} empty="You haven’t sent any invoices yet." />
      </Section>
    </div>
  );
}

// ------------------------------------------------------------------ one subcontract

function SubcontractPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [openM, setOpenM] = useState<string | null>(null);
  useEffect(() => { setD(null); api.portal.subcontract(id).then((r: any) => setD(r)).catch((e: any) => setError(e.message || 'Could not load')); }, [id]);
  if (error) return <div style={{ ...card, padding: 20, fontSize: 13, color: MUTED }}>{error} <Link to="/portal" style={{ color: ACCENT, fontWeight: 700 }}>Back</Link></div>;
  if (!d) return <div style={{ fontSize: 13, color: MUTED }}>Loading…</div>;
  const cols = 'minmax(200px,2fr) repeat(4, minmax(96px,1fr)) minmax(120px,1.1fr)';
  return (
    <div>
      <Link to="/portal" style={{ fontSize: 13, fontWeight: 700, color: ACCENT, textDecoration: 'none' }}>← Overview</Link>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{d.projectName}{d.dateIssued ? ` · issued ${fmtDate(d.dateIssued)}` : ''}</div>
          <h1 style={{ fontFamily: BG, fontSize: 26, fontWeight: 700, margin: '4px 0 0' }}>{d.number} · {d.title}</h1>
        </div>
        {d.status === 'approved' ? <div onClick={() => navigate(`/portal/invoices/new?sc=${d.id}`)} style={btn(true)}>+ Invoice this subcontract</div> : <Badge tone="grey">Closed — no new invoices</Badge>}
      </div>
      {d.scope && <div style={{ ...card, padding: '12px 16px', marginTop: 14, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}><Label text="Scope of work" />{d.scope}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 14 }}>
        <Figure label="Subcontract value" value={usd(d.committed)} />
        <Figure label="Invoiced" value={usd(d.billed)} />
        <Figure label="Paid to you" value={usd(d.paid)} tone="#1E6B36" />
        <Figure label="Left to invoice" value={usd(d.remaining)} />
      </div>

      <Section title="Milestones">
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 760 }}>
              <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, padding: '9px 14px', background: '#F7F3EA', fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9c96a4' }}>
                <span>Milestone</span><span style={{ textAlign: 'right' }}>Value</span><span style={{ textAlign: 'right' }}>Invoiced</span><span style={{ textAlign: 'right' }}>Paid</span><span style={{ textAlign: 'right' }}>Left</span><span>Work progress</span>
              </div>
              {d.milestones.map((m) => {
                const p = m.progress;
                const expanded = openM === m.id;
                return (
                  <div key={m.id} style={{ borderTop: '1px solid rgba(20,8,31,.05)' }}>
                    <div onClick={() => m.tasks.length && setOpenM(expanded ? null : m.id)} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, alignItems: 'center', padding: '10px 14px', fontSize: 12.5, cursor: m.tasks.length ? 'pointer' : 'default', fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ fontWeight: 600 }}>{m.tasks.length > 0 && <span style={{ color: MUTED, marginRight: 6 }}>{expanded ? '▾' : '▸'}</span>}{m.description}</span>
                      <span style={{ textAlign: 'right' }}>{usd(m.amount)}</span>
                      <span style={{ textAlign: 'right' }}>{usd(m.billed)}</span>
                      <span style={{ textAlign: 'right', color: m.paid ? '#1E6B36' : MUTED }}>{usd(m.paid)}</span>
                      <b style={{ textAlign: 'right' }}>{usd(m.remaining)}</b>
                      <span>
                        {p ? (
                          <span style={{ display: 'grid', gap: 4 }}>
                            <span style={{ height: 6, borderRadius: 99, background: '#EFEDE8', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${(p.done / p.total) * 100}%`, background: ACCENT }} /></span>
                            <span style={{ fontSize: 11, color: MUTED }}>{p.done} of {p.total} tasks done</span>
                          </span>
                        ) : <span style={{ fontSize: 11.5, color: MUTED }}>—</span>}
                      </span>
                    </div>
                    {expanded && (
                      <div style={{ padding: '0 14px 12px 34px', display: 'grid', gap: 4 }}>
                        {m.tasks.map((t) => (
                          <div key={t.id} style={{ display: 'flex', gap: 10, fontSize: 12.5, alignItems: 'baseline' }}>
                            <span style={{ width: 14, color: t.status === 'Done' ? '#2F7D4A' : MUTED }}>{t.status === 'Done' ? '✓' : '○'}</span>
                            <span style={{ flex: 1, textDecoration: t.status === 'Done' ? 'line-through' : 'none', color: t.status === 'Done' ? MUTED : INK }}>{t.title}</span>
                            <span style={{ fontSize: 11.5, color: MUTED }}>{t.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {!d.milestones.length && <div style={{ padding: 18, fontSize: 12.5, color: MUTED, textAlign: 'center' }}>No milestones on this subcontract.</div>}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Files shared with you">
        {!d.files.length ? <div style={{ ...card, padding: '16px 18px', fontSize: 12.5, color: MUTED }}>Nothing shared yet. Drawings, specs or your signed agreement will show up here.</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
            {d.files.map((f) => (
              <a key={f.id} href={f.kind === 'link' ? f.url : api.portal.sharedFileUrl(d.id, f.id)} target="_blank" rel="noreferrer" style={{ ...card, padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'center', textDecoration: 'none', color: INK }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: ACCENT_BG, color: ACCENT, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{f.kind === 'link' ? 'LINK' : (f.name.split('.').pop() || 'FILE').slice(0, 4).toUpperCase()}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  {f.uploadedAt && <span style={{ fontSize: 11, color: MUTED }}>Shared {fmtDate(f.uploadedAt.slice(0, 10))}</span>}
                </span>
              </a>
            ))}
          </div>
        )}
      </Section>

      <Section title="Invoices on this subcontract">
        <InvoiceList rows={d.invoices} empty="No invoices on this subcontract yet." />
      </Section>
    </div>
  );
}

// ------------------------------------------------------------------ invoices

function InvoicesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Invoice[] | null>(null);
  const [filter, setFilter] = useState<'all' | Invoice['status']>('all');
  useEffect(() => { api.portal.invoices().then((r: any) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([])); }, []);
  const shown = (rows || []).filter((r) => filter === 'all' || r.status === filter);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontFamily: BG, fontSize: 26, fontWeight: 700, margin: 0 }}>Invoices</h1>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>Everything you’ve sent us, and where each one stands.</div>
        </div>
        <div onClick={() => navigate('/portal/invoices/new')} style={btn(true)}>+ Send an invoice</div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '16px 0 10px' }}>
        {(['all', 'submitted', 'approved', 'paid', 'returned'] as const).map((k) => {
          const n = (rows || []).filter((r) => k === 'all' || r.status === k).length;
          return <div key={k} onClick={() => setFilter(k)} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: filter === k ? ACCENT : '#fff', color: filter === k ? '#fff' : ACCENT, border: '1px solid ' + (filter === k ? ACCENT : 'rgba(20,8,31,.14)') }}>{k === 'all' ? 'All' : STATUS[k][0].split(' ·')[0]} · {n}</div>;
        })}
      </div>
      {rows === null ? <div style={{ fontSize: 13, color: MUTED }}>Loading…</div> : <InvoiceList rows={shown} empty="No invoices here." />}
    </div>
  );
}

/** Where an invoice is in its journey: sent, approved, paid (or returned). */
function Steps({ inv }: { inv: Invoice }) {
  if (inv.status === 'returned') return null;
  const at = ['submitted', 'approved', 'paid'].indexOf(inv.status);
  const steps = ['Sent', 'Approved', 'Paid'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
      {steps.map((s, i) => (
        <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <span style={{ width: 18, height: 2, background: i <= at ? '#2F7D4A' : '#E4E0D8' }} />}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: i <= at ? '#1E6B36' : MUTED, fontWeight: i === at ? 700 : 500 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: i <= at ? '#2F7D4A' : '#E4E0D8' }} />{s}
          </span>
        </span>
      ))}
    </div>
  );
}

function InvoiceList({ rows, empty }: { rows: Invoice[]; empty: string }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!rows.length) return <div style={{ ...card, padding: '18px', fontSize: 12.5, color: MUTED }}>{empty}</div>;
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      {rows.map((inv, i) => {
        const [label, tone] = STATUS[inv.status];
        const expanded = open === inv.id;
        return (
          <div key={inv.id} style={{ borderTop: i ? '1px solid rgba(20,8,31,.06)' : 'none' }}>
            <div onClick={() => setOpen(expanded ? null : inv.id)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', cursor: 'pointer', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>Invoice {inv.reference}</div>
                <div style={{ fontSize: 11.5, color: MUTED }}>{[inv.subcontractNumber, inv.projectName, fmtDate(inv.date)].filter(Boolean).join(' · ')}</div>
              </div>
              <div style={{ flex: '0 1 auto' }}><Steps inv={inv} /></div>
              <Badge tone={tone}>{label}</Badge>
              <b style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', minWidth: 96, textAlign: 'right' }}>{usd(inv.total)}</b>
            </div>
            {inv.status === 'paid' && inv.paidDate && <div style={{ padding: '0 16px 10px', fontSize: 12, color: '#1E6B36' }}>Paid {fmtDate(inv.paidDate)}{inv.paymentRef ? ` · reference ${inv.paymentRef}` : ''}</div>}
            {inv.status === 'returned' && <div style={{ padding: '0 16px 10px', fontSize: 12, color: DANGER }}>Returned{inv.returnedReason ? `: ${inv.returnedReason}` : ''} — correct it and send it again.</div>}
            {expanded && (
              <div style={{ padding: '0 16px 14px', display: 'grid', gap: 8 }}>
                <div style={{ background: PAPER, borderRadius: 10, padding: '8px 12px' }}>
                  {inv.lines.map((l) => (
                    <div key={l.id} style={{ display: 'flex', gap: 10, fontSize: 12.5, padding: '4px 0' }}>
                      <span style={{ flex: 1 }}>{l.description}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{usd(l.amount)}</span>
                    </div>
                  ))}
                </div>
                {inv.files.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {inv.files.map((f) => <a key={f.id} href={f.kind === 'link' ? f.url : api.portal.billFileUrl(f.entryId, f.id)} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>📎 {f.name}</a>)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ sending an invoice

function NewInvoice({ ov, onSent }: { ov: Overview; onSent: () => void }) {
  const { toast } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const open = ov.subcontracts.filter((s) => s.status === 'approved');
  const [scId, setScId] = useState(params.get('sc') && open.some((s) => s.id === params.get('sc')) ? params.get('sc')! : open[0]?.id || '');
  const [d, setD] = useState<Detail | null>(null);
  const [f, setF] = useState({ reference: '', date: todayISO(), note: '' });
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setD(null); setAmounts({}); if (scId) api.portal.subcontract(scId).then((r: any) => setD(r)).catch(() => {}); }, [scId]);
  const total = useMemo(() => Object.values(amounts).reduce((a, v) => a + (Number(v) || 0), 0), [amounts]);
  const over = (d?.milestones || []).find((m) => (Number(amounts[m.id]) || 0) > m.remaining + 0.001);

  if (!open.length) return <div style={{ ...card, padding: 20, fontSize: 13, color: MUTED }}>You have no open subcontracts to invoice. <Link to="/portal" style={{ color: ACCENT, fontWeight: 700 }}>Back</Link></div>;

  const send = async () => {
    setErr('');
    if (!f.reference.trim()) { setErr('Enter your invoice number.'); return; }
    if (!total) { setErr('Enter an amount against at least one milestone.'); return; }
    if (over) { setErr(`${over.description}: only ${usd(over.remaining)} is left to invoice.`); return; }
    setBusy(true);
    try {
      const r: any = await api.portal.submit({
        subcontractId: scId, reference: f.reference.trim(), date: f.date, note: f.note,
        lines: Object.entries(amounts).filter(([, v]) => Number(v) > 0).map(([milestoneId, amount]) => ({ milestoneId, amount: Number(amount) })),
      });
      if (files.length) {
        try { await api.portal.attach(r.batchId, files); }
        catch (e: any) { toast('⚠ Invoice sent, but the file didn’t upload: ' + (e.message || 'try again from the invoice')); }
      }
      toast(`Invoice ${f.reference.trim()} sent`);
      onSent();
      navigate('/portal/invoices');
    } catch (e: any) { setErr(e.message || 'Could not send the invoice'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ maxWidth: 820 }}>
      <Link to="/portal" style={{ fontSize: 13, fontWeight: 700, color: ACCENT, textDecoration: 'none' }}>← Overview</Link>
      <h1 style={{ fontFamily: BG, fontSize: 26, fontWeight: 700, margin: '10px 0 2px' }}>Send an invoice</h1>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>Bill against the milestones on your subcontract. We’ll review it, and you’ll get an email when it’s approved and when it’s paid.</div>

      <div style={{ ...card, padding: '18px 20px', display: 'grid', gap: 14 }}>
        <div>
          <Label text="Subcontract" />
          <select value={scId} onChange={(e) => setScId(e.target.value)} style={input}>
            {open.map((s) => <option key={s.id} value={s.id}>{s.number} · {s.title} — {s.projectName}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div><Label text="Your invoice number *" /><input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="e.g. 1042" style={input} /></div>
          <div><Label text="Invoice date" /><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} style={input} /></div>
        </div>

        <div>
          <Label text="What you’re billing" />
          {!d ? <div style={{ fontSize: 12.5, color: MUTED }}>Loading milestones…</div> : (
            <div style={{ border: '1px solid ' + LINE, borderRadius: 10, overflow: 'hidden' }}>
              {d.milestones.map((m, i) => {
                const v = amounts[m.id] || '';
                const bad = (Number(v) || 0) > m.remaining + 0.001;
                return (
                  <div key={m.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', borderTop: i ? '1px solid rgba(20,8,31,.05)' : 'none', flexWrap: 'wrap', opacity: m.remaining > 0 ? 1 : 0.55 }}>
                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{m.description}</div>
                      <div style={{ fontSize: 11.5, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
                        {usd(m.amount)} value · {usd(m.billed)} invoiced · <b style={{ color: INK }}>{usd(m.remaining)} left</b>
                        {m.progress ? ` · ${m.progress.done}/${m.progress.total} tasks done` : ''}
                      </div>
                    </div>
                    {m.remaining > 0 ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span onClick={() => setAmounts({ ...amounts, [m.id]: String(m.remaining) })} style={{ fontSize: 11.5, fontWeight: 700, color: ACCENT, cursor: 'pointer', whiteSpace: 'nowrap' }}>Bill the rest</span>
                        <div style={{ position: 'relative', width: 140 }}>
                          <span style={{ position: 'absolute', left: 10, top: 8, fontSize: 13, color: MUTED }}>$</span>
                          <input inputMode="decimal" value={v} onChange={(e) => setAmounts({ ...amounts, [m.id]: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="0.00"
                            style={{ ...input, paddingLeft: 20, textAlign: 'right', borderColor: bad ? DANGER : 'rgba(20,8,31,0.13)', fontVariantNumeric: 'tabular-nums' }} />
                        </div>
                      </div>
                    ) : <span style={{ fontSize: 11.5, color: MUTED }}>Fully invoiced</span>}
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 12px', background: PAPER, fontSize: 13.5 }}>
                <b>Invoice total</b><b style={{ fontVariantNumeric: 'tabular-nums' }}>{usd(total)}</b>
              </div>
            </div>
          )}
        </div>

        <div>
          <Label text="Your invoice (PDF or photo)" />
          <input ref={fileRef} type="file" multiple accept=".pdf,image/*,.xlsx,.xls,.doc,.docx" onChange={(e) => setFiles(Array.from(e.target.files || []))} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div onClick={() => fileRef.current?.click()} style={btn()}>Choose file…</div>
            <span style={{ fontSize: 12, color: files.length ? INK : MUTED }}>{files.length ? files.map((x) => x.name).join(', ') : 'Attach the invoice itself and any backup (lien waiver, photos).'}</span>
          </div>
        </div>

        <div><Label text="Note to us (optional)" /><textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} rows={3} style={{ ...input, resize: 'vertical' }} /></div>

        {err && <div style={{ fontSize: 12.5, color: DANGER, fontWeight: 600 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <div onClick={() => navigate(-1)} style={btn()}>Cancel</div>
          <div onClick={busy ? undefined : send} style={btn(true, busy || !total || !f.reference.trim())}>{busy ? 'Sending…' : `Send invoice${total ? ' · ' + usd(total) : ''}`}</div>
        </div>
      </div>
    </div>
  );
}
