import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.12)', background: 'white', fontSize: 12.5,
  fontFamily: 'inherit', color: '#0B1A12', outline: 'none',
};
const label: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' };

/**
 * Compose and send the proposal, and see whether the client has signed it.
 *
 * Signing happens off-app, from the emailed link -- there is nothing to do
 * here once it's sent except wait, since the signature is what moves the
 * deal to a project on its own (see ProposalService.signByToken).
 */
export function ProposalPanel({ dealId, dealEmail }: { dealId: string; dealEmail: string }) {
  const { toast } = useApp();
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [amount, setAmount] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [signedAt, setSignedAt] = useState('');
  const [signedByName, setSignedByName] = useState('');
  const [signatureImage, setSignatureImage] = useState('');

  const load = () => {
    setLoading(true);
    api.proposals.get(dealId)
      .then((res: any) => {
        setSubject(res?.subject || '');
        setHtml(res?.html || '');
        setAmount(res?.amount || '');
        setSentAt(res?.sentAt || '');
        setSentTo(res?.sentTo || '');
        setSignedAt(res?.signedAt || '');
        setSignedByName(res?.signedByName || '');
        setSignatureImage(res?.signatureImage || '');
        setTo((prev) => prev || res?.sentTo || dealEmail || '');
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  };
  useEffect(load, [dealId]);
  useEffect(() => { setTo(dealEmail || ''); }, [dealEmail]);

  const save = () => {
    setSaving(true);
    api.proposals.save(dealId, { subject, html, amount })
      .then(() => toast('Proposal saved'))
      .catch((e: Error) => toast('⚠ ' + e.message))
      .finally(() => setSaving(false));
  };

  const send = () => {
    if (!to.trim()) { toast('Who should it go to?'); return; }
    setSending(true);
    api.proposals.save(dealId, { subject, html, amount })
      .then(() => api.proposals.send(dealId, to.trim()))
      .then((res: any) => { setSentAt(new Date().toISOString()); setSentTo(res?.to || to.trim()); toast(`Sent to ${res?.to || to.trim()}`); })
      .catch((e: Error) => toast('⚠ ' + e.message))
      .finally(() => setSending(false));
  };

  if (loading) return <div style={{ padding: '14px 20px', fontSize: 12, color: '#9AA39D' }}>Loading…</div>;

  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(20,8,31,0.06)', background: '#EEF3EE' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#173326" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#173326' }}>Proposal</span>
      </div>

      {signedAt ? (
        <div style={{ padding: '10px 12px', borderRadius: 9, background: '#D2EAD3', marginBottom: 10 }}>
          <div style={{ color: '#1C5230', fontSize: 12, fontWeight: 700, marginBottom: signatureImage ? 8 : 0 }}>
            Signed by {signedByName} on {new Date(signedAt).toLocaleString()} — converted to a project.
          </div>
          {signatureImage && (
            <img src={signatureImage} alt={`Signature of ${signedByName}`} style={{ maxWidth: 220, height: 'auto', border: '1px solid rgba(20,8,31,0.1)', borderRadius: 8, background: 'white', padding: 6 }} />
          )}
        </div>
      ) : sentAt ? (
        <div style={{ padding: '10px 12px', borderRadius: 9, background: '#FBE9AE', color: '#8A6D12', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
          Sent to {sentTo} on {new Date(sentAt).toLocaleString()} — awaiting signature.
        </div>
      ) : null}

      <div style={{ marginBottom: 8 }}>
        <span style={label}>Subject</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Proposal — [project]" style={input} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <span style={label}>Proposed contract amount</span>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$0" style={input} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <span style={label}>Proposal body</span>
        <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={5} placeholder="Scope, terms, and anything else the client should see before signing." style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <span style={label}>Send to</span>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.com" style={input} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div onClick={saving ? undefined : save} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: saving ? 'default' : 'pointer', border: '1px solid rgba(20,8,31,0.12)', color: '#173326', background: 'white' }}>
          {saving ? 'Saving…' : 'Save draft'}
        </div>
        <div onClick={sending ? undefined : send} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: sending ? 'default' : 'pointer', background: '#173326', color: 'white' }}>
          {sending ? 'Sending…' : sentAt ? 'Re-send' : 'Send for signature'}
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#7E9B93', fontStyle: 'italic', marginTop: 6 }}>
        Emails the proposal with a letterhead PDF and a signing link valid for 10 days — no account needed to sign. Signing moves this deal to a project automatically.
      </div>
    </div>
  );
}
