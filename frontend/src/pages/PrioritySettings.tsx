import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { DEFAULT_PRIORITY_DEFS, type PriorityDef } from '../data/priority';
import { loadPriorityDefs, setPriorityDefs } from '../data/priorityDefs';

const box: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.14)',
  background: 'var(--surface)', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', outline: 'none', resize: 'vertical', lineHeight: 1.5,
};

/**
 * Settings -> Task priorities: what Urgent, High, Medium and Low mean, in the
 * office's words. Shown under every priority picker. The due-date windows are
 * fixed (picking a priority fills in the due date from them).
 */
export function PrioritySettings() {
  const { toast } = useApp();
  const [saved, setSaved] = useState<PriorityDef[] | null>(null);
  const [draft, setDraft] = useState<PriorityDef[]>(DEFAULT_PRIORITY_DEFS);
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadPriorityDefs(true).then((l) => { setSaved(l); setDraft(l); }); }, []);
  const dirty = !!saved && draft.some((d, i) => d.meaning !== saved[i]?.meaning);
  const save = async () => {
    setBusy(true);
    try {
      const l = await api.tasks.savePriorities(draft.map((d) => ({ ...d, meaning: d.meaning.trim() })));
      setSaved(l); setDraft(l); setPriorityDefs(l); toast('Priority definitions saved');
    } catch (e: any) { toast('⚠ ' + (e?.message || 'Could not save')); } finally { setBusy(false); }
  };
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ fontSize: 13, color: 'var(--body)', lineHeight: 1.55 }}>
        What each priority means. Everyone sees this under the priority picker on tasks, Special Actions Log items and RFIs. Picking a priority fills in the due date from its window.
      </div>
      {draft.map((d, i) => (
        <label key={d.priority} style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{d.priority} <span style={{ fontWeight: 500, color: 'var(--muted)' }}>· {d.window}</span></span>
          <textarea rows={2} value={d.meaning} maxLength={500} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, meaning: e.target.value } : x)))} style={box} />
        </label>
      ))}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="button" className="btn-primary" disabled={!dirty || busy} onClick={save}
          style={{ padding: '9px 18px', borderRadius: 999, border: 0, background: dirty ? 'var(--ink)' : 'var(--border)', color: dirty ? 'var(--surface)' : 'var(--muted)', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: dirty ? 'pointer' : 'default' }}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => setDraft(draft.map((d, i) => ({ ...d, meaning: DEFAULT_PRIORITY_DEFS[i].meaning })))}
          style={{ border: 0, background: 'transparent', padding: 0, font: 'inherit', fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline' }}>Use the suggested wording</button>
      </div>
    </div>
  );
}
