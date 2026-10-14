import { useRef, useState } from 'react';
import {
  AUTHORITIES, NO_WORK_REASONS, OPS_DELAYS, OUTCOMES, STOP_BY, VISITOR_TYPES, isRowCarried, rowId,
  type Delay, type FileRef, type OpsKey, type Sections, type YesNo,
} from '../../data/dailyReport';
import {
  AddRow, Carry, ConvertButton, DelayBlock, INK, Label, MUTED, RemoveRow, SectionCard, YesNoPick, area, input, pill, useReport,
} from './ReportBits';

export type Convert = (title: string, details: string) => Promise<string | null>;
export type Upload = (files: File[]) => Promise<FileRef[]>;
type Set = (fn: (s: Sections) => Sections) => void;

/** The six operations delays and/or force majeure, each with its get-well date, details and Convert to task. */
function DelayChecklist({ ops, force, base, onOps, onForce, convert, showForce = true, showOps = true }: {
  ops: Partial<Record<OpsKey, Delay>>; force: Delay; base: 'activity.ops' | 'activity.dOps'; onOps: (k: OpsKey, d: Delay) => void; onForce: (d: Delay) => void;
  convert: Convert; showForce?: boolean; showOps?: boolean;
}) {
  const { editable } = useReport();
  const forcePath = base === 'activity.ops' ? 'activity.force' : 'activity.dForce';
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {showOps && OPS_DELAYS.map(([k, label]) => {
        const d = ops[k] || {};
        return (
          <div key={k} style={{ display: 'grid', gap: 8 }}>
            <Carry path={`${base}.${k}.on`}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: INK }}>
                <input type="checkbox" disabled={!editable} checked={!!d.on} onChange={(e) => onOps(k, { ...d, on: e.target.checked })} />{label}
              </label>
            </Carry>
            {d.on && <div style={{ paddingLeft: 24 }}><DelayBlock value={d} path={`${base}.${k}`} onChange={(v) => onOps(k, v)} onConvert={(t) => convert(label, t)} /></div>}
          </div>
        );
      })}
      {showForce && (
        <div style={{ display: 'grid', gap: 8 }}>
          <Carry path={`${forcePath}.on`}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: INK }}>
              <input type="checkbox" disabled={!editable} checked={!!force.on} onChange={(e) => onForce({ ...force, on: e.target.checked })} />Force majeure delay
            </label>
          </Carry>
          {force.on && <div style={{ paddingLeft: 24 }}><DelayBlock value={force} path={forcePath} onChange={onForce} onConvert={(t) => convert('Force majeure delay', t)} /></div>}
        </div>
      )}
    </div>
  );
}

/** Attach completed forms or photos for the day (stored in the project's File Room). */
function Attachments({ files, onChange, upload, label }: { files: FileRef[]; onChange: (f: FileRef[]) => void; upload: Upload; label: string }) {
  const { editable } = useReport();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {files.map((f) => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <a href={`/planroom?file=${encodeURIComponent(f.id)}`} target="_blank" rel="noreferrer" style={{ color: INK, fontWeight: 600 }}>{f.name}</a>
          <RemoveRow onClick={() => onChange(files.filter((x) => x.id !== f.id))} label={`Remove ${f.name}`} />
        </div>
      ))}
      {editable && (
        <>
          <input ref={ref} type="file" multiple hidden accept="image/*,application/pdf" onChange={async (e) => {
            const picked = Array.from(e.target.files || []); e.target.value = '';
            if (!picked.length) return;
            setBusy(true);
            try { onChange([...files, ...(await upload(picked))]); } finally { setBusy(false); }
          }} />
          <button type="button" onClick={() => ref.current?.click()} style={{ ...pill(false), justifySelf: 'start', borderStyle: 'dashed' }}>{busy ? 'Uploading…' : label}</button>
        </>
      )}
    </div>
  );
}

const yn = (v: YesNo) => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : 'Not answered yet');

// ------------------------------------------------------------------ II. Activity

export function ActivitySection({ s, set, convert, baseline }: { s: Sections; set: Set; convert: Convert; baseline?: Sections | null }) {
  const { editable } = useReport();
  const a = s.activity;
  const setA = (p: Partial<Sections['activity']>) => set((x) => ({ ...x, activity: { ...x.activity, ...p } }));
  void baseline;
  const reasonLabel = NO_WORK_REASONS.find(([k]) => k === a.reason)?.[1];
  return (
    <SectionCard roman="II" title="Activity" summary={a.worked === 'no' ? `No work today${reasonLabel ? ` — ${reasonLabel}` : ''}` : a.worked === 'yes' ? 'Work occurred today' : 'Did work occur today?'}>
      <div>
        <Label code="II.A">Did work occur today?</Label>
        <YesNoPick value={a.worked} onChange={(v) => setA({ worked: v })} path="activity.worked" />
      </div>

      {a.worked === 'no' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <Label>Why not?</Label>
            <Carry path="activity.reason">
              <select disabled={!editable} value={a.reason} onChange={(e) => setA({ reason: e.target.value as Sections['activity']['reason'] })} style={{ ...input, maxWidth: 320 }}>
                <option value="">Choose a reason…</option>
                {NO_WORK_REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Carry>
          </div>

          {a.reason === 'stop' && (
            <div style={{ display: 'grid', gap: 12, padding: 14, borderRadius: 12, background: 'var(--panel)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                <div>
                  <Label>Project ordered to STOP by</Label>
                  <Carry path="activity.stop.by"><select disabled={!editable} value={a.stop.by || ''} onChange={(e) => setA({ stop: { ...a.stop, by: e.target.value } })} style={input}>
                    <option value="">Choose…</option>{STOP_BY.map((b) => <option key={b}>{b}</option>)}
                  </select></Carry>
                </div>
                <div>
                  <Label>As of</Label>
                  <Carry path="activity.stop.asOf"><input type="date" disabled={!editable} value={a.stop.asOf || ''} onChange={(e) => setA({ stop: { ...a.stop, asOf: e.target.value } })} style={input} /></Carry>
                </div>
                <div>
                  <Label>Projected to end</Label>
                  {!a.stop.endUnknown && <Carry path="activity.stop.end"><input type="date" disabled={!editable} value={a.stop.end || ''} min={a.stop.asOf || undefined} onChange={(e) => setA({ stop: { ...a.stop, end: e.target.value } })} style={input} /></Carry>}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: INK, marginTop: 6 }}>
                    <input type="checkbox" disabled={!editable} checked={!!a.stop.endUnknown} onChange={(e) => setA({ stop: { ...a.stop, endUnknown: e.target.checked, end: e.target.checked ? '' : a.stop.end } })} />Unknown stop date
                  </label>
                </div>
              </div>
              <Carry path="activity.stop.details"><textarea disabled={!editable} value={a.stop.details || ''} onChange={(e) => setA({ stop: { ...a.stop, details: e.target.value } })} rows={2} placeholder="More about the stop order" style={area} /></Carry>
              <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.55 }}>
                Submitting puts the project on <b style={{ color: INK }}>HOLD</b>. A report is made for each day of the stop (anyone can still add their own as an update), and you’re reminded a week and two days before the end date. Only a person can take the project off hold.
              </div>
            </div>
          )}

          {a.reason === 'holiday' && (
            <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 12, background: 'var(--panel)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                <div><Label>Start holiday date</Label><Carry path="activity.holiday.start"><input type="date" disabled={!editable} value={a.holiday.start || ''} onChange={(e) => setA({ holiday: { ...a.holiday, start: e.target.value } })} style={input} /></Carry></div>
                <div><Label>End holiday date</Label><Carry path="activity.holiday.end"><input type="date" disabled={!editable} value={a.holiday.end || ''} min={a.holiday.start || undefined} onChange={(e) => setA({ holiday: { ...a.holiday, end: e.target.value } })} style={input} /></Carry></div>
              </div>
              <div style={{ fontSize: 12, color: MUTED }}>A report is made for each holiday day; anyone can still add their own as an update.</div>
            </div>
          )}

          {(a.reason === 'ops' || a.reason === 'force') && (
            <DelayChecklist ops={a.ops} force={a.force} base="activity.ops" showOps={a.reason === 'ops'} showForce={a.reason === 'force'}
              onOps={(k, d) => setA({ ops: { ...a.ops, [k]: d } })} onForce={(d) => setA({ force: d })} convert={convert} />
          )}
          <div style={{ fontSize: 12.5, color: MUTED }}>Sections III–IX don’t apply on a day without work — go straight to the signature (Section X).</div>
        </div>
      )}

      {a.worked === 'yes' && (
        <>
          <div>
            <Label code="II.B">Were there delays today?</Label>
            <YesNoPick value={a.delays} onChange={(v) => setA({ delays: v })} path="activity.delays" />
          </div>
          {a.delays === 'yes' && (
            <DelayChecklist ops={a.dOps} force={a.dForce} base="activity.dOps" onOps={(k, d) => setA({ dOps: { ...a.dOps, [k]: d } })} onForce={(d) => setA({ dForce: d })} convert={convert} />
          )}
          <div>
            <Label code="II.C">Were site photos and site videos taken and uploaded to the project folder today?</Label>
            <YesNoPick value={a.photos} onChange={(v) => setA({ photos: v })} path="activity.photos" />
            {a.photos === 'no' && <div style={{ marginTop: 8, fontSize: 12.5, color: '#8A5A12', background: 'rgba(245, 196, 67, 0.16)', borderRadius: 10, padding: '8px 12px' }}>Please upload photos at your soonest. Submitting adds a task for you: “Upload job photos for this date”.</div>}
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ------------------------------------------------------------------ III. Internal workers

export function YesNoSection({ roman, title, code, question, value, onChange, path, na, summaryYes, children }: {
  roman: string; title: string; code: string; question: string; value: YesNo; onChange: (v: YesNo) => void; path: string; na: boolean; summaryYes?: string; children?: React.ReactNode;
}) {
  return (
    <SectionCard roman={roman} title={title} na={na} summary={value === 'yes' ? (summaryYes || 'Yes') : yn(value)}>
      <div><Label code={code}>{question}</Label><YesNoPick value={value} onChange={onChange} path={path} /></div>
      {value === 'yes' && children}
    </SectionCard>
  );
}

// ------------------------------------------------------------------ IV. Subcontractors

export function SubsSection({ s, set, na, contractors, baseline }: { s: Sections; set: Set; na: boolean; contractors: { id: string; companyName: string }[]; baseline?: Sections | null }) {
  const { editable } = useReport();
  const sub = s.subs;
  const setSubs = (p: Partial<Sections['subs']>) => set((x) => ({ ...x, subs: { ...x.subs, ...p } }));
  const setRow = (id: string, p: Record<string, unknown>) => setSubs({ rows: sub.rows.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  const heads = sub.rows.reduce((n, r) => n + (Number(r.headcount) || 0), 0);
  return (
    <YesNoSection roman="IV" title="Subcontractors" code="IV.A" question="Were subcontractors present today?" value={sub.present} na={na}
      onChange={(v) => setSubs({ present: v, rows: v === 'yes' && !sub.rows.length ? [{ id: rowId() }] : sub.rows })} path="subs.present"
      summaryYes={`${sub.rows.length} subcontractor${sub.rows.length === 1 ? '' : 's'} · ${heads} people`}>
      {sub.rows.map((r) => (
        <Carry key={r.id} on={isRowCarried(baseline?.subs.rows, r)}>
          <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 12, border: '1px solid rgba(var(--rgb-shade), .1)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: '2 1 220px' }}><Label>Subcontractor</Label>
                <select disabled={!editable} value={r.contractorId || ''} onChange={(e) => setRow(r.id, { contractorId: e.target.value, name: contractors.find((c) => c.id === e.target.value)?.companyName || '' })} style={input}>
                  <option value="">Choose…</option>
                  {contractors.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
              </div>
              <div style={{ flex: '0 1 100px' }}><Label>Headcount</Label><input type="number" min={0} disabled={!editable} value={r.headcount ?? ''} onChange={(e) => setRow(r.id, { headcount: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })} style={input} /></div>
              <div style={{ flex: '1 1 110px' }}><Label>On site from</Label><input type="time" disabled={!editable} value={r.from || ''} onChange={(e) => setRow(r.id, { from: e.target.value })} style={input} /></div>
              <div style={{ flex: '1 1 110px' }}><Label>To</Label><input type="time" disabled={!editable} value={r.to || ''} onChange={(e) => setRow(r.id, { to: e.target.value })} style={input} /></div>
              <RemoveRow onClick={() => setSubs({ rows: sub.rows.filter((x) => x.id !== r.id) })} label="Remove subcontractor" />
            </div>
            <div><Label>Work accomplished</Label><textarea disabled={!editable} value={r.work || ''} onChange={(e) => setRow(r.id, { work: e.target.value })} rows={2} style={area} /></div>
          </div>
        </Carry>
      ))}
      <AddRow onClick={() => setSubs({ rows: [...sub.rows, { id: rowId() }] })}>+ Add subcontractor</AddRow>
    </YesNoSection>
  );
}

// ------------------------------------------------------------------ V. Inspectors

export function InspectorsSection({ s, set, na, convert, upload, baseline }: { s: Sections; set: Set; na: boolean; convert: Convert; upload: Upload; baseline?: Sections | null }) {
  const { editable } = useReport();
  const ins = s.inspectors;
  const setIns = (p: Partial<Sections['inspectors']>) => set((x) => ({ ...x, inspectors: { ...x.inspectors, ...p } }));
  const setRow = (id: string, p: Record<string, unknown>) => setIns({ rows: ins.rows.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  const failed = ins.rows.filter((r) => r.outcome === 'failed').length;
  return (
    <YesNoSection roman="V" title="Inspectors" code="V.A" question="Were inspectors present today?" value={ins.present} na={na}
      onChange={(v) => setIns({ present: v, rows: v === 'yes' && !ins.rows.length ? [{ id: rowId() }] : ins.rows })} path="inspectors.present"
      summaryYes={`${ins.rows.length} inspection${ins.rows.length === 1 ? '' : 's'}${failed ? ` · ${failed} failed` : ''}`}>
      {ins.rows.map((r) => (
        <Carry key={r.id} on={isRowCarried(baseline?.inspectors.rows, r)}>
          <div style={{ display: 'grid', gap: 12, padding: 14, borderRadius: 12, border: '1px solid rgba(var(--rgb-shade), .1)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}><Label>Inspection authority</Label>
                <select disabled={!editable} value={r.authority || ''} onChange={(e) => setRow(r.id, { authority: e.target.value })} style={input}>
                  <option value="">Choose…</option>{AUTHORITIES.map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
              <RemoveRow onClick={() => setIns({ rows: ins.rows.filter((x) => x.id !== r.id) })} label="Remove inspector" />
            </div>
            <div><Label>What was inspected?</Label><textarea disabled={!editable} value={r.what || ''} onChange={(e) => setRow(r.id, { what: e.target.value })} rows={2} style={area} /></div>
            <div>
              <Label>Outcome of the inspection</Label>
              <div style={{ display: 'grid', gap: 6 }}>
                {OUTCOMES.map(([k, l]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: INK }}>
                    <input type="checkbox" disabled={!editable} checked={r.outcome === k} onChange={(e) => setRow(r.id, { outcome: e.target.checked ? k : '' })} style={{ marginTop: 3 }} />{l}
                  </label>
                ))}
              </div>
            </div>
            {r.outcome && r.outcome !== 'passed' && (
              <DelayBlock value={r.delay || {}} path={`inspectors.rows.${ins.rows.indexOf(r)}.delay`} onChange={(d) => setRow(r.id, { delay: d })}
                onConvert={(t) => convert(`${OUTCOMES.find(([k]) => k === r.outcome)?.[1].split(' —')[0]} inspection${r.authority ? ` (${r.authority})` : ''}`, `${r.what ? r.what + '\n\n' : ''}${t}`)} />
            )}
            <div>
              <Label>Photo of the inspection card</Label>
              <Attachments files={r.card ? [r.card] : []} onChange={(f) => setRow(r.id, { card: f[f.length - 1] || null })} upload={upload} label={r.card ? 'Replace photo' : '+ Attach photo'} />
            </div>
          </div>
        </Carry>
      ))}
      <AddRow onClick={() => setIns({ rows: [...ins.rows, { id: rowId() }] })}>+ Add inspector</AddRow>
    </YesNoSection>
  );
}

// ------------------------------------------------------------------ VI. Site meeting & visitors

export function VisitorsSection({ s, set, na, convert, consultants, baseline }: { s: Sections; set: Set; na: boolean; convert: Convert; consultants: { id: string | number; name: string; company?: string }[]; baseline?: Sections | null }) {
  const { editable } = useReport();
  const v = s.visitors;
  const setV = (p: Partial<Sections['visitors']>) => set((x) => ({ ...x, visitors: { ...x.visitors, ...p } }));
  const setRow = (id: string, p: Record<string, unknown>) => setV({ rows: v.rows.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  return (
    <YesNoSection roman="VI" title="Site meeting & site visitors" code="VI.A" question="Were site visitors present today?" value={v.present} na={na}
      onChange={(x) => setV({ present: x, rows: x === 'yes' && !v.rows.length ? [{ id: rowId() }] : v.rows })} path="visitors.present"
      summaryYes={`${v.rows.length} visitor${v.rows.length === 1 ? '' : 's'}`}>
      {v.rows.map((r) => (
        <Carry key={r.id} on={isRowCarried(baseline?.visitors.rows, r)}>
          <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 12, border: '1px solid rgba(var(--rgb-shade), .1)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 150px' }}><Label>Visitor</Label>
                <select disabled={!editable} value={r.type || ''} onChange={(e) => setRow(r.id, { type: e.target.value, personId: '', name: '' })} style={input}>
                  <option value="">Choose…</option>{VISITOR_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ flex: '3 1 200px' }}><Label>Name</Label>
                {r.type === 'Consultant'
                  ? <select disabled={!editable} value={r.personId || ''} onChange={(e) => setRow(r.id, { personId: e.target.value, name: consultants.find((c) => String(c.id) === e.target.value)?.name || '' })} style={input}>
                      <option value="">Choose a consultant…</option>
                      {consultants.map((c) => <option key={c.id} value={String(c.id)}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
                    </select>
                  : <input disabled={!editable} value={r.name || ''} onChange={(e) => setRow(r.id, { name: e.target.value })} placeholder={r.type ? `${r.type}’s name` : 'Name'} style={input} />}
              </div>
              <RemoveRow onClick={() => setV({ rows: v.rows.filter((x) => x.id !== r.id) })} label="Remove visitor" />
            </div>
            <div><Label>Details</Label><textarea disabled={!editable} value={r.details || ''} onChange={(e) => setRow(r.id, { details: e.target.value })} rows={2} style={area} /></div>
            <ConvertButton taskId={r.taskId} text={r.details || ''} onConvert={(t) => convert(`Site visit${r.name ? ` — ${r.name}` : r.type ? ` — ${r.type}` : ''}`, t)} onDone={(id) => setRow(r.id, { taskId: id })} />
          </div>
        </Carry>
      ))}
      <AddRow onClick={() => setV({ rows: [...v.rows, { id: rowId() }] })}>+ Add visitor</AddRow>
    </YesNoSection>
  );
}

// ------------------------------------------------------------------ VII. Deliveries / VIII. Equipment

export function FormSection({ roman, title, codeA, questionA, codeB, questionB, a, b, files, pathA, pathB, onA, onB, onFiles, na, upload, missingTask, attachLabel }: {
  roman: string; title: string; codeA: string; questionA: string; codeB: string; questionB: string; a: YesNo; b: YesNo; files: FileRef[];
  pathA: string; pathB: string; onA: (v: YesNo) => void; onB: (v: YesNo) => void; onFiles: (f: FileRef[]) => void; na: boolean; upload: Upload; missingTask: string; attachLabel: string;
}) {
  return (
    <YesNoSection roman={roman} title={title} code={codeA} question={questionA} value={a} onChange={onA} path={pathA} na={na}
      summaryYes={b === 'yes' ? `Yes · ${files.length} form${files.length === 1 ? '' : 's'}` : b === 'no' ? 'Yes · form still to upload' : 'Yes'}>
      <div><Label code={codeB}>{questionB}</Label><YesNoPick value={b} onChange={onB} path={pathB} /></div>
      {b === 'no' && <div style={{ fontSize: 12.5, color: '#8A5A12', background: 'rgba(245, 196, 67, 0.16)', borderRadius: 10, padding: '8px 12px' }}>Submitting adds a task for you: “{missingTask}”.</div>}
      {b === 'yes' && <Attachments files={files} onChange={onFiles} upload={upload} label={attachLabel} />}
    </YesNoSection>
  );
}

// ------------------------------------------------------------------ IX. Notes

export function NotesSection({ s, set, na, convert, baseline }: { s: Sections; set: Set; na: boolean; convert: Convert; baseline?: Sections | null }) {
  const { editable } = useReport();
  const notes = s.notes;
  const setNotes = (rows: Sections['notes']) => set((x) => ({ ...x, notes: rows }));
  const setRow = (id: string, p: Record<string, unknown>) => setNotes(notes.map((r) => (r.id === id ? { ...r, ...p } : r)));
  return (
    <SectionCard roman="IX" title="Notes" na={na} summary={notes.filter((n) => (n.text || '').trim()).length ? `${notes.filter((n) => (n.text || '').trim()).length} note${notes.length === 1 ? '' : 's'}` : 'Anything else about today'}>
      {notes.map((r) => (
        <Carry key={r.id} on={isRowCarried(baseline?.notes, r)}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <textarea disabled={!editable} value={r.text || ''} onChange={(e) => setRow(r.id, { text: e.target.value })} rows={2} placeholder="A note" style={{ ...area, minHeight: 52 }} />
            <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
              <ConvertButton taskId={r.taskId} text={r.text || ''} onConvert={(t) => convert(t.split('\n')[0].slice(0, 80), t)} onDone={(id) => setRow(r.id, { taskId: id })} />
              <RemoveRow onClick={() => setNotes(notes.filter((x) => x.id !== r.id))} label="Remove note" />
            </div>
          </div>
        </Carry>
      ))}
      <AddRow onClick={() => setNotes([...notes, { id: rowId() }])}>+ Add note</AddRow>
    </SectionCard>
  );
}
