/**
 * The Daily Report: Sections II and IV-IX are kept as one `sections` object on
 * the daily log; Section III is the crew sheet (the log's entries), and I / X
 * are the report's own fields. Everything here is plain data + helpers so the
 * page and the tests share one definition.
 */

export type YesNo = 'yes' | 'no' | '';

/** A delay or a failed / partial inspection: when it's expected to be fixed, what happened, and the task made from it. */
export interface Delay {
  on?: boolean;
  /** 'known' = a get-well date is set; 'unknown' = no date yet. */
  getWell?: 'known' | 'unknown' | '';
  date?: string;
  details?: string;
  /** The To Do task made with "Convert to task". */
  taskId?: string;
}

export const OPS_DELAYS: [key: OpsKey, label: string][] = [
  ['procurement', 'Procurement / Delivery delay'],
  ['changeOrder', 'Change order delay'],
  ['rfi', 'RFI delay'],
  ['scheduling', 'Scheduling / Sequencing delay'],
  ['safety', 'Safety incident delay'],
  ['siteCondition', 'Unknown site condition'],
];
export type OpsKey = 'procurement' | 'changeOrder' | 'rfi' | 'scheduling' | 'safety' | 'siteCondition';

export const NO_WORK_REASONS: [key: NoWorkReason, label: string][] = [
  ['stop', 'Stop order'],
  ['holiday', 'Holiday'],
  ['ops', 'Operations delay'],
  ['force', 'Force majeure delay'],
];
export type NoWorkReason = 'stop' | 'holiday' | 'ops' | 'force' | '';

export const STOP_BY = ['GC', 'Owner', 'Authority'];

export const AUTHORITIES = [
  'City or Municipal Inspector',
  'Third Party Inspector',
  'Utility – PG&E Inspection',
  'Utility – Other Power Company',
  'Utility – Water',
  'Utility – Sanitary Sewer',
  'Health Department',
  'Governing Body Inspector',
];

export const OUTCOMES: [key: Outcome, label: string][] = [
  ['passed', 'Passed'],
  ['partial', 'Partial passed'],
  ['conditional', 'Conditional passed with comments — clear to move on to the next phase of work'],
  ['failed', 'Failed'],
];
export type Outcome = 'passed' | 'partial' | 'conditional' | 'failed' | '';

export const VISITOR_TYPES = ['Owner', 'Supplier', 'Architect', 'Consultant'];

export interface FileRef { id: string; name: string }
export interface SubRow { id: string; contractorId?: string; name?: string; headcount?: number | ''; work?: string; from?: string; to?: string }
export interface InspectorRow { id: string; authority?: string; what?: string; outcome?: Outcome; delay?: Delay; card?: FileRef | null }
/**
 * Nov 20 (Edward): an inspection asked for from the daily report. It makes a
 * task on the project (for the Coordinator, else the PM, due the day before);
 * once it happens, its result goes in as a normal Inspectors row.
 */
export interface InspectionRequest {
  id: string; authority?: string; agency?: string; date?: string; time?: string; areas?: string; notes?: string;
  status?: 'requested' | 'passed' | 'partial' | 'conditional' | 'failed'; taskId?: string;
}

/** The day before a date (yyyy-mm-dd), for when the request task is due. */
export function dayBefore(iso?: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The task an inspection request makes. */
export function inspectionTask(r: InspectionRequest, reportDate: string) {
  const what = [r.authority || 'Inspection', r.areas].filter(Boolean).join(' — ');
  return {
    title: `Inspection request: ${what}`.slice(0, 120),
    description: [
      `Requested from the daily report for ${reportDate}.`,
      r.date ? `Wanted on ${r.date}${r.time ? ` at ${r.time}` : ''}.` : 'No date asked for yet.',
      r.agency ? `Agency / inspector: ${r.agency}.` : '',
      r.areas ? `Areas / sheets: ${r.areas}.` : '',
      r.notes ? `Notes: ${r.notes}` : '',
    ].filter(Boolean).join('\n'),
    dueDate: dayBefore(r.date),
  };
}
export interface VisitorRow { id: string; type?: string; personId?: string; name?: string; details?: string; taskId?: string }
export interface NoteRow { id: string; text?: string; taskId?: string }
/** VII. One delivery on the transmittal. */
export interface DeliveryRow {
  id: string; contractorId?: string; supplier?: string; poRef?: string; items?: string; qty?: number | '';
  receivedBy?: string; condition?: 'good' | 'damaged' | 'short' | ''; notes?: string; photo?: FileRef | null; taskId?: string;
}
/** VIII. One piece of equipment on the utilization form. */
export interface EquipmentRow {
  id: string; equipment?: string; ownership?: 'owned' | 'rented' | ''; supplier?: string; operator?: string;
  hoursUsed?: number | ''; hoursIdle?: number | ''; notes?: string; taskId?: string;
}
export const DELIVERY_CONDITIONS: [NonNullable<DeliveryRow['condition']>, string][] = [['good', 'Good'], ['damaged', 'Damaged'], ['short', 'Short / missing items']];

export interface Sections {
  activity: {
    worked: YesNo;
    reason: NoWorkReason;
    stop: { by?: string; asOf?: string; end?: string; endUnknown?: boolean; details?: string };
    holiday: { start?: string; end?: string };
    ops: Partial<Record<OpsKey, Delay>>;
    force: Delay;
    /** II.B, when work occurred. */
    delays: YesNo;
    dOps: Partial<Record<OpsKey, Delay>>;
    dForce: Delay;
    /** II.C */
    photos: YesNo;
  };
  crew: YesNo;
  subs: { present: YesNo; rows: SubRow[] };
  inspectors: { present: YesNo; rows: InspectorRow[]; requests: InspectionRequest[] };
  visitors: { present: YesNo; rows: VisitorRow[] };
  /** The transmittal is filled in here (rows) or attached as a scan (files); `transmittal` says whether it's done. */
  deliveries: { present: YesNo; transmittal: YesNo; files: FileRef[]; rows: DeliveryRow[] };
  /** The Equipment Utilization form, filled in here (rows) or attached (files). */
  equipment: { used: YesNo; form: YesNo; files: FileRef[]; rows: EquipmentRow[] };
  notes: NoteRow[];
}

export const rowId = () => Math.random().toString(36).slice(2, 10);

export function emptySections(): Sections {
  return {
    activity: { worked: '', reason: '', stop: {}, holiday: {}, ops: {}, force: {}, delays: '', dOps: {}, dForce: {}, photos: '' },
    crew: '',
    subs: { present: '', rows: [] },
    inspectors: { present: '', rows: [], requests: [] },
    visitors: { present: '', rows: [] },
    deliveries: { present: '', transmittal: '', files: [], rows: [] },
    equipment: { used: '', form: '', files: [], rows: [] },
    notes: [],
  };
}

/** Fill in anything missing (older drafts, templates) so the form can rely on every key. */
export function normalizeSections(raw: unknown): Sections {
  const base = emptySections();
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<Sections>;
  return {
    activity: { ...base.activity, ...(s.activity || {}) },
    crew: s.crew ?? '',
    subs: { ...base.subs, ...(s.subs || {}), rows: Array.isArray(s.subs?.rows) ? s.subs!.rows : [] },
    inspectors: { ...base.inspectors, ...(s.inspectors || {}), rows: Array.isArray(s.inspectors?.rows) ? s.inspectors!.rows : [], requests: Array.isArray(s.inspectors?.requests) ? s.inspectors!.requests : [] },
    visitors: { ...base.visitors, ...(s.visitors || {}), rows: Array.isArray(s.visitors?.rows) ? s.visitors!.rows : [] },
    deliveries: { ...base.deliveries, ...(s.deliveries || {}), files: Array.isArray(s.deliveries?.files) ? s.deliveries!.files : [], rows: Array.isArray(s.deliveries?.rows) ? s.deliveries!.rows : [] },
    equipment: { ...base.equipment, ...(s.equipment || {}), files: Array.isArray(s.equipment?.files) ? s.equipment!.files : [], rows: Array.isArray(s.equipment?.rows) ? s.equipment!.rows : [] },
    notes: Array.isArray(s.notes) ? s.notes : [],
  };
}

/**
 * What a template keeps: the day's answers without anything tied to that day --
 * no stop/holiday dates, uploaded files, inspection cards or tasks already made.
 */
export function templateOf(s: Sections): Sections {
  const clean = <T extends { taskId?: string }>(x: T): T => { const { taskId: _t, ...rest } = x; void _t; return rest as T; };
  const delays = (m: Partial<Record<OpsKey, Delay>>) => Object.fromEntries(Object.entries(m).map(([k, d]) => [k, clean({ ...d!, date: '' })]));
  return {
    ...s,
    activity: { ...s.activity, stop: {}, holiday: {}, ops: delays(s.activity.ops), force: clean({ ...s.activity.force, date: '' }), dOps: delays(s.activity.dOps), dForce: clean({ ...s.activity.dForce, date: '' }) },
    inspectors: { ...s.inspectors, requests: [], rows: s.inspectors.rows.map((r) => ({ ...r, card: null, delay: r.delay ? clean({ ...r.delay, date: '' }) : r.delay })) },
    visitors: { ...s.visitors, rows: s.visitors.rows.map(clean) },
    // The usual suppliers and machines stay; what arrived, how much and the hours belong to the day.
    deliveries: { ...s.deliveries, files: [], rows: s.deliveries.rows.map((r) => ({ id: r.id, contractorId: r.contractorId, supplier: r.supplier })) },
    equipment: { ...s.equipment, files: [], rows: s.equipment.rows.map((r) => ({ id: r.id, equipment: r.equipment, ownership: r.ownership, supplier: r.supplier, operator: r.operator })) },
    notes: s.notes.map(clean),
  };
}

// ------------------------------------------------------------------ VII / VIII forms

const filled = (r: object) => Object.entries(r).some(([k, v]) => k !== 'id' && v !== '' && v != null && !(Array.isArray(v) && !v.length));
/** The transmittal counts as done once a delivery is written up or a signed copy is attached. */
export const transmittalDone = (d: Sections['deliveries']) => d.rows.some(filled) || d.files.length > 0;
/** Same for the Equipment Utilization form. */
export const equipmentFormDone = (e: Sections['equipment']) => e.rows.some(filled) || e.files.length > 0;
export const equipmentHours = (rows: EquipmentRow[]) => ({
  used: rows.reduce((a, r) => a + (Number(r.hoursUsed) || 0), 0),
  idle: rows.reduce((a, r) => a + (Number(r.hoursIdle) || 0), 0),
});

// ------------------------------------------------------------------ carried-over highlighting

export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

const isBlank = (v: unknown): boolean => v == null || v === '' || v === false || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.values(v as object).some((x): boolean => !isBlank(x)));

export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (isBlank(a) && isBlank(b)) return true;
  if (typeof a !== typeof b || typeof a !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object).filter((k) => !isBlank((a as Record<string, unknown>)[k]));
  const kb = Object.keys(b as object).filter((k) => !isBlank((b as Record<string, unknown>)[k]));
  if (ka.length !== kb.length) return false;
  return ka.every((k) => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * Was this value copied from the previous day and left as it was? Those are
 * highlighted yellow until someone changes them. `path` is a dotted path into
 * the sections (e.g. "activity.photos"); list rows are found by their id.
 */
export function isCarried(baseline: Sections | null | undefined, current: Sections, path: string): boolean {
  if (!baseline) return false;
  const was = getPath(baseline, path);
  if (isBlank(was)) return false;
  return sameValue(was, getPath(current, path));
}

/** A list row (subs, inspectors, visitors, notes) copied from the previous day and not touched since. */
export function isRowCarried<T extends { id: string }>(baselineRows: T[] | undefined, row: T): boolean {
  const was = baselineRows?.find((r) => r.id === row.id);
  return !!was && sameValue(was, row);
}

/** How many copied values are still unchanged -- shown in the legend. */
export function carriedCount(baseline: Sections | null | undefined, current: Sections): number {
  if (!baseline) return 0;
  let n = 0;
  const walk = (b: unknown, c: unknown) => {
    if (Array.isArray(b)) {
      for (const row of b) {
        const id = (row as { id?: string })?.id;
        const now = Array.isArray(c) && id ? c.find((x) => (x as { id?: string })?.id === id) : undefined;
        if (!isBlank(row) && now && sameValue(row, now)) n++;
      }
      return;
    }
    if (b && typeof b === 'object') { for (const k of Object.keys(b)) walk((b as Record<string, unknown>)[k], c && typeof c === 'object' ? (c as Record<string, unknown>)[k] : undefined); return; }
    if (!isBlank(b) && sameValue(b, c)) n++;
  };
  walk(baseline, current);
  return n;
}
