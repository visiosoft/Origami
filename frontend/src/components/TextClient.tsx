import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { mergeTokens } from '../data/clientPersonality';
import { hasUnfilled } from '../data/placeholders';
import { smsSegments, type SmsMessage } from '../data/sms';
import { UnfilledPlaceholders } from './UnfilledPlaceholders';
import { CloseButton } from './CloseButton';

interface Template { id: string; key?: string; name: string; body: string; kind?: string }
export interface TextClientProps {
  entityType: 'lead' | 'person' | 'project';
  entityId: string;
  phone?: string;
  clientName?: string;
  projectTitle?: string;
  label?: string;
}

const field: CSSProperties = {
  boxSizing: 'border-box', width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.14)',
  background: 'var(--surface)', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', outline: 'none',
};
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * "Text client" (Oct 27 backlog item 11): pick an SMS template, it fills in
 * the client's name, the project and your name; edit, send. Every text is
 * kept on the lead, contact or project, sent or failed.
 */
export function TextClient(props: TextClientProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title={props.phone ? `Text ${props.phone}` : 'Add a phone number to text'}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--forest)', cursor: 'pointer' }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        {props.label || 'Text client'}
      </button>
      {open && createPortal(<TextClientDialog {...props} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function TextClientDialog({ entityType, entityId, phone, clientName, projectTitle, onClose }: TextClientProps & { onClose: () => void }) {
  const { toast, currentUser } = useApp();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateKey, setTemplateKey] = useState('');
  const [to, setTo] = useState(phone || '');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState<SmsMessage[]>([]);
  const [ready, setReady] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);

  const tokens = useMemo(() => ({
    clientName: (clientName || '').split(/\s+/)[0] || 'there',
    clientPhone: phone || '',
    projectTitle: projectTitle || '',
    senderName: currentUser?.name || '',
    senderEmail: currentUser?.email || '',
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
  }), [clientName, phone, projectTitle, currentUser?.name, currentUser?.email]);

  useEffect(() => {
    api.emailTemplates.list().then((r) => setTemplates((Array.isArray(r) ? r : []).filter((t: Template) => t.kind === 'sms'))).catch(() => setTemplates([]));
    api.sms.status().then((s) => setReady(!!(s?.configured && s.enabled))).catch(() => setReady(false));
    api.sms.messages(entityType, entityId).then((r) => setSent(Array.isArray(r) ? r : [])).catch(() => setSent([]));
  }, [entityType, entityId]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const pick = (id: string) => {
    const t = templates.find((x) => x.id === id);
    setTemplateKey(t?.key || t?.id || '');
    if (t) setBody(mergeTokens(t.body, tokens));
  };

  const seg = smsSegments(body);
  const blocked = !to.trim() ? 'Add the number to text' : !body.trim() ? 'Write a message' : hasUnfilled(body) ? 'Fill in the highlighted merge fields' : ready === false ? 'Texting isn’t set up yet (Settings → SMS)' : '';
  const send = () => {
    if (blocked || sending) return;
    setSending(true);
    api.sms.send(to.trim(), body.trim(), { entityType, entityId, ...(templateKey ? { templateKey } : {}) })
      .then((r) => {
        toast(`Text sent to ${r?.to || to}`);
        setBody(''); setTemplateKey('');
        return api.sms.messages(entityType, entityId).then((m) => setSent(Array.isArray(m) ? m : []));
      })
      .catch((e: Error) => {
        toast('⚠ ' + (e.message || 'Text not sent'));
        void api.sms.messages(entityType, entityId).then((m) => setSent(Array.isArray(m) ? m : [])).catch(() => undefined);
      })
      .finally(() => setSending(false));
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 320, background: 'rgba(var(--rgb-shade), 0.45)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div role="dialog" aria-label="Text client" onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(480px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box', background: 'var(--surface)', borderRadius: 'var(--r-12)', padding: 20, boxShadow: '0 18px 50px rgba(var(--rgb-ink), 0.25)', display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Text {clientName || 'client'}</div>
            {projectTitle && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{projectTitle}</div>}
          </div>
          <CloseButton onClick={onClose} />
        </div>
        {ready === false && (
          <div role="alert" style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--c-fbf0cc)', border: '1px solid #EAD48A', fontSize: 12, color: '#6B540C' }}>
            Texting isn’t set up yet — an administrator adds the Quo API key in Settings → SMS.
          </div>
        )}
        <label style={{ display: 'grid', gap: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--body)' }}>
          To
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="(808) 555-0100" style={field} aria-label="Phone number" />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--body)' }}>
          Template
          <select value={templates.find((t) => (t.key || t.id) === templateKey)?.id || ''} onChange={(e) => pick(e.target.value)} style={field} aria-label="Template">
            <option value="">{templates.length ? 'Pick a template…' : 'No SMS templates yet (Library → Email, SMS & Documents)'}</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--body)' }}>
          Message
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} aria-label="Message" />
        </label>
        <div style={{ fontSize: 11, color: seg.segments > 1 ? '#93520F' : 'var(--muted)' }}>{seg.length} characters · {seg.segments} text{seg.segments === 1 ? '' : 's'}{seg.unicode ? ' · contains special characters' : ''}</div>
        <UnfilledPlaceholders texts={[body]} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
          {blocked && <span style={{ fontSize: 11.5, color: 'var(--muted)', marginRight: 'auto' }}>{blocked}</span>}
          <button type="button" onClick={send} disabled={!!blocked || sending}
            style={{ padding: '9px 18px', borderRadius: 999, border: 0, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#fff', cursor: blocked || sending ? 'default' : 'pointer', background: blocked || sending ? 'var(--c-c9d4cc)' : 'var(--forest)' }}>
            {sending ? 'Sending…' : 'Send text'}
          </button>
        </div>
        {sent.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(var(--rgb-shade), 0.08)', paddingTop: 10, display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>Texts sent</div>
            {sent.map((m) => (
              <div key={m.id} style={{ padding: '8px 10px', borderRadius: 9, background: m.status === 'failed' ? '#F7E4DB' : 'var(--panel)', fontSize: 12.5, color: 'var(--ink)' }}>
                <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</div>
                <div style={{ fontSize: 11, color: m.status === 'failed' ? '#8E2E0A' : 'var(--muted)', marginTop: 3 }}>
                  {m.status === 'failed' ? `Not sent — ${m.error || 'failed'}` : `Sent to ${m.to}`} · {when(m.at)}{m.byName ? ` · ${m.byName}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
