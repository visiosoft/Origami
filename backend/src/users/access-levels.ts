/**
 * Granular access (the client's PEOPLE ACCESS matrix): for each role and each
 * data type, an access LEVEL and an EXTENT. Stored in the same role permission
 * map as before -- `view` / `manage` are worked out from the level, so every
 * existing check keeps working -- plus per-person overrides on the user.
 */
export const LEVELS = ['block', 'block_permit', 'view', 'input', 'user', 'dashboard', 'modify', 'full'] as const;
export type Level = (typeof LEVELS)[number];
export type Extent = 'assigned' | 'portfolio';
export const LEVEL_LABEL: Record<Level, string> = {
  block: 'Block access', block_permit: 'Block, as permit', view: 'View only', input: 'Input', user: 'User',
  dashboard: 'Dashboard', modify: 'Modify', full: 'Full edit',
};
/** The key for a role's "Overall access" -- what a data type without its own setting gets. */
export const OVERALL_KEY = '__overall';

export interface Perm { view: boolean; manage: boolean; level?: Level; extent?: Extent; note?: string }
export type PermMap = Record<string, Perm>;
export interface Override { level?: Level; extent?: Extent }

/** View: anything above the blocks. Manage (add / change): Input and up -- Input and User for their own data. */
export function flagsFor(level: Level): { view: boolean; manage: boolean } {
  const i = LEVELS.indexOf(level);
  return { view: i >= LEVELS.indexOf('view'), manage: i >= LEVELS.indexOf('input') };
}

export function perm(level: Level, extent?: Extent, note?: string): Perm {
  return { ...flagsFor(level), level, ...(extent ? { extent } : {}), ...(note ? { note } : {}) };
}

/** A role's permissions with a person's overrides on top. */
export function effectivePermissions(role: PermMap | null | undefined, overrides: Record<string, Override> | null | undefined): PermMap {
  const out: PermMap = { ...(role || {}) };
  for (const [k, o] of Object.entries(overrides || {})) {
    if (!o) continue;
    const base = out[k] || out[OVERALL_KEY];
    const level = o.level || base?.level;
    const extent = o.extent || base?.extent;
    out[k] = level ? perm(level, extent, base?.note) : { ...(base || { view: false, manage: false }), ...(extent ? { extent } : {}) };
  }
  return out;
}

/** Assigned projects only? From the overall setting (portfolio when not set -- as every role was before). */
export const extentOf = (perms: PermMap | null | undefined): Extent => (perms?.[OVERALL_KEY]?.extent === 'assigned' ? 'assigned' : 'portfolio');

// ------------------------------------------------------------------ the import

/** The sheet's words for a level. */
export function levelFrom(text: unknown): Level | null {
  const s = String(text ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!s) return null;
  if (/^FULL EDIT/.test(s)) return 'full';
  if (/^MODIFY/.test(s)) return 'modify';
  if (/^DASHBOARD/.test(s)) return 'dashboard';
  if (/^USER\b/.test(s)) return 'user';
  if (/^INPUT/.test(s)) return 'input';
  if (/^VIEW/.test(s)) return 'view';
  if (/^BLOCK,? ?AS PERMIT/.test(s)) return 'block_permit';
  if (/^BLOCK/.test(s)) return 'block';
  return null;
}
export function extentFrom(text: unknown): Extent | null {
  const s = String(text ?? '').toLowerCase();
  if (/portfolio/.test(s)) return 'portfolio';
  if (/assigned|limited|project/.test(s)) return 'assigned';
  return null;
}
const tierFrom = (s: string) => (/client/i.test(s) ? 'client' : /third|external|consult/i.test(s) ? 'consultant' : 'internal');

/** Menu items, by the sheet's wording. */
const MODULE_LABELS: Record<string, string> = {
  'DASHBOARD': 'dashboard', 'PROJECTS': 'projects', 'PEOPLE': 'people', 'ALL FILES': 'allfiles',
  'MY CALENDAR': 'my-calendar', 'MY TIMESHEETS': 'my-timesheet', 'MEETINGS': 'meetings', 'FOR RECORD': 'observations', 'RFI': 'rfis',
  'TASK': 'tasks', 'TASKS': 'tasks', 'CHANGE ORDERS': 'changeorders', 'APPROVALS': 'approvals',
  'CRM & LEADS': 'pipeline', 'HOLDING & REFER OUT': 'crm_holding', 'FEEDBACK': 'feedback', 'WARRANTY': 'warranty',
  'CONSULTANT PREQUIALIFYING & RFP': 'prequal', 'CONSULTANT PREQUALIFYING & RFP': 'prequal', 'DESIGN': 'design',
  'DESIGN CURRENT FILES': 'design_files_current', 'DESIGN PREVIOUS FILES': 'design_files_previous',
  'ESTIMATING': 'estimating', 'SELECTIONS & SPECIFICATIONS': 'selections', 'SELECTION AND SPECIFICATIONS CURRENT': 'selections_current',
  'SCHEDULE': 'schedule', 'PLAN & FILE ROOM': 'planroom', 'GC PREQUALIFY & RFP': 'gc_prequal', 'SUB PREQUALIFY & RFP': 'sub_prequal',
  'PROJECT MANAGEMENT': 'pm', 'QA/QC': 'quality', 'SAFETY': 'safety', 'EQUIPMENT MANAGEMENT': 'equipment', 'DELIVERY MANAGEMENT': 'deliveries',
  'PROCUREMENT MANAGEMENT': 'procurement', 'DAILY REPORTS': 'daily_reports', 'PROGRESS PHOTOS': 'progress_photos',
  'REPORTS & ANYALYTICS': 'reports', 'REPORTS & ANALYTICS': 'reports', 'DOCUMENT & TEMPLATE LIBRARY': 'library',
  'BUSINESS FILES': 'business_files', 'BUSINESS FINANCIALS': 'fin_business',
  'USER ACCES & ROLES': 'users', 'USER ACCESS & ROLES': 'users', 'HELP & SUPPORT': 'help',
};
/** Section headings in the sheet (no setting of their own here). */
const SECTIONS = new Set(['MAIN', 'SPECIAL ACTIONS', 'CRM', 'DESIGN', 'PRECONSTRUCTION', 'CONSTRUCTION', 'INSIGHT & DOCUMENTS', 'ADMIN', 'FINANCIAL & RESOURCE']);

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s/(&-])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bQa\/qc\b/i, 'QA/QC').replace(/\bPc\b/, 'PC');

/** Which data type a row is: a menu item, a financial data type, or nothing we know. */
export function keyForRow(label: string, code: string): { key: string; kind: 'overall' | 'module' | 'financial' | 'section' } | null {
  const raw = clean(label);
  if (!raw) return null;
  const up = raw.toUpperCase();
  if (/^OVERALL ACCESS/.test(up)) return { key: OVERALL_KEY, kind: 'overall' };
  const dashed = /^-/.test(raw);
  // "-ESTIMATING (… Tools for HISTORICAL DATA)" is its own data type.
  if (/ESTIMATING/.test(up) && /HISTORICAL/.test(up)) return { key: 'estimating_history', kind: 'module' };
  const base = up.replace(/^-+/, '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
  if (!dashed && SECTIONS.has(base)) return { key: 'section:' + slug(base), kind: 'section' };
  if (/^FINANCIAL DATA TYPE/.test(base) || /^PRECONSTRUCTION ESTIMATES/.test(base) || /^INCLUSIONS, EXCLUSIONS/.test(base)) {
    const name = base.replace(/^FINANCIAL DATA TYPE:?/, '').trim();
    return { key: 'fin:' + slug(name), kind: 'financial' };
  }
  // General Requirement lines: "2.01 Construction Supervision".
  if (/^\d+(\.\d+)?$/.test(clean(code))) return { key: 'fin:gr_' + clean(code) + '_' + slug(base), kind: 'financial' };
  const key = MODULE_LABELS[base];
  return key ? { key, kind: 'module' } : null;
}

export interface MatrixRole {
  col: number; name: string; tier: 'internal' | 'client' | 'consultant'; rank: string; classification: string; description: string;
  emails: string[]; example: string; key: string; perms: PermMap; overall: Perm | null;
}
export interface MatrixParse { roles: MatrixRole[]; unmatched: string[]; dataTypes: { key: string; label: string; kind: string }[] }

/**
 * Read the PEOPLE ACCESS sheet (rows of cells, as from its CSV): roles across
 * in three-column groups (access, extent, note), data types down column B.
 */
export function parseAccessMatrix(rows: string[][]): MatrixParse {
  const cell = (r: number, c: number) => String(rows[r]?.[c] ?? '');
  const find = (re: RegExp) => rows.findIndex((r) => re.test(clean(r?.[1])) || re.test(clean(r?.[0])));
  const roleRow = find(/^ROLE\b/i);
  if (roleRow < 0) throw new Error('This doesn’t look like the access sheet — no ROLE row was found.');
  const rankRow = find(/^RANK/i);
  const bucketRow = find(/^BUCKET/i);
  const classRow = find(/^CLASSIFICATION/i);
  const emailRow = rows.findIndex((r) => (r || []).some((c) => /Email\/Account/i.test(String(c))));
  const exampleRow = rows.findIndex((r) => /^EXAMPLE$/i.test(clean(r?.[0])) || /^EXAMPLE$/i.test(clean(r?.[1])));
  const end = rows.findIndex((r, i) => i > roleRow && /^ACCESS\s+Note/i.test(clean(r?.[0])));
  const last = end > 0 ? end : rows.length;

  const roles: MatrixRole[] = [];
  const width = Math.max(...rows.slice(0, last).map((r) => r?.length || 0));
  for (let c = 2; c < width; c += 3) {
    const nameCell = cell(roleRow, c).trim();
    if (!nameCell) continue;
    const lines = nameCell.split(/\n/).map(clean).filter(Boolean);
    const name = titleCase(lines[0]);
    const emails = [...new Set((cell(emailRow, c).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((e) => e.toLowerCase()))];
    roles.push({
      col: c, name, tier: tierFrom(cell(bucketRow, c)) as MatrixRole['tier'], rank: clean(cell(rankRow, c)), classification: titleCase(clean(cell(classRow, c))),
      description: [clean(cell(rankRow, c)), titleCase(clean(cell(classRow, c))), ...lines.slice(1)].filter(Boolean).join(' · '),
      emails, example: exampleRow >= 0 ? titleCase(clean(cell(exampleRow, c))) : '', key: 'r_' + slug(name), perms: {}, overall: null,
    });
  }

  const unmatched: string[] = [];
  const dataTypes: MatrixParse['dataTypes'] = [];
  const header = Math.max(roleRow, rows.findIndex((r) => /^DATA TYPE$/i.test(clean(r?.[0])) || /^DATA TYPE$/i.test(clean(r?.[1]))));
  for (let r = header + 1; r < last; r++) {
    const label = cell(r, 1);
    const hit = keyForRow(label, cell(r, 0));
    if (!hit) { if (clean(label)) unmatched.push(clean(label).slice(0, 120)); continue; }
    if (hit.kind === 'section') continue;
    if (!dataTypes.some((d) => d.key === hit.key)) dataTypes.push({ key: hit.key, label: clean(label).replace(/^-+/, ''), kind: hit.kind });
    for (const role of roles) {
      const level = levelFrom(cell(r, role.col));
      if (!level) continue;
      const p = perm(level, extentFrom(cell(r, role.col + 1)) || undefined, clean(cell(r, role.col + 2)) || undefined);
      role.perms[hit.key] = p;
      if (hit.kind === 'overall') role.overall = p;
    }
  }
  return { roles, unmatched, dataTypes };
}

/**
 * A role's full permission map from its sheet column: every menu item gets its
 * own row's setting, else the role's overall access (extent likewise).
 */
export function rolePermissionsFrom(role: MatrixRole, moduleKeys: string[]): PermMap {
  const overall = role.overall || perm('block');
  const out: PermMap = { [OVERALL_KEY]: overall };
  for (const k of [...new Set([...moduleKeys, ...Object.keys(role.perms)])]) {
    const own = role.perms[k];
    const level = own?.level || overall.level || 'block';
    out[k] = perm(level, own?.extent || overall.extent, own?.note);
  }
  return out;
}
