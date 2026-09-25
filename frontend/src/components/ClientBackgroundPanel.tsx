import { useEffect, useState } from 'react';
import { ClampText } from './ClampText';
import { api } from '../api';
import { useApp } from '../AppContext';
import { SaveBar, useAutosave } from '../autosave';

export interface ClientBackground {
  facts?: Record<string, string>;
  notes?: { id: string; text: string; at: string; by?: string }[];
}

/** The few things worth knowing about a client before the next conversation. */
const FACTS: { key: string; label: string; ph: string }[] = [
  { key: 'business', label: 'Work / business', ph: 'e.g. Owns three Cold Stone Creamery stores in Dubai' },
  { key: 'from', label: 'Where they’re from', ph: 'e.g. Grew up in Punjab — same home province as Ehsan' },
  { key: 'family', label: 'Family & household', ph: 'e.g. Two kids, 8 and 11; mother-in-law moving in (why the ADU)' },
  { key: 'interests', label: 'Interests', ph: 'e.g. Cooking, cricket, loves mid-century modern' },
  { key: 'dates', label: 'Dates to remember', ph: 'e.g. Wants to move in before Diwali; anniversary in May' },
  { key: 'history', label: 'Past building / contractor experience', ph: 'e.g. Bad experience with their last GC on a kitchen — values updates' },
  { key: 'rapport', label: 'How to build rapport', ph: 'e.g. Likes a quick text over email; ask about the restaurants' },
];

const BLANK: ClientBackground = { facts: {}, notes: [] };

/**
 * Client background: who the client is, kept apart from the project notes so
 * anyone picking up the relationship later can build rapport. The facts save
 * as you type; notes are dated and listed newest first. What's written here
 * stays as written -- an AI summary can sit on top later, never replace it.
 */
export function ClientBackgroundPanel({ leadId, clientName, value, version, onSaved }: {
  leadId: string;
  clientName: string;
  value?: ClientBackground | null;
  /** The lead's last-saved stamp, for the "someone else changed it" check. */
  version: () => string | undefined;
  onSaved: (bg: ClientBackground, updatedAt?: string) => void;
}) {
  const { currentUser, can, toast } = useApp();
  const canEdit = can('pipeline', 'manage');
  const loaded: ClientBackground = { facts: { ...(value?.facts || {}) }, notes: [...(value?.notes || [])] };
  const [draft, setDraft] = useState<ClientBackground>(loaded);
  const [saved, setSaved] = useState<ClientBackground>(loaded);
  const [noteText, setNoteText] = useState('');
  useEffect(() => { setDraft(loaded); setSaved(loaded); setNoteText(''); }, [leadId]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = async (bg: ClientBackground) => {
    const res: any = await api.leads.update(leadId, { clientBackground: bg, expectedUpdatedAt: version() });
    onSaved(bg, res?.updatedAt);
    return bg;
  };
  const auto = useAutosave<ClientBackground>({
    draft, saved, resetKey: 'client-bg-' + leadId, enabled: canEdit, label: 'client background',
    save: async (_c, { draft: d }) => { const bg = await persist(d); setSaved(bg); return bg; },
  });

  const setFact = (key: string, v: string) => setDraft((d) => ({ ...d, facts: { ...(d.facts || {}), [key]: v } }));
  const addNote = () => {
    const text = noteText.trim();
    if (!text) return;
    setDraft((d) => ({ ...d, notes: [{ id: 'bg' + Date.now().toString(36), text, at: new Date().toISOString(), by: currentUser?.name }, ...(d.notes || [])] }));
    setNoteText('');
    // A note is a deliberate entry: save it now rather than after the pause.
    window.setTimeout(() => { void auto.saveNow().then((ok) => ok && toast('Note saved')); }, 0);
  };
  const removeNote = (id: string) => setDraft((d) => ({ ...d, notes: (d.notes || []).filter((n) => n.id !== id) }));
  const notes = [...(draft.notes || [])].sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.12)', background: '#FBF8F2', fontSize: 12.5, fontFamily: 'inherit', color: '#0B1A12', outline: 'none', resize: 'vertical' };

  return (
    <div style={{ padding: '16px 20px 24px', display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', fontSize: 11.5, color: '#5C6B65', lineHeight: 1.55 }}>
          Who <b style={{ color: '#0B1A12' }}>{clientName}</b> is, beyond this project — what anyone taking over the relationship should know. Kept separate from the project notes.
        </div>
        {canEdit && <SaveBar auto={auto} />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
        {FACTS.map((f) => (
          <label key={f.key} style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{f.label}</span>
            <textarea disabled={!canEdit} value={draft.facts?.[f.key] || ''} onChange={(e) => setFact(f.key, e.target.value)} placeholder={f.ph} rows={2} style={input} />
          </label>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Background notes · newest first</div>
        {canEdit && (
          <div style={{ display: 'grid', gap: 6 }}>
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') addNote(); }}
              placeholder="Something you learned about them — a story they told, what matters to them…" rows={3} style={{ ...input, background: 'white' }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div onClick={addNote} style={{ padding: '7px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: noteText.trim() ? 'pointer' : 'not-allowed', background: noteText.trim() ? '#173326' : '#D6DED8', color: noteText.trim() ? 'white' : '#9AA39D' }}>Add note</div>
              <span style={{ fontSize: 10.5, color: '#9AA39D' }}>Ctrl + Enter to add</span>
            </div>
          </div>
        )}
        {!notes.length && <div style={{ fontSize: 12, color: '#9AA39D', fontStyle: 'italic' }}>No background notes yet.</div>}
        {notes.map((n) => (
          <div key={n.id} style={{ background: '#FBF8F2', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 10.5, color: '#7E9B93' }}>{new Date(n.at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}{n.by ? ` · ${n.by}` : ''}</span>
              {canEdit && <span onClick={() => removeNote(n.id)} style={{ marginLeft: 'auto', fontSize: 11, color: '#8E2E0A', cursor: 'pointer', fontWeight: 600 }}>Delete</span>}
            </div>
            <ClampText text={n.text} lines={2} style={{ fontSize: 12.5, color: '#43514D', lineHeight: 1.55 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export const EMPTY_BACKGROUND = BLANK;
