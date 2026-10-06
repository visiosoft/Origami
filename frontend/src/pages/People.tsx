import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PeopleImport } from '../components/PeopleImport';
import { PeopleTable } from '../components/PeopleTable';
import { getTheme, useTheme } from '../theme';
import { toCsv } from '../data/csv';
import { SubContractorSummary } from '../components/Contractors';
import { LoginCard } from '../components/StaffAccessCards';
import { EmailLink, PhoneLink } from '../components/ContactLinks';
import { SaveBar, useAutosave } from '../autosave';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext';
import { api } from '../api';
import { PersonProfileEditor } from '../components/PersonProfileEditor';
import { normalizeProfile, personDisplayName, missingFields, type PersonProfile } from '../data/personProfile';
import {
  KIND_STYLE, TIER_STYLE, KIND_C, COMPANY_META, INTERNAL_LEVELS, initials, internalLevelOf, levelFromRole, type Person, type Comply,
} from '../data/people';

const BG = 'var(--font-display)';
// Internal people are split by level (Executive … Labor); everyone else by kind.
const KINDS = ['All', ...INTERNAL_LEVELS, 'Client', 'Consultant', 'Sub', 'Authority', 'Vendor'];
const isLevel = (k: string) => (INTERNAL_LEVELS as readonly string[]).includes(k);
const matchKind = (p: Person, k: string) => k === 'All' || (isLevel(k) ? internalLevelOf(p) === k : p.kind === k);
const kindLabel = (k: string) => (k === 'Sub' ? 'Subs' : k);
/** What the type badge says: the level for internal people, the kind for everyone else. */
const typeOf = (p: Person) => internalLevelOf(p) || p.kind;

interface NewPerson {
  name: string; kind: Person['kind']; role: string; company: string; contact: string;
  phone: string; email: string; tier: Person['tier']; projects: string[]; complyDate: string; complyRef: string;
  /** Internal people: their level; '' = worked out from the role. */
  internalLevel: string;
}
const BLANK: NewPerson = { name: '', kind: 'Consultant', role: '', company: '', contact: '', phone: '', email: '', tier: 'Consultant', projects: [], complyDate: '', complyRef: '', internalLevel: '' };

/** What the directory stores for a person, composed from the form and the profile editor. */
function personPayload(np: NewPerson, profile: PersonProfile): Record<string, any> {
  const needsComply = ['Consultant', 'Sub', 'Vendor'].includes(np.kind);
  const payload: Record<string, any> = {
    name: np.name.trim(),
    role: np.role.trim() || np.kind,
    company: np.company.trim() || np.name.trim(),
    contact: np.contact.trim() || undefined,
    kind: np.kind,
    internalLevel: np.kind === 'Staff' ? np.internalLevel : '',
    tier: np.tier,
    phone: np.phone.trim() || '—',
    email: np.email.trim() || '—',
    projects: [...np.projects],
    comply: needsComply && np.complyDate.trim() ? { label: 'Insurance', date: np.complyDate.trim(), ok: true, extra: np.complyRef.trim() || 'No reference on file' } : null,
    ...profile,
  };
  // The directory shows one name, composed from the parts the profile holds.
  const composed = personDisplayName(profile);
  if (composed) payload.name = composed;
  return payload;
}
const BLANK_PAYLOAD = personPayload(BLANK, normalizeProfile({}));

function ComplyBadge({ comply, small }: { comply: Comply | null; small?: boolean }) {
  if (!comply) return <span style={{ fontSize: small ? 9.5 : 10.5, color: 'var(--muted)' }}>n/a</span>;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: small ? '2px 7px' : '4px 9px', borderRadius: 999, background: comply.ok ? 'var(--c-d2ead3)' : '#F2DFD4', color: comply.ok ? 'var(--success-deep)' : '#8E2E0A', fontSize: small ? 9.5 : 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: comply.ok ? 'var(--success)' : '#B8410F' }} />
      {comply.date}
    </div>
  );
}

function ProjChips({ p, max }: { p: Person; max: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {p.projects.slice(0, max).map((pr) => (
        <span key={pr} style={{ fontSize: 10, fontWeight: 600, color: 'var(--body)', background: 'var(--mist)', border: '1px solid rgba(var(--rgb-forest), 0.08)', padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>{pr}</span>
      ))}
      {p.projects.length > max && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>+{p.projects.length - max}</span>}
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
  const [theme] = useTheme();
  const isNew = theme === 'coterie';
  // The New look opens on the list; Classic keeps its cards.
  const [view, setView] = useState<'cards' | 'table' | 'company'>(() => (getTheme() === 'coterie' ? 'table' : 'cards'));
  const [q, setQ] = useState('');
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [contactGroup, setContactGroup] = useState<'company' | 'project'>('company');
  const [projOpen, setProjOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // /people?open=<personId> (global search) opens that record once it has loaded.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const id = Number(searchParams.get('open'));
    if (!id || !people.some((x) => x.id === id)) return;
    setSelectedId(id);
    setSearchParams((p) => { p.delete('open'); return p; }, { replace: true });
  }, [searchParams, people, setSearchParams]);
  const [showNew, setShowNew] = useState(false);
  const [importing, setImporting] = useState(false);
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

  let shown = all.filter((p) => matchKind(p, kf));
  if (pf !== 'All projects') shown = shown.filter((p) => p.projects.includes(pf));
  if (onlyAlerts) shown = shown.filter((p) => p.comply && !p.comply.ok);
  const qn = q.trim().toLowerCase();
  if (qn) shown = shown.filter((p) => [p.name, p.role, p.company, p.email, p.contact, ...p.projects].some((v) => (v || '').toLowerCase().includes(qn)));
  const alertCount = all.filter((p) => p.comply && !p.comply.ok).length;
  const kindCount = (k: string) => all.filter((p) => matchKind(p, k)).length;
  const pickedShown = shown.filter((p) => picked.has(p.id));
  const togglePick = (id: number) => setPicked((s0) => { const n = new Set(s0); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const exportPicked = () => {
    const rows = [['Name', 'Type', 'Role', 'Company', 'Phone', 'Email', 'Projects', 'Since'],
      ...pickedShown.map((p) => [p.name, p.kind, p.role, p.company, p.phone, p.email, p.projects.join('; '), p.since])];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `people-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const stats = [
    { label: 'People & Companies', value: String(all.length), sub: projectNames.length + ' projects covered', color: 'var(--forest)' },
    { label: 'Internal Staff', value: String(all.filter((p) => p.kind === 'Staff').length), sub: 'Full access tier', color: 'var(--success)' },
    { label: 'Consultants & Subs', value: String(all.filter((p) => p.kind === 'Consultant' || p.kind === 'Sub').length), sub: 'Scoped to their projects', color: '#6B2FA0' },
    { label: 'Compliance Alerts', value: String(all.filter((p) => p.comply && !p.comply.ok).length), sub: 'Insurance expiring soon', color: '#B8410F' },
  ];

  const sel = all.find((p) => p.id === selectedId) || null;
  const [profile, setProfile] = useState<PersonProfile>(() => normalizeProfile({}));

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <div key={label} onClick={onClick} style={{ padding: '6px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', background: active ? 'var(--forest)' : 'var(--surface)', color: active ? 'white' : 'var(--muted)', border: '1px solid ' + (active ? 'var(--forest)' : 'rgba(var(--rgb-shade), 0.1)') }}>{label}</div>
  );

  // The person form saves itself: added to the directory once it has a name,
  // then only the changed fields, 3 seconds after typing stops.
  const [personSession, setPersonSession] = useState(0);
  const [personSaved, setPersonSaved] = useState<Record<string, any> | null>(null);
  const personIdRef = useRef<number | null>(null);
  const personDraft = useMemo(() => personPayload(np, profile), [np, profile]);
  const personNameOk = String(personDraft.name || '').trim().length > 1;
  const personAuto = useAutosave<Record<string, any>>({
    draft: personDraft, saved: personSaved ?? BLANK_PAYLOAD, resetKey: 'person-' + personSession,
    // New staff go through the employee form (one record), so this form doesn't create them.
    enabled: showNew && personNameOk && !(np.kind === 'Staff' && personIdRef.current == null), label: 'person',
    save: async (changes, { draft }) => {
      if (personIdRef.current == null) {
        const created: any = await api.people.create(draft);
        personIdRef.current = created?.id ?? null;
        setEditingId(created?.id ?? null);
        reload();
        toast(`${draft.name} added to the People directory`);
        return { ...draft };
      }
      const id = personIdRef.current;
      await api.people.update(id, changes);
      setPeople((prev) => prev.map((x) => (x.id === id ? { ...x, ...changes } as Person : x)));
      return { ...draft };
    },
  });
  const startPersonForm = (form: NewPerson, prof: PersonProfile, id: number | null) => {
    setNp(form);
    setProfile(prof);
    setEditingId(id);
    personIdRef.current = id;
    setPersonSaved(id != null ? personPayload(form, prof) : null);
    setPersonSession((n) => n + 1);
    setShowNew(true);
  };
  const openNew = () => startPersonForm(BLANK, normalizeProfile({}), null);
  const openEdit = (p: Person) => {
    setSelectedId(null);
    // The person's own profile, not whatever the form held last -- saving used to overwrite it.
    startPersonForm({
      name: p.name, kind: p.kind, role: p.role, company: p.company, contact: p.contact || '',
      phone: p.phone === '—' ? '' : p.phone, email: p.email === '—' ? '' : p.email, tier: p.tier,
      projects: [...p.projects], complyDate: p.comply?.date || '', complyRef: p.comply?.extra || '', internalLevel: p.internalLevel || '',
    }, normalizeProfile(p as any), p.id);
  };
  const closePersonForm = () => {
    if (personNameOk && personAuto.dirty && !(np.kind === 'Staff' && personIdRef.current == null)) void personAuto.saveNow();
    setShowNew(false);
    setEditingId(null);
  };
  const del = (p: Person) => {
    if (!confirm(`Remove ${p.name} from People?`)) return;
    setPeople((prev) => prev.filter((x) => x.id !== p.id));
    setSelectedId(null);
    api.people.remove(p.id).then(() => reload()).catch(() => toast('⚠ Failed to delete'));
    toast(`${p.name} removed`);
  };

  const cardsView = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 10 }}>
      {shown.map((p) => {
        const ks = KIND_STYLE[p.kind];
        return (
          <div key={p.id} onClick={() => setSelectedId(p.id)} style={{ background: 'var(--surface)', borderRadius: 'var(--r-14)', border: '1px solid rgba(var(--rgb-shade), 0.06)', padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
              <div style={{ width: 38, height: 38, borderRadius: 999, background: ks.c, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>{initials(p.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{p.role}</div>
                <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{p.company}</div>
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 700, background: ks.bg, color: ks.c, padding: '3px 8px', borderRadius: 999, flexShrink: 0 }}>{typeOf(p)}</span>
            </div>
            <ProjChips p={p} max={3} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 10, borderTop: '1px solid rgba(var(--rgb-shade), 0.05)' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--body)' }}>{p.openTasks} open tasks</span>
              <ComplyBadge comply={p.comply} small />
            </div>
          </div>
        );
      })}
    </div>
  );

  const cols = '1.5fr 92px 1.3fr 1.4fr 132px 84px';
  const tableView = (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-14)', border: '1px solid rgba(var(--rgb-shade), 0.06)', overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, padding: '12px 18px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: 720 }}>
        <span>Person / Company</span><span>Kind</span><span>Projects</span><span>Contact</span><span>Compliance</span><span>Tier</span>
      </div>
      {shown.map((p) => {
        const ks = KIND_STYLE[p.kind];
        const ts = TIER_STYLE[p.tier];
        return (
          <div key={p.id} onClick={() => setSelectedId(p.id)} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, alignItems: 'center', padding: '11px 18px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.04)', cursor: 'pointer', minWidth: 720 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: 999, background: ks.c, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0 }}>{initials(p.name)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.role} · {p.company}</div>
              </div>
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 700, background: ks.bg, color: ks.c, padding: '3px 8px', borderRadius: 999, textAlign: 'center' }}>{typeOf(p)}</span>
            <ProjChips p={p} max={2} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)' }}><PhoneLink phone={p.phone} /></div>
              <div style={{ fontSize: 10.5, color: 'var(--forest)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><EmailLink email={p.email} /></div>
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
    <div key={title} title={title} style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--mist)', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
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
            <div key={g.key} style={{ background: 'var(--surface)', borderRadius: 'var(--r-14)', border: '1px solid rgba(var(--rgb-shade), 0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '15px 18px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.05)', background: 'var(--panel)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{g.key}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{g.sub}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', background: 'var(--sand)', padding: '3px 9px', borderRadius: 999, flexShrink: 0 }}>{g.members.length}{g.members.length === 1 ? ' contact' : ' contacts'}</span>
                </div>
                {contactGroup === 'company' && cm && cm.line && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 11 }}>
                    {([['Main line', cm.line], ['Billing', cm.billing], ['Address', cm.address]] as [string, string][]).map((r) => (
                      <div key={r[0]} style={{ gridColumn: r[0] === 'Address' ? '1 / -1' : 'auto' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{r[0]}</div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)', marginTop: 1 }}>{r[1]}</div>
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
                      <div style={{ fontSize: 10.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.role}{contactGroup === 'project' ? ' · ' + p.company : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)' }}><PhoneLink phone={p.phone} /></div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}><EmailLink email={p.email} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>{iconBtn('Call', PH)}{iconBtn('Email', EM)}{iconBtn('Copy details', CP)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: '13px 16px', background: 'var(--mist)', border: '1px dashed rgba(var(--rgb-forest), 0.2)', borderRadius: 'var(--r-12)', fontSize: 12, color: 'var(--forest)', lineHeight: 1.55 }}>One address book, two ways to read it: by company for procurement and accounts, by project for day-to-day coordination. Every contact here is the same record as the People directory — edit it once.</div>
    </div>
  );

  const tierFor: Record<string, Person['tier']> = { Staff: 'Internal', Client: 'Client', Consultant: 'Consultant', Sub: 'Consultant', Authority: 'Consultant', Vendor: 'Consultant' };
  const isCompany = ['Consultant', 'Sub', 'Authority', 'Vendor'].includes(np.kind);
  const needsComply = ['Consultant', 'Sub', 'Vendor'].includes(np.kind);
  const valid = np.name.trim().length > 1;
  const lbl = (t: string, hint?: string): ReactNode => (
    <div style={{ marginBottom: 5 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t}</span>
      {hint && <span style={{ fontSize: 10, color: '#A8B5AF', marginLeft: 6 }}>{hint}</span>}
    </div>
  );
  const field = (label: string, key: keyof NewPerson, placeholder: string, hint?: string, span?: string) => (
    <div key={key} style={{ gridColumn: span || 'auto' }}>
      {lbl(label, hint)}
      <input value={np[key] as string} placeholder={placeholder} onChange={(e) => setNp({ ...np, [key]: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.12)', background: 'var(--panel)', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', outline: 'none' }} />
    </div>
  );

  const newTop = (
    <>
      <div className="pp-head">
        <h2 className="pp-title">People</h2>
        <label className="pp-search">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" style={{ stroke: 'var(--muted)', flexShrink: 0 }}><circle cx={11} cy={11} r={7} /><path d="m20 20-3.5-3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or role" aria-label="Search people" />
        </label>
        <div className="pp-views" style={{ display: 'flex', gap: 3, background: 'var(--surface)', border: '1px solid var(--border)', padding: 3, borderRadius: 999 }}>
          {([['table', 'List'], ['cards', 'Cards'], ['company', 'Address book']] as [typeof view, string][]).map((v) => (
            <div key={v[0]} onClick={() => setView(v[0])} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', background: view === v[0] ? 'var(--seg-on)' : 'transparent', color: view === v[0] ? 'var(--ink)' : 'var(--body)' }}>{v[1]}</div>
          ))}
        </div>
        {canManage && <button type="button" className="pp-btn is-ghost" onClick={() => setImporting(true)}>Import</button>}
        {canManage && (
          <button type="button" className="pp-btn is-dark" onClick={openNew}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round" style={{ stroke: 'currentColor' }}><path d="M12 5v14M5 12h14" /></svg>
            Add member
          </button>
        )}
      </div>
      <div className="pp-filters">
        {KINDS.filter((k) => k === 'All' || kindCount(k) > 0).map((k) => (
          <button type="button" key={k} className={'pp-chip' + (kf === k ? ' is-on' : '')} onClick={() => setKf(k)}>{kindLabel(k)} <small>{kindCount(k)}</small></button>
        ))}
        {alertCount > 0 && (
          <button type="button" className={'pp-chip is-alert' + (onlyAlerts ? ' is-on' : '')} onClick={() => setOnlyAlerts((v) => !v)}>Compliance <small>{alertCount}</small></button>
        )}
        <span className="pp-spacer" />
        <div style={{ position: 'relative' }}>
          <button type="button" className={'pp-chip' + (pf !== 'All projects' ? ' is-on' : '')} onClick={(e) => { e.stopPropagation(); swallow.current = true; setProjOpen((o) => !o); }}>
            {pf}
            <svg width={10} height={6} viewBox="0 0 10 6" fill="none" style={{ stroke: 'currentColor', transform: projOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="M1 1l4 4 4-4" strokeWidth={1.6} strokeLinecap="round" /></svg>
          </button>
          {projOpen && (
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60, minWidth: 200, background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)', boxShadow: 'var(--shadow-pop)', padding: 6, maxHeight: 280, overflowY: 'auto' }}>
              {['All projects', ...projectNames].map((pr) => (
                <div key={pr} onClick={() => { setPf(pr); setProjOpen(false); }} style={{ padding: '9px 12px', borderRadius: 12, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: pf === pr ? 600 : 400, color: 'var(--ink)', background: pf === pr ? 'var(--yellow-soft)' : 'transparent' }}>{pr}</div>
              ))}
            </div>
          )}
        </div>
      </div>
      {view === 'company' && (
        <div style={{ display: 'flex', gap: 3, alignSelf: 'flex-start', background: 'var(--surface)', border: '1px solid var(--border)', padding: 3, borderRadius: 999 }}>
          {([['company', 'Group by company'], ['project', 'Group by project']] as [typeof contactGroup, string][]).map((m) => (
            <div key={m[0]} onClick={() => setContactGroup(m[0])} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', background: contactGroup === m[0] ? 'var(--seg-on)' : 'transparent', color: contactGroup === m[0] ? 'var(--ink)' : 'var(--body)' }}>{m[1]}</div>
          ))}
        </div>
      )}
      {(pickedShown.length > 0 || qn || onlyAlerts || pf !== 'All projects') && (
        <div className="pp-select-bar">
          {pickedShown.length > 0
            ? <><span>{pickedShown.length} selected</span><span className="pp-link" onClick={exportPicked}>Export to spreadsheet</span><span className="pp-link" onClick={() => setPicked(new Set())}>Clear</span></>
            : <span>Showing {shown.length} of {all.length}</span>}
        </div>
      )}
      {importing && <PeopleImport onClose={() => setImporting(false)} onDone={() => reload()} />}
    </>
  );

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', gap: isNew ? 16 : 12 }}>
      {isNew ? newTop : <>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {stats.map((st) => (
          <div key={st.label} style={{ background: 'var(--surface)', borderRadius: 'var(--r-14)', border: '1px solid rgba(var(--rgb-shade), 0.06)', padding: '15px 16px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>{st.label}</div>
            <div style={{ fontFamily: BG, fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 7 }}>{st.value}</div>
            <div style={{ fontSize: 10.5, color: st.color, fontWeight: 600, marginTop: 4 }}>{st.sub}</div>
          </div>
        ))}
      </div>

      {/* View toggle + kind filter + project popover */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 3, background: 'var(--c-efede8)', padding: 3, borderRadius: 999 }}>
          {([['cards', 'Cards'], ['table', 'Table'], ['company', 'Address book']] as [typeof view, string][]).map((v) => (
            <div key={v[0]} onClick={() => setView(v[0])} style={{ padding: '6px 15px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', background: view === v[0] ? 'var(--seg-on)' : 'transparent', color: view === v[0] ? 'var(--ink)' : 'var(--muted)', boxShadow: view === v[0] ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{v[1]}</div>
          ))}
        </div>
        {view === 'company' && (
          <div style={{ display: 'flex', gap: 3, background: 'var(--c-efede8)', padding: 3, borderRadius: 999 }}>
            {([['company', 'Group by company'], ['project', 'Group by project']] as [typeof contactGroup, string][]).map((m) => (
              <div key={m[0]} onClick={() => setContactGroup(m[0])} style={{ padding: '6px 13px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', background: contactGroup === m[0] ? 'var(--seg-on)' : 'transparent', color: contactGroup === m[0] ? 'var(--ink)' : 'var(--muted)', boxShadow: contactGroup === m[0] ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{m[1]}</div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', width: '100%' }}>
          {KINDS.filter((k) => !isLevel(k) || kindCount(k) > 0).map((k) => chip(kindLabel(k), kf === k, () => setKf(k)))}
          <div style={{ marginLeft: 'auto', position: 'relative' }}>
            <div onClick={(e) => { e.stopPropagation(); swallow.current = true; setProjOpen((o) => !o); }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 13px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: pf === 'All projects' ? 'var(--muted)' : 'white', background: pf === 'All projects' ? 'var(--surface)' : 'var(--forest)', border: '1px solid rgba(var(--rgb-shade), 0.12)' }}>
              <span>{pf}</span>
              <svg width={10} height={6} viewBox="0 0 10 6" fill="none" style={{ transform: projOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="M1 1l4 4 4-4" stroke={pf === 'All projects' ? '#7E9B93' : 'white'} strokeWidth={1.6} strokeLinecap="round" /></svg>
            </div>
            {projOpen && (
              <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60, minWidth: 190, background: 'var(--surface)', borderRadius: 'var(--r-12)', border: '1px solid rgba(var(--rgb-shade), 0.08)', boxShadow: '0 12px 30px rgba(var(--rgb-ink), 0.16)', padding: 5, maxHeight: 260, overflowY: 'auto' }}>
                {['All projects', ...projectNames].map((pr) => (
                  <div key={pr} onClick={() => { setPf(pr); setProjOpen(false); }} style={{ padding: '8px 11px', borderRadius: 8, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: pf === pr ? 700 : 500, color: pf === pr ? 'var(--forest)' : 'var(--body)', background: pf === pr ? 'var(--mint)' : 'transparent' }}>{pr}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Count + New */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Showing {shown.length} of {all.length} records{pf === 'All projects' ? '' : ' on ' + pf}</div>
        {canManage && <div onClick={() => setImporting(true)} style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.12)', color: 'var(--forest)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: 'var(--surface)' }}>Import from spreadsheet</div>}
        {importing && <PeopleImport onClose={() => setImporting(false)} onDone={() => reload()} />}
        {canManage && (
          <div onClick={openNew} style={{ marginLeft: canManage ? 0 : 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 999, background: 'var(--forest)', color: 'white', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(var(--rgb-forest), 0.22)' }}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> New person or company
          </div>
        )}
      </div>

      </>}

      {view === 'company' ? addressBook
        : view === 'table' ? (isNew
          ? <PeopleTable people={shown} picked={picked} onPick={togglePick} onOpen={(id) => setSelectedId(id)}
              onPickAll={(on) => setPicked(on ? new Set(shown.map((p) => p.id)) : new Set())} />
          : tableView)
        : cardsView}

      {/* Person drawer */}
      {sel && (
        <div onClick={() => setSelectedId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(var(--rgb-shade), 0.45)', zIndex: 90, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.18s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 430, maxWidth: '92vw', height: '100%', background: 'var(--surface)', overflowY: 'auto', boxShadow: '-14px 0 46px rgba(var(--rgb-ink), 0.22)' }}>
            <div style={{ padding: '22px 24px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)', display: 'flex', alignItems: 'flex-start', gap: 13 }}>
              <div style={{ width: 48, height: 48, borderRadius: 999, background: KIND_STYLE[sel.kind].c, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 700, color: 'white', flexShrink: 0 }}>{initials(sel.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: BG, fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>{sel.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{sel.role}</div>
                <div style={{ fontSize: 12, color: 'var(--body)', fontWeight: 600, marginTop: 1 }}>{sel.company}</div>
                {sel.contact && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Primary contact: {sel.contact}</div>}
              </div>
              <div onClick={() => setSelectedId(null)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.08)', display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 14, color: 'var(--muted)', flexShrink: 0 }}>×</div>
            </div>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              {([['Kind', sel.kind], ['Access tier', sel.tier], ['Phone', sel.phone], ['Email', sel.email], ['Open tasks', String(sel.openTasks)], ['With us since', sel.since]] as [string, string][]).map((r) => (
                <div key={r[0]} style={{ padding: '11px 13px', background: 'var(--panel)', borderRadius: 10 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{r[0]}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', wordBreak: 'break-word' }}>{r[0] === 'Phone' ? <PhoneLink phone={r[1]} /> : r[0] === 'Email' ? <EmailLink email={r[1]} /> : r[1]}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Projects ({sel.projects.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sel.projects.map((pr) => (
                  <div key={pr} onClick={() => { setSelectedId(null); navigate('/projects'); }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: 'var(--panel)', borderRadius: 9, cursor: 'pointer' }}>
                    <div style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--forest)' }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{pr}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--forest)' }}>Open →</span>
                  </div>
                ))}
              </div>
            </div>
            {sel.comply && (
              <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Compliance</div>
                <div style={{ padding: '13px 15px', borderRadius: 11, background: sel.comply.ok ? 'var(--mist)' : '#F2DFD4' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: sel.comply.ok ? 'var(--success-deep)' : '#8E2E0A' }}>{sel.comply.label} · {sel.comply.date}</div>
                  <div style={{ fontSize: 11.5, color: sel.comply.ok ? 'var(--body)' : '#8E2E0A', marginTop: 4 }}>{sel.comply.extra}</div>
                </div>
              </div>
            )}
            {sel.contractorId && !sel.employeeId && (
              <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
                <SubContractorSummary contractorId={sel.contractorId} onOpen={() => { setSelectedId(null); navigate(`/manpower_con?contractor=${encodeURIComponent(sel.contractorId!)}`); }} />
              </div>
            )}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
              {sel.kind === 'Staff' || sel.employeeId ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>Their login is managed on their employee record — <span onClick={() => { setSelectedId(null); navigate(sel.employeeId ? `/manpower_con?employee=${encodeURIComponent(sel.employeeId)}` : '/manpower_con'); }} style={{ color: 'var(--forest)', fontWeight: 700, cursor: 'pointer' }}>open it</span>.</div>
              ) : (
                <LoginCard
                  subject={{ id: sel.id, name: sel.kind === 'Sub' && sel.contact ? `${sel.contact} (${sel.name})` : sel.name, email: sel.email, userId: sel.userId }}
                  kind={sel.kind}
                  projects={sel.projects}
                  onLink={(userId, email) => api.people.update(String(sel.id), { userId, ...(email ? { email } : {}) })}
                  onChanged={() => reload()}
                />
              )}
            </div>
            <div style={{ padding: '18px 24px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div onClick={() => { setSelectedId(null); navigate('/tasks'); }} style={{ padding: '9px 15px', borderRadius: 999, background: 'var(--forest)', color: 'white', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>View their tasks</div>
              {sel.employeeId ? (
                // Staff and workers are one record with their employee file -- edited there, in full.
                <div onClick={() => { setSelectedId(null); navigate(`/manpower_con?employee=${encodeURIComponent(sel.employeeId!)}`); }} style={{ padding: '9px 15px', borderRadius: 999, background: 'var(--forest)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: 'white' }}>Open full record</div>
              ) : (
                <>
                  {canManage && <div onClick={() => openEdit(sel)} style={{ padding: '9px 15px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.1)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: 'var(--success)' }}>Edit record</div>}
                  {canManage && <div onClick={() => del(sel)} style={{ padding: '9px 15px', borderRadius: 999, border: '1px solid rgba(142,46,10,0.25)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: '#8E2E0A' }}>Delete</div>}
                </>
              )}
            </div>
            <div style={{ padding: '0 24px 24px', fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.55 }}>Access tier controls what this person sees. Consultants and subs only see the projects listed above; clients see their own project only.</div>
          </div>
        </div>
      )}

      {/* New person panel */}
      {showNew && (
        <div onClick={closePersonForm} style={{ position: 'fixed', inset: 0, background: 'rgba(var(--rgb-shade), 0.5)', zIndex: 120, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.18s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 640, maxWidth: '100vw', height: '100vh', background: 'var(--surface)', boxShadow: '-18px 0 48px rgba(var(--rgb-shade), 0.22)', display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.2s ease' }}>
            <div style={{ padding: '22px 26px 18px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.07)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: BG, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{editingId != null ? 'Edit person or company' : 'Add to People'}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>One record serves the directory, the address book and access control.</div>
              </div>
              <div onClick={closePersonForm} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.08)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--muted)', fontSize: 15, flexShrink: 0 }}>×</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <div style={{ padding: '20px 26px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                {lbl('Kind', 'sets the default access tier')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {['Staff', 'Client', 'Consultant', 'Sub', 'Authority', 'Vendor'].map((o) => (
                    <div key={o} onClick={() => setNp({ ...np, kind: o as Person['kind'], tier: tierFor[o] })} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: np.kind === o ? 'var(--forest)' : 'var(--surface)', color: np.kind === o ? 'white' : 'var(--muted)', border: '1px solid ' + (np.kind === o ? 'var(--forest)' : 'rgba(var(--rgb-shade), 0.12)') }}>{o}</div>
                  ))}
                </div>
              </div>
              {np.kind === 'Staff' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  {lbl('Internal level', np.internalLevel ? 'set by hand' : 'from their role: ' + levelFromRole(np.role))}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {(['', ...INTERNAL_LEVELS] as string[]).map((o) => (
                      <div key={o || 'auto'} onClick={() => setNp({ ...np, internalLevel: o })} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: np.internalLevel === o ? 'var(--forest)' : 'var(--surface)', color: np.internalLevel === o ? 'white' : 'var(--muted)', border: '1px solid ' + (np.internalLevel === o ? 'var(--forest)' : 'rgba(var(--rgb-shade), 0.12)') }}>{o || 'From role'}</div>
                    ))}
                  </div>
                </div>
              )}
              {np.kind === 'Staff' && editingId == null && (
                // Staff are employees too: one record, added with the full employee form.
                <div style={{ gridColumn: '1 / -1', padding: '14px 16px', borderRadius: 'var(--r-12)', background: 'var(--mist)', border: '1px solid var(--c-b9cdbd)', display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 13, color: 'var(--forest)', lineHeight: 1.55 }}>
                    <b>Staff are employees too.</b> Add them once with the full employee record — they appear here in People and in Manpower, and you can give them a login from the same record.
                  </div>
                  <div onClick={() => { setShowNew(false); navigate('/manpower_con?add=employee'); }} style={{ justifySelf: 'start', padding: '9px 16px', borderRadius: 999, background: 'var(--forest)', color: 'white', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Add as an employee →</div>
                </div>
              )}
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
                    return <div key={o} onClick={() => setNp({ ...np, projects: active ? np.projects.filter((x) => x !== o) : [...np.projects, o] })} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: active ? 'var(--forest)' : 'var(--surface)', color: active ? 'white' : 'var(--muted)', border: '1px solid ' + (active ? 'var(--forest)' : 'rgba(var(--rgb-shade), 0.12)') }}>{o}</div>;
                  })}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                {lbl('Access tier', 'what they can see in the platform')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {['Internal', 'Client', 'Consultant'].map((o) => (
                    <div key={o} onClick={() => setNp({ ...np, tier: o as Person['tier'] })} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: np.tier === o ? 'var(--forest)' : 'var(--surface)', color: np.tier === o ? 'white' : 'var(--muted)', border: '1px solid ' + (np.tier === o ? 'var(--forest)' : 'rgba(var(--rgb-shade), 0.12)') }}>{o}</div>
                  ))}
                </div>
              </div>
              {needsComply && field('Insurance expiry', 'complyDate', 'e.g. Expires Mar 2027')}
              {needsComply && field('Licence / EMR reference', 'complyRef', 'e.g. EMR 0.87 · Licence 1042118')}
            </div>

            {/* The full record: identity, addresses, licences and insurance. */}
            <div style={{ padding: '0 26px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', margin: '4px 0 10px' }}>Full record</div>
              <PersonProfileEditor profile={profile} onChange={setProfile} />
            </div>
            <div style={{ padding: '0 26px 18px' }}>
              <div style={{ padding: '12px 14px', background: 'var(--panel)', borderRadius: 10, fontSize: 11, color: 'var(--body)', lineHeight: 1.55 }}>{np.tier === 'Internal' ? 'Internal tier sees every project, every task and all financials.' : np.tier === 'Client' ? 'Client tier sees only the projects selected above — no internal tasks, costs or margins.' : 'Consultant tier sees only the projects selected above, and only the tasks and files shared with them.'}</div>
            </div>
            </div>
            <div style={{ padding: '16px 26px 22px', borderTop: '1px solid rgba(var(--rgb-shade), 0.07)', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0, background: 'var(--surface)' }}>
              <span style={{ marginRight: 'auto', fontSize: 11, fontWeight: 600, color: !valid ? '#8E2E0A' : missingFields(profile).length ? '#93520F' : 'var(--success)' }}>
                {!valid
                  ? 'A name is required to save'
                  : missingFields(profile).length
                    ? `${missingFields(profile).length} required field(s) outstanding`
                    : 'Record complete'}
              </span>
              <div style={{ minWidth: 0 }}><SaveBar auto={personAuto} blocked={np.kind === 'Staff' && personIdRef.current == null ? 'Staff are added as employees (button above)' : personNameOk ? undefined : 'Add a name to save'} /></div>
              <div onClick={closePersonForm} style={{ padding: '11px 18px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.12)', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--body)' }}>{personAuto.dirty && !personNameOk && editingId == null ? 'Discard' : 'Done'}</div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
