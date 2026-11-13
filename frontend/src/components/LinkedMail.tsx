import { useEffect, useState } from 'react';
import { api, type LinkedMailRow } from '../api';

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');

/**
 * Email linked to a lead, project or task (Nov 13 sync): conversations
 * someone linked from their Gmail (or that linked themselves by a #tag),
 * readable by everyone who can see this record. Hidden when there are none.
 */
export function LinkedMail({ entityType, entityId }: { entityType: 'lead' | 'project' | 'task'; entityId: string | number }) {
  const [rows, setRows] = useState<LinkedMailRow[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { api.mail.linked(entityType, String(entityId)).then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([])); }, [entityType, entityId]);
  if (!rows.length) return null;
  return (
    <section aria-label="Linked email" style={{ display: 'grid', gap: 6, marginTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Email ({rows.length})</div>
      {rows.map((r) => (
        <div key={r.id} style={{ border: '1px solid rgba(var(--rgb-shade), 0.08)', borderRadius: 12, padding: '8px 10px', display: 'grid', gap: 4 }}>
          <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} style={{ textAlign: 'left', border: 0, background: 'none', font: 'inherit', cursor: 'pointer', padding: 0, display: 'flex', gap: 8 }}>
            <b style={{ flex: 1, fontSize: 13, color: 'var(--ink)' }}>{r.subject || '(no subject)'}</b>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{r.messages.length} message{r.messages.length === 1 ? '' : 's'} · {when(r.lastAt)} · from {r.ownerName}’s mail{r.auto ? ' (by tag)' : ''}</span>
          </button>
          {open === r.id && r.messages.map((m, i) => (
            <div key={i} style={{ borderTop: '1px solid rgba(var(--rgb-shade), 0.06)', paddingTop: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--body)' }}><b>{m.from}</b> <span style={{ color: 'var(--muted)' }}>· {when(m.date)}</span></div>
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.text}</div>
              {m.attachments.length > 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>📎 {m.attachments.join(', ')}</div>}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
