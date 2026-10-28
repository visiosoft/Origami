import { useRef, useState } from 'react';
import {
  AUTHORITIES, DELIVERY_CONDITIONS, NO_WORK_REASONS, OPS_DELAYS, OUTCOMES, STOP_BY, VISITOR_TYPES, equipmentFormDone, equipmentHours, isRowCarried, rowId, transmittalDone,
  type Delay, type DeliveryRow, type EquipmentRow, type FileRef, type OpsKey, type Sections, type YesNo,
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
            <div style={{ display: 'grid', gap: 12, padding: 14, borderRadius: 'var(--r-12)', background: 'var(--panel)' }}>
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
            <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 'var(--r-12)', background: 'var(--panel)' }}>
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
          <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 'var(--r-12)', border: '1px solid rgba(var(--rgb-shade), .1)' }}>
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
          <div style={{ display: 'grid', gap: 12, padding: 14, borderRadius: 'var(--r-12)', border: '1px solid rgba(var(--rgb-shade), .1)' }}>
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
          <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 'var(--r-12)', border: '1px solid rgba(var(--rgb-shade), .1)' }}>
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

/** "Still to do" note: nothing filled in or attached yet, so submitting adds a task. */
function MissingNote({ task }: { task: string }) {
  return <div style={{ fontSize: 12.5, color: '#8A5A12', background: 'rgba(245, 196, 67, 0.16)', borderRadius: 10, padding: '8px 12px' }}>Nothing filled in or attached yet — submitting adds a task for you: “{task}”.</div>;
}

/** VII. The transmittal, filled in here: one block per delivery. A signed paper copy can be attached instead (or as well). */
export function DeliveriesSection({ s, set, na, convert, upload, contractors, baseline, missingTask }: {
  s: Sections; set: Set; na: boolean; convert: Convert; upload: Upload; contractors: { id: string; companyName: string }[]; baseline?: Sections | null; missingTask: string;
}) {
  const { editable } = useReport();
  const d = s.deliveries;
  // "Transmittal completed" follows what's on the form, so the PDF and the task on submit agree with it.
  const setD = (p: Partial<Sections['deliveries']>) => set((x) => {
    const next = { ...x.deliveries, ...p };
    return { ...x, deliveries: { ...next, transmittal: next.present === 'yes' ? (transmittalDone(next) ? 'yes' : 'no') : '' } };
  });
  const setRow = (id: string, p: Partial<DeliveryRow>) => setD({ rows: d.rows.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  const done = transmittalDone(d);
  return (
    <YesNoSection roman="VII" title="Deliveries" code="VII.A" question="Was there a delivery today?" value={d.present} na={na} path="deliveries.present"
      onChange={(v) => setD({ present: v, rows: v === 'yes' && !d.rows.length ? [{ id: rowId() }] : d.rows })}
      summaryYes={done ? `Yes · ${d.rows.length} on the transmittal${d.files.length ? ` · ${d.files.length} attached` : ''}` : 'Yes · transmittal still to do'}>
      <Label code="VII.B" hint="One block per delivery. Or attach a signed transmittal below.">Transmittal</Label>
      <datalist id="dr-suppliers">{contractors.map((c) => <option key={c.id} value={c.companyName} />)}</datalist>
      {d.rows.map((r) => (
        <Carry key={r.id} on={isRowCarried(baseline?.deliveries.rows, r)}>
          <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 'var(--r-12)', border: '1px solid rgba(var(--rgb-shade), .1)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: '2 1 200px' }}><Label>Supplier</Label>
                <input disabled={!editable} list="dr-suppliers" value={r.supplier || ''} placeholder="Choose or type a supplier"
                  onChange={(e) => setRow(r.id, { supplier: e.target.value, contractorId: contractors.find((c) => c.companyName.toLowerCase() === e.target.value.trim().toLowerCase())?.id || '' })} style={input} />
              </div>
              <div style={{ flex: '1 1 130px' }}><Label>PO / delivery ticket #</Label><input disabled={!editable} value={r.poRef || ''} onChange={(e) => setRow(r.id, { poRef: e.target.value })} style={input} /></div>
              <div style={{ flex: '1 1 150px' }}><Label>Received by</Label><input disabled={!editable} value={r.receivedBy || ''} onChange={(e) => setRow(r.id, { receivedBy: e.target.value })} style={input} /></div>
              <RemoveRow onClick={() => setD({ rows: d.rows.filter((x) => x.id !== r.id) })} label="Remove delivery" />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: '3 1 240px' }}><Label>Items delivered</Label><textarea disabled={!editable} value={r.items || ''} onChange={(e) => setRow(r.id, { items: e.target.value })} rows={2} placeholder="e.g. 40 sheets 3/4 ply, 2 pallets 2x6x16" style={area} /></div>
              <div style={{ flex: '0 1 100px' }}><Label>Quantity</Label><input type="number" min={0} disabled={!editable} value={r.qty ?? ''} onChange={(e) => setRow(r.id, { qty: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })} style={input} /></div>
            </div>
            <div>
              <Label>Condition on arrival</Label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DELIVERY_CONDITIONS.map(([k, l]) => (
                  <button key={k} type="button" disabled={!editable} onClick={() => setRow(r.id, { condition: r.condition === k ? '' : k })} style={pill(r.condition === k, !editable)}>{l}</button>
                ))}
              </div>
            </div>
            <div><Label>Notes</Label><textarea disabled={!editable} value={r.notes || ''} onChange={(e) => setRow(r.id, { notes: e.target.value })} rows={2} style={area} /></div>
            {(r.condition === 'damaged' || r.condition === 'short') && (
              <ConvertButton taskId={r.taskId} text={[r.items, r.notes].filter(Boolean).join('\n') || `${r.condition === 'damaged' ? 'Damaged' : 'Short'} delivery`}
                onConvert={(t) => convert(`${r.condition === 'damaged' ? 'Damaged' : 'Short'} delivery${r.supplier ? ` — ${r.supplier}` : ''}${r.poRef ? ` (${r.poRef})` : ''}`, t)}
                onDone={(id) => setRow(r.id, { taskId: id })} />
            )}
            <div><Label>Photo of the ticket or the delivery</Label>
              <Attachments files={r.photo ? [r.photo] : []} onChange={(f) => setRow(r.id, { photo: f[f.length - 1] || null })} upload={upload} label={r.photo ? 'Replace photo' : '+ Attach photo'} />
            </div>
          </div>
        </Carry>
      ))}
      <AddRow onClick={() => setD({ rows: [...d.rows, { id: rowId() }] })}>+ Add delivery</AddRow>
      <div><Label hint="A signed paper transmittal, if there is one">Attached transmittal</Label><Attachments files={d.files} onChange={(f) => setD({ files: f })} upload={upload} label="+ Attach transmittal" /></div>
      {!done && <MissingNote task={missingTask} />}
    </YesNoSection>
  );
}

/** VIII. The Equipment Utilization form, filled in here: one row per machine, with hours used and idle. */
export function EquipmentSection({ s, set, na, convert, upload, operators, baseline, missingTask }: {
  s: Sections; set: Set; na: boolean; convert: Convert; upload: Upload; operators: string[]; baseline?: Sections | null; missingTask: string;
}) {
  const { editable } = useReport();
  const e = s.equipment;
  const setE = (p: Partial<Sections['equipment']>) => set((x) => {
    const next = { ...x.equipment, ...p };
    return { ...x, equipment: { ...next, form: next.used === 'yes' ? (equipmentFormDone(next) ? 'yes' : 'no') : '' } };
  });
  const setRow = (id: string, p: Partial<EquipmentRow>) => setE({ rows: e.rows.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  const hrs = equipmentHours(e.rows);
  const num = (v: string) => (v === '' ? '' : Math.max(0, Math.min(24, Number(v))));
  return (
    <YesNoSection roman="VIII" title="Equipment used" code="VIII.A" question="Was equipment used today?" value={e.used} na={na} path="equipment.used"
      onChange={(v) => setE({ used: v, rows: v === 'yes' && !e.rows.length ? [{ id: rowId() }] : e.rows })}
      summaryYes={equipmentFormDone(e) ? `Yes · ${e.rows.length} machine${e.rows.length === 1 ? '' : 's'} · ${hrs.used} h used, ${hrs.idle} h idle` : 'Yes · utilization form still to do'}>
      <Label code="VIII.B" hint="One row per machine. Or attach a completed form below.">Equipment Utilization</Label>
      <datalist id="dr-operators">{operators.map((o) => <option key={o} value={o} />)}</datalist>
      {e.rows.map((r) => (
        <Carry key={r.id} on={isRowCarried(baseline?.equipment.rows, r)}>
          <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 'var(--r-12)', border: '1px solid rgba(var(--rgb-shade), .1)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: '2 1 200px' }}><Label>Equipment</Label><input disabled={!editable} value={r.equipment || ''} onChange={(ev) => setRow(r.id, { equipment: ev.target.value })} placeholder="e.g. CAT 308 excavator" style={input} /></div>
              <div style={{ flex: '0 0 auto' }}><Label>Owned or rented</Label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['owned', 'rented'] as const).map((k) => <button key={k} type="button" disabled={!editable} onClick={() => setRow(r.id, { ownership: r.ownership === k ? '' : k })} style={pill(r.ownership === k, !editable)}>{k === 'owned' ? 'Owned' : 'Rented'}</button>)}
                </div>
              </div>
              <RemoveRow onClick={() => setE({ rows: e.rows.filter((x) => x.id !== r.id) })} label="Remove equipment" />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              {r.ownership === 'rented' && <div style={{ flex: '1 1 160px' }}><Label>Rented from</Label><input disabled={!editable} value={r.supplier || ''} onChange={(ev) => setRow(r.id, { supplier: ev.target.value })} style={input} /></div>}
              <div style={{ flex: '1 1 160px' }}><Label>Operator</Label><input disabled={!editable} list="dr-operators" value={r.operator || ''} onChange={(ev) => setRow(r.id, { operator: ev.target.value })} style={input} /></div>
              <div style={{ flex: '0 1 100px' }}><Label>Hours used</Label><input type="number" min={0} max={24} step={0.5} disabled={!editable} value={r.hoursUsed ?? ''} onChange={(ev) => setRow(r.id, { hoursUsed: num(ev.target.value) })} style={input} /></div>
              <div style={{ flex: '0 1 100px' }}><Label>Hours idle</Label><input type="number" min={0} max={24} step={0.5} disabled={!editable} value={r.hoursIdle ?? ''} onChange={(ev) => setRow(r.id, { hoursIdle: num(ev.target.value) })} style={input} /></div>
            </div>
            <div><Label>Notes</Label><textarea disabled={!editable} value={r.notes || ''} onChange={(ev) => setRow(r.id, { notes: ev.target.value })} rows={2} placeholder="Breakdowns, fuel, service due…" style={area} /></div>
            <ConvertButton taskId={r.taskId} text={r.notes || ''} onConvert={(t) => convert(`Equipment${r.equipment ? ` — ${r.equipment}` : ''}`, t)} onDone={(id) => setRow(r.id, { taskId: id })} />
          </div>
        </Carry>
      ))}
      <AddRow onClick={() => setE({ rows: [...e.rows, { id: rowId() }] })}>+ Add equipment</AddRow>
      {e.rows.length > 0 && <div style={{ fontSize: 12.5, color: MUTED }}>Total: <b style={{ color: INK }}>{hrs.used} h used</b> · {hrs.idle} h idle</div>}
      <div><Label hint="A completed paper form, if there is one">Attached form</Label><Attachments files={e.files} onChange={(f) => setE({ files: f })} upload={upload} label="+ Attach equipment form" /></div>
      {!equipmentFormDone(e) && <MissingNote task={missingTask} />}
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
