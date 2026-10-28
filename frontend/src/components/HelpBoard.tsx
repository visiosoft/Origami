import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { RELEASES, releaseSeen } from '../data/releaseNotes';
import { WhatsNew } from './WhatsNew';
import { openGlobalSearch } from './GlobalSearch';
import {
  TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES,
  type Ticket, type Faq, type TicketPriority, type TicketStatus,
} from '../data/support';
import './HelpBoard.css';

const GUIDES = [
  { title: 'Finance guide', body: 'Subcontracts, billing clients, payments, and what every number means', route: '/help/finance' },
  { title: 'Projects & workflows', body: 'Create and track projects and their checklists', route: '/projects' },
  { title: 'Task boards', body: 'Sections, subtasks, files and comments', route: '/tasks' },
  { title: 'CRM & leads', body: 'Move leads through the pipeline and book visits', route: '/pipeline' },
  { title: 'Users, roles & access', body: 'Accounts and what each role can do', route: '/users' },
];
const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || '');
const SHORTCUTS: [string, string[]][] = [
  ['Search anything', [isMac ? '⌘' : 'Ctrl', 'K']],
  ['Move through results', ['↑', '↓']],
  ['Open the result', ['Enter']],
  ['Close search', ['Esc']],
];

const Icon = ({ d }: { d: string }) => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const I_TICKET = 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z';
const I_BOOK = 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5';
const I_SPARK = 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6';
const I_SEARCH = 'M21 21l-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z';

/**
 * Help & Support in the New look: the office's own FAQs first (filter by
 * category, search, expand), and beside them the ways to get help -- a
 * ticket to the team, the guides, what's new -- plus keyboard shortcuts and,
 * for whoever manages Help, the ticket queue.
 */
export function HelpBoard() {
  const navigate = useNavigate();
  const { can, toast, currentUser } = useApp();
  const canManage = can('help', 'manage');
  const [view, setView] = useState<'home' | 'new' | 'ticket'>('home');
  const unseen = !releaseSeen();

  // ---- FAQs ----
  const [faqs, setFaqs] = useState<Faq[] | null>(null);
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Faq | null>(null);
  const loadFaqs = () => api.faqs.list().then((r) => setFaqs(Array.isArray(r) ? (r as Faq[]) : [])).catch(() => setFaqs([]));
  useEffect(() => { loadFaqs(); }, []);
  const cats = useMemo(() => ['All', ...Array.from(new Set((faqs || []).map((f) => f.category || 'General')))], [faqs]);
  const needle = q.trim().toLowerCase();
  const shownFaqs = (faqs || [])
    .filter((f) => (cat === 'All' || (f.category || 'General') === cat) && (!needle || `${f.question} ${f.answer}`.toLowerCase().includes(needle)))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const saveFaq = () => {
    if (!editing || editing.question.trim().length < 3) { toast('Add a question'); return; }
    (editing.id ? api.faqs.update(editing.id, editing) : api.faqs.create(editing))
      .then(() => { toast('FAQ saved'); setEditing(null); loadFaqs(); }).catch(() => toast('⚠ Failed to save'));
  };
  const delFaq = (f: Faq) => { if (!confirm('Delete this question?')) return; setFaqs((p) => (p || []).filter((x) => x.id !== f.id)); api.faqs.remove(f.id).catch(() => toast('⚠ Failed to delete')); };

  // ---- tickets ----
  const blank = { subject: '', category: 'General', priority: 'Medium' as TicketPriority, message: '', requesterName: currentUser?.name || '', requesterEmail: currentUser?.email || '' };
  const [form, setForm] = useState(blank);
  const [sending, setSending] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const loadTickets = () => { if (canManage) api.tickets.list().then((r) => { if (Array.isArray(r)) setTickets(r as Ticket[]); }).catch(() => { }); };
  useEffect(() => { loadTickets(); }, [canManage]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = () => {
    if (form.subject.trim().length < 3 || form.message.trim().length < 5) { toast('Add a subject and a short description'); return; }
    setSending(true);
    api.tickets.create(form).then(() => { toast('Ticket sent — the team will follow up'); setForm(blank); setView('home'); loadTickets(); })
      .catch(() => toast('⚠ Failed to send')).finally(() => setSending(false));
  };
  const setStatus = (t: Ticket, status: TicketStatus) => {
    setTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, status } : x)));
    api.tickets.update(t.id, { status }).catch(() => { toast('⚠ Failed to update'); loadTickets(); });
  };
  const openTickets = tickets.filter((t) => t.status !== 'Resolved');

  const back = <button type="button" className="hb-back" onClick={() => setView('home')}>← Back to Help</button>;
  const row = (icon: string, title: string, sub: string, action: string, onClick: () => void, badge?: ReactNode) => (
    <div className="hb-contact">
      <span className="hb-tile"><Icon d={icon} /></span>
      <span className="hb-contact-text"><b>{title}{badge}</b><small>{sub}</small></span>
      <button type="button" className="hb-btn" onClick={onClick}>{action}</button>
    </div>
  );

  return (
    <div className="hb">
      <div className="hb-top">
        <p>Answers first. The team when you need them.</p>
        <button type="button" className="hb-cta" onClick={() => setView('ticket')}>
          <Icon d={I_TICKET} />Submit a ticket
        </button>
      </div>

      {view === 'new' && <section className="hb-card hb-wide">{back}<WhatsNew /></section>}

      {view === 'ticket' && (
        <section className="hb-card hb-form">
          {back}
          <h2>Submit a ticket</h2>
          <span className="hb-sub">Tell us what's wrong or what you need — the team replies by email.</span>
          <div className="hb-form-grid">
            <label className="is-wide">Subject<input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="A few words" autoFocus /></label>
            <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{TICKET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Priority<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })}>{TICKET_PRIORITIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Your name<input value={form.requesterName} onChange={(e) => setForm({ ...form, requesterName: e.target.value })} /></label>
            <label>Your email<input value={form.requesterEmail} onChange={(e) => setForm({ ...form, requesterEmail: e.target.value })} /></label>
            <label className="is-wide">How can we help?<textarea rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="What happened, where, and what you expected" /></label>
          </div>
          <div className="hb-form-foot">
            <button type="button" className="hb-btn" onClick={() => setView('home')}>Cancel</button>
            <button type="button" className="hb-btn is-dark" disabled={sending} onClick={submit}>{sending ? 'Sending…' : 'Send ticket'}</button>
          </div>
        </section>
      )}

      {view === 'home' && (
        <div className="hb-grid">
          <section className="hb-card hb-faq">
            <div className="hb-faq-head">
              <div>
                <h2>Common questions</h2>
                <span className="hb-sub">{faqs === null ? 'Loading…' : `${shownFaqs.length} ${shownFaqs.length === 1 ? 'answer' : 'answers'}`}</span>
              </div>
              <div className="hb-cats">
                {cats.map((c) => <button type="button" key={c} className={cat === c ? 'is-on' : ''} onClick={() => setCat(c)}>{c}</button>)}
              </div>
            </div>
            <div className="hb-faq-tools">
              <input className="hb-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the answers…" />
              {canManage && <button type="button" className="hb-btn" onClick={() => setEditing({ id: '', question: '', answer: '', category: cat === 'All' ? 'General' : cat, order: (faqs || []).length })}>+ Question</button>}
            </div>
            <div className="hb-faqs">
              {faqs && !shownFaqs.length && (
                <div className="hb-empty">
                  {faqs.length ? 'No answer matches.' : 'No questions yet.'}{' '}
                  <button type="button" className="hb-link" onClick={() => setView('ticket')}>Ask the team</button>
                </div>
              )}
              {shownFaqs.map((f, i) => {
                const open = openId === f.id;
                return (
                  <div key={f.id} className={'hb-q' + (open ? ' is-open' : '')} style={{ animationDelay: Math.min(i, 12) * 0.03 + 's' }}>
                    <button type="button" className="hb-q-row" aria-expanded={open} onClick={() => setOpenId(open ? null : f.id)}>
                      <span className="hb-q-text">{f.question}</span>
                      <span className="hb-tag"><i />{f.category || 'General'}</span>
                      <span className="hb-chev" aria-hidden>
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                      </span>
                    </button>
                    {open && (
                      <div className="hb-a">
                        {f.answer}
                        {canManage && (
                          <div className="hb-a-tools">
                            <button type="button" className="hb-link" onClick={() => setEditing(f)}>Edit</button>
                            <button type="button" className="hb-link is-danger" onClick={() => delFaq(f)}>Delete</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="hb-side">
            <section className="hb-card">
              <h2>Get help</h2>
              <span className="hb-sub">Your Origami team reads every ticket</span>
              <div className="hb-contacts">
                {row(I_TICKET, 'Submit a ticket', 'Bugs, questions or requests — replied to by email', 'Write', () => setView('ticket'))}
                {row(I_BOOK, 'Finance guide', 'Step by step, on a real project', 'Open', () => navigate('/help/finance'))}
                {row(I_SPARK, 'What’s new', RELEASES[0] ? `Latest: ${RELEASES[0].title}` : 'Release notes', 'See', () => setView('new'), unseen ? <em className="hb-new">New</em> : null)}
                {row(I_SEARCH, 'Search Origami', 'Projects, people, leads and tasks', 'Search', () => openGlobalSearch())}
              </div>
            </section>

            {canManage && (
              <section className="hb-card">
                <div className="hb-card-head"><h2>Tickets</h2><span className="hb-count">{openTickets.length} open</span></div>
                <div className="hb-tickets">
                  {!tickets.length && <div className="hb-empty">No tickets yet.</div>}
                  {tickets.slice(0, 8).map((t) => (
                    <div key={t.id} className="hb-ticket">
                      <div className="hb-ticket-main">
                        <b>{t.subject}</b>
                        <small>{[t.requesterName, t.category, t.priority, t.createdAt?.slice(0, 10)].filter(Boolean).join(' · ')}</small>
                        <p>{t.message}</p>
                      </div>
                      <select className={'hb-status is-' + t.status.replace(/\s+/g, '-').toLowerCase()} value={t.status} onChange={(e) => setStatus(t, e.target.value as TicketStatus)} aria-label={`Status of ${t.subject}`}>
                        {TICKET_STATUSES.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="hb-card">
              <h2>Guides</h2>
              <span className="hb-sub">Where things live</span>
              <div className="hb-guides">
                {GUIDES.map((g) => (
                  <button type="button" key={g.title} className="hb-guide" onClick={() => navigate(g.route)}>
                    <span><b>{g.title}</b><small>{g.body}</small></span>
                    <span className="hb-arrow" aria-hidden>↗</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="hb-card">
              <h2>Keyboard shortcuts</h2>
              <div className="hb-keys">
                {SHORTCUTS.map(([l, keys]) => (
                  <div key={l} className="hb-key-row"><span>{l}</span><span>{keys.map((k) => <kbd key={k}>{k}</kbd>)}</span></div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {editing && (
        <div className="hb-modal-bg" onClick={() => setEditing(null)}>
          <div className="hb-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={editing.id ? 'Edit question' : 'New question'}>
            <h3>{editing.id ? 'Edit question' : 'New question'}</h3>
            <label>Question<input value={editing.question} onChange={(e) => setEditing({ ...editing, question: e.target.value })} autoFocus /></label>
            <label>Category<input value={editing.category || ''} onChange={(e) => setEditing({ ...editing, category: e.target.value })} list="hb-cats" /></label>
            <datalist id="hb-cats">{cats.filter((c) => c !== 'All').map((c) => <option key={c} value={c} />)}</datalist>
            <label>Answer<textarea rows={6} value={editing.answer} onChange={(e) => setEditing({ ...editing, answer: e.target.value })} /></label>
            <div className="hb-form-foot">
              <button type="button" className="hb-btn" onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className="hb-btn is-dark" onClick={saveFaq}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
