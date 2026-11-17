import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

export type HelpDoc = { id: string; title: string; kind: string; url: string; summary?: string | null; order: number; updatedAt?: string | null };
const KINDS: [string, string][] = [['sop', 'Standard operating procedure'], ['sla', 'Service level agreement'], ['disaster', 'Disaster recovery'], ['policy', 'Policy'], ['other', 'Other']];
const kindLabel = (k: string) => KINDS.find(([v]) => v === k)?.[1] || 'Other';

/**
 * Nov 17 sync: the company's SOPs, service levels and disaster-recovery
 * documents in one place for the team. Administrators add each as a link
 * (usually to Google Drive).
 */
export function HelpPolicies() {
  const { authUser, toast } = useApp();
  const admin = authUser?.roleKey === 'admin' && !authUser?.viewedBy;
  const staff = authUser?.tier === 'internal' || admin;
  const [docs, setDocs] = useState<HelpDoc[] | null>(null);
  const [edit, setEdit] = useState<Partial<HelpDoc> | null>(null);
  const load = () => { api.helpDocuments.list().then(setDocs).catch(() => setDocs([])); };
  useEffect(() => { if (staff) load(); }, [staff]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!staff) return null;
  const save = async () => {
    if (!edit) return;
    try {
      if (edit.id) await api.helpDocuments.update(edit.id, edit); else await api.helpDocuments.create(edit);
      setEdit(null); load(); toast('Saved');
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not saved')); }
  };
  const remove = async (d: HelpDoc) => {
    if (!window.confirm(`Take “${d.title}” off the list? The document itself isn’t touched.`)) return;
    try { await api.helpDocuments.remove(d.id); load(); } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not removed')); }
  };
  const box = { width: '100%', boxSizing: 'border-box' as const, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), .14)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)' };
  const btn = (dark?: boolean) => ({ padding: '7px 14px', borderRadius: 999, border: dark ? 0 : '1px solid rgba(var(--rgb-shade), .14)', background: dark ? 'var(--ink)' : 'var(--surface)', color: dark ? '#fff' : 'var(--body)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' });
  return (
    <section className="help-policies" aria-label="Policies and procedures" style={{ background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), .06)', borderRadius: 'var(--r-14)', padding: 18, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>Policies &amp; procedures</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>SOPs, service levels and disaster recovery — for our team.</div>
        </div>
        {admin && !edit && <button type="button" style={btn()} onClick={() => setEdit({ kind: 'sop', title: '', url: '', summary: '', order: (docs || []).length })}>+ Document</button>}
      </div>
      {edit && (
        <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 10, background: 'var(--panel)' }}>
          <input aria-label="Title" placeholder="Title, e.g. Disaster recovery plan" value={edit.title || ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} style={box} />
          <select aria-label="Kind" value={edit.kind || 'sop'} onChange={(e) => setEdit({ ...edit, kind: e.target.value })} style={box}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <input aria-label="Link" placeholder="Link to the document (https://drive.google.com/…)" value={edit.url || ''} onChange={(e) => setEdit({ ...edit, url: e.target.value })} style={box} />
          <textarea aria-label="Summary" rows={2} placeholder="What it covers (optional)" value={edit.summary || ''} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} style={{ ...box, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button type="button" style={btn()} onClick={() => setEdit(null)}>Cancel</button><button type="button" style={btn(true)} onClick={save}>Save</button></div>
        </div>
      )}
      {docs === null ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Loading…</div>
        : !docs.length ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>No documents yet.{admin ? ' Add the SOPs, SLA and disaster-recovery plan with “+ Document”.' : ''}</div>
          : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
              {docs.map((d) => (
                <li key={d.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(var(--rgb-shade), .06)' }}>
                  <span aria-hidden style={{ fontSize: 18 }}>{d.kind === 'disaster' ? '🛟' : d.kind === 'sla' ? '🤝' : d.kind === 'policy' ? '📜' : '📘'}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--forest)', textDecoration: 'none' }}>{d.title} ↗</a>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>{kindLabel(d.kind)}{d.summary ? ` · ${d.summary}` : ''}</span>
                  </span>
                  {admin && <span style={{ display: 'flex', gap: 4 }}><button type="button" style={btn()} onClick={() => setEdit(d)}>Edit</button><button type="button" style={btn()} onClick={() => remove(d)} aria-label={`Remove ${d.title}`}>✕</button></span>}
                </li>
              ))}
            </ul>
          )}
    </section>
  );
}
