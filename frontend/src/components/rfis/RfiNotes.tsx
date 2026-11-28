import { useRef, useState } from 'react';
import { api, attachmentUrl } from '../../api';
import type { Attachment } from '../../data/projectTasks';

export interface RfiNote { id: string; at: string; by: string; text: string; attachmentIds?: string[] }

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const isImage = (a?: Attachment) => !!a && (/^image\//.test(a.mimeType || '') || /\.(jpe?g|png|gif|webp|heic)$/i.test(a.name || ''));

/**
 * Nov 27 (Weekly Sync, Edward): notes and updates on an RFI, in line with
 * their photos, files and sketches -- like a task's activity -- instead of
 * one long description. Anyone who can see the RFI adds to it.
 */
export function RfiNotes({ rfiId, notes, attachments, onSaved, toast }: {
  rfiId: string; notes: RfiNote[]; attachments: Attachment[];
  onSaved: (r: any) => void; toast: (m: string) => void;
}) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const byId = new Map(attachments.map((a) => [a.id, a]));

  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      const before = new Set(attachments.map((a) => a.id));
      const list: Attachment[] = await api.rfis.upload(rfiId, files);
      setPending((p) => [...p, ...list.filter((a) => !before.has(a.id) && !p.some((x) => x.id === a.id))]);
      onSaved({ attachments: list });
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Could not attach')); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const save = async () => {
    if (!text.trim() && !pending.length) return;
    setBusy(true);
    try {
      const r = await api.rfis.addNote(rfiId, text.trim(), pending.map((a) => a.id));
      setText(''); setPending([]); onSaved(r); toast('Note added');
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Could not add the note')); }
    finally { setBusy(false); }
  };
  const thumb = (a: Attachment) => isImage(a)
    ? <a key={a.id} href={attachmentUrl('rfis', rfiId, a.id)} target="_blank" rel="noopener noreferrer" title={a.name}><img src={attachmentUrl('rfis', rfiId, a.id, true)} alt={a.name} style={{ width: 92, height: 70, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), .12)' }} /></a>
    : <a key={a.id} href={attachmentUrl('rfis', rfiId, a.id)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: 'var(--forest)', overflowWrap: 'anywhere' }}>📎 {a.name}</a>;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {notes.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>No notes yet. Add updates here as the RFI moves — with photos or sketches — instead of a long description.</div>}
      {notes.map((n) => (
        <div key={n.id} style={{ display: 'grid', gap: 6, padding: '9px 12px', borderRadius: 10, background: 'var(--panel)' }}>
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}><b style={{ color: 'var(--ink)' }}>{n.by}</b> · {when(n.at)}</div>
          {n.text && <div style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.5 }}>{n.text}</div>}
          {(n.attachmentIds || []).length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(n.attachmentIds || []).map((id) => byId.get(id)).filter(Boolean).map((a) => thumb(a!))}</div>}
        </div>
      ))}
      <div style={{ display: 'grid', gap: 6 }}>
        <textarea aria-label="Add a note or update" value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Add a note or update…"
          style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), .15)', font: 'inherit', fontSize: 13, resize: 'vertical', background: 'var(--surface)', color: 'var(--ink)' }} />
        {pending.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{pending.map(thumb)}</div>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" hidden onChange={(e) => void addFiles(Array.from(e.target.files || []))} />
          <button type="button" className="ak-btn" disabled={busy} onClick={() => fileRef.current?.click()} style={{ height: 34 }}>＋ Photo / file</button>
          <span style={{ flex: 1 }} />
          <button type="button" className="ak-btn is-dark" disabled={busy || (!text.trim() && !pending.length)} onClick={() => void save()} style={{ height: 34 }}>{busy ? 'Saving…' : 'Add note'}</button>
        </div>
      </div>
    </div>
  );
}
