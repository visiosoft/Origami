import { useEffect, useState } from 'react';
import { api } from '../api';
import { SaveBar, useAutosave } from '../autosave';

const BG = "'Bricolage Grotesque', serif";
type Form = { emails: string };

/**
 * Who receives each submitted daily log by email -- a PDF to read and an
 * Excel file to work with -- so the day is on record outside the app too.
 */
export function DailyLogBackupSettings() {
  const [saved, setSaved] = useState<Form | null>(null);
  const [draft, setDraft] = useState<Form>({ emails: '' });
  useEffect(() => {
    api.settings.get().then((s) => { const f = { emails: s['dailyLogs.backupEmails'] || '' }; setSaved(f); setDraft(f); }).catch(() => undefined);
  }, []);
  const addresses = draft.emails.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  const bad = addresses.filter((a) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a));
  const auto = useAutosave<Form>({
    draft, saved, enabled: !bad.length, label: 'daily log backup',
    save: async (_c, { draft: d }) => {
      const clean = d.emails.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean).join(', ');
      await api.settings.save({ 'dailyLogs.backupEmails': clean });
      setSaved({ emails: clean });
      return { emails: clean };
    },
  });

  return (
    <div style={{ background: 'white', border: '1px solid rgba(20,8,31,0.08)', borderRadius: 14, padding: '20px 22px', display: 'grid', gap: 14, maxWidth: 720 }}>
      <div>
        <div style={{ fontFamily: BG, fontSize: 17, fontWeight: 700 }}>Daily log backup</div>
        <div style={{ fontSize: 12.5, color: '#5C6B65', marginTop: 4, lineHeight: 1.55 }}>
          When a superintendent submits a daily log, it’s emailed here as a <b>PDF</b> and an <b>Excel</b> file — hours by cost code, every worker line and the site notes.
          The superintendent is copied. Leave this empty to send it to the administrators. Needs the Google account connected (Integrations).
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Send each daily log to</div>
        <textarea value={draft.emails} onChange={(e) => setDraft({ emails: e.target.value })} rows={3} placeholder="edward@origamidb.com, astrid@origamidb.com"
          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, border: '1px solid ' + (bad.length ? '#C9A227' : 'rgba(20,8,31,0.14)'), fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }} />
        <div style={{ fontSize: 11.5, color: bad.length ? '#8A6D12' : '#7E9B93', marginTop: 4 }}>
          {bad.length ? `Not an email address: ${bad.join(', ')}` : addresses.length ? `${addresses.length} recipient${addresses.length === 1 ? '' : 's'}` : 'Empty — the administrators get it.'}
        </div>
      </div>
      <SaveBar auto={auto} blocked={bad.length ? 'Fix the addresses to save' : undefined} />
    </div>
  );
}
