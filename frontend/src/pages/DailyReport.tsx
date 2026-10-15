import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { MapLink } from '../components/ContactLinks';
import { api } from '../api';
import { useApp } from '../AppContext';
import { useAutosave } from '../autosave';
import {
  carriedCount, emptySections, isCarried, normalizeSections, sameValue, templateOf, type FileRef, type Sections,
} from '../data/dailyReport';
import { ACCENT, BG, INK, LINE, MUTED, ReportCtx, SectionCard, input, pill, Label, Carry } from '../components/dailyReport/ReportBits';
import { CrewSheet, type Code, type Emp, type Entry } from '../components/dailyReport/CrewSheet';
import { ActivitySection, FormSection, InspectorsSection, NotesSection, SubsSection, VisitorsSection, YesNoSection } from '../components/dailyReport/ReportSections';
import { SignaturePad } from '../components/dailyReport/SignaturePad';

// ------------------------------------------------------------------ shapes

interface Report {
  notes: string;
  entries: Entry[];
  sections: Sections;
  behalf: boolean;
  onBehalfOf: string;
  certifiedName: string;
  signatureDataUrl: string;
}
interface Log {
  id: string | null; status: string; version?: number; createdAt?: string; supervisorName?: string; rejectionNote?: string; signedAt?: string;
  autoReason?: string | null; dupFromDate?: string | null; dupBaseline?: { sections?: unknown; entries?: Entry[] } | null; sections?: unknown;
}
interface Version { id: string; version: number; status: string; autoReason?: string | null; supervisorName?: string }
interface Assign { employeeId: string; projectId: number; startDate: string; endDate?: string; status?: string }
interface Summary {
  percentInvoiced: number | null; percentDuration: number | null; scheduleEnd: string | null; changeOrderDays: number;
  tasks: Record<string, number>; rfis: Record<string, number>; changeOrders: Record<string, number>;
}
interface Template { id: string; name: string; createdByName?: string; createdById?: string; sections?: unknown; entries?: Entry[] }

const LEFT = ['resigned', 'terminated', 'contract_expired', 'demobilized'];
const PROJECT_KEY = 'origami.fieldProject';
const ROLLUP = ['To Do', 'Assigned', 'In Progress', 'On Hold', 'Complete', 'Confirmed'];
const CO_LABEL: Record<string, string> = { draft: 'Draft', internal_review: 'Internal review', submitted: 'With client', approved: 'Approved', rejected: 'Rejected', void: 'Void' };

const localISO = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const shift = (iso: string, days: number) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + days); return localISO(d); };
const niceDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const stamp = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
const toEntry = (e: any): Entry => ({ employeeId: e.employeeId, csiCodeId: e.csiCodeId || '', hours: e.hours ?? undefined, taskDetail: e.taskDetail || '', taskStatus: e.taskStatus || 'continued', team: e.team || '' });

function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: 'var(--surface)', border: '1px solid ' + LINE, borderRadius: 'var(--r-14)', ...style }}>{children}</div>;
}

function Stat({ code, label, value, hint }: { code: string; label: string; value: ReactNode; hint?: string }) {
  return (
    <div style={{ padding: '12px 14px', background: 'var(--panel)', borderRadius: 12, minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>{code} · {label}</div>
      <div style={{ fontFamily: BG, fontSize: 24, color: INK, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {hint && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function Counts({ code, label, counts, order, labels }: { code: string; label: string; counts: Record<string, number>; order?: string[]; labels?: Record<string, string> }) {
  const keys = order || Object.keys(counts);
  const total = keys.reduce((n, k) => n + (counts[k] || 0), 0);
  return (
    <div style={{ padding: '12px 14px', background: 'var(--panel)', borderRadius: 12, minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>{code} · {label} <span style={{ color: INK }}>{total}</span></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {keys.length ? keys.map((k) => (
          <span key={k} style={{ fontSize: 12, padding: '3px 9px', borderRadius: 999, background: 'var(--surface)', border: '1px solid ' + LINE, color: counts[k] ? INK : MUTED }}>
            {labels?.[k] || k} <b style={{ fontVariantNumeric: 'tabular-nums' }}>{counts[k] || 0}</b>
          </span>
        )) : <span style={{ fontSize: 12, color: MUTED }}>None yet</span>}
      </div>
    </div>
  );
}

function Modal({ children, onClose, width = 480 }: { children: ReactNode; onClose: () => void; width?: number }) {
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 160, background: 'rgba(29, 29, 27, 0.4)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" style={{ width: `min(${width}px, 100%)`, maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box', background: 'var(--surface)', borderRadius: 18, padding: 22, display: 'grid', gap: 14, boxShadow: '0 24px 60px rgba(var(--rgb-ink), .25)', color: INK }}>{children}</div>
    </div>,
    document.body,
  );
}

// ------------------------------------------------------------------ the page

/**
 * The Daily Report: ten sections from General information to Certification.
 * A day starts blank, from a saved template, or as a copy of the previous
 * report (copied values show yellow until they're changed). A second report
 * for the same day is kept as an update, with tabs between the versions.
 * Drafts save by themselves; Submit sends it for approval.
 */
export function DailyReport() {
  const { authUser, toast } = useApp();
  const canFile = !!authUser?.isSuperintendent || authUser?.roleKey === 'admin';
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState<{ id: number; name: string; location?: string }[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);
  const [assignments, setAssignments] = useState<Assign[]>([]);
  const [contractors, setContractors] = useState<{ id: string; companyName: string }[]>([]);
  const [consultants, setConsultants] = useState<{ id: string | number; name: string; company?: string }[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const [projectId, setProjectId] = useState<number | ''>(() => { const p = Number(params.get('project')); if (p) return p; try { return Number(localStorage.getItem(PROJECT_KEY)) || ''; } catch { return ''; } });
  const [date, setDate] = useState(() => (/^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date')! : localISO()));
  const [reportId, setReportId] = useState<string | null>(params.get('report'));
  const [log, setLog] = useState<Log | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [saved, setSaved] = useState<Report | null>(null);
  const [draft, setDraft] = useState<Report>({ notes: '', entries: [], sections: emptySections(), behalf: false, onBehalfOf: '', certifiedName: '', signatureDataUrl: '' });
  const [loadKey, setLoadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [starting, setStarting] = useState<null | { update: boolean }>(null);
  const [dateClash, setDateClash] = useState<string | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
  const [tplName, setTplName] = useState('');
  const logIdRef = useRef<string | null>(null);

  // ---- reference lists
  useEffect(() => {
    api.projects.list().then((r: any) => {
      const real = (Array.isArray(r) ? r : []).filter((p: any) => p.stage !== 'Kickoff').map((p: any) => ({ id: p.id, name: p.name, location: p.location }));
      setProjects(real);
      setProjectId((cur) => (cur && real.some((p: any) => p.id === cur) ? cur : real[0]?.id ?? ''));
    }).catch(() => { });
    api.employees.list().then((r: any) => setEmployees((Array.isArray(r) ? r : []).filter((e: Emp) => !LEFT.includes(e.employmentStatus || '') && e.status !== 'inactive'))).catch(() => { });
    api.csiCodes.list().then((r: any) => setCodes((Array.isArray(r) ? r : []).filter((c: Code) => c.active))).catch(() => { });
    api.contractors.list().then((r: any) => setContractors((Array.isArray(r) ? r : []).map((c: any) => ({ id: c.id, companyName: c.companyName || c.name })).sort((a: any, b: any) => a.companyName.localeCompare(b.companyName)))).catch(() => { });
    api.people.list().then((r: any) => setConsultants((Array.isArray(r) ? r : []).filter((p: any) => p.kind === 'Consultant').map((p: any) => ({ id: p.id, name: p.name, company: p.company })))).catch(() => { });
    api.dailyLogs.templates().then((r: any) => setTemplates(Array.isArray(r) ? r : [])).catch(() => { });
  }, []);
  useEffect(() => {
    if (!projectId) { setAssignments([]); setSummary(null); return; }
    api.assignments.list({ projectId: Number(projectId) }).then((r: any) => setAssignments(Array.isArray(r) ? r : [])).catch(() => setAssignments([]));
  }, [projectId]);
  useEffect(() => {
    if (!projectId) return;
    api.dailyLogs.summary(Number(projectId), date).then((r: any) => setSummary(r)).catch(() => setSummary(null));
  }, [projectId, date]);

  // ---- the report for the project + day (+ version)
  const load = (id?: string | null) => {
    if (!projectId) return;
    try { localStorage.setItem(PROJECT_KEY, String(projectId)); } catch { /* private window */ }
    setLoading(true);
    api.dailyLogs.day(Number(projectId), date, id || undefined).then((r: any) => {
      const l: Log = r.log || { id: null, status: 'draft' };
      const rep: Report = {
        notes: r.log?.notes || '',
        entries: (r.entries || []).map(toEntry),
        sections: normalizeSections(r.log?.sections),
        behalf: !!r.log?.onBehalfOf,
        onBehalfOf: r.log?.onBehalfOf || '',
        certifiedName: r.log?.certifiedName || '',
        signatureDataUrl: r.log?.signatureDataUrl || '',
      };
      // Reports from before the sections existed: work happened if anyone is on the timesheet.
      if (l.id && !r.log?.sections && rep.entries.length) { rep.sections.activity.worked = 'yes'; rep.sections.crew = 'yes'; }
      setLog(l);
      setVersions(Array.isArray(r.versions) ? r.versions : []);
      logIdRef.current = l.id;
      setReportId(l.id);
      setSaved(rep);
      setDraft(rep);
      setLoadKey((n) => n + 1);
    }).catch((e: Error) => toast('⚠ ' + e.message)).finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(reportId); }, [projectId, date]);
  // Keep the address bar in step, so a report can be linked to.
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (projectId) next.set('project', String(projectId)); else next.delete('project');
    next.set('date', date);
    if (reportId && versions.length > 1) next.set('report', reportId); else next.delete('report');
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [projectId, date, reportId, versions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const exists = !!log?.id;
  const locked = exists && ((log!.status !== 'draft' && log!.status !== 'rejected') || !!log!.autoReason);
  const editable = canFile && exists && !locked && !loading;

  // ---- autosave: the whole report, 3 seconds after the last change
  const auto = useAutosave<Report>({
    draft, saved, resetKey: `report-${projectId}-${date}-${loadKey}`, enabled: editable, label: 'daily report',
    save: async (_c, { draft: d }) => {
      const r: any = await api.dailyLogs.save({
        id: logIdRef.current || undefined, projectId: Number(projectId), date,
        notes: d.notes, entries: d.sections.crew === 'no' ? [] : d.entries.filter((e) => e.employeeId),
        sections: d.sections as unknown as Record<string, unknown>,
        onBehalfOf: d.behalf ? d.onBehalfOf : '', certifiedName: d.certifiedName, signatureDataUrl: d.signatureDataUrl,
      });
      if (r?.log) setLog((cur) => ({ ...(cur || {}), ...r.log }));
      return { ...d };
    },
  });

  // ---- highlighting what was copied from the previous report
  const baseline = useMemo(() => (log?.dupBaseline?.sections ? normalizeSections(log.dupBaseline.sections) : null), [log?.dupBaseline]);
  const baseEntries = log?.dupBaseline?.entries || [];
  const carried = (path: string) => !locked && isCarried(baseline, draft.sections, path);
  const crewCarried = (e: Entry) => !locked && baseEntries.some((b) => b.employeeId === e.employeeId && sameValue(toEntry(b), e));
  const stillCarried = locked ? 0 : carriedCount(baseline, draft.sections) + draft.entries.filter(crewCarried).length;

  // ---- workers on this project for the day (Manpower -> Deployment)
  const onSite = useMemo(() => {
    const d10 = (v?: string) => (v || '').slice(0, 10);
    const m = new Map<string, string>();
    for (const a of assignments) {
      if (a.projectId !== projectId) continue;
      const start = d10(a.startDate), end = d10(a.endDate);
      if (end && end < date) continue;
      if (a.status === 'ended' && !end) continue;
      if (!start || start <= date) m.set(a.employeeId, '');
      else if (a.status !== 'ended' && !m.has(a.employeeId)) m.set(a.employeeId, 'starts ' + new Date(start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    return m;
  }, [assignments, projectId, date]);

  const setSections = (fn: (s: Sections) => Sections) => setDraft((d) => ({ ...d, sections: fn(d.sections) }));
  const setEntries = (fn: (e: Entry[]) => Entry[]) => setDraft((d) => ({ ...d, entries: fn(d.entries) }));
  const s = draft.sections;
  const noWork = s.activity.worked === 'no';

  // ---- Convert to task: a To Do on the project's task board, linked back to this report
  const firstSection = useRef<{ project: number; id: string | null } | null>(null);
  const convert = async (title: string, details: string): Promise<string | null> => {
    if (!projectId) return null;
    try {
      if (firstSection.current?.project !== projectId) {
        const secs: any = await api.projectSections.list(Number(projectId)).catch(() => []);
        const first = (Array.isArray(secs) ? secs : []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))[0];
        firstSection.current = { project: Number(projectId), id: first?.id || null };
      }
      const t: any = await api.projectTasks.create({
        projectId: Number(projectId), sectionId: firstSection.current.id || undefined, title: title.slice(0, 120),
        description: `${details}\n\nFrom the daily report for ${niceDate(date)}.`, status: 'Not started',
      });
      toast('Added to the project’s To Do list');
      return t?.id || null;
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Could not create the task')); return null; }
  };
  const ownTask = (title: string) => (projectId ? api.projectTasks.create({
    projectId: Number(projectId), sectionId: firstSection.current?.id || undefined, title, status: 'Not started',
    assigneeId: authUser?.id, assignee: authUser?.name, dueDate: shift(localISO(), 1), description: `From the daily report for ${niceDate(date)}.`,
  }).catch(() => null) : Promise.resolve(null));

  // ---- uploads (inspection cards, transmittals, equipment forms) into the File Room
  const upload = async (files: File[]): Promise<FileRef[]> => {
    if (!projectId) return [];
    try {
      const saved: any = await api.fileRoom.upload(Number(projectId), ['Daily Reports', date], files);
      return (Array.isArray(saved) ? saved : []).map((f: any) => ({ id: f.id, name: f.name }));
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Upload failed')); return []; }
  };

  // ---- starting a report
  const create = async (from: { sections?: Sections; entries?: Entry[]; baseline?: { sections: Sections; entries: Entry[] }; fromDate?: string }, update: boolean) => {
    if (!projectId) return;
    setBusy('start');
    try {
      const r: any = await api.dailyLogs.save({
        projectId: Number(projectId), date, newVersion: update,
        sections: (from.sections || emptySections()) as unknown as Record<string, unknown>,
        entries: from.entries || [],
        dupBaseline: from.baseline ? (from.baseline as unknown as Record<string, unknown>) : null,
        dupFromDate: from.fromDate || '',
      });
      setStarting(null);
      load(r?.log?.id);
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Could not start the report')); }
    finally { setBusy(''); }
  };
  const duplicate = async (update: boolean) => {
    if (!projectId) return;
    setBusy('dup');
    try {
      const all: any = await api.dailyLogs.list({ projectId: Number(projectId) });
      const prev = (Array.isArray(all) ? all : [])
        .filter((l: any) => l.date < date && l.status !== 'superseded' && !l.autoReason)
        .sort((a: any, b: any) => (b.date.localeCompare(a.date)) || ((b.version || 1) - (a.version || 1)))[0];
      if (!prev) { toast('There’s no earlier report on this project to copy'); return; }
      const r: any = await api.dailyLogs.day(Number(projectId), prev.date, prev.id);
      // Sections I and X start fresh; everything else comes across to be checked and changed.
      const sections = normalizeSections(r.log?.sections);
      const entries = (r.entries || []).map(toEntry);
      if (!r.log?.sections && entries.length) { sections.activity.worked = 'yes'; sections.crew = 'yes'; }
      await create({ sections, entries, baseline: { sections, entries }, fromDate: prev.date }, update);
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Could not copy the previous report')); }
    finally { setBusy(''); }
  };

  // ---- I.B: moving a draft to another day
  const moveTo = async (to: string, asUpdate = false) => {
    if (!to || to === date) return;
    if (!exists || !logIdRef.current) { setReportId(null); setDate(to); return; }
    setBusy('move');
    try {
      await auto.saveNow();
      const r: any = await api.dailyLogs.save({ id: logIdRef.current, projectId: Number(projectId), date: to, newVersion: asUpdate });
      setDateClash(null);
      setReportId(r?.log?.id || null);
      setDate(to);
      toast(asUpdate ? `Moved to ${niceDate(to)} as an updated report` : `Moved to ${niceDate(to)}`);
    } catch (e: any) {
      if (e?.status === 409) setDateClash(to);
      else toast('⚠ ' + (e.message || 'Could not change the date'));
    } finally { setBusy(''); }
  };

  // ---- save draft / template / submit
  const saveDraft = async () => { if (await auto.saveNow()) toast('Draft saved — submit it whenever it’s ready'); };
  const saveTemplate = async () => {
    const name = tplName.trim();
    if (!name) return;
    try {
      const t: any = await api.dailyLogs.saveTemplate({ name, sections: templateOf(draft.sections) as unknown as Record<string, unknown>, entries: draft.entries });
      setTemplates((cur) => [...cur.filter((x) => x.id !== t.id), t].sort((a, b) => a.name.localeCompare(b.name)));
      setTplOpen(false); setTplName('');
      toast(`Saved as template “${name}”`);
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Could not save the template')); }
  };
  const missing = (): string | null => {
    if (!s.activity.worked) return 'Answer “Did work occur today?” in Section II';
    if (noWork && !s.activity.reason) return 'Say why no work happened (Section II)';
    if (noWork && s.activity.reason === 'stop' && (!s.activity.stop.by || !s.activity.stop.asOf || (!s.activity.stop.end && !s.activity.stop.endUnknown))) return 'Fill in the stop order: who, as of when, and the end date (or “unknown”)';
    if (noWork && s.activity.reason === 'holiday' && (!s.activity.holiday.start || !s.activity.holiday.end)) return 'Give the holiday’s start and end dates';
    if (!noWork && s.crew === 'yes') {
      if (!draft.entries.length) return 'Put at least one person on the timesheet (Section III), or answer No';
      const noCode = draft.entries.filter((e) => !e.csiCodeId).length;
      if (noCode) return `${noCode} ${noCode === 1 ? 'row has' : 'rows have'} no cost code yet (Section III)`;
    }
    if (draft.behalf && !draft.onBehalfOf.trim()) return 'Type the name of the person completing the form (I.E)';
    if (!draft.certifiedName.trim() || !draft.signatureDataUrl) return 'Type your name and sign (Section X)';
    return null;
  };
  const submit = async () => {
    const why = missing();
    if (why) { toast('⚠ ' + why); return; }
    setBusy('submit');
    try {
      const ok = await auto.saveNow();
      if (!ok || !logIdRef.current) throw new Error(auto.error || 'Could not save the report');
      const r: any = await api.dailyLogs.submit(logIdRef.current);
      // What still needs doing becomes a task for whoever filed the report.
      if (!noWork) {
        const day = niceDate(date);
        const jobs: Promise<unknown>[] = [];
        if (s.activity.photos === 'no') jobs.push(ownTask(`Upload job photos for ${day}`));
        if (s.deliveries.present === 'yes' && s.deliveries.transmittal === 'no') jobs.push(ownTask(`Upload Transmittal for deliveries on ${day}`));
        if (s.equipment.used === 'yes' && s.equipment.form === 'no') jobs.push(ownTask(`Upload Equipment Utilization form for ${day}`));
        await Promise.all(jobs);
      }
      setLog((cur) => ({ ...(cur || {}), ...r }));
      toast(r?.projectHeld ? `Submitted — ${projects.find((p) => p.id === projectId)?.name || 'the project'} is now on HOLD${r?.autoReportsMade ? `, and ${r.autoReportsMade} stop day${r.autoReportsMade === 1 ? '' : 's'} got a report` : ''}`
        : r?.autoReportsMade ? `Submitted — ${r.autoReportsMade} holiday day${r.autoReportsMade === 1 ? '' : 's'} got a report`
        : draft.behalf ? 'Submitted — the office gets a copy, and so do you for your records' : 'Submitted — the office gets a PDF + Excel copy by email');
      load(logIdRef.current);
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not submit')); }
    finally { setBusy(''); }
  };

  // ---------------------------------------------------------------- render

  if (!canFile) {
    return (
      <Card style={{ maxWidth: 480, padding: 22, display: 'grid', gap: 10 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 20, color: INK }}>This is the superintendent’s daily report</div>
        <div style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.6 }}>
          It’s for whoever runs the site — the Site Superintendent role, or an employee whose designation is Superintendent.
          To read or approve daily reports, use <b style={{ color: INK }}>Daily Reports</b> or <b style={{ color: INK }}>Manpower → Approvals</b>.
        </div>
        <Link to="/daily_reports" style={{ justifySelf: 'start', padding: '9px 18px', borderRadius: 999, background: ACCENT, color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Open Daily Reports</Link>
      </Card>
    );
  }

  const project = projects.find((p) => p.id === projectId);
  const statusTone: Record<string, [string, string, string]> = {
    draft: ['var(--c-efede8)', 'var(--c-5c6b65)', 'Draft — not submitted yet'], submitted: ['var(--c-fbf0cc)', 'var(--c-8a6d12)', 'Submitted — waiting for approval'],
    approved: ['var(--c-d2ead3)', 'var(--c-1e6b36)', 'Approved'], rejected: ['#F2DFD4', '#8E2E0A', 'Sent back — fix and submit again'],
    superseded: ['var(--c-efede8)', 'var(--c-5c6b65)', 'Replaced by a later update'],
  };
  const st = statusTone[log?.status || 'draft'] || statusTone.draft;
  const filer = log?.supervisorName || authUser?.name || '';
  const prevChoice = (update: boolean) => (
    <div style={{ display: 'grid', gap: 10 }}>
      <button type="button" disabled={!!busy} onClick={() => create({}, update)} style={{ ...choice, opacity: busy ? 0.6 : 1 }}>
        <b>Create new daily report</b><span>Start from a blank report.</span>
      </button>
      <button type="button" disabled={!!busy} onClick={() => duplicate(update)} style={{ ...choice, opacity: busy ? 0.6 : 1 }}>
        <b>{busy === 'dup' ? 'Copying…' : 'Duplicate from previous day'}</b>
        <span>Copies everything except Sections I and X. What you don’t change stays highlighted yellow, so it’s easy to see what’s new.</span>
      </button>
      {templates.length > 0 && (
        <div style={{ ...choice, cursor: 'default' }}>
          <b>Start from a template</b>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {templates.map((t) => (
              <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <button type="button" disabled={!!busy} onClick={() => create({ sections: normalizeSections(t.sections), entries: (t.entries || []).map(toEntry) }, update)} style={{ ...pill(false), padding: '5px 12px', fontSize: 12 }}>{t.name}</button>
                {(t.createdById === authUser?.id || authUser?.roleKey === 'admin') && (
                  <button type="button" aria-label={`Delete template ${t.name}`} title="Delete template" onClick={async () => {
                    if (!confirm(`Delete the template “${t.name}”?`)) return;
                    try { await api.dailyLogs.removeTemplate(t.id); setTemplates((cur) => cur.filter((x) => x.id !== t.id)); } catch (e) { toast('⚠ ' + (e as Error).message); }
                  }} style={{ border: 0, background: 'none', color: MUTED, cursor: 'pointer', fontSize: 14 }}>×</button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ReportCtx.Provider value={{ editable, carried }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14, paddingBottom: 96, animation: 'fadeIn 0.3s ease' }}>
        {/* I.A project + I.B day */}
        <Card style={{ padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', minWidth: 0, display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>I.A · Project</span>
            <select value={projectId} onChange={(e) => { setReportId(null); setProjectId(e.target.value ? Number(e.target.value) : ''); }} style={{ ...input, height: 40, fontSize: 14, fontWeight: 700 }}>
              {!projectId && <option value="">Choose a project…</option>}
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {project?.location && <div style={{ fontSize: 12, color: MUTED }}><MapLink address={project.location} iconSize={12}>{project.location} · Directions</MapLink></div>}
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>I.B · Report date</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button type="button" onClick={() => { setReportId(null); setDate(shift(date, -1)); }} style={{ ...pill(false), padding: '8px 12px' }} aria-label="Previous day">‹</button>
              <label style={{ position: 'relative', ...pill(true), padding: '8px 16px', minWidth: 170, textAlign: 'center' }}>
                {date === localISO() ? `Today · ${niceDate(date)}` : niceDate(date)}
                <input type="date" value={date} max={localISO()} onChange={(e) => e.target.value && (editable ? moveTo(e.target.value) : (setReportId(null), setDate(e.target.value)))}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} aria-label={editable ? 'Change this report’s date' : 'Pick a date'} />
              </label>
              <button type="button" onClick={() => { if (date < localISO()) { setReportId(null); setDate(shift(date, 1)); } }} style={{ ...pill(false), padding: '8px 12px', opacity: date < localISO() ? 1 : 0.4 }} aria-label="Next day">›</button>
              {date !== localISO() && <button type="button" onClick={() => { setReportId(null); setDate(localISO()); }} style={pill(false)}>Today</button>}
            </div>
          </div>
        </Card>

        {loading ? <div style={{ fontSize: 13, color: MUTED, padding: 20 }}>Loading…</div> : !projectId ? null : !exists ? (
          <Card style={{ padding: 22, display: 'grid', gap: 14, maxWidth: 640 }}>
            <div>
              <div style={{ fontFamily: BG, fontSize: 22, color: INK }}>Daily report for {niceDate(date)}</div>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{project?.name}. How would you like to start?</div>
            </div>
            {prevChoice(false)}
          </Card>
        ) : (
          <>
            {/* versions + status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {versions.length > 1 && (
                <div role="tablist" style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 999, background: 'var(--panel)' }}>
                  {versions.map((v) => (
                    <button key={v.id} type="button" role="tab" aria-selected={v.id === log?.id} onClick={() => { setReportId(v.id); load(v.id); }}
                      style={{ ...pill(v.id === log?.id), border: 0, padding: '6px 14px' }}>
                      {v.version === 1 ? 'Original' : `Update ${v.version - 1}`}{v.autoReason ? ' · auto' : ''}
                    </button>
                  ))}
                </div>
              )}
              <span style={{ padding: '6px 12px', borderRadius: 999, background: st[0], color: st[1], fontSize: 12.5, fontWeight: 700 }}>{st[2]}</span>
              {log?.autoReason && <span style={{ padding: '6px 12px', borderRadius: 999, background: 'var(--panel)', fontSize: 12.5, fontWeight: 700, color: 'var(--body)' }}>Made automatically — {log.autoReason === 'stop' ? 'stop order' : 'holiday'}</span>}
              <div style={{ flex: 1 }} />
              <button type="button" onClick={() => setStarting({ update: true })} style={pill(false)}>+ Add an updated report for this day</button>
            </div>
            {log?.status === 'rejected' && log.rejectionNote && <div style={{ fontSize: 13, color: '#8E2E0A', background: '#F2DFD4', borderRadius: 'var(--r-12)', padding: 12 }}>Sent back: {log.rejectionNote}</div>}
            {!locked && baseline && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: 'rgba(245, 196, 67, 0.16)', border: '1px solid rgba(245, 196, 67, 0.6)', fontSize: 13, color: INK }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: 'rgba(245, 196, 67, 0.55)', flexShrink: 0 }} />
                <span>Copied from <b>{log?.dupFromDate ? niceDate(log.dupFromDate) : 'the previous report'}</b>. Yellow = carried over and not changed yet{stillCarried ? ` (${stillCarried} left)` : ' — everything has been reviewed'}.</span>
              </div>
            )}

            {/* I. General information */}
            <SectionCard roman="I" title="General information" summary={`${project?.name || ''} · ${niceDate(date)} · ${filer}`}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
                <div><Label code="I.C">Report created</Label><div style={{ fontSize: 13.5, color: INK }}>{stamp(log?.createdAt)}</div></div>
                <div><Label code="I.D">Submitted by</Label><div style={{ fontSize: 13.5, color: INK }}>{filer}</div></div>
                <div>
                  <Label code="I.E">Completing this form on behalf of {filer}?</Label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: INK }}>
                    <input type="checkbox" disabled={!editable} checked={draft.behalf} onChange={(e) => setDraft((d) => ({ ...d, behalf: e.target.checked }))} />Yes, I’m filling it in for them
                  </label>
                  {draft.behalf && <input disabled={!editable} value={draft.onBehalfOf} onChange={(e) => setDraft((d) => ({ ...d, onBehalfOf: e.target.value, certifiedName: e.target.value }))} placeholder="Your name" style={{ ...input, marginTop: 6 }} />}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                <Stat code="I.F" label="Percent invoiced" value={summary?.percentInvoiced != null ? `${summary.percentInvoiced}%` : '—'} hint="Of the contract incl. approved change orders" />
                <Stat code="I.G" label="Duration complete" value={summary?.percentDuration != null ? `${summary.percentDuration}%` : '—'}
                  hint={summary?.scheduleEnd ? `To ${niceDate(summary.scheduleEnd)}${summary.changeOrderDays ? ` (+${summary.changeOrderDays} days from change orders)` : ''}` : 'No schedule dates yet'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                <Counts code="I.H" label="Tasks" counts={summary?.tasks || {}} order={ROLLUP} />
                <Counts code="I.I" label="RFIs" counts={summary?.rfis || {}} order={ROLLUP} />
                <Counts code="I.J" label="Change orders" counts={summary?.changeOrders || {}} labels={CO_LABEL} />
              </div>
            </SectionCard>

            <ActivitySection s={s} set={setSections} convert={convert} baseline={baseline} />

            <YesNoSection roman="III" title="Internal workers" code="III.A" question="Were internal workers present today?" value={s.crew} na={noWork} path="crew"
              onChange={(v) => {
                if (v === 'no' && draft.entries.length && !confirm('Take everyone off today’s timesheet?')) return;
                setDraft((d) => ({ ...d, sections: { ...d.sections, crew: v }, entries: v === 'no' ? [] : d.entries }));
              }}
              summaryYes={`${draft.entries.length} on the timesheet · ${draft.entries.reduce((a, e) => a + (Number(e.hours) || 0), 0)} h`}>
              <CrewSheet employees={employees} codes={codes} onSite={onSite} entries={draft.entries} setEntries={setEntries} editable={editable} carried={crewCarried} />
            </YesNoSection>

            <SubsSection s={s} set={setSections} na={noWork} contractors={contractors} baseline={baseline} />
            <InspectorsSection s={s} set={setSections} na={noWork} convert={convert} upload={upload} baseline={baseline} />
            <VisitorsSection s={s} set={setSections} na={noWork} convert={convert} consultants={consultants} baseline={baseline} />
            <FormSection roman="VII" title="Deliveries" codeA="VII.A" questionA="Was there a delivery today?" codeB="VII.B" questionB="Was a transmittal form completed?"
              a={s.deliveries.present} b={s.deliveries.transmittal} files={s.deliveries.files} pathA="deliveries.present" pathB="deliveries.transmittal" na={noWork} upload={upload}
              onA={(v) => setSections((x) => ({ ...x, deliveries: { ...x.deliveries, present: v } }))} onB={(v) => setSections((x) => ({ ...x, deliveries: { ...x.deliveries, transmittal: v } }))}
              onFiles={(f) => setSections((x) => ({ ...x, deliveries: { ...x.deliveries, files: f } }))}
              missingTask={`Upload Transmittal for deliveries on ${niceDate(date)}`} attachLabel="+ Attach transmittal" />
            <FormSection roman="VIII" title="Equipment used" codeA="VIII.A" questionA="Was equipment used today?" codeB="VIII.B" questionB="Was an Equipment Utilization form completed?"
              a={s.equipment.used} b={s.equipment.form} files={s.equipment.files} pathA="equipment.used" pathB="equipment.form" na={noWork} upload={upload}
              onA={(v) => setSections((x) => ({ ...x, equipment: { ...x.equipment, used: v } }))} onB={(v) => setSections((x) => ({ ...x, equipment: { ...x.equipment, form: v } }))}
              onFiles={(f) => setSections((x) => ({ ...x, equipment: { ...x.equipment, files: f } }))}
              missingTask={`Upload Equipment Utilization form for ${niceDate(date)}`} attachLabel="+ Attach equipment form" />
            <NotesSection s={s} set={setSections} na={noWork} convert={convert} baseline={baseline} />

            {/* X. Certification */}
            <SectionCard roman="X" title="Certification" summary={log?.signedAt ? `Signed ${stamp(log.signedAt)}` : 'Sign to submit'}>
              <div style={{ fontSize: 13.5, color: INK, lineHeight: 1.65, padding: '12px 14px', borderRadius: 12, background: 'var(--panel)' }}>
                {draft.behalf
                  ? <>I <b>{draft.certifiedName.trim() || '__________'}</b> am completing this form on behalf of <b>{filer}</b>. And I am certifying that the information contained in this report is true and correct to the best of my recollection. A copy of this report will be sent to <b>{filer}</b> for record.</>
                  : <>I am certifying that the information contained in this report is true and correct to the best of my recollection.</>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, alignItems: 'start' }}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div><Label>Typed name</Label>
                    <input disabled={!editable} value={draft.certifiedName} onChange={(e) => setDraft((d) => ({ ...d, certifiedName: e.target.value, onBehalfOf: d.behalf ? e.target.value : d.onBehalfOf }))}
                      placeholder={draft.behalf ? 'Your name' : filer} style={input} />
                  </div>
                  <div><Label>Date signed</Label><div style={{ fontSize: 13.5, color: INK }}>{log?.signedAt ? stamp(log.signedAt) : draft.signatureDataUrl && draft.certifiedName ? 'Stamped when this saves' : 'Stamped automatically when you sign'}</div></div>
                </div>
                <div><Label>Signature</Label>
                  {locked && draft.signatureDataUrl
                    ? <img src={draft.signatureDataUrl} alt="Signature" style={{ width: '100%', maxHeight: 140, objectFit: 'contain', background: '#fff', borderRadius: 12, border: '1px solid ' + LINE }} />
                    : <SignaturePad key={`${log?.id}-${loadKey}`} value={draft.signatureDataUrl} disabled={!editable} onChange={(v) => setDraft((d) => ({ ...d, signatureDataUrl: v, certifiedName: d.certifiedName || (d.behalf ? d.onBehalfOf : authUser?.name || '') }))} />}
                </div>
              </div>
            </SectionCard>

            {/* footer */}
            <div style={{ position: 'sticky', bottom: 0, zIndex: 5, background: 'var(--surface)', border: '1px solid ' + LINE, borderRadius: 'var(--r-14)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', boxShadow: '0 -6px 20px rgba(var(--rgb-ink), .06)' }}>
              {editable ? (
                <>
                  <div style={{ flex: '1 1 160px', minWidth: 0, fontSize: 12, color: auto.state === 'error' ? '#8E2E0A' : auto.dirty ? 'var(--c-8a6d12)' : MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {auto.state === 'saving' ? 'Saving…' : auto.state === 'error' ? `Couldn’t save — ${auto.error}` : auto.dirty ? 'Unsaved · saves itself in a moment' : 'Draft saved'}
                  </div>
                  <button type="button" onClick={saveDraft} style={pill(false)}>{auto.state === 'error' ? 'Retry save' : 'Save draft'}</button>
                  <button type="button" onClick={() => { setTplName(''); setTplOpen(true); }} style={pill(false)}>Save as template</button>
                  <button type="button" onClick={busy ? undefined : submit} style={{ padding: '10px 22px', borderRadius: 999, border: 'none', background: ACCENT, color: '#fff', fontSize: 13.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', opacity: busy ? 0.6 : 1 }}>
                    {busy === 'submit' ? 'Submitting…' : 'Submit'}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ flex: 1, fontSize: 13, color: MUTED }}>{log?.autoReason ? 'Made by the system — add an updated report to change anything.' : locked ? 'This report has been submitted — the office can send it back, or add an updated report for the day.' : 'Read only.'}</div>
                  <button type="button" onClick={() => { setTplName(''); setTplOpen(true); }} style={pill(false)}>Save as template</button>
                </>
              )}
            </div>
          </>
        )}

        {starting && (
          <Modal onClose={() => setStarting(null)}>
            <div>
              <div style={{ fontFamily: BG, fontSize: 21 }}>Updated report for {niceDate(date)}</div>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>The day already has a report. An update is kept alongside it — tabs switch between the original and each update.</div>
            </div>
            {prevChoice(starting.update)}
            <button type="button" onClick={() => setStarting(null)} style={{ ...pill(false), justifySelf: 'end' }}>Cancel</button>
          </Modal>
        )}
        {dateClash && (
          <Modal onClose={() => setDateClash(null)}>
            <div style={{ fontFamily: BG, fontSize: 21 }}>There’s already a report for {niceDate(dateClash)}</div>
            <div style={{ fontSize: 13.5, color: 'var(--body)', lineHeight: 1.6 }}>Change the date, or add this as an updated report for that day — the original stays as it is, with tabs to switch between them.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setDateClash(null)} style={pill(false)}>Change the date</button>
              <button type="button" disabled={!!busy} onClick={() => moveTo(dateClash, true)} style={pill(true)}>Add as an updated report</button>
            </div>
          </Modal>
        )}
        {tplOpen && (
          <Modal onClose={() => setTplOpen(false)} width={420}>
            <div style={{ fontFamily: BG, fontSize: 21 }}>Save as template</div>
            <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.55 }}>Saves this report’s answers and crew so anyone can start a report from it. Dates, uploaded files and tasks already made aren’t kept.</div>
            <Carry><input autoFocus value={tplName} onChange={(e) => setTplName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveTemplate(); }} placeholder="Template name, e.g. Framing day" style={input} /></Carry>
            {templates.some((t) => t.name.toLowerCase() === tplName.trim().toLowerCase()) && <div style={{ fontSize: 12, color: '#8A5A12' }}>A template with this name exists — saving replaces it (if it’s yours).</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setTplOpen(false)} style={pill(false)}>Cancel</button>
              <button type="button" disabled={!tplName.trim()} onClick={saveTemplate} style={pill(true, !tplName.trim())}>Save template</button>
            </div>
          </Modal>
        )}
      </div>
    </ReportCtx.Provider>
  );
}

const choice: React.CSSProperties = {
  display: 'grid', gap: 3, textAlign: 'left', padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(var(--rgb-shade), .14)',
  background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--body)', lineHeight: 1.5,
};
