import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import {
  PROGRAM_STEPS, PICKLISTS, money, num, stepFilled, stepTotals, withPrefill,
  type PSection, type PField, type ProgramData,
} from '../data/projectProgram';
import { PERSONALITY_TEMPLATE, templateKeyForPersonality, mergeTokens } from '../data/clientPersonality';

const BG = "'Bricolage Grotesque', serif";
const input: React.CSSProperties = {
  boxSizing: 'border-box', width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.13)', background: 'white', fontFamily: 'inherit',
  fontSize: 13, color: '#0B1A12', outline: 'none',
};

/**
 * The Project Program wizard — one step per sheet of the office's workbook.
 *
 * Answers are kept as one document per project and saved as a whole, so a step
 * half-filled is a normal state rather than a validation failure: this gets
 * built up over weeks as the research comes back.
 */
export interface LinkedTask { stepKey: string; id: string; title: string; done: boolean }

export function ProjectProgram({ projectId, projectName, defaultTo, initialStep, linkedTasks, onToggleTask, prefill, clientPersonality, clientName }: {
  projectId: number;
  projectName?: string;
  defaultTo?: string;
  /** A step to open at, when arriving from the Phase Board. */
  initialStep?: string | null;
  /** The Project Programming tasks this form answers. */
  linkedTasks?: LinkedTask[];
  /** What the project and its lead already know, laid under the answers. */
  prefill?: ProgramData;
  /** How this client communicates, from the intake -- picks the message tone. */
  clientPersonality?: string;
  clientName?: string;
  onToggleTask?: (id: string, done: boolean) => void;
}) {
  const { can, toast } = useApp();
  const canManage = can('projects', 'manage');
  const [data, setData] = useState<ProgramData>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [meta, setMeta] = useState<{ updatedAt: string; updatedBy: string; completedAt: string; sentAt?: string; sentTo?: string }>({ updatedAt: '', updatedBy: '', completedAt: '' });
  const [rendering, setRendering] = useState(false);
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [note, setNote] = useState('');
  const [tone, setTone] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const loadedFor = useRef<number | null>(null);

  useEffect(() => {
    if (loadedFor.current === projectId) return;
    loadedFor.current = projectId;
    setLoading(true);
    api.projectProgram.get(projectId)
      .then((res: any) => {
        // The prefill goes under what was saved, never over it.
        setData(withPrefill(res?.data || {}, prefill || {}));
        setMeta({ updatedAt: res?.updatedAt || '', updatedBy: res?.updatedBy || '', completedAt: res?.completedAt || '', sentAt: res?.sentAt || '', sentTo: res?.sentTo || '' });
        setDirty(false);
      })
      .catch(() => setData({}))
      .finally(() => setLoading(false));
    setTo(defaultTo || '');
    setSubject(`Project Program — ${projectName || ''}`.trim());
  }, [projectId]);

  useEffect(() => { api.emailTemplates.list().then((r: any) => { if (Array.isArray(r)) setTemplates(r); }).catch(() => { }); }, []);

  // The covering note is written in the tone the intake recorded for this
  // client. Only laid down while the note is untouched -- once someone has
  // written their own words, switching tone is their choice, not ours.
  const noteTouched = useRef(false);
  useEffect(() => {
    if (!templates.length) return;
    const key = tone || templateKeyForPersonality(clientPersonality);
    if (!tone) setTone(key);
    if (noteTouched.current) return;
    const tpl = templates.find((t: any) => t.key === key);
    if (!tpl) return;
    setNote(mergeTokens(tpl.body || '', {
      clientName: clientName || 'there',
      projectTitle: projectName || '',
      projectScope: String(data.title?.['main.projectScope'] || ''),
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      senderName: '',
    }).trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, tone, clientPersonality]);

  // The lead is fetched alongside the program, so it can land after it. Re-lay
  // the prefill when it arrives -- it never overwrites a stored answer, so
  // running it more than once is harmless. Keyed on the content, not the
  // object, which is rebuilt on every render.
  const prefillKey = JSON.stringify(prefill || {});
  useEffect(() => {
    if (loading || !prefill) return;
    setData((prev) => withPrefill(prev, prefill));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillKey, loading]);

  // Arriving from a phase card, open at the step that card produces.
  useEffect(() => {
    if (!initialStep) return;
    const i = PROGRAM_STEPS.findIndex((st) => st.key === initialStep);
    if (i >= 0) setStepIdx(i);
  }, [initialStep]);

  const step = PROGRAM_STEPS[stepIdx];
  const values = data[step.key] || {};

  const put = (key: string, value: any) => {
    setDirty(true);
    setData((prev) => ({ ...prev, [step.key]: { ...(prev[step.key] || {}), [key]: value } }));
  };
  const putCell = (rowKey: string, col: 'budget' | 'actual' | 'notes', value: string) => {
    setDirty(true);
    setData((prev) => {
      const bag = prev[step.key] || {};
      return { ...prev, [step.key]: { ...bag, [rowKey]: { ...(bag[rowKey] || {}), [col]: value } } };
    });
  };

  const save = async () => {
    if (!canManage) return;
    setSaving(true);
    try {
      const res: any = await api.projectProgram.save(projectId, data);
      setMeta({ updatedAt: res?.updatedAt || '', updatedBy: res?.updatedBy || '', completedAt: res?.completedAt || '', sentAt: res?.sentAt || '', sentTo: res?.sentTo || '' });
      setDirty(false);
      toast('Project Program saved');
    } catch (e: any) {
      toast('⚠ ' + (e.message || 'Could not save the program'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * The document the PDF is rendered from.
   *
   * Built here rather than on the server because the labels live with the form
   * definition -- sending the shape across keeps one copy of it, not two that
   * can drift.
   */
  const docPayload = () => ({
    projectId,
    projectName: projectName || `Project ${projectId}`,
    subtitle: String(data.title?.['main.projectTitle'] || '').trim() || undefined,
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    steps: PROGRAM_STEPS.map((st) => {
      const v = data[st.key] || {};
      const blocks = st.sections.map((sec) => {
        if (sec.kind === 'fields') {
          return { title: sec.title, kind: 'fields' as const, note: sec.note, rows: (sec.fields || []).map((fl) => ({ label: fl.label, value: String(v[`${sec.key}.${fl.key}`] ?? '') })) };
        }
        if (sec.kind === 'table') {
          return { title: sec.title, kind: 'table' as const, rows: (sec.rows || []).map((rw) => ({ label: rw.label, budget: String(v[rw.key]?.budget ?? ''), actual: String(v[rw.key]?.actual ?? ''), notes: String(v[rw.key]?.notes ?? '') })) };
        }
        if (sec.kind === 'weeks') {
          return { title: sec.title, kind: 'weeks' as const, rows: (sec.rows || []).map((rw) => ({ label: rw.label, value: String(v[rw.key] ?? '') })) };
        }
        const items = ((v[sec.key] || []) as string[]).filter((x) => String(x || '').trim());
        return { title: sec.title, kind: 'list' as const, rows: items.map((x) => ({ label: x, value: x })) };
      });
      const t = stepTotals(st, v);
      return { name: st.name, blurb: st.blurb, blocks, totals: st.totalOf ? { budget: money(t.budget), actual: money(t.actual) } : undefined };
    }),
  });

  const openPdf = async () => {
    setRendering(true);
    try {
      const blob = await api.projectProgram.pdf(docPayload());
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Give the new tab time to take the blob before it is revoked.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e: any) {
      toast('⚠ ' + (e.message || 'Could not render the PDF'));
    } finally {
      setRendering(false);
    }
  };

  const sendToClient = async () => {
    if (!to.trim()) { toast('⚠ Who should it go to?'); return; }
    setSending(true);
    try {
      const html = note.trim()
        ? note.trim().split(/\n{2,}/).map((para) => `<p>${para.replace(/\n/g, '<br/>')}</p>`).join('')
        : `<p>Please find the Project Program for ${projectName || 'your project'} attached.</p>`;
      const res: any = await api.projectProgram.send({ ...docPayload(), to: to.trim(), cc: cc.trim() || undefined, subject: subject.trim() || `Project Program — ${projectName || ''}`.trim(), html });
      setMeta((m) => ({ ...m, sentAt: new Date().toISOString(), sentTo: res?.to || to.trim() }));
      toast(`Sent to ${res?.to || to.trim()}`);
    } catch (e: any) {
      toast('⚠ ' + (e.message || 'Could not send it'));
    } finally {
      setSending(false);
    }
  };

  // Progress down the rail, so it is obvious what is still outstanding.
  const progress = useMemo(
    () => PROGRAM_STEPS.map((s) => stepFilled(s, data[s.key] || {})),
    [data],
  );
  const answered = progress.reduce((a, p) => a + p.done, 0);
  const questions = progress.reduce((a, p) => a + p.total, 0);

  const totals = stepTotals(step, values);
  const hasTotals = !!step.totalOf;

  if (loading) return <div style={{ padding: 28, fontSize: 12.5, color: '#7E9B93' }}>Loading the program…</div>;

  const label = (text: string, hint?: string) => (
    <div style={{ marginBottom: 5 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{text}</div>
      {hint && <div style={{ fontSize: 10.5, color: '#9AA39D', marginTop: 2 }}>{hint}</div>}
    </div>
  );

  const fieldInput = (section: PSection, fld: PField) => {
    const key = `${section.key}.${fld.key}`;
    const v = values[key] ?? '';
    const set = (x: string) => put(key, x);
    if (fld.kind === 'textarea') {
      return <textarea disabled={!canManage} value={v} onChange={(e) => set(e.target.value)} rows={3} style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} />;
    }
    if (fld.kind === 'select') {
      const opts = PICKLISTS[fld.options || ''] || [];
      return (
        <select disabled={!canManage} value={v} onChange={(e) => set(e.target.value)} style={input}>
          <option value="">Not set</option>
          {/* A value chosen before the list changed stays selectable. */}
          {v && !opts.includes(v) && <option value={v}>{v} (not in the current list)</option>}
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    const type = fld.kind === 'date' ? 'date' : fld.kind === 'number' ? 'number' : fld.kind === 'phone' ? 'tel' : 'text';
    return <input disabled={!canManage} type={type} value={v} onChange={(e) => set(e.target.value)} style={input} />;
  };

  const renderSection = (section: PSection) => (
    <div key={section.key} style={{ marginBottom: 22 }}>
      {section.title && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: BG, fontSize: 14, fontWeight: 700, color: '#0B1A12' }}>{section.title}</div>
          {section.note && <div style={{ fontSize: 11, color: '#9AA39D', marginTop: 3, lineHeight: 1.5 }}>{section.note}</div>}
        </div>
      )}

      {section.kind === 'fields' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          {(section.fields || []).map((fld) => (
            <div key={fld.key} style={fld.wide ? { gridColumn: '1 / -1' } : undefined}>
              {label(fld.label, fld.hint)}
              {fieldInput(section, fld)}
            </div>
          ))}
        </div>
      )}

      {section.kind === 'table' && (
        <div style={{ border: '1px solid rgba(20,8,31,0.08)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.4fr) 120px 120px minmax(140px, 1fr)', gap: 8, padding: '8px 12px', background: '#F7F9F7', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9AA39D' }}>
            <span>Description</span><span>Budget</span><span>Actual</span><span>Notes</span>
          </div>
          {(section.rows || []).map((row) => {
            const cell = values[row.key] || {};
            return (
              <div key={row.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.4fr) 120px 120px minmax(140px, 1fr)', gap: 8, alignItems: 'center', padding: '7px 12px', borderTop: '1px solid rgba(20,8,31,0.05)' }}>
                <span style={{ fontSize: 12.5, color: '#0B1A12' }}>{row.label}</span>
                <input disabled={!canManage} value={cell.budget ?? ''} onChange={(e) => putCell(row.key, 'budget', e.target.value)} placeholder="0" style={{ ...input, padding: '6px 8px' }} />
                <input disabled={!canManage} value={cell.actual ?? ''} onChange={(e) => putCell(row.key, 'actual', e.target.value)} placeholder="0" style={{ ...input, padding: '6px 8px' }} />
                <input disabled={!canManage} value={cell.notes ?? ''} onChange={(e) => putCell(row.key, 'notes', e.target.value)} style={{ ...input, padding: '6px 8px' }} />
              </div>
            );
          })}
        </div>
      )}

      {section.kind === 'weeks' && (
        <div style={{ border: '1px solid rgba(20,8,31,0.08)', borderRadius: 10, overflow: 'hidden' }}>
          {(section.rows || []).map((row) => (
            <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderTop: '1px solid rgba(20,8,31,0.05)' }}>
              <span style={{ flex: 1, fontSize: 12.5, color: '#0B1A12' }}>{row.label}</span>
              <input disabled={!canManage} type="number" min={0} value={values[row.key] ?? ''} onChange={(e) => put(row.key, e.target.value)} placeholder="0" style={{ ...input, width: 90, padding: '6px 8px' }} />
              <span style={{ fontSize: 11, color: '#9AA39D', width: 40 }}>weeks</span>
            </div>
          ))}
        </div>
      )}

      {section.kind === 'list' && (
        <ListRows
          items={(values[section.key] || []) as string[]}
          canManage={canManage}
          placeholder={section.placeholder || 'Add a line…'}
          onChange={(items) => put(section.key, items)}
        />
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
      {/* Step rail */}
      <div style={{ width: 214, flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9AA39D', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
          {answered} of {questions} answered
        </div>
        {PROGRAM_STEPS.map((s, i) => {
          const on = i === stepIdx;
          const p = progress[i];
          const complete = p.total > 0 && p.done === p.total;
          return (
            <div
              key={s.key}
              onClick={() => setStepIdx(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 9, cursor: 'pointer',
                background: on ? '#173326' : 'transparent', marginBottom: 2,
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: 999, flexShrink: 0, display: 'grid', placeItems: 'center',
                fontSize: 9.5, fontWeight: 700,
                background: complete ? '#D2EAD3' : on ? 'rgba(255,255,255,0.16)' : '#EFEDE8',
                color: complete ? '#1C5230' : on ? 'white' : '#7E9B93',
              }}>{complete ? '✓' : i + 1}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: on ? 700 : 600, color: on ? 'white' : '#43514D', lineHeight: 1.3 }}>{s.name}</span>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: on ? 'rgba(255,255,255,0.6)' : '#9AA39D' }}>{p.done}/{p.total}</span>
            </div>
          );
        })}
      </div>

      {/* Step body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9AA39D', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Step {stepIdx + 1} of {PROGRAM_STEPS.length}{projectName ? ` · ${projectName}` : ''}
            </div>
            <div style={{ fontFamily: BG, fontSize: 19, fontWeight: 700, color: '#0B1A12', marginTop: 3 }}>{step.name}</div>
            {step.blurb && <div style={{ fontSize: 12, color: '#7E9B93', marginTop: 4, lineHeight: 1.55, maxWidth: 620 }}>{step.blurb}</div>}
          </div>
          <div
            onClick={rendering ? undefined : openPdf}
            title="The whole program on the company letterhead, one section per page."
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: rendering ? 'default' : 'pointer', border: '1px solid rgba(20,8,31,0.12)', color: '#173326', background: 'white' }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1={12} y1={15} x2={12} y2={3} /></svg>
            {rendering ? 'Rendering…' : 'Download PDF'}
          </div>
          {canManage && (
            <div
              onClick={saving ? undefined : save}
              style={{ padding: '9px 18px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: saving ? 'default' : 'pointer', background: dirty ? '#173326' : 'white', color: dirty ? 'white' : '#7E9B93', border: '1px solid ' + (dirty ? '#173326' : 'rgba(20,8,31,0.12)') }}
            >
              {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
            </div>
          )}
        </div>

        {(linkedTasks || []).filter((lt) => lt.stepKey === step.key).map((lt) => (
          <div key={lt.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, background: lt.done ? '#EDF4EC' : '#FBF8F2', border: '1px solid ' + (lt.done ? 'rgba(28,82,48,0.16)' : 'rgba(20,8,31,0.07)'), marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={lt.done}
              disabled={!canManage || !onToggleTask}
              onChange={(e) => onToggleTask?.(lt.id, e.target.checked)}
              style={{ accentColor: '#173326' }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Project Programming</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0B1A12', marginTop: 1 }}>{lt.title}</div>
            </div>
            <span style={{ fontSize: 10.5, color: '#7E9B93' }}>
              {lt.done ? 'Done on the Phase Board' : 'Ticking this closes the card on the Phase Board'}
            </span>
          </div>
        ))}

        {step.sections.map(renderSection)}

        {hasTotals && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '14px 16px', background: '#F7F9F7', borderRadius: 11, marginBottom: 18 }}>
            <div style={{ flex: 1, minWidth: 130 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#9AA39D', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Budget subtotal</div>
              <div style={{ fontFamily: BG, fontSize: 20, fontWeight: 700, color: '#0B1A12' }}>{money(totals.budget)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#9AA39D', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Actual to date</div>
              <div style={{ fontFamily: BG, fontSize: 20, fontWeight: 700, color: '#0B1A12' }}>{money(totals.actual)}</div>
            </div>
            {step.key === 'budget' && (
              <div style={{ flex: 1, minWidth: 130 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: '#9AA39D', textTransform: 'uppercase', letterSpacing: '0.07em' }}>With contingency</div>
                <div style={{ fontFamily: BG, fontSize: 20, fontWeight: 700, color: '#173326' }}>
                  {money(totals.budget + num(values['titleInsurance']?.budget) + num(values['contingency']?.budget))}
                </div>
              </div>
            )}
          </div>
        )}

        {stepIdx === PROGRAM_STEPS.length - 1 && canManage && (
          <div style={{ border: '1px solid rgba(20,8,31,0.09)', borderRadius: 12, padding: '16px 18px', marginBottom: 18, background: '#FBFDFA' }}>
            <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: '#0B1A12' }}>Send to the client</div>
            <div style={{ fontSize: 11.5, color: '#7E9B93', marginTop: 3, marginBottom: 12, lineHeight: 1.55 }}>
              Emails the program from the connected Google Workspace account, with the letterhead PDF attached.
              {meta.sentAt ? ` Last sent ${new Date(meta.sentAt).toLocaleString()}${meta.sentTo ? ` to ${meta.sentTo}` : ''}.` : ''}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
              <div>
                {label('To')}
                <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.com" style={input} />
              </div>
              <div>
                {label('CC', 'Optional')}
                <input value={cc} onChange={(e) => setCc(e.target.value)} style={input} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                {label('Subject')}
                <input value={subject} onChange={(e) => setSubject(e.target.value)} style={input} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                {label('Tone', clientPersonality
                  ? `From the intake: this client is ${clientPersonality}.`
                  : 'No client personality recorded on the lead, so the standard wording is used.')}
                <select
                  value={tone}
                  onChange={(e) => { noteTouched.current = false; setTone(e.target.value); }}
                  style={input}
                >
                  {Object.entries(PERSONALITY_TEMPLATE).map(([person, key]) => (
                    <option key={key} value={key}>{person}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                {label('Message', 'Written in the tone above. Edit freely — switching tone will not overwrite your words.')}
                <textarea
                  value={note}
                  onChange={(e) => { noteTouched.current = true; setNote(e.target.value); }}
                  rows={12}
                  style={{ ...input, resize: 'vertical', lineHeight: 1.55 }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div
                onClick={sending ? undefined : sendToClient}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: sending ? 'default' : 'pointer', background: sending ? '#9AB0A4' : '#173326', color: 'white' }}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1={22} y1={2} x2={11} y2={13} /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                {sending ? 'Sending…' : meta.sentAt ? 'Re-send' : 'Send'}
              </div>
              <div onClick={rendering ? undefined : openPdf} style={{ padding: '10px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.14)', color: '#173326' }}>
                {rendering ? 'Rendering…' : 'Preview the PDF first'}
              </div>
              {dirty && <span style={{ fontSize: 11, color: '#8E2E0A', fontWeight: 600 }}>Unsaved edits are included in the PDF but not yet stored — Save first.</span>}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderTop: '1px solid rgba(20,8,31,0.07)', paddingTop: 14 }}>
          <div
            onClick={stepIdx === 0 ? undefined : () => setStepIdx(stepIdx - 1)}
            style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: stepIdx === 0 ? 'default' : 'pointer', border: '1px solid rgba(20,8,31,0.12)', color: stepIdx === 0 ? '#C9CDC9' : '#173326', background: 'white' }}
          >Back</div>
          <div
            onClick={stepIdx === PROGRAM_STEPS.length - 1 ? undefined : () => setStepIdx(stepIdx + 1)}
            style={{ padding: '9px 18px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: stepIdx === PROGRAM_STEPS.length - 1 ? 'default' : 'pointer', background: stepIdx === PROGRAM_STEPS.length - 1 ? '#EFEDE8' : '#173326', color: stepIdx === PROGRAM_STEPS.length - 1 ? '#9AA39D' : 'white' }}
          >Next</div>
          <div style={{ marginLeft: 'auto', fontSize: 10.5, color: '#9AA39D' }}>
            {meta.updatedAt ? `Last saved ${new Date(meta.updatedAt).toLocaleString()}${meta.updatedBy ? ` by ${meta.updatedBy}` : ''}` : 'Not saved yet'}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The free-text lists the workbook marks with asterisks. */
function ListRows({ items, canManage, placeholder, onChange }: {
  items: string[]; canManage: boolean; placeholder: string; onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([...items, t]);
    setDraft('');
  };
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#FBF8F2', borderRadius: 8 }}>
            <span style={{ color: '#9AA39D', fontSize: 11 }}>{i + 1}</span>
            <input
              disabled={!canManage}
              value={it}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              style={{ ...input, border: 'none', background: 'transparent', padding: 0, flex: 1 }}
            />
            {canManage && <span onClick={() => onChange(items.filter((_, j) => j !== i))} style={{ cursor: 'pointer', color: '#8E2E0A', fontSize: 13 }}>×</span>}
          </div>
        ))}
        {!items.length && <div style={{ fontSize: 11.5, color: '#9AA39D', padding: '4px 0' }}>Nothing added yet.</div>}
      </div>
      {canManage && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder={placeholder} style={{ ...input, flex: 1 }} />
          <div onClick={add} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white', whiteSpace: 'nowrap' }}>Add</div>
        </div>
      )}
    </div>
  );
}
