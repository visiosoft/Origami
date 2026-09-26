import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { loadPicklists, setPicklists, type Picklists } from '../data/picklists';

const LISTS: { key: keyof Picklists; title: string; hint: string }[] = [
  { key: 'departments', title: 'Departments', hint: 'Where someone sits in the company.' },
  { key: 'designations', title: 'Designations', hint: 'Job titles. The team is still agreeing this list — change it here when it’s settled.' },
  { key: 'skills', title: 'Skills & trades', hint: 'What a worker can do. A worker can have several.' },
];

/**
 * Manpower -> Setup -> Picklists: the lists behind the employee form's
 * Department, Designation and Skills fields. One entry per line. Changing a
 * list never changes what's already saved on an employee.
 */
export function PicklistsSetup({ canManage }: { canManage: boolean }) {
  const { toast } = useApp();
  const [text, setText] = useState<Record<keyof Picklists, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fill = (p: Picklists) => setText({ departments: p.departments.join('\n'), designations: p.designations.join('\n'), skills: p.skills.join('\n') });
  useEffect(() => { loadPicklists(true).then(fill); }, []);
  if (!text) return <div style={{ fontSize: 13, color: '#7E9B93' }}>Loading…</div>;

  const save = () => {
    const body = Object.fromEntries(LISTS.map(({ key }) => [key, text[key].split('\n').map((s) => s.trim()).filter(Boolean)])) as unknown as Picklists;
    setSaving(true); setError('');
    api.picklists.save(body)
      .then((p) => { setPicklists(p as Picklists); fill(p as Picklists); toast('Picklists saved'); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false));
  };

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 1000 }}>
      <div style={{ fontSize: 12.5, color: '#5C6B65', lineHeight: 1.6 }}>
        The choices in the employee form’s <b>Department</b>, <b>Designation</b> and <b>Skills</b> fields — one per line. Anyone filling in the
        form can still pick “Other…” for something not listed. New worker IDs include the year they started, e.g. <b>W-{new Date().getFullYear()}-0012</b>.
      </div>
      {error && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F7E4DB', fontSize: 12.5, fontWeight: 600, color: '#8E2E0A' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {LISTS.map(({ key, title, hint }) => (
          <div key={key} style={{ background: 'white', border: '1px solid rgba(20,8,31,0.08)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0B1A12' }}>{title} <span style={{ fontSize: 11.5, fontWeight: 500, color: '#7E9B93' }}>({text[key].split('\n').filter((s) => s.trim()).length})</span></div>
            <div style={{ fontSize: 11.5, color: '#7E9B93', margin: '3px 0 8px', lineHeight: 1.45 }}>{hint}</div>
            <textarea disabled={!canManage} value={text[key]} onChange={(e) => setText({ ...text, [key]: e.target.value })} rows={14}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.14)', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical' }} />
          </div>
        ))}
      </div>
      {canManage
        ? <div><span onClick={saving ? undefined : save} style={{ display: 'inline-block', padding: '9px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white' }}>{saving ? 'Saving…' : 'Save picklists'}</span></div>
        : <div style={{ fontSize: 12, color: '#7E9B93' }}>Only HR managers can change these.</div>}
    </div>
  );
}
