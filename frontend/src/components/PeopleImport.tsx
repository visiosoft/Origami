import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { csvToObjects, toCsv } from '../data/csv';

const INK = '#0B1A12';
const MUTED = '#7E9B93';
const BG = "'Bricolage Grotesque', serif";
const btn = (primary = false, off = false): React.CSSProperties => ({ padding: '8px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: off ? 'default' : 'pointer', border: primary ? 'none' : '1px solid rgba(20,8,31,0.14)', background: primary ? '#173326' : 'white', color: primary ? 'white' : '#173326', opacity: off ? 0.5 : 1, whiteSpace: 'nowrap' });

interface Column { key: string; header: string; hint: string }
interface PlanRow { row: number; action: 'create' | 'update' | 'skip' | 'error'; name: string; kind: string; email: string; issues: string[] }
const TONE: Record<PlanRow['action'], [string, string, string]> = {
  create: ['New', '#D2EAD3', '#1E6B36'], update: ['Update', '#D6E8E5', '#2F6F68'], skip: ['Skip', '#EFEDE8', '#5C6B65'], error: ['Problem', '#F2DFD4', '#8E2E0A'],
};
const EXAMPLES = [
  ['Sub', 'Ortiz Framing', '', '', 'Ortiz Framing', 'Luis Ortiz', 'Framing', '(209) 555-0101', 'luis@ortizframing.com', "Aquino's Kitchen and Bathroom Remodel", '12 Oak St', '', 'Tracy', 'CA', '95376', '998877', '2027-03-31', 'Hartford', 'GL-1234', '2027-01-01'],
  ['Client', 'Maria Aquino', 'Maria', 'Aquino', '', '', 'Owner', '(209) 555-0110', 'maria@example.com', "Aquino's Kitchen and Bathroom Remodel", '44 Elm Ave', '', 'Tracy', 'CA', '95376', '', '', '', '', ''],
];

/**
 * Import people from a spreadsheet (F8): download the template (or copy its
 * columns to send), upload CSV or Excel, see what each row will do, then
 * import. Nothing is saved until "Import".
 */
export function PeopleImport({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useApp();
  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [update, setUpdate] = useState(false);
  const [plan, setPlan] = useState<{ summary: Record<string, number>; rows: PlanRow[] } | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { api.people.importColumns().then((c) => setColumns(c as Column[])).catch(() => { }); }, []);

  const downloadTemplate = () => {
    const csv = toCsv([columns.map((c) => c.header), ...EXAMPLES]);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'People import template.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const copyColumns = async () => {
    const text = columns.map((c) => `${c.header}${c.hint ? ` — ${c.hint}` : ''}`).join('\n');
    try { await navigator.clipboard.writeText(text); toast('Column list copied — paste it into an email'); } catch { toast('⚠ Couldn’t copy — use the template instead'); }
  };

  const preview = async (list: Record<string, string>[], upd = update) => {
    setBusy('preview'); setError('');
    try { setPlan(await api.people.importRows(list, true, upd) as any); }
    catch (e: any) { setError(e.message); setPlan(null); }
    finally { setBusy(''); }
  };
  const pick = async (f?: File) => {
    if (!f) return;
    setFileName(f.name); setPlan(null); setError(''); setBusy('reading');
    try {
      let text: string;
      if (/\.(xlsx|xls|ods)$/i.test(f.name)) text = ((await api.people.importConvert(f)) as any).csv;
      else text = await f.text();
      const list = csvToObjects(text);
      if (!list.length) throw new Error('No rows found under the header row.');
      setRows(list);
      await preview(list);
    } catch (e: any) { setError(e.message || 'Couldn’t read that file'); setRows(null); }
    finally { setBusy(''); }
  };
  const run = async () => {
    if (!rows) return;
    setBusy('import'); setError('');
    try {
      const r: any = await api.people.importRows(rows, false, update);
      toast(`Imported: ${r.created} new${r.updated ? `, ${r.updated} updated` : ''}${r.failed?.length ? ` · ${r.failed.length} failed` : ''}`);
      if (r.failed?.length) setError(r.failed.map((f: any) => `Row ${f.row}: ${f.error}`).join('\n'));
      else { onDone(); onClose(); }
    } catch (e: any) { setError(e.message); }
    finally { setBusy(''); }
  };

  const will = plan ? (plan.summary.create || 0) + (plan.summary.update || 0) : 0;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.45)', zIndex: 110, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 760, maxWidth: '96vw', height: '100%', background: 'white', overflowY: 'auto', padding: '22px 24px', display: 'grid', gap: 16, alignContent: 'start' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: BG, fontSize: 19, fontWeight: 700, color: INK }}>Import people from a spreadsheet</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3, lineHeight: 1.55 }}>Clients, consultants, subs, vendors and authorities. Subs also appear in Manpower → Contractors. You see what every row will do before anything is saved.</div>
          </div>
          <span onClick={onClose} style={{ cursor: 'pointer', color: MUTED, fontSize: 18 }}>×</span>
        </div>

        <div style={{ background: '#FBF8F2', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, marginBottom: 6 }}>1 · The columns</div>
          <div style={{ fontSize: 12, color: '#43514D', lineHeight: 1.6 }}>
            Only <b>Kind</b> and <b>Name</b> are required. Headers can be in any order; leave out columns you don’t have.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, margin: '8px 0' }}>
            {columns.map((c) => <span key={c.key} title={c.hint} style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 999, background: 'white', border: '1px solid rgba(20,8,31,0.1)', fontWeight: c.key === 'kind' || c.key === 'name' ? 700 : 500 }}>{c.header}</span>)}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span onClick={columns.length ? downloadTemplate : undefined} style={btn()}>Download template (CSV)</span>
            <span onClick={columns.length ? copyColumns : undefined} style={btn()}>Copy the column list</span>
          </div>
        </div>

        <div style={{ background: '#FBF8F2', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, marginBottom: 6 }}>2 · Upload the filled-in sheet</div>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.ods,text/csv" style={{ display: 'none' }} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span onClick={busy ? undefined : () => fileRef.current?.click()} style={btn(true, !!busy)}>{busy === 'reading' ? 'Reading…' : fileName ? 'Choose another file' : 'Choose a file'}</span>
            {fileName && <span style={{ fontSize: 12.5, color: '#43514D' }}>{fileName}{rows ? ` · ${rows.length} rows` : ''}</span>}
          </div>
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 6 }}>CSV or Excel (.xlsx) — for Excel, the first sheet is read.</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#43514D', marginTop: 8 }}>
            <input type="checkbox" checked={update} onChange={(e) => { setUpdate(e.target.checked); if (rows) void preview(rows, e.target.checked); }} />
            Update people who are already in People (matched by email, or kind and name)
          </label>
        </div>

        {error && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F7E4DB', fontSize: 12.5, fontWeight: 600, color: '#8E2E0A', whiteSpace: 'pre-wrap' }}>{error}</div>}

        {plan && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, marginRight: 4 }}>3 · Check and import</div>
              {(Object.keys(TONE) as PlanRow['action'][]).map((k) => (
                <span key={k} style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: TONE[k][1], color: TONE[k][2] }}>{plan.summary[k] || 0} {TONE[k][0].toLowerCase()}</span>
              ))}
              <span onClick={busy || !will ? undefined : run} style={{ ...btn(true, !!busy || !will), marginLeft: 'auto' }}>{busy === 'import' ? 'Importing…' : `Import ${will}`}</span>
            </div>
            <div style={{ border: '1px solid rgba(20,8,31,0.08)', borderRadius: 12, overflow: 'auto', maxHeight: '48vh' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead><tr style={{ textAlign: 'left', color: MUTED, fontSize: 10.5, textTransform: 'uppercase' }}>
                  {['Row', '', 'Name', 'Kind', 'Email', 'Notes'].map((h, i) => <th key={i} style={{ padding: '7px 9px', borderBottom: '1px solid rgba(20,8,31,0.08)', background: 'white', position: 'sticky', top: 0 }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {plan.rows.map((r) => (
                    <tr key={r.row} style={{ borderBottom: '1px solid rgba(20,8,31,0.05)', verticalAlign: 'top' }}>
                      <td style={{ padding: '7px 9px', color: MUTED }}>{r.row}</td>
                      <td style={{ padding: '7px 9px' }}><span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: TONE[r.action][1], color: TONE[r.action][2] }}>{TONE[r.action][0]}</span></td>
                      <td style={{ padding: '7px 9px', fontWeight: 600, color: INK }}>{r.name || '—'}</td>
                      <td style={{ padding: '7px 9px' }}>{r.kind || '—'}</td>
                      <td style={{ padding: '7px 9px', color: '#43514D' }}>{r.email || '—'}</td>
                      <td style={{ padding: '7px 9px', color: r.action === 'error' ? '#8E2E0A' : MUTED, fontSize: 12 }}>{r.issues.join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
