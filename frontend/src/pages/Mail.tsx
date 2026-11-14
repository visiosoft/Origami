import { useEffect, useMemo, useRef, useState } from 'react';
import { fillPlaceholders, unfilled } from '../data/placeholders';
import { api, type MailThreadRow, type MailThread, type MailTemplate } from '../api';
import { useApp } from '../AppContext';
import { sanitizeHtml } from '../data/contracts';

const field = { padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.15)', font: 'inherit', fontSize: 13, background: 'var(--surface)' } as const;
const btn = (primary = false) => ({ padding: '7px 14px', borderRadius: 999, border: 0, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: primary ? 'var(--forest)' : 'var(--mist)', color: primary ? '#fff' : 'var(--forest)' }) as const;
const nameOf = (from: string) => (from.match(/^\s*"?([^"<]+?)"?\s*</)?.[1] || from).trim();
const when = (iso: string) => { const d = new Date(iso); return isNaN(+d) ? '' : d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString(); };
const LINK_LABEL = { lead: 'Lead', project: 'Project', task: 'Task' } as const;

/**
 * My mail (Nov 13 sync): your own Gmail in the app -- inbox and search,
 * threads, reply or write with attachments, and link a thread to a lead,
 * project or task (also done on its own for #P-45 / #L-… / #<task number>
 * tags, and mail from a lead) so the team sees it on the record.
 */
export function Mail() {
  const { toast, authUser } = useApp();
  const [st, setSt] = useState<{ connected: boolean; email: string } | null>(null);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [list, setList] = useState<{ threads: MailThreadRow[]; nextPageToken: string | null } | null>(null);
  const [pages, setPages] = useState<string[]>(['']);
  const [open, setOpen] = useState<MailThread | null>(null);
  const [compose, setCompose] = useState<ComposeState | null>(null);
  // Folders and drafts (Batch 6).
  const [folder, setFolder] = useState<'INBOX' | 'SENT' | 'DRAFT'>('INBOX');
  const [drafts, setDrafts] = useState<Awaited<ReturnType<typeof api.mail.drafts>> | null>(null);
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [managing, setManaging] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const composeRef = useRef<ComposeState | null>(null);
  composeRef.current = compose;
  const lastSaved = useRef('');
  const [linkTo, setLinkTo] = useState(false);
  const [busy, setBusy] = useState(false);
  const params = new URLSearchParams(window.location.search);

  useEffect(() => {
    api.google.myMail.status().then(setSt).catch(() => setSt({ connected: false, email: '' }));
    if (params.get('error')) toast('⚠ ' + params.get('error'));
    if (params.get('connected')) toast(`Gmail connected — ${params.get('connected')}`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const page = pages[pages.length - 1];
  const loadDrafts = () => { setDrafts(null); api.mail.drafts().then(setDrafts).catch((e: Error) => { toast('⚠ ' + e.message); setDrafts([]); }); };
  useEffect(() => {
    if (!st?.connected) return;
    if (folder === 'DRAFT') { loadDrafts(); return; }
    setList(null);
    api.mail.threads(search, page, folder).then(setList).catch((e: Error) => { toast('⚠ ' + e.message); setList({ threads: [], nextPageToken: null }); });
  }, [st?.connected, search, page, folder]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (st?.connected) api.mail.templates().then(setTemplates).catch(() => setTemplates([])); }, [st?.connected]);

  // A draft saves itself into Gmail 5 seconds after typing stops (Batch 6).
  const keyOf = (c: ComposeState) => JSON.stringify({ to: c.to, cc: c.cc, subject: c.subject, body: c.body, files: c.files.map((f) => `${f.name}:${f.size}`) });
  const saveDraftNow = async () => {
    const c = composeRef.current;
    if (!c || !(c.to.trim() || c.subject.trim() || c.body.trim())) return;
    const key = keyOf(c);
    if (key === lastSaved.current && c.draftId) return;
    try {
      const r = await api.mail.saveDraft({ id: c.draftId, to: c.to, cc: c.cc, subject: c.subject, html: toHtml(c.body), threadId: c.threadId, inReplyTo: c.inReplyTo }, c.files);
      lastSaved.current = key;
      setSavedAt(new Date());
      if (!c.draftId) setCompose((cur) => (cur ? { ...cur, draftId: r.id } : cur));
    } catch (e) { toast('⚠ Draft not saved: ' + (e as Error).message); }
  };
  useEffect(() => {
    if (!compose || keyOf(compose) === lastSaved.current) return;
    const t = setTimeout(() => { void saveDraftNow(); }, 5000);
    return () => clearTimeout(t);
  }, [compose]); // eslint-disable-line react-hooks/exhaustive-deps
  const startCompose = (c: ComposeState) => { lastSaved.current = c.draftId ? keyOf(c) : ''; setSavedAt(null); setCompose(c); };
  const openDraft = async (id: string) => {
    setOpen(null);
    try {
      const d = await api.mail.draft(id);
      // Its attachments come back as files, so they stay on the draft when it's saved again.
      const files = await Promise.all(d.attachments.map(async (a) => new File([await api.mail.attachment(d.messageId, a.id, a.filename)], a.filename, { type: a.mimeType })));
      startCompose({ to: d.to, cc: d.cc, subject: d.subject, body: toText(d.html), threadId: d.threadId || undefined, inReplyTo: d.inReplyTo || undefined, files, draftId: d.id });
    } catch (e) { toast('⚠ ' + (e as Error).message); }
  };
  const closeCompose = async (keep: boolean) => {
    const c = composeRef.current;
    if (keep) { await saveDraftNow(); toast('Saved in Drafts'); }
    else if (c?.draftId && confirm('Delete this draft?')) await api.mail.discardDraft(c.draftId).catch(() => undefined);
    else if (c?.draftId) return;
    setCompose(null);
    if (folder === 'DRAFT') loadDrafts();
  };

  const openThread = async (id: string) => {
    setOpen(null); setCompose(null); setLinkTo(false);
    try { setOpen(await api.mail.thread(id)); } catch (e) { toast('⚠ ' + (e as Error).message); }
  };
  const reply = () => {
    if (!open) return;
    const last = open.messages[open.messages.length - 1];
    startCompose({ to: last.from, cc: '', subject: /^re:/i.test(open.subject) ? open.subject : `Re: ${open.subject}`, body: '', threadId: open.id, inReplyTo: last.messageId, files: [], project: open.links.find((l) => l.entityType === 'project')?.label || undefined });
  };
  const send = async () => {
    if (!compose) return;
    const left = unfilled(compose.subject, compose.body);
    if (left.length && !confirm(`Still to fill in: ${left.map((p) => p.raw).join(', ')}. Send anyway?`)) return;
    setBusy(true);
    try {
      const d = { to: compose.to, cc: compose.cc, subject: compose.subject, html: toHtml(compose.body), threadId: compose.threadId, inReplyTo: compose.inReplyTo };
      if (compose.draftId) await api.mail.sendDraft(compose.draftId, d, compose.files);
      else await api.mail.send(d, compose.files);
      toast('Sent'); setCompose(null);
      if (folder === 'DRAFT') loadDrafts();
      if (open) await openThread(open.id);
    } catch (e) { toast('⚠ ' + (e as Error).message); } finally { setBusy(false); }
  };

  if (!st) return <div style={{ color: 'var(--muted)' }}>Loading…</div>;
  if (!st.connected) {
    return (
      <div style={{ maxWidth: 560, background: 'var(--surface)', borderRadius: 16, padding: 22, display: 'grid', gap: 12 }}>
        <b style={{ fontSize: 17, color: 'var(--ink)' }}>Connect your Gmail</b>
        <div style={{ fontSize: 13.5, color: 'var(--body)', lineHeight: 1.6 }}>Read and answer your own mail here, and link a conversation to a lead, project or task so the team sees it there. Put <b>#P-45</b> (a project), <b>#L-…</b> (a lead) or a task number like <b>#NARV-T-2026-0001</b> in an email and it links itself; mail from a lead links to that lead.</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Only you see your mailbox. A linked conversation is copied to the record for people who can see that record.</div>
        <a href={api.google.myMail.connectUrl()} style={{ ...btn(true), justifySelf: 'start', textDecoration: 'none', padding: '10px 18px' }}>Connect Gmail</a>
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <form onSubmit={(e) => { e.preventDefault(); setPages(['']); setSearch(q.trim()); }} style={{ display: 'flex', gap: 6, flex: '1 1 260px' }}>
          <input aria-label="Search mail" placeholder="Search mail (Gmail search works: from:, has:attachment…)" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...field, flex: 1 }} />
          <button type="submit" style={btn()}>Search</button>
        </form>
        <button type="button" style={btn(true)} onClick={() => { setOpen(null); startCompose({ to: '', cc: '', subject: '', body: '', files: [] }); }}>New email</button>
        <button type="button" style={btn()} onClick={() => setManaging((v) => !v)}>Templates</button>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{st.email} · <button type="button" onClick={() => { if (confirm('Disconnect your Gmail?')) void api.google.myMail.disconnect().then(() => setSt({ connected: false, email: '' })); }} style={{ border: 0, background: 'none', color: 'var(--muted)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit', padding: 0 }}>disconnect</button></span>
      </div>
      {managing && <TemplateManager templates={templates} onChanged={() => void api.mail.templates().then(setTemplates)} />}
      <div style={{ display: 'flex', gap: 6 }}>
        {([['INBOX', 'Inbox'], ['SENT', 'Sent'], ['DRAFT', 'Drafts']] as const).map(([k, l]) => <button key={k} type="button" style={btn(folder === k)} onClick={() => { setFolder(k); setPages(['']); setOpen(null); }}>{l}</button>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 0.9fr) minmax(0, 1.4fr)', gap: 12, alignItems: 'start' }} className="mail-grid">
        <div aria-label="Inbox" style={{ background: 'var(--surface)', borderRadius: 16, padding: 6, display: 'grid', gap: 2 }}>
          {folder === 'DRAFT' ? (drafts === null ? <div style={{ padding: 12, color: 'var(--muted)' }}>Loading…</div> : !drafts.length ? <div style={{ padding: 12, color: 'var(--muted)' }}>No drafts.</div> : drafts.map((d) => (
            <button key={d.id} type="button" onClick={() => void openDraft(d.id)} style={{ display: 'grid', gap: 2, textAlign: 'left', padding: '9px 10px', borderRadius: 12, border: 0, background: compose?.draftId === d.id ? 'var(--mist)' : 'transparent', font: 'inherit', cursor: 'pointer' }}>
              <span style={{ display: 'flex', gap: 8 }}><b style={{ flex: 1, fontSize: 13, color: '#8E2E0A' }}>Draft{d.to ? ` to ${nameOf(d.to)}` : ''}</b><span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{when(d.date)}</span></span>
              <span style={{ fontSize: 12.5, color: 'var(--body)' }}>{d.subject}</span>
              <span style={{ fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.snippet}</span>
            </button>
          ))) : list === null ? <div style={{ padding: 12, color: 'var(--muted)' }}>Loading…</div> : !list.threads.length ? <div style={{ padding: 12, color: 'var(--muted)' }}>Nothing here.</div> : list.threads.map((t) => (
            <button key={t.id} type="button" onClick={() => void openThread(t.id)} style={{ display: 'grid', gap: 2, textAlign: 'left', padding: '9px 10px', borderRadius: 12, border: 0, background: open?.id === t.id ? 'var(--mist)' : 'transparent', font: 'inherit', cursor: 'pointer' }}>
              <span style={{ display: 'flex', gap: 8 }}><b style={{ flex: 1, fontSize: 13, color: 'var(--ink)', fontWeight: t.unread ? 800 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(t.from)}{t.count > 1 ? ` (${t.count})` : ''}</b><span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{when(t.date)}</span></span>
              <span style={{ fontSize: 12.5, color: 'var(--body)', fontWeight: t.unread ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</span>
              <span style={{ fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.links.length ? `🔗 ${t.links.map((l) => l.label || LINK_LABEL[l.entityType]).join(', ')} · ` : ''}{t.snippet}</span>
            </button>
          ))}
          <div style={{ display: 'flex', gap: 8, padding: 6 }}>
            {pages.length > 1 && <button type="button" style={btn()} onClick={() => setPages(pages.slice(0, -1))}>Newer</button>}
            {list?.nextPageToken && <button type="button" style={btn()} onClick={() => setPages([...pages, list.nextPageToken!])}>Older</button>}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {compose && <Compose c={compose} setC={setCompose} busy={busy} onSend={() => void send()} templates={templates} myName={authUser?.name || st.email} savedAt={savedAt} onClose={(keep) => void closeCompose(keep)} />}
          {open && (
            <div aria-label="Thread" style={{ background: 'var(--surface)', borderRadius: 16, padding: 16, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ flex: 1, fontSize: 16, color: 'var(--ink)' }}>{open.subject}</b>
                <button type="button" style={btn()} onClick={reply}>Reply</button>
                <button type="button" style={btn()} onClick={() => setLinkTo((v) => !v)}>Link to…</button>
              </div>
              {open.links.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{open.links.map((l) => (
                <span key={l.id} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: 'var(--mist)', color: 'var(--forest)', display: 'inline-flex', gap: 6 }}>
                  {LINK_LABEL[l.entityType]}: {l.label}{l.auto ? ' (by tag)' : ''}
                  <button type="button" aria-label={`Unlink ${l.label}`} onClick={() => void api.mail.unlink(l.id).then(() => openThread(open.id)).catch((e: Error) => toast('⚠ ' + e.message))} style={{ border: 0, background: 'none', cursor: 'pointer', color: '#8E2E0A', padding: 0 }}>×</button>
                </span>
              ))}</div>}
              {linkTo && <LinkPicker onPick={(type, id) => void api.mail.link(open.id, type, id).then(() => { setLinkTo(false); toast('Linked'); return openThread(open.id); }).catch((e: Error) => toast('⚠ ' + e.message))} />}
              {open.messages.map((m) => (
                <div key={m.id} style={{ borderTop: '1px solid rgba(var(--rgb-shade), 0.08)', paddingTop: 10, display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--body)' }}><b>{nameOf(m.from)}</b> <span style={{ color: 'var(--muted)' }}>to {m.to} · {when(m.date)}</span></div>
                  {m.html ? <div style={{ fontSize: 13.5, lineHeight: 1.55, overflowX: 'auto', maxWidth: '100%' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.html) }} /> : <div style={{ fontSize: 13.5, whiteSpace: 'pre-wrap' }}>{m.text}</div>}
                  {m.attachments.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{m.attachments.map((a) => (
                    <button key={a.id} type="button" style={btn()} onClick={() => void api.mail.attachment(m.id, a.id, a.filename).then((blob) => { const u = URL.createObjectURL(blob); const el = document.createElement('a'); el.href = u; el.download = a.filename; el.click(); setTimeout(() => URL.revokeObjectURL(u), 5000); })}>📎 {a.filename}</button>
                  ))}</div>}
                </div>
              ))}
            </div>
          )}
          {!open && !compose && <div style={{ color: 'var(--muted)', fontSize: 13, padding: 12 }}>Pick a conversation, or write a new email.</div>}
        </div>
      </div>
    </div>
  );
}

type ComposeState = { to: string; cc: string; subject: string; body: string; threadId?: string; inReplyTo?: string; files: File[]; draftId?: string; toName?: string; project?: string };
const toHtml = (body: string) => body.split('\n').map((l) => `<p>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;') || '&nbsp;'}</p>`).join('');
const toText = (html: string) => String(html || '').replace(/<\/(p|div)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim();

function Compose({ c, setC, busy, onSend, templates, myName, savedAt, onClose }: { c: ComposeState; setC: (c: any) => void; busy: boolean; onSend: () => void; templates: MailTemplate[]; myName: string; savedAt: Date | null; onClose: (keep: boolean) => void }) {
  const [hits, setHits] = useState<{ name: string; email: string; kind: string }[]>([]);
  /** A template, filled from who it's to (Batch 6): {{clientFirstName}}, {{clientName}}, {{projectTitle}}, {{senderName}}. */
  const applyTemplate = (t: MailTemplate) => {
    const name = c.toName || (c.to.match(/^\s*"?([^"<,]+?)"?\s*</)?.[1] || '').trim();
    const values = { clientName: name, clientFirstName: name.split(/\s+/)[0] || '', projectTitle: c.project || '', senderName: myName };
    setC({ ...c, subject: c.subject || fillPlaceholders(t.subject || '', values), body: fillPlaceholders(toText(t.html), values) + (c.body ? `\n\n${c.body}` : '') });
  };
  const last = c.to.split(/[,;]/).pop()?.trim() || '';
  useEffect(() => { if (last.length < 2 || /@.+\./.test(last)) { setHits([]); return; } const t = setTimeout(() => { api.mail.contacts(last).then(setHits).catch(() => setHits([])); }, 250); return () => clearTimeout(t); }, [last]);
  return (
    <div aria-label="Compose" style={{ background: 'var(--surface)', borderRadius: 16, padding: 16, display: 'grid', gap: 8 }}>
      <input aria-label="To" placeholder="To" value={c.to} onChange={(e) => setC({ ...c, to: e.target.value })} style={field} />
      {hits.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{hits.map((h) => <button key={h.email} type="button" style={btn()} onClick={() => setC({ ...c, toName: c.toName || h.name, to: [...c.to.split(/[,;]/).slice(0, -1).map((x) => x.trim()).filter(Boolean), `${h.name} <${h.email}>`].join(', ') + ', ' })}>{h.name} · {h.email}</button>)}</div>}
      <input aria-label="Cc" placeholder="Cc" value={c.cc} onChange={(e) => setC({ ...c, cc: e.target.value })} style={field} />
      <div style={{ display: 'flex', gap: 6 }}>
        <input aria-label="Subject" placeholder="Subject" value={c.subject} onChange={(e) => setC({ ...c, subject: e.target.value })} style={{ ...field, flex: 1 }} />
        {templates.length > 0 && <select aria-label="Use a template" value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) applyTemplate(t); }} style={field}><option value="">Template…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.shared ? '' : ' (mine)'}</option>)}</select>}
      </div>
      <textarea aria-label="Message" rows={8} value={c.body} onChange={(e) => setC({ ...c, body: e.target.value })} style={{ ...field, fontSize: 14 }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ ...btn(), cursor: 'pointer' }}>📎 Attach<input type="file" multiple hidden onChange={(e) => setC({ ...c, files: [...c.files, ...Array.from(e.target.files || [])] })} /></label>
        {c.files.map((f, i) => <span key={i} style={{ fontSize: 12 }}>{f.name} <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setC({ ...c, files: c.files.filter((_, j) => j !== i) })} style={{ border: 0, background: 'none', color: '#8E2E0A', cursor: 'pointer' }}>×</button></span>)}
        <span style={{ flex: 1 }} />
        {savedAt && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Draft saved {savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
        <button type="button" style={btn()} onClick={() => onClose(true)}>Save draft</button>
        <button type="button" style={btn()} onClick={() => onClose(false)}>Discard</button>
        <button type="button" disabled={busy || !c.to.trim()} style={btn(true)} onClick={onSend}>{busy ? 'Sending…' : 'Send'}</button>
      </div>
    </div>
  );
}

/** Pick a lead, project or task to link a conversation to. */
function LinkPicker({ onPick }: { onPick: (type: 'lead' | 'project' | 'task', id: string) => void }) {
  const [type, setType] = useState<'project' | 'lead' | 'task'>('project');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    const load = type === 'project' ? (api.projects.list() as Promise<any[]>).then((r) => r.map((p) => ({ id: String(p.id), label: p.name })))
      : type === 'lead' ? (api.pipeline.list() as Promise<any[]>).then((r) => r.map((d) => ({ id: String(d.id), label: d.name || d.leadName || d.id })))
      : (api.projectTasks.list() as Promise<any[]>).then((r) => r.map((t) => ({ id: String(t.id), label: `${t.serial ? t.serial + ' · ' : ''}${t.title}` })));
    load.then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
  }, [type]);
  const shown = useMemo(() => rows.filter((r) => !q || r.label.toLowerCase().includes(q.toLowerCase())).slice(0, 40), [rows, q]);
  return (
    <div aria-label="Link to" style={{ display: 'grid', gap: 6, padding: 10, borderRadius: 12, background: 'var(--mist)' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['project', 'lead', 'task'] as const).map((t) => <button key={t} type="button" style={btn(type === t)} onClick={() => setType(t)}>{LINK_LABEL[t]}</button>)}
        <input aria-label="Find a record" placeholder="Find…" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...field, flex: 1 }} />
      </div>
      <div style={{ maxHeight: 200, overflow: 'auto', display: 'grid', gap: 2 }}>{shown.map((r) => <button key={r.id} type="button" onClick={() => onPick(type, r.id)} style={{ textAlign: 'left', border: 0, background: 'var(--surface)', borderRadius: 8, padding: '6px 10px', font: 'inherit', fontSize: 13, cursor: 'pointer' }}>{r.label}</button>)}</div>
    </div>
  );
}

/** Email templates (Batch 6): your own, and shared ones that administrators make. */
function TemplateManager({ templates, onChanged }: { templates: MailTemplate[]; onChanged: () => void }) {
  const { toast, authUser } = useApp();
  const admin = authUser?.roleKey === 'admin';
  const [edit, setEdit] = useState<{ id: string | null; name: string; subject: string; body: string; shared: boolean } | null>(null);
  const save = async () => {
    if (!edit) return;
    try { await api.mail.saveTemplate(edit.id, { name: edit.name, subject: edit.subject, html: toHtml(edit.body), shared: edit.shared }); toast('Template saved'); setEdit(null); onChanged(); }
    catch (e) { toast('⚠ ' + (e as Error).message); }
  };
  return (
    <div aria-label="Email templates" style={{ background: 'var(--surface)', borderRadius: 16, padding: 14, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <b style={{ flex: 1, color: 'var(--ink)' }}>Email templates</b>
        <button type="button" style={btn(true)} onClick={() => setEdit({ id: null, name: '', subject: '', body: '', shared: false })}>+ New template</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fields fill in when you use one: {'{{clientFirstName}}'}, {'{{clientName}}'}, {'{{projectTitle}}'}, {'{{senderName}}'}.</div>
      {templates.map((t) => (
        <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <span style={{ flex: 1 }}><b>{t.name}</b> <span style={{ color: 'var(--muted)', fontSize: 12 }}>{t.shared ? 'shared' : 'mine'}{t.subject ? ` · ${t.subject}` : ''}</span></span>
          {(t.mine || (t.shared && admin)) && <>
            <button type="button" style={btn()} onClick={() => setEdit({ id: t.id, name: t.name, subject: t.subject || '', body: toText(t.html), shared: t.shared })}>Edit</button>
            <button type="button" style={{ ...btn(), color: '#8E2E0A' }} onClick={() => { if (confirm(`Delete “${t.name}”?`)) void api.mail.removeTemplate(t.id).then(onChanged).catch((e: Error) => toast('⚠ ' + e.message)); }}>Delete</button>
          </>}
        </div>
      ))}
      {edit && (
        <div style={{ display: 'grid', gap: 6, padding: 10, borderRadius: 12, background: 'var(--mist)' }}>
          <input aria-label="Template name" placeholder="Name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} style={field} />
          <input aria-label="Template subject" placeholder="Subject" value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} style={field} />
          <textarea aria-label="Template text" rows={6} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} style={{ ...field, fontSize: 14 }} />
          {admin && !edit.id && <label style={{ fontSize: 12.5, display: 'flex', gap: 6 }}><input type="checkbox" checked={edit.shared} onChange={(e) => setEdit({ ...edit, shared: e.target.checked })} /> Shared with everyone</label>}
          <div style={{ display: 'flex', gap: 6 }}><button type="button" style={btn(true)} onClick={() => void save()}>Save</button><button type="button" style={btn()} onClick={() => setEdit(null)}>Cancel</button></div>
        </div>
      )}
    </div>
  );
}
