import { useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { LabelChip } from '../components/LabelPicker';
import { loadTagBank, useTagBank } from '../data/tagBank';

const input: React.CSSProperties = { boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', outline: 'none' };
const link: React.CSSProperties = { border: 0, background: 'transparent', padding: 0, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--forest)', cursor: 'pointer' };

/**
 * Settings -> Tags (Oct 30 sync, admins). Anyone can add a tag on a task and
 * it joins this list; here it's tidied: renamed (a name that already exists
 * merges the two), or deleted from every task. The standard tags stay.
 */
export function TagSettings() {
  const { toast } = useApp();
  const bank = useTagBank();
  const [editing, setEditing] = useState<{ key: string; name: string } | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const custom = bank.filter((t) => !t.standard);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    try { toast(await fn()); await loadTagBank(true); }
    catch (e) { toast('⚠ ' + (e as Error).message); }
    finally { setBusy(false); }
  };
  const rename = (key: string, from: string, to: string) => {
    const merge = custom.find((t) => t.key === to.trim().toLowerCase() && t.key !== key);
    if (merge && !confirm(`“${merge.name}” already exists. Merge “${from}” into it on every task?`)) return;
    void run(async () => { const r = await api.tags.rename(key, to); setEditing(null); return `${merge ? 'Merged' : 'Renamed'} — ${r.changed} task${r.changed === 1 ? '' : 's'} updated`; });
  };
  const remove = (key: string, name: string, uses: number) => {
    if (!confirm(`Delete “${name}”?${uses ? ` It comes off ${uses} task${uses === 1 ? '' : 's'}.` : ''}`)) return;
    void run(async () => { const r = await api.tags.remove(key); return `Deleted — ${r.changed} task${r.changed === 1 ? '' : 's'} updated`; });
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--body)', lineHeight: 1.55 }}>
        <b>Standard tags</b> decide who sees an item: <b>Internal</b> and <b>Financial</b> never reach clients or consultants. New special actions start <b>Internal</b> unless they're made by, or assigned to, a client or consultant; they also get <b>CRM</b>, <b>Design</b> or <b>Construction</b> from where they were made, and anything with a change order is <b>Financial</b>. A personal tag (one that starts with someone's name, like “Astrid private”) keeps the item Internal.
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {bank.filter((t) => t.standard).map((t) => <LabelChip key={t.key} label={t.name} />)}
      </div>

      <div style={{ fontSize: 13, color: 'var(--body)' }}><b>Custom tags</b> — anyone can add one on a task and it joins this list for everyone.</div>
      <form onSubmit={(e) => { e.preventDefault(); const n = draft.trim(); if (n) void run(async () => { await api.tags.add(n); setDraft(''); return `“${n}” added`; }); }} style={{ display: 'flex', gap: 8 }}>
        <input aria-label="New tag" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="New tag" style={{ ...input, width: 240 }} />
        <button type="submit" disabled={busy || !draft.trim()} style={{ ...link, padding: '7px 14px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.14)' }}>Add</button>
      </form>
      <div style={{ border: '1px solid rgba(var(--rgb-shade), 0.08)', borderRadius: 'var(--r-12)', background: 'var(--surface)' }}>
        {custom.length === 0 && <div style={{ padding: 14, fontSize: 12.5, color: 'var(--muted)' }}>No custom tags yet.</div>}
        {custom.map((t, i) => (
          <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderTop: i ? '1px solid rgba(var(--rgb-shade), 0.06)' : 0, flexWrap: 'wrap' }}>
            {editing?.key === t.key ? (
              <form onSubmit={(e) => { e.preventDefault(); if (editing.name.trim() && editing.name.trim() !== t.name) rename(t.key, t.name, editing.name); else setEditing(null); }} style={{ display: 'flex', gap: 8, flex: 1 }}>
                <input autoFocus aria-label={`Rename ${t.name}`} value={editing.name} onChange={(e) => setEditing({ key: t.key, name: e.target.value })} style={{ ...input, flex: 1, maxWidth: 260 }} />
                <button type="submit" disabled={busy} style={link}>Save</button>
                <button type="button" onClick={() => setEditing(null)} style={{ ...link, color: 'var(--muted)' }}>Cancel</button>
              </form>
            ) : (
              <>
                <LabelChip label={t.name} />
                <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>{t.uses ? `${t.uses} task${t.uses === 1 ? '' : 's'}` : 'Not used yet'}</span>
                <button type="button" disabled={busy} onClick={() => setEditing({ key: t.key, name: t.name })} style={link}>Rename / merge</button>
                <button type="button" disabled={busy} onClick={() => remove(t.key, t.name, t.uses)} style={{ ...link, color: '#8E2E0A' }}>Delete</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
