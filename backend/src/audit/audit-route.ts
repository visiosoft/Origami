/**
 * The audit log (Oct 2026): what a saved change was, worked out from the
 * request, and what it changed. Pure, so the rules are easy to test.
 */
export interface AuditChange { field: string; from: string | null; to: string | null }

/** Records whose before/after the log keeps, by the first path segment. */
export const TRACKED: Record<string, { type: string; numeric?: boolean; key?: string }> = {
  projects: { type: 'Project', numeric: true },
  people: { type: 'Contact', numeric: true },
  users: { type: 'User' },
  roles: { type: 'Role', key: 'key' },
  'project-tasks': { type: 'Task' },
  tasks: { type: 'Request Log task' },
  leads: { type: 'Lead' },
  pipeline: { type: 'Deal' },
  rfis: { type: 'RFI' },
};

/** Paths that are housekeeping, not something anyone did on purpose. */
const SKIP = [/^auth\//, /^views(\/|$)/, /^notifications\/(read|seen|feed)/, /^notifications\/[^/]+\/read/, /^status(\/|$)/, /^google\/.*sync/, /^support\/log/,
  // Finance writes its own field-by-field log (finance_activity); the log page merges it in.
  /^finance/];

const METHOD_ACTION: Record<string, string> = { POST: 'created', PUT: 'updated', PATCH: 'updated', DELETE: 'deleted' };

const humanize = (seg: string) => seg.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
// Ids: numbers, T-…/D-…, uuids, anything with a digit, or a dotted settings key.
const looksLikeId = (seg?: string) => !!seg && (/^[\w-]+(\.[\w-]+)+$/.test(seg) || /^\d+$/.test(seg) || /^[A-Za-z]{1,6}-[\w-]+$/.test(seg) || /^[0-9a-f-]{16,}$/i.test(seg) || /\d/.test(seg));

/** What a mutating request did: the record type, its id, and the action ("updated", "stage", "deleted"…). Null for anything not worth logging. */
export function describeRequest(method: string, rawPath: string): { segment: string; entityType: string; entityId: string | null; action: string; sub: string | null } | null {
  const action = METHOD_ACTION[method.toUpperCase()];
  if (!action) return null;
  const path = rawPath.split('?')[0].replace(/^\/?(api\/)?/, '').replace(/\/+$/, '');
  if (!path || SKIP.some((r) => r.test(path))) return null;
  const parts = path.split('/').map(decodeURIComponent);
  const segment = parts[0];
  const tracked = TRACKED[segment];
  // Roles are keyed by a word ("project_manager"); everything else by something id-shaped.
  const entityId = parts[1] && (looksLikeId(parts[1]) || (tracked?.key && parts.length <= 3)) ? parts[1] : null;
  // /pipeline/:id/stage -> "stage"; /project-tasks/reorder -> "reorder".
  const sub = (entityId ? parts.slice(2) : parts.slice(1)).filter((p) => !looksLikeId(p)).join(' ') || null;
  return {
    segment,
    entityType: tracked?.type || humanize(segment),
    entityId,
    action: sub && !(method === 'DELETE' && !entityId) ? (method === 'DELETE' ? `removed ${sub}` : sub) : action,
    sub,
  };
}

const SECRET = /pass(word)?|token|secret|hash|api_?key|authToken|signature(Image)?\d?$|cardToken/i;
/** Fields that change on every save and say nothing. */
const NOISE = new Set(['updatedAt', 'createdAt', 'version', 'activity', 'events', 'pendingNotices', 'comments', 'daysOpen', 'daysInStage', 'lastActivityAt']);
const MAX = 240;

export function show(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null;
  const s = typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > MAX ? s.slice(0, MAX - 1) + '…' : s;
}

/** Field-by-field changes between two versions of a record (secrets masked, noise left out). */
export function diffFields(before: Record<string, any> | null, after: Record<string, any> | null): AuditChange[] {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const out: AuditChange[] = [];
  for (const k of keys) {
    if (NOISE.has(k)) continue;
    const a = show(before?.[k]), b = show(after?.[k]);
    if (a === b) continue;
    out.push(SECRET.test(k) ? { field: k, from: a == null ? null : '•••', to: b == null ? null : '•••' } : { field: k, from: a, to: b });
  }
  return out.slice(0, 40);
}

/** What was sent, for requests on records the log doesn't diff (secrets masked, long values cut). */
export function bodyChanges(body: unknown): AuditChange[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  return Object.entries(body as Record<string, unknown>).filter(([k]) => !NOISE.has(k)).slice(0, 20)
    .map(([k, v]) => ({ field: k, from: null, to: SECRET.test(k) ? '•••' : show(v) }));
}

/** A readable name for a record, for the log's "what" column. */
export function labelOf(row: Record<string, any> | null | undefined): string | null {
  if (!row) return null;
  const parts = [row.serial || row.number, row.title || row.subject || row.name || row.leadName || row.email].filter(Boolean);
  return parts.length ? String(parts.join(' · ')).slice(0, 200) : null;
}

/** The project a record belongs to, when it says. */
export function projectOf(segment: string, row: Record<string, any> | null | undefined): number | null {
  if (!row) return null;
  if (segment === 'projects') return Number(row.id) || null;
  const p = Number(row.projectId);
  return Number.isFinite(p) && p > 0 ? p : null;
}
