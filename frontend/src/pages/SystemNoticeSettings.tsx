import { useEffect, useState } from 'react';
import { api } from '../api';
import { SaveBar, useAutosave } from '../autosave';

const BG = "'Bricolage Grotesque', serif";
const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.14)', background: 'white', fontFamily: 'inherit',
  fontSize: 13, color: '#0B1A12', outline: 'none', resize: 'vertical',
};
type Notice = { text: string; on: boolean };

/**
 * A banner every signed-in page shows while it's on -- e.g. before updating
 * the system, so nobody is mid-edit when the server restarts. It goes to
 * everyone, so it only changes when Save is pressed (no autosave here).
 */
export function SystemNoticeSettings() {
  const [saved, setSaved] = useState<Notice | null>(null);
  const [draft, setDraft] = useState<Notice>({ text: '', on: false });
  useEffect(() => {
    api.settings.get().then((s) => {
      const n = { text: s['app.notice'] || '', on: s['app.noticeActive'] === 'true' };
      setSaved(n); setDraft(n);
    }).catch(() => undefined);
  }, []);
  const auto = useAutosave<Notice>({
    draft, saved, enabled: false, label: 'notice',
    save: async (_c, { draft: d }) => {
      await api.settings.save({ 'app.notice': d.text.trim(), 'app.noticeActive': d.on ? 'true' : 'false' });
      setSaved(d);
      return d;
    },
  });
  const quick = ['Updates in progress — please save your work. Back in a few minutes.', 'Scheduled update today at 3:00 pm. Save your work before then.'];

  return (
    <div style={{ background: 'white', border: '1px solid rgba(20,8,31,0.08)', borderRadius: 14, padding: '20px 22px', display: 'grid', gap: 14, maxWidth: 720 }}>
      <div>
        <div style={{ fontFamily: BG, fontSize: 17, fontWeight: 700 }}>System notice</div>
        <div style={{ fontSize: 12.5, color: '#5C6B65', marginTop: 4, lineHeight: 1.55 }}>
          A banner across the top of every page for everyone signed in. Turn it on before updating the system, so nobody is in the middle of typing when it restarts.
          The app also shows “Updating the system…” by itself whenever the server is restarting, and “A new version was installed” afterwards.
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        <input type="checkbox" checked={draft.on} onChange={(e) => setDraft({ ...draft, on: e.target.checked })} />
        Show the notice
      </label>
      <textarea value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} rows={3} placeholder="e.g. Updates in progress — please save your work." style={input} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {quick.map((q) => <span key={q} onClick={() => setDraft({ text: q, on: true })} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 999, border: '1px solid rgba(20,8,31,0.12)', cursor: 'pointer', color: '#43514D' }}>{q}</span>)}
      </div>
      <SaveBar auto={auto} blocked={draft.on && !draft.text.trim() ? 'Write the notice to turn it on' : undefined} />
    </div>
  );
}
