import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { api } from '../api';
import { PersonProfileEditor } from '../components/PersonProfileEditor';
import { normalizeProfile, personDisplayName, missingFields, type PersonProfile } from '../data/personProfile';
import {
  KIND_STYLE, TIER_STYLE, KIND_C, COMPANY_META, initials, type Person, type Comply,
} from '../data/people';

const BG = "'Bricolage Grotesque', serif";
const KINDS = ['All', 'Staff', 'Client', 'Consultant', 'Sub', 'Authority', 'Vendor'];

interface NewPerson {
  name: string; kind: Person['kind']; role: string; company: string; contact: string;
  phone: string; email: string; tier: Person['tier']; projects: string[]; complyDate: string; complyRef: string;
}
const BLANK: NewPerson = { name: '', kind: 'Consultant', role: '', company: '', contact: '', phone: '', email: '', tier: 'Consultant', projects: [], complyDate: '', complyRef: '' };

function ComplyBadge({ comply, small }: { comply: Comply | null; small?: boolean }) {
  if (!comply) return <span style={{ fontSize: small ? 9.5 : 10.5, color: '#7E9B93' }}>n/a</span>;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: small ? '2px 7px' : '4px 9px', borderRadius: 999, background: comply.ok ? '#D2EAD3' : '#F2DFD4', color: comply.ok ? '#1C5230' : '#8E2E0A', fontSize: small ? 9.5 : 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: comply.ok ? '#2F7D4A' : '#B8410F' }} />
      {comply.date}
    </div>
  );
}

function ProjChips({ p, max }: { p: Person; max: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {p.projects.slice(0, max).map((pr) => (
        <span key={pr} style={{ fontSize: 10, fontWeight: 600, color: '#43514D', background: '#EEF3EE', border: '1px solid rgba(23,51,38,0.08)', padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>{pr}</span>
      ))}
      {p.projects.length > max && <span style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93' }}>+{p.projects.length - max}</span>}
    </div>
  );
}

export function People() {
  const navigate = useNavigate();
  const { toast, can } = useApp();
  const canManage = can('people', 'manage');
  const [people, setPeople] = useState<Person[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [kf, setKf] = useState('All');
  const [pf, setPf] = useState('All projects');
  const [view, setView] = useState<'cards' | 'table' | 'company'>('cards');
  const [contactGroup, setContactGroup] = useState<'company' | 'project'>('company');
  const [projOpen, setProjOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [np, setNp] = useState<NewPerson>(BLANK);
  const swallow = useRef(false);

  useEffect(() => {
    const onDoc = () => { if (swallow.current) { swallow.current = false; return; } setProjOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const reload = () => { api.people.list().then((r) => { if (Array.isArray(r)) setPeople(r as Person[]); }).catch(() => { }); };
  useEffect(() => { reload(); }, []);

  const all: Person[] = people;
  const projectNames: string[] = [];
  all.forEach((p) => p.projects.forEach((pr) => { if (!projectNames.includes(pr)) projectNames.push(pr); }));

  let shown = kf === 'All' ? all : all.filter((p) => p.kind === kf);
  if (pf !== 'All projects') shown = shown.filter((p) => p.projects.includes(pf));

  const stats = [
    { label: 'People & Companies', value: String(all.length), sub: projectNames.length + ' projects covered', color: '#173326' },
    { label: 'Internal Staff', value: String(all.filter((p) => p.kind === 'Staff').length), sub: 'Full access tier', color: '#2F7D4A' },
    { label: 'Consultants & Subs', value: String(all.filter((p) => p.kind === 'Consultant' || p.kind === 'Sub').length), sub: 'Scoped to their projects', color: '#6B2FA0' },
    { label: 'Compliance Alerts', value: String(all.filter((p) => p.comply && !p.comply.ok).length), sub: 'Insurance expiring soon', color: '#B8410F' },
  ];

  const sel = all.find((p) => p.id === selectedId) || null;
  const [profile, setProfile] = useState<PersonProfile>(() => normalizeProfile({}));

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <div key={label} onClick={onClick} style={{ padding: '6px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', background: active ? '#173326' : 'white', color: active ? 'white' : '#7E9B93', border: '1px solid ' + (active ? '#173326' : 'rgba(20,8,31,0.1)') }}>{label}</div>
  );

  const openNew = () => { setNp(BLANK); setProfile(normalizeProfile({})); setEditingId(null); setShowNew(true); };
  const openEdit = (p: Person) => {
    setNp({
      name: p.name, kind: p.kind, role: p.role, company: p.company, contact: p.contact || '',
      phone: p.phone === '—' ? '' : p.phone, email: p.email === '—' ? '' : p.email, tier: p.tier,
      projects: [...p.projects], complyDate: p.comply?.date || '', complyRef: p.comply?.extra || '',
    });
    setEditingId(p.id);
    setSelectedId(null);
    setShowNew(true);
  };
  const del = (p: Person) => {
    if (!confirm(`Remove ${p.name} from People?`)) return;
    setPeople((prev) => prev.filter((x) => x.id !== p.id));
    setSelectedId(null);
    api.people.remove(p.id).then(() => reload()).catch(() => toast('⚠ Failed to delete'));
    toast(`${p.name} removed`);
  };

  const save = () => {
    if (np.name.trim().length <= 1) return;
    const needsComplyLocal = ['Consultant', 'Sub', 'Vendor'].includes(np.kind);
    const payload: Record<string, unknown> = {
      name: np.name.trim(),
      role: np.role.trim() || np.kind,
      company: np.company.trim() || np.name.trim(),
      contact: np.contact.trim() || undefined,
      kind: np.kind,
      tier: np.tier,
      phone: np.phone.trim() || '—',
      email: np.email.trim() || '—',
      projects: [...np.projects],
      comply: needsComplyLocal && np.complyDate.trim() ? { label: 'Insurance', date: np.complyDate.trim(), ok: true, extra: np.complyRef.trim() || 'No reference on file' } : null,
      ...profile,
    };
    // The directory shows one name, composed from the parts the profile holds.
    const composed = personDisplayName(profile);
    if (composed) payload.name = composed;
    const done = (verb: string) => { setShowNew(false); setNp(BLANK); setEditingId(null); reload(); toast(`${payload.name} ${verb}`); };
    if (editingId != null) {
      api.people.update(editingId, payload).then(() => done('updated')).catch(() => toast('⚠ Failed to save'));
    } else {
      api.people.create(payload).then(() => done('added to the People directory')).catch(() => toast('⚠ Failed to save'));
    }
  };

  const cardsView = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 10 }}>
      {shown.map((p) => {
        const ks = KIND_STYLE[p.kind];
        return (
          <div key={p.id} onClick={() => setSelectedId(p.id)} style={{ background: 'white', borderRadius: 14, border: '1px solid rgba(20,8,31,0.06)', padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
              <div style={{ width: 38, height: 38, borderRadius: 999, background: ks.c, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>{initials(p.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0B1A12', lineHeight: 1.3 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: '#7E9B93', marginTop: 2 }}>{p.role}</div>
                <div style={{ fontSize: 10.5, color: '#7E9B93' }}>{p.company}</div>
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 700, background: ks.bg, color: ks.c, padding: '3px 8px', borderRadius: 999, flexShrink: 0 }}>{p.kind}</span>
            </div>
            <ProjChips p={p} max={3} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 10, borderTop: '1px solid rgba(20,8,31,0.05)' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#43514D' }}>{p.openTasks} open tasks</span>
              <ComplyBadge comply={p.comply} small />
            </div>
          </div>
        );
      })}
    </div>
  );

  const cols = '1.5fr 92px 1.3fr 1.4fr 132px 84px';
  const tableView = (
    <div style={{ background: 'white', borderRadius: 14, border: '1px solid rgba(20,8,31,0.06)', overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, padding: '12px 18px', borderBottom: '1px solid rgba(20,8,31,0.06)', fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: 720 }}>
        <span>Person / Company</span><span>Kind</span><span>Projects</span><span>Contact</span><span>Compliance</span><span>Tier</span>
      </div>
      {shown.map((p) => {
        const ks = KIND_STYLE[p.kind];
        const ts = TIER_STYLE[p.tier];
        return (
          <div key={p.id} onClick={() => setSelectedId(p.id)} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, alignItems: 'center', padding: '11px 18px', borderBottom: '1px solid rgba(20,8,31,0.04)', cursor: 'pointer', minWidth: 720 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: 999, background: ks.c, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0 }}>{initials(p.name)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ fontSize: 10.5, color: '#7E9B93', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.role} · {p.company}</div>
              </div>
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 700, background: ks.bg, color: ks.c, padding: '3px 8px', borderRadius: 999, textAlign: 'center' }}>{p.kind}</span>
            <ProjChips p={p} max={2} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#0B1A12' }}>{p.phone}</div>
              <div style={{ fontSize: 10.5, color: '#173326', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.email}</div>
            </div>
            <ComplyBadge comply={p.comply} small />
            <span style={{ fontSize: 9.5, fontWeight: 700, background: ts.bg, color: ts.c, padding: '3px 8px', borderRadius: 999, textAlign: 'center' }}>{p.tier}</span>
          </div>
        );
      })}
    </div>
  );

  // Address book
  const groups: { key: string; sub: string; members: Person[] }[] = [];
  if (contactGroup === 'company') {
    const seen: Record<string, { key: string; sub: string; members: Person[] }> = {};
    shown.forEach((p) => {
      if (!seen[p.company]) { seen[p.company] = { key: p.company, sub: (COMPANY_META[p.company] || {}).trade || '', members: [] }; groups.push(seen[p.company]); }
      seen[p.company].members.push(p);
    });
  } else {
    const pn: string[] = [];
    shown.forEach((p) => p.projects.forEach((pr) => { if (!pn.includes(pr)) pn.push(pr); }));
    pn.forEach((pr) => groups.push({ key: pr, sub: 'Everyone with access to this project', members: shown.filter((p) => p.projects.includes(pr)) }));
  }
  const iconBtn = (title: string, path: string) => (
    <div key={title} title={title} style={{ width: 26, height: 26, borderRadius: 7, background: '#EEF3EE', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#173326" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
    </div>
  );
  const PH = 'M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z';
  const EM = 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6';
  const CP = 'M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1';

  const addressBook = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 10, alignItems: 'start' }}>
        {groups.map((g) => {
          const cm = COMPANY_META[g.key] || null;
          return (
            <div key={g.key} style={{ background: 'white', borderRadius: 14, border: '1px solid rgba(20,8,31,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '15px 18px', borderBottom: '1px solid rgba(20,8,31,0.05)', background: '#FBF8F2' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{g.key}</div>
                    <div style={{ fontSize: 11, color: '#7E9B93', marginTop: 2 }}>{g.sub}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', background: '#EDE3D0', padding: '3px 9px', borderRadius: 999, flexShrink: 0 }}>{g.members.length}{g.members.length === 1 ? ' contact' : ' contacts'}</span>
                </div>
                {contactGroup === 'company' && cm && cm.line && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 11 }}>
                    {([['Main line', cm.line], ['Billing', cm.billing], ['Address', cm.address]] as [string, string][]).map((r) => (
                      <div key={r[0]} style={{ gridColumn: r[0] === 'Address' ? '1 / -1' : 'auto' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{r[0]}</div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: '#0B1A12', marginTop: 1 }}>{r[1]}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding: '8px 10px' }}>
                {g.members.map((p) => (
                  <div key={p.id} onClick={() => setSelectedId(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 9, cursor: 'pointer' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 999, background: KIND_C[p.kind], display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0 }}>{initials(p.contact || p.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.contact || p.name}</div>
                      <div style={{ fontSize: 10.5, color: '#7E9B93', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.role}{contactGroup === 'project' ? ' · ' + p.company : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#0B1A12' }}>{p.phone}</div>
                      <div style={{ fontSize: 10, color: '#7E9B93' }}>{p.email}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>{iconBtn('Call', PH)}{iconBtn('Email', EM)}{iconBtn('Copy details', CP)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: '13px 16px', background: '#EEF3EE', border: '1px dashed rgba(23,51,38,0.2)', borderRadius: 12, fontSize: 12, color: '#173326', lineHeight: 1.55 }}>One address book, two ways to read it: by company for procurement and accounts, by project for day-to-day coordination. Every contact here is the same record as the People directory — edit it once.</div>
    </div>
  );

  const tierFor: Record<string, Person['tier']> = { Staff: 'Internal', Client: 'Client', Consultant: 'Consultant', Sub: 'Consultant', Authority: 'Consultant', Vendor: 'Consultant' };
  const isCompany = ['Consultant', 'Sub', 'Authority', 'Vendor'].includes(np.kind);
  const needsComply = ['Consultant', 'Sub', 'Vendor'].includes(np.kind);
  const valid = np.name.trim().length > 1;
  const lbl = (t: string, hint?: string): ReactNode => (
    <div style={{ marginBottom: 5 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t}</span>
      {hint && <span style={{ fontSize: 10, color: '#A8B5AF', marginLeft: 6 }}>{hint}</span>}
    </div>
  );
  const field = (label: string, key: keyof NewPerson, placeholder: string, hint?: string, span?: string) => (
    <div key={key} style={{ gridColumn: span || 'auto' }}>
      {lbl(label, hint)}
      <input value={np[key] as string} placeholder={placeholder} onChange={(e) => setNp({ ...np, [key]: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9, border: '1px solid rgba(20,8,31,0.12)', background: '#FBF8F2', fontSize: 13, fontFamily: 'inherit', color: '#0B1A12', outline: 'none' }} />
    </div>
  );

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {stats.map((st) => (
          <div key={st.label} style={{ background: 'white', borderRadius: 14, border: '1px solid rgba(20,8,31,0.06)', padding: '15px 16px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.09em' }}>{st.label}</div>
            <div style={{ fontFamily: BG, fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 7 }}>{st.value}</div>
            <div style={{ fontSize: 10.5, color: st.color, fontWeight: 600, marginTop: 4 }}>{st.sub}</div>
          </div>
        ))}
      </div>

      {/* View toggle + kind filter + project popover */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 3, background: '#EFEDE8', padding: 3, borderRadius: 999 }}>
          {([['cards', 'Cards'], ['table', 'Table'], ['company', 'Address book']] as [typeof view, string][]).map((v) => (
            <div key={v[0]} onClick={() => setView(v[0])} style={{ padding: '6px 15px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', background: view === v[0] ? 'white' : 'transparent', color: view === v[0] ? '#0B1A12' : '#7E9B93', boxShadow: view === v[0] ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{v[1]}</div>
          ))}
        </div>
        {view === 'company' && (
          <div style={{ display: 'flex', gap: 3, background: '#EFEDE8', padding: 3, borderRadius: 999 }}>
            {([['company', 'Group by company'], ['project', 'Group by project']] as [typeof contactGroup, string][]).map((m) => (
              <div key={m[0]} onClick={() => setContactGroup(m[0])} style={{ padding: '6px 13px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', background: contactGroup === m[0] ? 'white' : 'transparent', color: contactGroup === m[0] ? '#0B1A12' : '#7E9B93', boxShadow: contactGroup === m[0] ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{m[1]}</div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', width: '100%' }}>
          {KINDS.map((k) => chip(k, kf === k, () => setKf(k)))}
          <div style={{ marginLeft: 'auto', position: 'relative' }}>
            <div onClick={(e) => { e.stopPropagation(); swallow.current = true; setProjOpen((o) => !o); }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 13px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: pf === 'All projects' ? '#7E9B93' : 'white', background: pf === 'All projects' ? 'white' : '#173326', border: '1px solid rgba(20,8,31,0.12)' }}>
              <span>{pf}</span>
              <svg width={10} height={6} viewBox="0 0 10 6" fill="none" style={{ transform: projOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="M1 1l4 4 4-4" stroke={pf === 'All projects' ? '#7E9B93' : 'white'} strokeWidth={1.6} strokeLinecap="round" /></svg>
            </div>
            {projOpen && (
              <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60, minWidth: 190, background: 'white', borderRadius: 12, border: '1px solid rgba(20,8,31,0.08)', boxShadow: '0 12px 30px rgba(11,26,18,0.16)', padding: 5, maxHeight: 260, overflowY: 'auto' }}>
                {['All projects', ...projectNames].map((pr) => (
                  <div key={pr} onClick={() => { setPf(pr); setProjOpen(false); }} style={{ padding: '8px 11px', borderRadius: 8, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: pf === pr ? 700 : 500, color: pf === pr ? '#173326' : '#43514D', background: pf === pr ? '#DCE7DE' : 'transparent' }}>{pr}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Count + New */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 11.5, color: '#7E9B93' }}>Showing {shown.length} of {all.length} records{pf === 'All projects' ? '' : ' on ' + pf}</div>
        {canManage && (
          <div onClick={openNew} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 999, background: '#173326', color: 'white', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(23,51,38,0.22)' }}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> New person or company
          </div>
        )}
      </div>

      {view === 'company' ? addressBook : view === 'table' ? tableView : cardsView}

      {/* Person drawer */}
      {sel && (
        <div onClick={() => setSelectedId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.45)', zIndex: 90, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.18s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 430, maxWidth: '92vw', height: '100%', background: 'white', overflowY: 'auto', boxShadow: '-14px 0 46px rgba(11,26,18,0.22)' }}>
            <div style={{ padding: '22px 24px', borderBottom: '1px solid rgba(20,8,31,0.06)', display: 'flex', alignItems: 'flex-start', gap: 13 }}>
              <div style={{ width: 48, height: 48, borderRadius: 999, background: KIND_STYLE[sel.kind].c, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 700, color: 'white', flexShrink: 0 }}>{initials(sel.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: BG, fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>{sel.name}</div>
                <div style={{ fontSize: 12, color: '#7E9B93', marginTop: 2 }}>{sel.role}</div>
                <div style={{ fontSize: 12, color: '#43514D', fontWeight: 600, marginTop: 1 }}>{sel.company}</div>
                {sel.contact && <div style={{ fontSize: 11, color: '#7E9B93', marginTop: 2 }}>Primary contact: {sel.contact}</div>}
              </div>
              <div onClick={() => setSelectedId(null)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(20,8,31,0.08)', display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 14, color: '#7E9B93', flexShrink: 0 }}>×</div>
            </div>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(20,8,31,0.06)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              {([['Kind', sel.kind], ['Access tier', sel.tier], ['Phone', sel.phone], ['Email', sel.email], ['Open tasks', String(sel.openTasks)], ['With us since', sel.since]] as [string, string][]).map((r) => (
                <div key={r[0]} style={{ padding: '11px 13px', background: '#FBF8F2', borderRadius: 10 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{r[0]}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0B1A12', wordBreak: 'break-word' }}>{r[1]}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Projects ({sel.projects.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sel.projects.map((pr) => (
                  <div key={pr} onClick={() => { setSelectedId(null); navigate('/projects'); }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: '#FBF8F2', borderRadius: 9, cursor: 'pointer' }}>
                    <div style={{ width: 7, height: 7, borderRadius: 999, background: '#173326' }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{pr}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#173326' }}>Open →</span>
                  </div>
                ))}
              </div>
            </div>
            {sel.comply && (
              <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Compliance</div>
                <div style={{ padding: '13px 15px', borderRadius: 11, background: sel.comply.ok ? '#EEF3EE' : '#F2DFD4' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: sel.comply.ok ? '#1C5230' : '#8E2E0A' }}>{sel.comply.label} · {sel.comply.date}</div>
                  <div style={{ fontSize: 11.5, color: sel.comply.ok ? '#43514D' : '#8E2E0A', marginTop: 4 }}>{sel.comply.extra}</div>
                </div>
              </div>
            )}
            <div style={{ padding: '18px 24px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div onClick={() => { setSelectedId(null); navigate('/tasks'); }} style={{ padding: '9px 15px', borderRadius: 999, background: '#173326', color: 'white', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>View their tasks</div>
              {canManage && <div onClick={() => openEdit(sel)} style={{ padding: '9px 15px', borderRadius: 999, border: '1px solid rgba(20,8,31,0.1)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: '#2F7D4A' }}>Edit record</div>}
              {canManage && <div onClick={() => del(sel)} style={{ padding: '9px 15px', borderRadius: 999, border: '1px solid rgba(142,46,10,0.25)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: '#8E2E0A' }}>Delete</div>}
            </div>
            <div style={{ padding: '0 24px 24px', fontSize: 10.5, color: '#7E9B93', lineHeight: 1.55 }}>Access tier controls what this person sees. Consultants and subs only see the projects listed above; clients see their own project only.</div>
          </div>
        </div>
      )}

      {/* New person panel */}
      {showNew && (
        <div onClick={() => setShowNew(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.5)', zIndex: 120, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.18s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 640, maxWidth: '100vw', height: '100vh', background: 'white', boxShadow: '-18px 0 48px rgba(20,8,31,0.22)', display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.2s ease' }}>
            <div style={{ padding: '22px 26px 18px', borderBottom: '1px solid rgba(20,8,31,0.07)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: BG, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{editingId != null ? 'Edit person or company' : 'Add to People'}</div>
                <div style={{ fontSize: 12.5, color: '#7E9B93', marginTop: 3 }}>One record serves the directory, the address book and access control.</div>
              </div>
              <div onClick={() => setShowNew(false)} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(20,8,31,0.08)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#7E9B93', fontSize: 15, flexShrink: 0 }}>×</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <div style={{ padding: '20px 26px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                {lbl('Kind', 'sets the default access tier')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {['Staff', 'Client', 'Consultant', 'Sub', 'Authority', 'Vendor'].map((o) => (
                    <div key={o} onClick={() => setNp({ ...np, kind: o as Person['kind'], tier: tierFor[o] })} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: np.kind === o ? '#173326' : 'white', color: np.kind === o ? 'white' : '#7E9B93', border: '1px solid ' + (np.kind === o ? '#173326' : 'rgba(20,8,31,0.12)') }}>{o}</div>
                  ))}
                </div>
              </div>
              {field(isCompany ? 'Company or firm name' : 'Full name', 'name', isCompany ? 'e.g. Kestrel Electric Co.' : 'e.g. Dana Whitfield', 'required', '1 / -1')}
              {field(isCompany ? 'Trade or discipline' : 'Role or title', 'role', isCompany ? 'e.g. Electrical' : 'e.g. Project Coordinator')}
              {field('Company shown in lists', 'company', isCompany ? 'Same as above if left blank' : 'e.g. Origami Design + Build')}
              {isCompany && field('Primary contact', 'contact', 'e.g. Dana Whitfield', 'the person you actually call', '1 / -1')}
              {field('Phone', 'phone', '(415) 555 0000')}
              {field('Email', 'email', 'name@company.com')}
              <div style={{ gridColumn: '1 / -1' }}>
                {lbl('Projects they can access', np.projects.length ? np.projects.length + ' selected' : 'pick any number')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {projectNames.map((o) => {
                    const active = np.projects.includes(o);
                    return <div key={o} onClick={() => setNp({ ...np, projects: active ? np.projects.filter((x) => x !== o) : [...np.projects, o] })} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: active ? '#173326' : 'white', color: active ? 'white' : '#7E9B93', border: '1px solid ' + (active ? '#173326' : 'rgba(20,8,31,0.12)') }}>{o}</div>;
                  })}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                {lbl('Access tier', 'what they can see in the platform')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {['Internal', 'Client', 'Consultant'].map((o) => (
                    <div key={o} onClick={() => setNp({ ...np, tier: o as Person['tier'] })} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: np.tier === o ? '#173326' : 'white', color: np.tier === o ? 'white' : '#7E9B93', border: '1px solid ' + (np.tier === o ? '#173326' : 'rgba(20,8,31,0.12)') }}>{o}</div>
                  ))}
                </div>
              </div>
              {needsComply && field('Insurance expiry', 'complyDate', 'e.g. Expires Mar 2027')}
              {needsComply && field('Licence / EMR reference', 'complyRef', 'e.g. EMR 0.87 · Licence 1042118')}
            </div>

            {/* The full record: identity, addresses, licences and insurance. */}
            <div style={{ padding: '0 26px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93', margin: '4px 0 10px' }}>Full record</div>
              <PersonProfileEditor profile={profile} onChange={setProfile} />
            </div>
            <div style={{ padding: '0 26px 18px' }}>
              <div style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10, fontSize: 11, color: '#43514D', lineHeight: 1.55 }}>{np.tier === 'Internal' ? 'Internal tier sees every project, every task and all financials.' : np.tier === 'Client' ? 'Client tier sees only the projects selected above — no internal tasks, costs or margins.' : 'Consultant tier sees only the projects selected above, and only the tasks and files shared with them.'}</div>
            </div>
            </div>
            <div style={{ padding: '16px 26px 22px', borderTop: '1px solid rgba(20,8,31,0.07)', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0, background: 'white' }}>
              <span style={{ marginRight: 'auto', fontSize: 11, fontWeight: 600, color: !valid ? '#8E2E0A' : missingFields(profile).length ? '#93520F' : '#2F7D4A' }}>
                {!valid
                  ? 'A name is required to save'
                  : missingFields(profile).length
                    ? `${missingFields(profile).length} required field(s) outstanding`
                    : 'Record complete'}
              </span>
              <div onClick={save} style={{ padding: '11px 20px', borderRadius: 999, background: valid ? '#173326' : '#D6DED8', color: valid ? 'white' : '#9AA39D', fontSize: 13, fontWeight: 700, cursor: valid ? 'pointer' : 'not-allowed' }}>{editingId != null ? 'Save changes' : 'Save to directory'}</div>
              <div onClick={() => setShowNew(false)} style={{ padding: '11px 18px', borderRadius: 999, border: '1px solid rgba(20,8,31,0.12)', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#43514D' }}>Cancel</div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
