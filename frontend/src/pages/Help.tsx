import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import {
  TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, TICKET_STATUS_STYLE,
  type Ticket, type Faq, type TicketPriority, type TicketStatus,
} from '../data/support';

const BG = "'Bricolage Grotesque', serif";
const inputStyle: React.CSSProperties = { boxSizing: 'border-box', width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid rgba(20,8,31,0.12)', background: '#FBF8F2', fontSize: 13, fontFamily: 'inherit', color: '#0B1A12', outline: 'none' };

const HELP_TOPICS = [
  { title: 'Projects & Workflows', body: 'Create and track projects, then attach reusable workflows with their own item checklists.', route: 'projects' },
  { title: 'Task Boards', body: 'Per-project Asana-style boards: custom sections, subtasks, attachments and comments.', route: 'tasks' },
  { title: 'CRM & Leads', body: 'Move leads through the pipeline, score fit, and schedule Google Meets / site visits.', route: 'pipeline' },
  { title: 'Users, Roles & Access', body: 'Manage accounts and per-module permissions across Internal, Client and Consultant tiers.', route: 'users' },
];

export function Help() {
  const navigate = useNavigate();
  const { can, toast, currentUser } = useApp();
  const canManage = can('help', 'manage');
  const [tab, setTab] = useState<'center' | 'ticket' | 'faq'>('center');

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 22, color: '#0B1A12', marginBottom: 4 }}>Help &amp; Support</div>
      <div style={{ fontSize: 13, color: '#5C6B65', marginBottom: 18 }}>Find answers, browse FAQs, or raise a support ticket.</div>

      <div style={{ display: 'flex', gap: 3, background: '#EFEDE8', padding: 3, borderRadius: 999, marginBottom: 20, width: 'fit-content', flexWrap: 'wrap' }}>
        {([['center', 'Help Center'], ['ticket', 'Submit Ticket'], ['faq', 'FAQs']] as [typeof tab, string][]).map((t) => (
          <div key={t[0]} onClick={() => setTab(t[0])} style={{ padding: '8px 18px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: tab === t[0] ? 'white' : 'transparent', color: tab === t[0] ? '#0B1A12' : '#7E9B93', boxShadow: tab === t[0] ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{t[1]}</div>
        ))}
      </div>

      {tab === 'center' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 16 }}>
            {HELP_TOPICS.map((h) => (
              <div key={h.title} onClick={() => navigate('/' + h.route)} style={{ background: 'white', border: '1px solid rgba(20,8,31,0.06)', borderRadius: 14, padding: 18, cursor: 'pointer' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0B1A12', marginBottom: 6 }}>{h.title}</div>
                <div style={{ fontSize: 12.5, color: '#5C6B65', lineHeight: 1.5 }}>{h.body}</div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#173326', marginTop: 10 }}>Open →</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#EEF3EE', border: '1px dashed rgba(23,51,38,0.2)', borderRadius: 12, padding: '14px 16px', fontSize: 12.5, color: '#173326', lineHeight: 1.55 }}>
            Can't find what you need? <strong onClick={() => setTab('ticket')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Submit a ticket</strong> and the team will follow up. Browse <strong onClick={() => setTab('faq')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>FAQs</strong> for quick answers.
          </div>
        </div>
      )}

      {tab === 'ticket' && <SubmitTicket canManage={canManage} currentUserName={currentUser?.name} currentUserEmail={currentUser?.email} toast={toast} />}
      {tab === 'faq' && <Faqs canManage={canManage} toast={toast} />}
    </div>
  );
}

function SubmitTicket({ canManage, currentUserName, currentUserEmail, toast }: { canManage: boolean; currentUserName?: string; currentUserEmail?: string; toast: (m: string) => void }) {
  const blank = { subject: '', category: 'General', priority: 'Medium' as TicketPriority, message: '', requesterName: currentUserName || '', requesterEmail: currentUserEmail || '' };
  const [form, setForm] = useState(blank);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [sending, setSending] = useState(false);

  const reload = () => { if (canManage) api.tickets.list().then((r) => { if (Array.isArray(r)) setTickets(r as Ticket[]); }).catch(() => { }); };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [canManage]);

  const submit = () => {
    if (form.subject.trim().length < 3 || form.message.trim().length < 5) { toast('Add a subject and a short description'); return; }
    setSending(true);
    api.tickets.create(form).then(() => { toast('Ticket submitted'); setForm(blank); reload(); }).catch(() => toast('⚠ Failed to submit')).finally(() => setSending(false));
  };
  const setStatus = (t: Ticket, status: TicketStatus) => {
    setTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, status } : x)));
    api.tickets.update(t.id, { status }).catch(() => { });
  };

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 420px', maxWidth: 560, background: 'white', border: '1px solid rgba(20,8,31,0.06)', borderRadius: 14, padding: 20 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Submit a ticket</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}><L>Subject</L><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} style={inputStyle} /></div>
          <div><L>Category</L><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle}>{TICKET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><L>Priority</L><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })} style={inputStyle}>{TICKET_PRIORITIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><L>Your name</L><input value={form.requesterName} onChange={(e) => setForm({ ...form, requesterName: e.target.value })} style={inputStyle} /></div>
          <div><L>Your email</L><input value={form.requesterEmail} onChange={(e) => setForm({ ...form, requesterEmail: e.target.value })} style={inputStyle} /></div>
          <div style={{ gridColumn: '1 / -1' }}><L>How can we help?</L><textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={5} style={{ ...inputStyle, resize: 'vertical' }} /></div>
        </div>
        <div onClick={sending ? undefined : submit} style={{ marginTop: 16, display: 'inline-block', padding: '11px 22px', borderRadius: 999, background: sending ? '#9AB0A4' : '#173326', color: 'white', fontSize: 13, fontWeight: 700, cursor: sending ? 'default' : 'pointer' }}>{sending ? 'Submitting…' : 'Submit ticket'}</div>
      </div>

      {canManage && (
        <div style={{ flex: '1 1 320px', minWidth: 280 }}>
          <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Tickets ({tickets.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tickets.map((t) => {
              const s = TICKET_STATUS_STYLE[t.status] || TICKET_STATUS_STYLE.Open;
              return (
                <div key={t.id} style={{ background: 'white', border: '1px solid rgba(20,8,31,0.06)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0B1A12', flex: 1 }}>{t.subject}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: s.bg, color: s.c }}>{t.status}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#7E9B93', marginBottom: 6 }}>{t.category} · {t.priority} · {t.requesterName || '—'} · {t.createdAt}</div>
                  <div style={{ fontSize: 12, color: '#43514D', lineHeight: 1.5, marginBottom: 8 }}>{t.message}</div>
                  <select value={t.status} onChange={(e) => setStatus(t, e.target.value as TicketStatus)} style={{ ...inputStyle, width: 'auto', padding: '5px 8px', fontSize: 11.5 }}>{TICKET_STATUSES.map((o) => <option key={o}>{o}</option>)}</select>
                </div>
              );
            })}
            {tickets.length === 0 && <div style={{ fontSize: 12.5, color: '#9AA39D', fontStyle: 'italic' }}>No tickets yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Faqs({ canManage, toast }: { canManage: boolean; toast: (m: string) => void }) {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Faq | null>(null);

  const reload = () => { api.faqs.list().then((r) => { if (Array.isArray(r)) setFaqs(r as Faq[]); }).catch(() => { }); };
  useEffect(() => { reload(); }, []);

  const addFaq = () => setEditing({ id: '', question: '', answer: '', category: 'General', order: faqs.length });
  const saveFaq = () => {
    if (!editing || editing.question.trim().length < 3) { toast('Add a question'); return; }
    const op = editing.id ? api.faqs.update(editing.id, editing) : api.faqs.create(editing);
    op.then(() => { toast('FAQ saved'); setEditing(null); reload(); }).catch(() => toast('⚠ Failed to save'));
  };
  const delFaq = (f: Faq) => { if (!confirm('Delete this FAQ?')) return; setFaqs((p) => p.filter((x) => x.id !== f.id)); api.faqs.remove(f.id).catch(() => { }); };

  return (
    <div style={{ maxWidth: 760 }}>
      {canManage && <div onClick={addFaq} style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 999, background: '#D2EAD3', color: '#173326', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}>+ Add FAQ</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {faqs.map((f) => (
          <div key={f.id} style={{ background: 'white', border: '1px solid rgba(20,8,31,0.06)', borderRadius: 12, overflow: 'hidden' }}>
            <div onClick={() => setOpenId(openId === f.id ? null : f.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer' }}>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: '#0B1A12' }}>{f.question}</span>
              {f.category && <span style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', background: '#EDE3D0', padding: '2px 8px', borderRadius: 999 }}>{f.category}</span>}
              <span style={{ fontSize: 14, color: '#7E9B93', transform: openId === f.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>⌄</span>
            </div>
            {openId === f.id && (
              <div style={{ padding: '0 16px 14px', fontSize: 13, color: '#43514D', lineHeight: 1.6 }}>
                {f.answer}
                {canManage && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    <span onClick={() => setEditing(f)} style={{ fontSize: 12, fontWeight: 700, color: '#173326', cursor: 'pointer' }}>Edit</span>
                    <span onClick={() => delFaq(f)} style={{ fontSize: 12, fontWeight: 700, color: '#8E2E0A', cursor: 'pointer' }}>Delete</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {faqs.length === 0 && <div style={{ fontSize: 12.5, color: '#9AA39D', fontStyle: 'italic' }}>No FAQs yet.</div>}
      </div>

      {editing && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.5)', zIndex: 140, display: 'grid', placeItems: 'center', animation: 'fadeIn 0.15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '94vw', background: 'white', borderRadius: 16, boxShadow: '0 24px 60px rgba(20,8,31,0.24)', padding: 22 }}>
            <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 17, marginBottom: 14 }}>{editing.id ? 'Edit FAQ' : 'New FAQ'}</div>
            <L>Question</L><input value={editing.question} onChange={(e) => setEditing({ ...editing, question: e.target.value })} style={{ ...inputStyle, marginBottom: 12 }} />
            <L>Category</L><input value={editing.category || ''} onChange={(e) => setEditing({ ...editing, category: e.target.value })} style={{ ...inputStyle, marginBottom: 12 }} />
            <L>Answer</L><textarea value={editing.answer} onChange={(e) => setEditing({ ...editing, answer: e.target.value })} rows={5} style={{ ...inputStyle, resize: 'vertical', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 9 }}>
              <div onClick={saveFaq} style={{ padding: '10px 20px', borderRadius: 999, background: '#173326', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Save</div>
              <div onClick={() => setEditing(null)} style={{ padding: '10px 18px', borderRadius: 999, border: '1px solid rgba(20,8,31,0.12)', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#43514D' }}>Cancel</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function L({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{children}</div>;
}
