import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { mergeTokens } from '../data/clientPersonality';
import { RichTextEditor } from './RichTextEditor';

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.12)', background: 'white', fontSize: 12.5,
  fontFamily: 'inherit', color: '#0B1A12', outline: 'none',
};
const label: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' };

interface ProposalTemplate { id: string; name: string; subject?: string; body: string; }

/** Base64 of a file's raw bytes (no data: prefix), for the JSON attachment payload. */
const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

/**
 * Compose and send the proposal, and see whether the client has signed it.
 *
 * Signing happens off-app, from the emailed link -- there is nothing to do
 * here once it's sent except wait, since the signature is what moves the
 * deal to a project on its own (see ProposalService.signByToken).
 */
/** "$780,000" from whatever was typed -- the same tidy-up the server does. */
const tidyAmount = (raw: string) => { const n = Number(String(raw).replace(/[^0-9.]/g, '')); return Number.isFinite(n) && n > 0 ? '$' + Math.round(n).toLocaleString('en-US') : raw.trim(); };

export function ProposalPanel({ dealId, dealName, dealEmail, onAmountSaved }: {
  dealId: string; dealName?: string; dealEmail: string;
  /** The saved amount is also the lead's contract amount (card and project) -- tell the board. */
  onAmountSaved?: (value: string) => void;
}) {
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
  const [requiresSecondSignatory, setRequiresSecondSignatory] = useState(false);
  const [signedAt2, setSignedAt2] = useState('');
  const [signedByName2, setSignedByName2] = useState('');
  const [signatureImage2, setSignatureImage2] = useState('');
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [agreementTemplates, setAgreementTemplates] = useState<ProposalTemplate[]>([]);
  const [agreementTemplateId, setAgreementTemplateId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = () => {
    setLoading(true);
    api.proposals.get(dealId)
      .then((res: any) => {
        setSubject(res?.subject || '');
        // A proposal saved before the rich editor existed is plain text with
        // blank-line paragraph breaks -- wrap it as real HTML once on load so
        // it still displays (and sends) with those breaks intact.
        const rawHtml: string = res?.html || '';
        setHtml(rawHtml && !/<[a-z][\s\S]*>/i.test(rawHtml)
          ? rawHtml.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('')
          : rawHtml);
        setAmount(res?.amount || '');
        setSentAt(res?.sentAt || '');
        setSentTo(res?.sentTo || '');
        setSignedAt(res?.signedAt || '');
        setSignedByName(res?.signedByName || '');
        setSignatureImage(res?.signatureImage || '');
        setRequiresSecondSignatory(!!res?.requiresSecondSignatory);
        setSignedAt2(res?.signedAt2 || '');
        setSignedByName2(res?.signedByName2 || '');
        setSignatureImage2(res?.signatureImage2 || '');
        setTo((prev) => prev || res?.sentTo || dealEmail || '');
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  };
  useEffect(load, [dealId]);
  useEffect(() => { setTo(dealEmail || ''); }, [dealEmail]);
  useEffect(() => {
    api.emailTemplates.list()
      .then((res: any) => {
        if (!Array.isArray(res)) return;
        setTemplates(res.filter((t: any) => t.kind === 'proposal'));
        setAgreementTemplates(res.filter((t: any) => t.kind === 'agreement'));
      })
      .catch(() => { });
  }, []);

  const tokens = useMemo(() => ({
    clientName: dealName || 'there',
    projectTitle: dealName || '',
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  }), [dealName]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    setAgreementTemplateId('');
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    if (tpl.subject) setSubject(mergeTokens(tpl.subject, tokens));
    setHtml(mergeTokens(tpl.body, tokens));
  };

  const applyAgreementTemplate = (id: string) => {
    setAgreementTemplateId(id);
    setTemplateId('');
    const tpl = agreementTemplates.find((t) => t.id === id);
    if (!tpl) return;
    if (tpl.subject) setSubject(mergeTokens(tpl.subject, tokens));
    setHtml(mergeTokens(tpl.body, tokens));
  };

  const openPdf = (renderHtml: string) =>
    api.proposals.pdf({ subject, html: renderHtml, amount, dealName })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      });

  const preview = () => {
    setPreviewing(true);
    openPdf(html)
      .catch((e: Error) => toast('⚠ ' + e.message))
      .finally(() => setPreviewing(false));
  };

  /**
   * Nothing is stored as a finished PDF -- there is no separate "signed
   * copy" on disk. This regenerates the document on demand from what's on
   * file (the saved html, plus the signature/date captured at signing),
   * the same way the client's own signing page shows it, so it always
   * reflects the real record rather than a stale export.
   */
  const viewSigned = () => {
    setPreviewing(true);
    openPdf(mergeTokens(html, {
      clientSignature: signatureImage
        ? `<img src="${signatureImage}" alt="Signature of ${signedByName}" style="max-width:220px;height:auto;display:block;margin-bottom:4px;" />`
        : '__________________________________',
      signedDate: signedAt ? new Date(signedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '____________________',
      clientSignature2: signatureImage2
        ? `<img src="${signatureImage2}" alt="Signature of ${signedByName2}" style="max-width:220px;height:auto;display:block;margin-bottom:4px;" />`
        : '__________________________________',
      signedDate2: signedAt2 ? new Date(signedAt2).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '____________________',
    }))
      .catch((e: Error) => toast('⚠ ' + e.message))
      .finally(() => setPreviewing(false));
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const save = () => {
    setSaving(true);
    api.proposals.save(dealId, { subject, html, amount, requiresSecondSignatory })
      .then(() => { toast('Proposal saved'); if (amount.trim() && !signedAt) onAmountSaved?.(tidyAmount(amount)); })
      .catch((e: Error) => toast('⚠ ' + e.message))
      .finally(() => setSaving(false));
  };

  const send = () => {
    if (!to.trim()) { toast('Who should it go to?'); return; }
    setSending(true);
    Promise.all(files.map(async (f) => ({ filename: f.name, mimeType: f.type || 'application/octet-stream', contentBase64: await fileToBase64(f) })))
      .then((extraAttachments) => api.proposals.save(dealId, { subject, html, amount })
        .then(() => { if (amount.trim() && !signedAt) onAmountSaved?.(tidyAmount(amount)); })
        .then(() => api.proposals.send(dealId, to.trim(), undefined, extraAttachments)))
      .then((res: any) => {
        setSentAt(new Date().toISOString()); setSentTo(res?.to || to.trim()); setFiles([]);
        toast(`Sent to ${res?.to || to.trim()}`);
      })
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
        <div style={{ padding: '10px 12px', borderRadius: 9, background: requiresSecondSignatory && !signedAt2 ? '#FBE9AE' : '#D2EAD3', marginBottom: 10 }}>
          <div style={{ color: requiresSecondSignatory && !signedAt2 ? '#8A6D12' : '#1C5230', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            Signed by {signedByName} on {new Date(signedAt).toLocaleString()}
            {requiresSecondSignatory && !signedAt2 && ' — waiting on the second signatory before this moves to Client Review.'}
            {signedAt2 && ` and by ${signedByName2} on ${new Date(signedAt2).toLocaleString()}`}
            {(!requiresSecondSignatory || signedAt2) && ' — moved to Client Review for a final check before converting.'}
          </div>
          {signatureImage && (
            <img src={signatureImage} alt={`Signature of ${signedByName}`} style={{ maxWidth: 220, height: 'auto', border: '1px solid rgba(20,8,31,0.1)', borderRadius: 8, background: 'white', padding: 6, marginBottom: 8, display: 'block' }} />
          )}
          {signatureImage2 && (
            <img src={signatureImage2} alt={`Signature of ${signedByName2}`} style={{ maxWidth: 220, height: 'auto', border: '1px solid rgba(20,8,31,0.1)', borderRadius: 8, background: 'white', padding: 6, marginBottom: 8, display: 'block' }} />
          )}
          <div onClick={previewing ? undefined : viewSigned} style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, color: '#173326', cursor: previewing ? 'default' : 'pointer', textDecoration: 'underline' }}>
            {previewing ? 'Rendering…' : '📄 View the signed document'}
          </div>
        </div>
      ) : sentAt ? (
        <div style={{ padding: '10px 12px', borderRadius: 9, background: '#FBE9AE', color: '#8A6D12', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
          Sent to {sentTo} on {new Date(sentAt).toLocaleString()} — awaiting signature.
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <span style={label}>Agreement</span>
          <select value={agreementTemplateId} onChange={(e) => applyAgreementTemplate(e.target.value)} style={input}>
            <option value="">{agreementTemplates.length ? 'Select an agreement…' : 'No agreement templates yet'}</option>
            {agreementTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {agreementTemplates.length === 0 && (
            <div style={{ fontSize: 10, color: '#9AA39D', marginTop: 3 }}>Create one under Document &amp; Template Library → Agreements.</div>
          )}
          {(agreementTemplateId || requiresSecondSignatory) && !signedAt && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#43514D', marginTop: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={requiresSecondSignatory} onChange={(e) => setRequiresSecondSignatory(e.target.checked)} />
              Requires a second signatory (e.g. husband and wife)
            </label>
          )}
        </div>
        <div>
          <span style={label}>Proposal template</span>
          <select value={templateId} onChange={(e) => applyTemplate(e.target.value)} style={input}>
            <option value="">{templates.length ? 'Start from scratch…' : 'No proposal templates yet'}</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <span style={label}>Subject</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Proposal — [project]" style={input} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <span style={label}>Proposed contract amount</span>
        <div style={{ fontSize: 10.5, color: '#7E9B93', margin: '0 0 5px' }}>Also the lead’s contract amount — shown on its card and carried into its project.</div>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$0" style={input} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <span style={label}>{agreementTemplateId ? 'Agreement body' : 'Proposal body'}</span>
        <RichTextEditor value={html} onChange={setHtml} minHeight={160} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <span style={label}>Send to</span>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.com" style={input} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <span style={label}>Attach documents</span>
        {files.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            {files.map((f, i) => (
              <span key={f.name + i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'white', border: '1px solid rgba(20,8,31,0.1)', borderRadius: 999, padding: '3px 6px 3px 10px', fontSize: 11 }}>
                {f.name}
                <span onClick={() => removeFile(i)} style={{ cursor: 'pointer', color: '#7E9B93', fontSize: 13, lineHeight: 1 }}>×</span>
              </span>
            ))}
          </div>
        )}
        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => addFiles(e.target.files)} />
        <div onClick={() => fileInputRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.14)', color: '#173326', background: 'white' }}>
          + Attach file{files.length ? 's' : ''}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div onClick={previewing ? undefined : preview} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: previewing ? 'default' : 'pointer', border: '1px solid rgba(20,8,31,0.12)', color: '#173326', background: 'white' }}>
          {previewing ? 'Rendering…' : '👁 Preview PDF'}
        </div>
        <div onClick={saving ? undefined : save} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: saving ? 'default' : 'pointer', border: '1px solid rgba(20,8,31,0.12)', color: '#173326', background: 'white' }}>
          {saving ? 'Saving…' : 'Save draft'}
        </div>
        <div onClick={sending ? undefined : send} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: sending ? 'default' : 'pointer', background: '#173326', color: 'white' }}>
          {sending ? 'Sending…' : sentAt ? 'Re-send' : 'Send for signature'}
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#7E9B93', fontStyle: 'italic', marginTop: 6 }}>
        {agreementTemplateId
          ? 'Emails the agreement as a letterhead PDF with a signing link valid for 10 days — no account needed to sign. Signing moves this deal to a project automatically.'
          : 'Emails the proposal with a letterhead PDF and a signing link valid for 10 days — no account needed to sign. Signing moves this deal to a project automatically.'}
      </div>
    </div>
  );
}
