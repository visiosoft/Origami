import type { ContractorBid } from './data/contractorBids';
import type { CardScan } from './data/businessCard';
import type { ContactActivity, ContactInteraction, DupMatch } from './data/people';
import type { NotifyFeedItem, NotifyPrefs } from './data/notifications';
import type { Markup } from './data/markup';

/** GET /dashboard/tasks-summary */
export interface TasksSummary {
  attention: { task: string; project: string; dueDate: string }[];
  mine: {
    total: number; open: number; overdue: number; today: number;
    latest: { key: string; title: string; project: string; due?: string; open: boolean; touched: string; to: string }[];
    dated: { key: string; title: string; project: string; due?: string; open: boolean; to: string }[];
  };
  team: { name: string; open: number; done: number }[];
  overdueByProject: [number, number][];
}
import type { BillingMonth } from './data/dashboardCharts';
import type { AuditRow } from './data/audit';
import type { Contract, ContractSigningView, ContractTemplate, ContractTypeInfo } from './data/contracts';
import type { PriorityDef } from './data/priority';
const API_BASE = '/api';

/** Special actions that can be duplicated or converted: Special Actions Log entry, board task, meeting, RFI, change order. */
export type ActionKind = 'log' | 'board' | 'meeting' | 'rfi' | 'co';
/** A record made by duplicating or converting. */
export interface MadeAction { kind: ActionKind; id: string; label: string; projectId: number | null; projectName: string }
/** What was made from a record ("Converted to CO-003"). */
export interface DerivedRef { kind: ActionKind; id: string; label: string; how: 'converted' | 'duplicated'; projectName?: string; by: string; at: string }

/** Where a record came from, and what was made from it (duplicate / convert). */
export interface ActionTrailFields { sourceType?: string | null; sourceId?: string | null; sourceLabel?: string | null; derivedRefs?: DerivedRef[] | null;
  /** Serial number per kind, project and year: T-2026-0142, FR-2026-0031, MTG-2026-0012. */
  serial?: string | null }

/** A project's week, from its daily reports (Daily Reports -> Weekly). */
export interface WeeklyReport {
  projectId: number; weekStart: string; weekEnd: string;
  days: { date: string; logId: string | null; status: string; worked: string; reason: string; auto: boolean; crew: number; hours: number; supervisor: string; updates: number }[];
  totals: { hours: number; workerDays: number; daysWorked: number; daysNoWork: number; daysMissing: number; equipmentHours: number; equipmentIdle: number; deliveries: number };
  byCode: { code: string; label: string; hours: number; workers: number }[];
  byWorker: { name: string; trade: string; hours: number; days: number }[];
  delays: { date: string; label: string; getWell: string; details: string }[];
  inspections: { date: string; authority: string; what: string; outcome: string }[];
  visitors: { date: string; type: string; name: string; details: string }[];
  deliveries: { date: string; supplier: string; poRef: string; items: string; qty: number | ''; receivedBy: string; condition: string; notes: string }[];
  equipment: { name: string; ownership: string; hoursUsed: number; hoursIdle: number; days: number }[];
  notes: { date: string; text: string }[];
}

/** A checklist made in advance ("Pre-pour inspection"). */
export interface ChecklistTemplate { id: string; name: string; items: { item: string }[];
  /** Added by itself to new records: task, record, record:Observation, label:Safety. */
  autoFor?: string[]; createdById?: string; createdByName?: string; createdAt: string }

/** A saved filter set on a list page (Saved views). */
export interface SavedView { id: string; page: string; name: string; filters: Record<string, unknown> | null; createdAt: string }

/** One email of File Room files: what went to whom, when, from whom. */
export type FileShare = { id: string; projectId: number | null; files: { id: string; name: string; folderPath?: string[] }[]; to: string; note?: string | null; sentByName: string; sentAt: string;
  /** When it was opened (null = not yet; absent = sent before tracking). */
  opened?: import('./components/OpenedBadge').Opened | null };

/** A letter rendered on the company letterhead — previewed and sent as a PDF. */
export interface LetterInput {
  to?: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html: string;
  recipient?: string;
  date?: string;
  filename?: string;
  /** The short document label shown as the cover/letter heading -- falls back to `subject`. */
  docTitle?: string;
  /** A line under the cover heading -- typically the project name/address. */
  subtitle?: string;
  /** Prepends a branded cover page before the letter. */
  includeCoverPage?: boolean;
  /** Inserts the "About Us" + "Team" page right after the cover. */
  includeAboutUs?: boolean;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  /** A short email note, sent instead of pasting the whole letter into the email body. */
  noteHtml?: string;
}

const TOKEN_KEY = 'origami.session';

/** The signed-in user's session token, shared by every API call. */
/** Fired when a request finds the session has ended mid-work; the app then asks the person to sign in again. */
export const SESSION_EXPIRED_EVENT = 'origami:session-expired';
/** Fired once they're signed back in, so unsaved work can be sent. */
export const SESSION_RESTORED_EVENT = 'origami:session-restored';

/** Seconds-since-epoch expiry inside a session token, or null if it can't be read. */
export const tokenExpiry = (token: string | null): number | null => {
  try {
    const body = token?.split('.')[1];
    if (!body) return null;
    const json = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp : null;
  } catch { return null; }
};

/** A 401 from anything but the sign-in endpoints means the session ran out while someone was working. */
const noteSignedOut = (status: number, path: string, hadToken: boolean) => {
  if (status === 401 && hadToken && !/^\/auth\/(login|me|refresh|logout)/.test(path)) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
};

/**
 * Runs a save that isn't on an autosaving form (a stage move, a delete, a
 * section rename). If the server is restarting -- a deploy -- it keeps trying for
 * a while; if the session ran out, it waits for the person to sign back in and
 * then sends. Anything else is handed back, so the screen can say it wasn't saved
 * instead of quietly dropping it.
 */
export function persist<T>(fn: () => Promise<T>, tries = 8): Promise<T> {
  return fn().catch((e: any) => {
    const down = !e?.status || e.status >= 500;
    if (down && tries > 1) {
      return new Promise<T>((resolve, reject) => { window.setTimeout(() => { persist(fn, tries - 1).then(resolve, reject); }, 5000); });
    }
    if (e?.status === 401) {
      return new Promise<T>((resolve, reject) => {
        const again = () => { window.removeEventListener(SESSION_RESTORED_EVENT, again); fn().then(resolve, reject); };
        window.addEventListener(SESSION_RESTORED_EVENT, again);
      });
    }
    throw e;
  });
}

export const session = {
  key: TOKEN_KEY,
  get: (): string | null => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (token: string) => {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
  },
  clear: () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  },
};

/**
 * A short read cache for going back and forth between pages: a list read in
 * the last minute comes from memory instead of the server. Only reads are
 * cached --
 *  - a save, delete or upload (any non-GET) clears the whole cache, so your
 *    own changes always show at once;
 *  - a single record opened to view or edit (a path ending in its id) is
 *    always fetched fresh, as is anything asked for with `cache: 'no-store'`;
 *  - sign-in, the server status and the notification bell are never cached.
 * Someone else's change shows within READ_TTL_MS. Each answer is a copy, so a
 * screen sorting or editing what it got can't change what's cached.
 */
export const READ_TTL_MS = 60_000;
const readCache = new Map<string, { at: number; value: unknown }>();
const readsInFlight = new Map<string, Promise<unknown>>();
const NEVER_CACHE = /^\/(auth\/|status\b|notifications\/my-tasks|google\/status)/;
/** The last path segment is a record id (it has a digit), e.g. /tasks/T-2026-0007, /people/42. */
const isRecordPath = (path: string) => /\d/.test(path.split('?')[0].split('/').filter(Boolean).pop() || '');
export const cacheableRead = (path: string, options?: RequestInit) =>
  (options?.method || 'GET').toUpperCase() === 'GET' && options?.cache !== 'no-store' && !NEVER_CACHE.test(path) && !isRecordPath(path);
/** Drop every cached read (after a change, or on signing in or out). */
export function clearReadCache() { readCache.clear(); readsInFlight.clear(); }
const copy = <T,>(v: T): T => (v === undefined || v === null ? v : structuredClone(v));

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!cacheableRead(path, options)) {
    try { return await send<T>(path, options); }
    finally { if ((options?.method || 'GET').toUpperCase() !== 'GET') clearReadCache(); }
  }
  const key = (session.get() || '') + ' ' + path;
  const hit = readCache.get(key);
  if (hit && Date.now() - hit.at < READ_TTL_MS) return copy(hit.value as T);
  let pending = readsInFlight.get(key) as Promise<T> | undefined;
  if (!pending) {
    pending = send<T>(path, options).then((value) => {
      if (readsInFlight.get(key) === pending) readCache.set(key, { at: Date.now(), value });
      return value;
    }).finally(() => { if (readsInFlight.get(key) === pending) readsInFlight.delete(key); });
    readsInFlight.set(key, pending);
  }
  return copy(await pending);
}

async function send<T>(path: string, options?: RequestInit): Promise<T> {
  const token = session.get();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    // Nest returns { message } (or an array of messages) — surface it verbatim so
    // the UI can show the real reason instead of a bare status code.
    const body = await res.json().catch(() => null);
    const msg = body && (Array.isArray(body.message) ? body.message[0] : body.message);
    noteSignedOut(res.status, path, !!token);
    // The status rides along, so callers can tell "signed out" (401) from "server busy" (502/503).
    throw Object.assign(new Error(msg || `API error: ${res.status}`), { status: res.status });
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/**
 * Multipart POST. Deliberately omits Content-Type so the browser can set the
 * multipart boundary itself, while keeping the Authorization header.
 */
async function requestForm<T>(path: string, form: FormData): Promise<T> {
  // An upload changes data: cached reads are dropped before and after it.
  clearReadCache();
  try { return await sendForm<T>(path, form); } finally { clearReadCache(); }
}

async function sendForm<T>(path: string, form: FormData): Promise<T> {
  const token = session.get();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = body && (Array.isArray(body.message) ? body.message[0] : body.message);
    noteSignedOut(res.status, path, !!token);
    throw Object.assign(new Error(msg || `Upload failed: ${res.status}`), { status: res.status });
  }
  return res.json();
}

/** A file's bytes, signed in (for the PDF markup viewer and marked-up downloads). */
async function requestBytes(path: string): Promise<ArrayBuffer> {
  const token = session.get();
  const res = await fetch(`${API_BASE}${path}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = body && (Array.isArray(body.message) ? body.message[0] : body.message);
    noteSignedOut(res.status, path, !!token);
    throw Object.assign(new Error(msg || `Couldn’t load the file (${res.status})`), { status: res.status });
  }
  return res.arrayBuffer();
}

/** Build a FormData from a browser FileList / File[]. */
function filesForm(files: File[] | FileList): FormData {
  const form = new FormData();
  Array.from(files).forEach((f) => form.append('files', f, f.name));
  return form;
}

export type AttachmentScope = 'tasks' | 'project-tasks' | 'employee-records' | 'contractors' | 'finance-invoices' | 'finance-change-orders' | 'finance-reimbursables' | 'finance-costs' | 'finance-commitment-shared' | 'rfis' | 'lead-files';

/**
 * Where the browser fetches an attachment's bytes. Relative on purpose: it works
 * through the vite proxy in dev and same-origin in production. The route is
 * scoped to the task, so a Drive id alone can never reach an arbitrary file.
 */
export const attachmentUrl = (
  scope: AttachmentScope,
  taskId: string,
  attId: string,
  thumb = false,
) => `${API_BASE}/${scope}/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attId)}/content${thumb ? '?thumb=1' : ''}`;

const qs = (o?: Record<string, unknown>) => { const q = new URLSearchParams(); Object.entries(o || {}).forEach(([k, v]) => { if (v != null && v !== '') q.set(k, String(v)); }); const t = q.toString(); return t ? `?${t}` : ''; };

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: unknown }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me: () => request('/auth/me'),
    /** A fresh session token while the current one is still valid. */
    refresh: () => request<{ token: string; expiresIn: number; user: unknown }>('/auth/refresh', { method: 'POST' }),
    setNotificationPrefs: (notifyOnAssignment: boolean) =>
      request('/auth/me/notifications', { method: 'PUT', body: JSON.stringify({ notifyOnAssignment }) }),
    /** Any subset of the newer per-channel/trigger notification preferences. */
    setNotificationPrefsExtra: (prefs: Partial<{ notifyByEmail: boolean; notifyBySms: boolean; notifyOnOverdue: boolean; notifyOnMilestone: boolean; digestFrequency: string }>) =>
      request('/auth/me/notifications', { method: 'PUT', body: JSON.stringify(prefs) }),
    /** Clears the session cookie server-side; the bearer token is dropped locally. */
    logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
    invite: (token: string) => request<{ name: string; email: string; isReset: boolean }>(`/auth/invite/${encodeURIComponent(token)}`),
    setPassword: (token: string, password: string) =>
      request('/auth/set-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
    forgotPassword: (email: string) =>
      request<{ ok: boolean; reason?: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    googleLoginUrl: () => `${API_BASE}/google/login`,
  },
  /** Duplicate a special action (to several projects at once) or convert it into another kind. */
  specialActions: {
    duplicate: (d: { kind: ActionKind; id: string; projectIds: (number | null)[] }) =>
      request<{ created: MadeAction[]; failed: { projectId: number | null; projectName: string; reason: string }[] }>('/special-actions/duplicate', { method: 'POST', body: JSON.stringify(d) }),
    convert: (d: { from: { kind: ActionKind; id: string }; to: ActionKind; topicType?: string; projectId?: number | null; title?: string; body?: string }) =>
      request<MadeAction>('/special-actions/convert', { method: 'POST', body: JSON.stringify(d) }),
  },
  /** Checklists made in advance and added to tasks. */
  checklistTemplates: {
    list: () => request<ChecklistTemplate[]>('/checklist-templates'),
    save: (name: string, items: string[], autoFor?: string[]) => request<ChecklistTemplate>('/checklist-templates', { method: 'POST', body: JSON.stringify({ name, items, autoFor }) }),
    update: (id: string, d: { name?: string; items?: string[]; autoFor?: string[] }) => request<ChecklistTemplate>(`/checklist-templates/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(d) }),
    remove: (id: string) => request(`/checklist-templates/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  /** The caller's own saved filter sets, per list page. */
  views: {
    list: (page: string) => request<SavedView[]>(`/views?page=${encodeURIComponent(page)}`),
    save: (page: string, name: string, filters: Record<string, unknown>) => request<SavedView>('/views', { method: 'POST', body: JSON.stringify({ page, name, filters }) }),
    remove: (id: string) => request(`/views/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  settings: {
    get: () => request<Record<string, string>>('/settings'),
    save: (data: Record<string, unknown>) => request<Record<string, string>>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },
  sms: {
    status: () => request<{ provider?: 'twilio' | 'quo'; configured: boolean; enabled: boolean; fromNumber: string; accountSid: string }>('/sms/status'),
    /** With entityType/entityId the text is recorded on that lead, contact or project. */
    send: (to: string, body: string, link?: { entityType: 'lead' | 'person' | 'project'; entityId: string; templateKey?: string }) =>
      request<{ sent: boolean; to: string; segments: number }>('/sms/send', { method: 'POST', body: JSON.stringify({ to, body, ...link }) }),
    messages: (entityType: 'lead' | 'person' | 'project', entityId: string) =>
      request<import('./data/sms').SmsMessage[]>(`/sms/messages?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`),
    test: (to: string) =>
      request<{ sent: boolean; to: string }>('/sms/test', { method: 'POST', body: JSON.stringify({ to }) }),
  },

  notifications: {
    /** My open board tasks and log entries, a few fields each (the bell). */
    myTasks: () => request<{
      board: { id: string; title: string; projectId: number | null; projectName: string | null; status?: string; updatedAt?: string; createdAt?: string }[];
      log: { id: string; subject?: string; description?: string; project?: string; status?: string; updatedAt?: string }[];
    }>('/notifications/my-tasks'),
    /** Sends the caller a sample assignment email, for checking the template. */
    test: () => request<{ sent: boolean; reason?: string }>('/notifications/test', { method: 'POST' }),
    /** My notification settings: each event's channels, my phone, and what's missing. */
    prefs: () => request<NotifyPrefs>('/notifications/prefs'),
    /** matrix: event -> channels ([] = no notification); null = back to the defaults. */
    setPrefs: (body: { matrix?: Record<string, string[]> | null; phone?: string }) => request<NotifyPrefs>('/notifications/prefs', { method: 'PUT', body: JSON.stringify(body) }),
    feed: (digest?: 'daily' | 'weekly') => request<NotifyFeedItem[]>(`/notifications/feed${digest ? `?digest=${digest}` : ''}`),
  },

  google: {
    status: () => request<GoogleStatus>('/google/status'),
    connectUrl: () => `${API_BASE}/google/connect`,
    disconnect: () => request<GoogleStatus>('/google/disconnect', { method: 'POST' }),
    testEmail: (to?: string) => request<{ sent: boolean; to: string }>('/google/test-email', { method: 'POST', body: JSON.stringify({ to }) }),
    send: (data: { to: string; subject: string; html: string; cc?: string; bcc?: string }) =>
      request('/google/send', { method: 'POST', body: JSON.stringify(data) }),
    /** Email the letter with the branded PDF attached. */
    sendLetter: (data: LetterInput) =>
      request<{ ok: boolean; filename: string }>('/google/send-letter', { method: 'POST', body: JSON.stringify(data) }),
    /** The same PDF the send would attach, as a blob for preview or download. */
    letterPdf: async (data: LetterInput): Promise<Blob> => {
      const token = session.get();
      const res = await fetch(`${API_BASE}/google/letter/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body && body.message) || `Could not render the PDF (${res.status})`);
      }
      return res.blob();
    },
    testDrive: () => request<{ ok: boolean; folderId: string }>('/google/drive/test', { method: 'POST' }),
    driveFiles: (q?: string) => request<DriveFile[]>(`/google/drive/files${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    myCalendar: {
      status: () => request<{ connected: boolean; email: string; connectedAt: string }>('/google/my-calendar/status'),
      connectUrl: () => `${API_BASE}/google/my-calendar/connect`,
      disconnect: () => request<{ connected: boolean }>('/google/my-calendar/disconnect', { method: 'POST' }),
      /** The signed-in user's own events for a window -- their real calendar. */
      events: (from: string, to: string) =>
        request<{ id: string; summary: string; start: string; end: string; allDay: boolean; htmlLink?: string }[]>(
          `/google/my-calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        ),
      /** Creates a real event (optionally with a Meet link and guests) on the signed-in user's own calendar. */
      createEvent: (body: { summary: string; start: string; end: string; description?: string; video?: boolean; location?: string; attendees?: string[] }) =>
        request<{ id: string; summary: string; start: string; end: string; allDay: boolean; htmlLink?: string; meetLink?: string }>(
          '/google/my-calendar/events', { method: 'POST', body: JSON.stringify(body) },
        ),
    },
  },
  dashboard: {
    /** The Dashboard's task cards, worked out on the server (today = the viewer's YYYY-MM-DD). */
    tasksSummary: (today: string) => request<TasksSummary>(`/dashboard/tasks-summary?today=${encodeURIComponent(today)}`),
    /** "My Tasks": my open work (assigned or collaborating), soonest due first -- `limit` rows and the total. */
    myTasks: (limit = 8) => request<{ total: number; rows: { key: string; title: string; context: string; dueDate?: string; priority?: string; where: 'board' | 'log'; to: string }[] }>(`/dashboard/my-tasks?limit=${limit}`),
    kpis: () => request('/dashboard/kpis'),
    budgetVsSpend: () => request('/dashboard/budget-vs-spend'),
    revenueByMonth: () => request('/dashboard/revenue-by-month'),
    leadFunnel: () => request('/dashboard/lead-funnel'),
    workload: () => request('/dashboard/workload'),
  },
  projects: {
    list: () => request('/projects'),
    get: (id: string) => request(`/projects/${id}`),
    create: (data: unknown) => request('/projects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string | number, data: unknown) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string | number) => request(`/projects/${id}`, { method: 'DELETE' }),
    /** Put on hold (or change the hold): creates / moves the follow-up task. */
    hold: (id: string | number, body: { until: string; reason?: string; followUpId?: string }) =>
      request(`/projects/${id}/hold`, { method: 'POST', body: JSON.stringify(body) }),
    /** Off hold; its follow-up task is marked done. */
    resume: (id: string | number) => request(`/projects/${id}/resume`, { method: 'POST' }),
  },
  people: {
    list: (project?: string) => request(`/people${project ? `?project=${encodeURIComponent(project)}` : ''}`),
    get: (id: string) => request(`/people/${id}`),
    create: (data: unknown) => request('/people', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string | number, data: unknown) => request(`/people/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string | number) => request(`/people/${id}`, { method: 'DELETE' }),
    /** Possible duplicates of a contact being added (same name, email or phone), Expired first. */
    duplicates: (q: Record<string, string>) => request<DupMatch[]>(`/people/duplicates?${new URLSearchParams(q).toString()}`),
    /** Activity: logged interactions, RFPs / estimates, the company's point of contact, and alerts. */
    activity: (id: number) => request<ContactActivity>(`/people/${id}/activity`),
    logInteraction: (id: number, d: { kind: string; at: string; note?: string }) => request<ContactInteraction>(`/people/${id}/interactions`, { method: 'POST', body: JSON.stringify(d) }),
    removeInteraction: (id: number, interactionId: string) => request(`/people/${id}/interactions/${interactionId}`, { method: 'DELETE' }),
    setPointOfContact: (id: number, on: boolean) => request(`/people/${id}/point-of-contact`, { method: 'PUT', body: JSON.stringify({ on }) }),
    /** "Same person": link two records both ways (read-only Reference on each), or unlink. */
    link: (id: number, otherId: number) => request(`/people/${id}/same-as/${otherId}`, { method: 'POST' }),
    unlink: (id: number, otherId: number) => request(`/people/${id}/same-as/${otherId}`, { method: 'DELETE' }),
    /** Read a business card (front and/or back photo): fields to review, and a token that keeps the photos with the contact. */
    scanCard: (front?: File | null, back?: File | null) => {
      const f = new FormData();
      if (front) f.append('front', front, front.name);
      if (back) f.append('back', back, back.name);
      return requestForm<CardScan>('/people/business-card/scan', f);
    },
    /** Add or replace card photos on a saved contact. */
    addCard: (id: number, front?: File | null, back?: File | null) => {
      const f = new FormData();
      if (front) f.append('front', front, front.name);
      if (back) f.append('back', back, back.name);
      return requestForm<any>(`/people/${id}/business-card`, f);
    },
    removeCard: (id: number, side: 'front' | 'back') => request<any>(`/people/${id}/business-card/${side}`, { method: 'DELETE' }),
    cardUrl: (id: number, side: 'front' | 'back', thumb = false) => `${API_BASE}/people/${id}/business-card/${side}/content${thumb ? '?thumb=1' : ''}`,
    /** Bulk import (People -> Import): the template's columns, Excel -> CSV, and preview / apply. */
    importColumns: () => request('/people/import/columns'),
    importConvert: (file: File) => { const f = new FormData(); f.append('file', file, file.name); return requestForm('/people/import/convert', f); },
    importRows: (rows: Record<string, string>[], dryRun: boolean, update: boolean, defaultKind?: string) => request('/people/import', { method: 'POST', body: JSON.stringify({ rows, dryRun, update, ...(defaultKind ? { defaultKind } : {}) }) }),
  },
  meetings: {
    list: () => request<import('./data/meetings').Meeting[]>('/meetings'),
    create: (d: unknown) => request<import('./data/meetings').Meeting>('/meetings', { method: 'POST', body: JSON.stringify(d) }),
    update: (id: string, d: unknown) => request<import('./data/meetings').Meeting>(`/meetings/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(d) }),
    remove: (id: string) => request(`/meetings/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    get: (id: string) => request<import('./data/meetings').Meeting>(`/meetings/${encodeURIComponent(id)}`),
    /** Raise a task, or a FOR RECORD item (FYI, observation, decision), from the meeting: a Special Actions Log entry linked to it. */
    addAction: (id: string, d: { topicType: string; subject: string; description?: string; assignedTo?: string; assignedToId?: string; dueDate?: string }) =>
      request<any>(`/meetings/${encodeURIComponent(id)}/actions`, { method: 'POST', body: JSON.stringify(d) }),
  },
  tasks: {
    /** Save pressed in the editor: send the emails held on this entry. */
    notify: (id: string) => request<{ sent: number }>(`/tasks/${encodeURIComponent(id)}/notify`, { method: 'POST' }),
    /** Projects and open leads a task can be linked to. */
    linkTargets: () => request<import('./data/linkTargets').LinkTargets>('/tasks/link-targets'),
    /** The Special Actions Log's statuses (Settings -> Special Actions Log statuses). */
    statuses: () => request<{ name: string; closed?: boolean; color?: string }[]>('/tasks/statuses'),
    /** What each priority means (Settings -> Task priorities). */
    priorities: () => request<PriorityDef[]>('/tasks/priorities'),
    savePriorities: (definitions: PriorityDef[]) => request<PriorityDef[]>('/tasks/priorities', { method: 'PUT', body: JSON.stringify({ definitions }) }),
    saveStatuses: (statuses: unknown) => request<{ name: string; closed?: boolean; color?: string }[]>('/tasks/statuses', { method: 'PUT', body: JSON.stringify({ statuses }) }),
    list: (tab?: string, project?: string, opts?: { slim?: boolean }) => {
      const params = new URLSearchParams();
      if (tab) params.set('tab', tab);
      if (project) params.set('project', project);
      if (opts?.slim) params.set('slim', '1');
      const qs = params.toString();
      return request(`/tasks${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) => request(`/tasks/${id}`),
    /** One page of the Special Actions Log -- filtered, searched and sorted on the server. */
    page: (o: { tab?: string; pf?: string; archived?: boolean; q?: string; scope?: string; person?: string; parts?: string; sort?: string; dir?: string; page?: number; size?: number }) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '' && v !== false) params.set(k, v === true ? '1' : String(v));
      return request<{
        rows: import('./data/tasks').Task[]; total: number; page: number; size: number; pages: number;
        counts: { tabs: Record<string, number>; archived: number; mine: number; scope: { all: number; mine: number; fromMe: number; assigned: number } };
        facets: { projects: string[]; hasGeneral: boolean; labels: string[] };
      }>(`/tasks/page?${params}`);
    },
    create: (data: unknown) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/tasks/${id}`, { method: 'DELETE' }),
    uploadAttachments: (id: string, files: File[] | FileList) => requestForm(`/tasks/${id}/attachments`, filesForm(files)),
    addLink: (id: string, name: string, url: string) => request(`/tasks/${id}/attachments/link`, { method: 'POST', body: JSON.stringify({ name, url }) }),
    removeAttachment: (id: string, attId: string) => request(`/tasks/${id}/attachments/${attId}`, { method: 'DELETE' }),
    addComment: (id: string, text: string) => request(`/tasks/${id}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),
    /** FOR RECORD: attach an entry to a task or a change order, or detach it. */
    link: (id: string, kind: 'task' | 'changeOrder', targetId: string) => request<any>(`/tasks/${encodeURIComponent(id)}/links`, { method: 'POST', body: JSON.stringify({ kind, targetId }) }),
    unlink: (id: string, kind: 'task' | 'changeOrder', targetId: string) => request<any>(`/tasks/${encodeURIComponent(id)}/links/${kind}/${encodeURIComponent(targetId)}`, { method: 'DELETE' }),
    /** A task driven by the entry, on its project and meeting, linked both ways. */
    linkedTask: (id: string, d: { subject?: string; description?: string; assignedTo?: string; assignedToId?: string; dueDate?: string } = {}) =>
      request<{ task: any; entry: any }>(`/tasks/${encodeURIComponent(id)}/linked-task`, { method: 'POST', body: JSON.stringify(d) }),
  },
  pipeline: {
    /** Archived deals are excluded unless asked for. */
    list: (includeArchived = false) => request(`/pipeline${includeArchived ? '?archived=true' : ''}`),
    stages: () => request('/pipeline/stages'),
    get: (id: string) => request(`/pipeline/${id}`),
    create: (data: unknown) => request('/pipeline', { method: 'POST', body: JSON.stringify(data) }),
    updateStage: (id: string, stage: string) => request(`/pipeline/${id}/stage`, { method: 'PUT', body: JSON.stringify({ stage }) }),
    setArchived: (id: string, archived: boolean) =>
      request(`/pipeline/${id}/archived`, { method: 'PUT', body: JSON.stringify({ archived }) }),
    setRoles: (id: string, roles: Record<string, string>) =>
      request(`/pipeline/${id}/roles`, { method: 'PUT', body: JSON.stringify(roles) }),
    setLoss: (id: string, data: { lossReason: string; note?: string }) => request(`/pipeline/${id}/loss`, { method: 'PUT', body: JSON.stringify(data) }),
    setRejection: (id: string, data: { rejectionType: 'internal' | 'client' | 'referred'; rejectionReason?: string; lossReason?: string; referredToName?: string; referredToCompany?: string; referredToContact?: string }) =>
      request(`/pipeline/${id}/rejection`, { method: 'PUT', body: JSON.stringify(data) }),
    logFollowUp: (id: string, data: Record<string, unknown>) =>
      request(`/pipeline/${id}/follow-up`, { method: 'POST', body: JSON.stringify(data) }),
    setNotes: (id: string, data: { notes: unknown[]; action: string; stageName?: string; text?: string }) =>
      request(`/pipeline/${id}/notes`, { method: 'PUT', body: JSON.stringify(data) }),
    addEvent: (id: string, action: string) =>
      request(`/pipeline/${id}/event`, { method: 'PUT', body: JSON.stringify({ action }) }),
    /** Approved lead becomes a project; the card is archived off the board. */
    convert: (id: string, data: { stage?: string; name?: string; contractAmt?: string }) =>
      request<{ project: { id: number; name: string; stage: string }; deal: unknown }>(
        `/pipeline/${id}/convert`, { method: 'POST', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/pipeline/${id}`, { method: 'DELETE' }),
  },
  leads: {
    list: () => request('/leads'),
    options: () => request('/leads/options'),
    get: (id: string) => request(`/leads/${id}`),
    create: (data: unknown) => request('/leads', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/leads/${id}`, { method: 'DELETE' }),
  },
  scoring: {
    getTemplate: () => request('/scoring/template'),
    saveTemplate: (criteria: unknown) => request('/scoring/template', { method: 'PUT', body: JSON.stringify({ criteria }) }),
  },
  emailTemplates: {
    list: () => request('/email-templates'),
    get: (id: string) => request(`/email-templates/${id}`),
    create: (data: unknown) => request('/email-templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/email-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/email-templates/${id}`, { method: 'DELETE' }),
  },
  leadFiles: {
    list: (leadId: string) => request<any[]>(`/lead-files/${encodeURIComponent(leadId)}`),
    /** The client welcome email + private upload link (F11). */
    /** Every file on a lead / project: its own, the client's, its tasks', RFIs', File Room -- numbered. */
    all: (leadId: string) => request<any>(`/lead-files/${encodeURIComponent(leadId)}/all`),
    allForProject: (projectId: number) => request<any>(`/lead-files/project/${projectId}/all`),
    welcomeStatus: (leadId: string) => request<any>(`/lead-files/${encodeURIComponent(leadId)}/welcome`),
    sendWelcome: (leadId: string, d: { to?: string; note?: string; items?: string[] }) => request<any>(`/lead-files/${encodeURIComponent(leadId)}/welcome`, { method: 'POST', body: JSON.stringify(d) }),
    disableWelcome: (leadId: string) => request<any>(`/lead-files/${encodeURIComponent(leadId)}/welcome/disable`, { method: 'POST' }),
    /** `stage` tags the files with the pipeline stage they belong to. */
    upload: (leadId: string, files: File[], stage?: string, stageName?: string) =>
      requestForm<any[]>(`/lead-files/${encodeURIComponent(leadId)}/attachments${stage ? `?stage=${encodeURIComponent(stage)}&stageName=${encodeURIComponent(stageName || '')}` : ''}`, filesForm(files)),
    link: (leadId: string, name: string, url: string, stage?: string, stageName?: string) =>
      request<any[]>(`/lead-files/${encodeURIComponent(leadId)}/attachments/link`, { method: 'POST', body: JSON.stringify({ name, url, stage, stageName }) }),
    remove: (leadId: string, attId: string) => request<any[]>(`/lead-files/${encodeURIComponent(leadId)}/attachments/${encodeURIComponent(attId)}`, { method: 'DELETE' }),
  },
  /** The client's own upload page -- no account, keyed by the link's token. */
  clientUpload: {
    view: (token: string) => request<any>(`/client-upload?token=${encodeURIComponent(token)}`),
    upload: (token: string, files: File[], item?: string) => { const f = filesForm(files); if (item) f.append('item', item); return requestForm<any>(`/client-upload/files?token=${encodeURIComponent(token)}`, f); },
  },
  rfis: {
    access: () => request<{ view: boolean; manage: boolean }>('/rfis/access'),
    list: (projectId?: number) => request<any[]>(`/rfis${projectId ? `?projectId=${projectId}` : ''}`),
    get: (id: string) => request<any>(`/rfis/${encodeURIComponent(id)}`),
    create: (data: unknown) => request<any>('/rfis', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request<any>(`/rfis/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/rfis/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    send: (id: string, note?: string) => request<any>(`/rfis/${encodeURIComponent(id)}/send`, { method: 'POST', body: JSON.stringify({ note }) }),
    markSent: (id: string) => request<any>(`/rfis/${encodeURIComponent(id)}/mark-sent`, { method: 'POST' }),
    answer: (id: string, data: unknown) => request<any>(`/rfis/${encodeURIComponent(id)}/answer`, { method: 'POST', body: JSON.stringify(data) }),
    close: (id: string, note?: string) => request<any>(`/rfis/${encodeURIComponent(id)}/close`, { method: 'POST', body: JSON.stringify({ note }) }),
    reopen: (id: string) => request<any>(`/rfis/${encodeURIComponent(id)}/reopen`, { method: 'POST' }),
    void: (id: string, reason: string) => request<any>(`/rfis/${encodeURIComponent(id)}/void`, { method: 'POST', body: JSON.stringify({ reason }) }),
    pdfUrl: (id: string, download = false) => `${API_BASE}/rfis/${encodeURIComponent(id)}/pdf${download ? '?download=1' : ''}`,
    upload: (id: string, files: File[]) => requestForm<any>(`/rfis/${encodeURIComponent(id)}/attachments`, filesForm(files)),
    link: (id: string, name: string, url: string) => request<any>(`/rfis/${encodeURIComponent(id)}/attachments/link`, { method: 'POST', body: JSON.stringify({ name, url }) }),
    removeAttachment: (id: string, attId: string) => request<any>(`/rfis/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attId)}`, { method: 'DELETE' }),
  },
  reminders: {
    /** Every digest, now (admin). */
    run: () => request<{ sent: number; skipped: number; recipients: string[] }>('/reminders/send-all', { method: 'POST' }),
    /** Just mine, now -- whatever the schedule says. */
    mine: () => request<{ sent: boolean; reason?: string; overdue: number; today: number; soon: number }>('/reminders/mine', { method: 'POST' }),
  },
  users: {
    list: () => request('/users'),
    /** Names and roles of the team, for people pickers -- open to all staff (the full list is admin-only). */
    directory: () => request('/users/directory'),
    create: (data: unknown) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/users/${id}`, { method: 'DELETE' }),
    resendInvite: (id: string) => request<{ invite: { sent: boolean; url?: string; error?: string } }>(`/users/${id}/resend-invite`, { method: 'POST' }),
    /** A person's access: their role's settings and their own changes. */
    access: (id: string) => request<{ userId: string; roleKey: string; roleName: string; rolePermissions: import('./data/users').RolePermissions; overrides: Record<string, { level?: string; extent?: string }> }>(`/users/${encodeURIComponent(id)}/access`),
    setAccess: (id: string, overrides: Record<string, { level?: string; extent?: string }>) => request<any>(`/users/${encodeURIComponent(id)}/access`, { method: 'PUT', body: JSON.stringify({ overrides }) }),
  },
  roles: {
    list: () => request('/roles'),
    create: (data: unknown) => request('/roles', { method: 'POST', body: JSON.stringify(data) }),
    update: (key: string, data: unknown) => request(`/roles/${key}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (key: string) => request(`/roles/${key}`, { method: 'DELETE' }),
    /** The PEOPLE ACCESS sheet's rows: a preview (dryRun) or applied. */
  },
  projectTasks: {
    /** Save pressed in the task editor: send the emails held on the task and its subtasks. */
    notify: (id: string) => request<{ sent: number }>(`/project-tasks/${encodeURIComponent(id)}/notify`, { method: 'POST' }),
    /** projectId: a number scopes to that project; null scopes to the
     *  General Tasks board; omitted (list only) returns everything. */
    board: (projectId: number | null, opts?: { slim?: boolean }) => request(`/project-tasks/board?projectId=${projectId === null ? 'null' : projectId}${opts?.slim ? '&slim=1' : ''}`),
    /** opts.slim: without each task's comments and history (they come with `get` when a task is opened). */
    list: (projectId?: number | null, opts?: { slim?: boolean }) => {
      const params = new URLSearchParams();
      if (projectId !== undefined) params.set('projectId', projectId === null ? 'null' : String(projectId));
      if (opts?.slim) params.set('slim', '1');
      const qs = params.toString();
      return request(`/project-tasks${qs ? `?${qs}` : ''}`);
    },
    /** One task in full, comments and history included. */
    get: (id: string) => request<import('./data/projectTasks').ProjectTask>(`/project-tasks/${encodeURIComponent(id)}`),
    create: (data: unknown) => request('/project-tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/project-tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/project-tasks/${id}`, { method: 'DELETE' }),
    reorder: (sectionId: string, ids: string[]) => request('/project-tasks/reorder', { method: 'PUT', body: JSON.stringify({ sectionId, ids }) }),
    uploadAttachments: (id: string, files: File[] | FileList) => requestForm(`/project-tasks/${id}/attachments`, filesForm(files)),
    addLink: (id: string, name: string, url: string) => request(`/project-tasks/${id}/attachments/link`, { method: 'POST', body: JSON.stringify({ name, url }) }),
    removeAttachment: (id: string, attId: string) => request(`/project-tasks/${id}/attachments/${attId}`, { method: 'DELETE' }),
    addComment: (id: string, text: string) => request(`/project-tasks/${id}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),
  },
  projectProgram: {
    get: (projectId: number) => request(`/project-program?projectId=${projectId}`),
    save: (projectId: number, data: unknown) => request('/project-program', { method: 'PUT', body: JSON.stringify({ projectId, data }) }),
    complete: (projectId: number, complete: boolean) => request('/project-program/complete', { method: 'PUT', body: JSON.stringify({ projectId, complete }) }),
    /** The client's own read of their project's program, gated by the People directory. */
    mine: (projectId: number) => request<{
      data: unknown; updatedAt: string; sentAt: string; signedAt: string; signedByName: string; signedByEmail: string;
    }>(`/project-program/mine?projectId=${projectId}`),
    /** The client's e-signature -- image is a base64 PNG from the signature pad. */
    sign: (projectId: number, name: string, image: string) =>
      request<{ signedAt: string; signedByName: string }>('/project-program/sign', { method: 'POST', body: JSON.stringify({ projectId, name, image }) }),
    /** Same document, held against a lead -- the programme is produced before conversion. */
    getForLead: (leadId: string) => request(`/project-program?leadId=${encodeURIComponent(leadId)}`),
    saveForLead: (leadId: string, data: unknown) => request('/project-program', { method: 'PUT', body: JSON.stringify({ leadId, data }) }),
    completeForLead: (leadId: string, complete: boolean) => request('/project-program/complete', { method: 'PUT', body: JSON.stringify({ leadId, complete }) }),
    /** The program on the letterhead, as a blob to preview or download. */
    pdf: async (payload: unknown): Promise<Blob> => {
      const token = session.get();
      const res = await fetch(`${API_BASE}/project-program/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body && body.message) || `Could not render the PDF (${res.status})`);
      }
      return res.blob();
    },
    /** Email it to the client with that same PDF attached -- plus any extra files chosen. */
    send: (payload: unknown) =>
      request<{ ok: boolean; filename: string; to: string; attachmentCount: number }>('/project-program/send', { method: 'POST', body: JSON.stringify(payload) }),
    /** Every past save, newest first -- the living document's history. */
    versions: (owner: { projectId?: number; leadId?: string }) =>
      request<{ id: number; savedAt: string; savedBy: string }[]>(
        `/project-program/versions?${owner.leadId ? `leadId=${encodeURIComponent(owner.leadId)}` : `projectId=${owner.projectId}`}`,
      ),
    getVersion: (id: number, owner: { projectId?: number; leadId?: string }) =>
      request<{ id: number; savedAt: string; savedBy: string; data: unknown }>(
        `/project-program/versions/${id}?${owner.leadId ? `leadId=${encodeURIComponent(owner.leadId)}` : `projectId=${owner.projectId}`}`,
      ),
    restoreVersion: (id: number, owner: { projectId?: number; leadId?: string }) =>
      request(`/project-program/versions/${id}/restore`, { method: 'POST', body: JSON.stringify(owner) }),
  },
  proposals: {
    /** Client contracts sent and not signed yet (Approvals). */
    awaiting: () => request<{ dealId: string; dealName: string; subject: string; amount: string; sentAt: string; sentTo: string }[]>('/proposals/awaiting'),
    get: (dealId: string) => request(`/proposals?dealId=${encodeURIComponent(dealId)}`),
    save: (dealId: string, body: { subject?: string; html?: string; amount?: string; requiresSecondSignatory?: boolean }) =>
      request('/proposals', { method: 'PUT', body: JSON.stringify({ dealId, ...body }) }),
    /** Whatever is currently in the composer, rendered as a PDF to preview -- no save needed first. */
    pdf: async (body: { subject?: string; html?: string; amount?: string; dealName?: string }): Promise<Blob> => {
      const token = session.get();
      const res = await fetch(`${API_BASE}/proposals/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error((errBody && errBody.message) || `Could not render the PDF (${res.status})`);
      }
      return res.blob();
    },
    /** Emails the proposal with the letterhead PDF attached, plus a 10-day signing link -- and any extra files chosen. */
    send: (dealId: string, to: string, cc?: string, extraAttachments?: { filename: string; mimeType?: string; contentBase64: string }[]) =>
      request<{ ok: boolean; to: string; link: string; attachmentCount: number }>('/proposals/send', { method: 'POST', body: JSON.stringify({ dealId, to, cc, extraAttachments }) }),
    /** The prospect's own view, no account needed -- gated by the signed link's token. */
    public: {
      get: (token: string) => request(`/proposals/public?token=${encodeURIComponent(token)}`),
      sign: (token: string, name: string, email: string, image: string, reviewedAllPages: boolean, slot: 1 | 2 = 1) =>
        request('/proposals/public/sign', { method: 'POST', body: JSON.stringify({ token, name, email, image, reviewedAllPages, slot }) }),
      /** A real, scrollable PDF -- for an <iframe>/<embed>, not a fetch call. */
      pdfUrl: (token: string) => `${API_BASE}/proposals/public/pdf?token=${encodeURIComponent(token)}`,
    },
  },
  /** Contracts signed inside ODIN: templates, drafts, sending, counter-signing, the signed PDF. */
  contracts: {
    types: () => request<{ types: ContractTypeInfo[]; mergeFields: [string, string][] }>('/contracts/types'),
    templates: () => request<ContractTemplate[]>('/contracts/templates'),
    createTemplate: (d: Partial<ContractTemplate>) => request<ContractTemplate>('/contracts/templates', { method: 'POST', body: JSON.stringify(d) }),
    saveTemplate: (id: string, d: Partial<ContractTemplate>) => request<ContractTemplate>(`/contracts/templates/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(d) }),
    removeTemplate: (id: string) => request(`/contracts/templates/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    list: (q: Record<string, string> = {}) => request<Contract[]>(`/contracts?${new URLSearchParams(q).toString()}`),
    get: (id: string) => request<Contract>(`/contracts/${encodeURIComponent(id)}`),
    create: (d: Record<string, unknown>) => request<Contract>('/contracts', { method: 'POST', body: JSON.stringify(d) }),
    update: (id: string, d: Record<string, unknown>) => request<Contract>(`/contracts/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(d) }),
    remove: (id: string) => request(`/contracts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    send: (id: string, d: { note?: string; resendKeys?: string[] } = {}) => request<{ sent: string[] }>(`/contracts/${encodeURIComponent(id)}/send`, { method: 'POST', body: JSON.stringify(d) }),
    countersign: (id: string, d: { name: string; initials: string; image: string; initialled: number; reviewed: boolean }) => request<Contract>(`/contracts/${encodeURIComponent(id)}/countersign`, { method: 'POST', body: JSON.stringify(d) }),
    void: (id: string, reason: string) => request<Contract>(`/contracts/${encodeURIComponent(id)}/void`, { method: 'POST', body: JSON.stringify({ reason }) }),
    /** The contract as a PDF (signed once it is), for viewing or downloading. */
    pdf: async (id: string) => new Blob([await requestBytes(`/contracts/${encodeURIComponent(id)}/pdf`)], { type: 'application/pdf' }),
    /** File Room files on a project that can go with a contract (estimates, drawings, specs). */
    files: (projectId: number) => request<{ id: string; name: string; folderPath: string[] }[]>(`/contracts/files?projectId=${projectId}`),
    /** A project's change orders and subcontracts / POs, for a contract to be about. */
    links: (projectId: number) => request<{ changeOrders: { id: string; number: string; title: string; amount: number | null; status: string }[]; commitments: { id: string; number: string; title: string; vendorName: string; contractorId?: string | null; type: string }[] }>(`/contracts/links?projectId=${projectId}`),
    public: {
      get: (token: string) => request<ContractSigningView>(`/contracts/public?token=${encodeURIComponent(token)}`),
      sign: (token: string, d: { name: string; initials: string; image: string; initialled: number; reviewed: boolean }) => request<ContractSigningView>('/contracts/public/sign', { method: 'POST', body: JSON.stringify({ token, ...d }) }),
      pdfUrl: (token: string, download = false) => `${API_BASE}/contracts/public/pdf?token=${encodeURIComponent(token)}${download ? '&download=1' : ''}`,
      fileUrl: (token: string, fileId: string) => `${API_BASE}/contracts/public/file?token=${encodeURIComponent(token)}&fileId=${encodeURIComponent(fileId)}`,
    },
  },
  guestAccess: {
    /** Time-limited logins granted to clients/consultants, in place of standing passwords. */
    list: (projectId?: number) => request<{
      id: number; name: string; email: string; tier: string; projectId: number; createdAt: string;
      expiresAt: string; createdBy: string; revokedAt: string; lastUsedAt: string; expired: boolean; hasFullAccount: boolean;
    }[]>(`/guest-access${projectId ? `?projectId=${projectId}` : ''}`),
    create: (body: { name: string; email: string; tier: 'client' | 'consultant'; projectId: number; days?: number }) =>
      request<{ id: number; link: string; expiresAt: string; emailSent: boolean; emailError?: string }>('/guest-access', { method: 'POST', body: JSON.stringify(body) }),
    revoke: (id: number) => request(`/guest-access/${id}/revoke`, { method: 'POST' }),
    promote: (id: number) => request<{ sent: boolean; to?: string }>(`/guest-access/${id}/promote`, { method: 'POST' }),
    /** The guest's own step, off the token in their emailed link -- no account needed until this resolves. */
    resolve: (token: string) => request<{ token: string; expiresIn: number; user: unknown }>('/guest-access/resolve', { method: 'POST', body: JSON.stringify({ token }) }),
  },
  scheduling: {
    /** Whose calendars show up when checking availability -- the office's own configured list. */
    calendars: () => request<{ name: string; email: string }[]>('/scheduling/calendars'),
    setCalendars: (calendars: { name: string; email: string }[]) =>
      request<{ name: string; email: string }[]>('/scheduling/calendars', { method: 'POST', body: JSON.stringify(calendars) }),
    /** Busy blocks for the configured calendars (or an explicit list) between two ISO timestamps. */
    availability: (from: string, to: string, emails?: string[]) =>
      request<{ email: string; busy: { start: string; end: string }[] | null; error?: string }[]>(
        `/scheduling/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${emails?.length ? `&emails=${encodeURIComponent(emails.join(','))}` : ''}`,
      ),
    /** Create or update the real calendar event a booking represents. */
    createEvent: (payload: {
      eventId?: string; summary: string; description?: string; start: string; end: string;
      location?: string; attendees?: (string | { email: string; optional?: boolean; name?: string })[]; video?: boolean;
    }) => request<{ id: string; htmlLink: string; meetLink?: string }>('/scheduling/events', { method: 'POST', body: JSON.stringify(payload) }),
    /** Who a site visit invite goes to by default, each required or optional. */
    siteVisitTeam: () => request<import('./data/siteVisitInvite').Guest[]>('/scheduling/site-visit-team'),
    setSiteVisitTeam: (team: import('./data/siteVisitInvite').Guest[]) =>
      request<import('./data/siteVisitInvite').Guest[]>('/scheduling/site-visit-team', { method: 'POST', body: JSON.stringify(team) }),
  },
  /** Construction -> Progress Photos: a project's photos by track and category (files live in its File Room). */
  progressPhotos: {
    categories: () => request<import('./data/progressPhotos').PhotoCategories>('/progress-photos/categories'),
    list: (projectId: number) => request<{ photos: import('./data/progressPhotos').ProgressPhoto[]; unsorted: import('./data/progressPhotos').UnsortedPhoto[]; notes: import('./data/progressPhotos').ProgressNote[]; progress: import('./data/progressPhotos').ProgressSummary }>(`/progress-photos?projectId=${projectId}`),
    addNote: (d: Record<string, unknown>) => request<import('./data/progressPhotos').ProgressNote>('/progress-photos/notes', { method: 'POST', body: JSON.stringify(d) }),
    updateNote: (id: string, d: Record<string, unknown>) => request<import('./data/progressPhotos').ProgressNote>(`/progress-photos/notes/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(d) }),
    removeNote: (id: string) => request(`/progress-photos/notes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    upload: (projectId: number, files: File[], meta: Record<string, unknown>, dates: string[]) => {
      const form = new FormData();
      form.append('projectId', String(projectId));
      form.append('meta', JSON.stringify(meta));
      form.append('dates', JSON.stringify(dates));
      files.forEach((f) => form.append('files', f, f.name));
      return requestForm<{ uploaded: number }>('/progress-photos/upload', form);
    },
    classify: (fileIds: string[], meta: Record<string, unknown>) => request<{ sorted: number }>('/progress-photos/classify', { method: 'POST', body: JSON.stringify({ fileIds, meta }) }),
    update: (id: string, d: Record<string, unknown>) => request<import('./data/progressPhotos').ProgressPhoto>(`/progress-photos/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(d) }),
    remove: (id: string) => request(`/progress-photos/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    /** The photo itself (thumb: Drive's small version; download: as a file). */
    url: (id: string, opts: { thumb?: boolean; download?: boolean; size?: number } = {}) => `${API_BASE}/file-room/files/${encodeURIComponent(id)}/content${opts.thumb ? `?thumb=1${opts.size ? `&size=${opts.size}` : ''}` : opts.download ? '?download=1' : ''}`,
  },
  fileRoom: {
    list: (projectId?: number) => request(`/file-room${projectId ? `?projectId=${projectId}` : ''}`),
    upload: (projectId: number, path: string[], files: File[] | FileList) => {
      const form = new FormData();
      form.append('projectId', String(projectId));
      form.append('path', JSON.stringify(path));
      Array.from(files).forEach((f) => form.append('files', f, f.name));
      return requestForm('/file-room/upload', form);
    },
    rename: (id: string, name: string) => request(`/file-room/files/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
    setNotes: (id: string, notes: string) => request(`/file-room/files/${id}`, { method: 'PUT', body: JSON.stringify({ notes }) }),
    markLatest: (id: string) => request(`/file-room/files/${id}/latest`, { method: 'PUT' }),
    remove: (id: string) => request(`/file-room/files/${id}`, { method: 'DELETE' }),
    createFolder: (projectId: number, path: string[], name: string) =>
      request('/file-room/folders', { method: 'POST', body: JSON.stringify({ projectId, path, name }) }),
    removeFolder: (id: string) => request(`/file-room/folders/${id}`, { method: 'DELETE' }),
    /** Files emailed from the File Room -- for a project or one file. */
    shares: (q: { projectId?: number; fileId?: string }) =>
      request<FileShare[]>(`/file-room/shares?${new URLSearchParams(Object.entries(q).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))}`),
    shareMany: (ids: string[]) => request<{ id: string; name: string; url: string }[]>('/file-room/files/share', { method: 'POST', body: JSON.stringify({ ids }) }),
    emailMany: (ids: string[], to: string, note: string) => request<{ sent: boolean; to: string; count: number }>('/file-room/files/email', { method: 'POST', body: JSON.stringify({ ids, to, note }) }),
    moveMany: (ids: string[], folderPath: string[]) => request<{ moved: number }>('/file-room/files/move', { method: 'PUT', body: JSON.stringify({ ids, folderPath }) }),
    move: (id: string, folderPath: string[]) => request(`/file-room/files/${id}/move`, { method: 'PUT', body: JSON.stringify({ folderPath }) }),
    applyTemplate: (projectId: number) => request<{ created: number; template: number }>(`/file-room/template?projectId=${projectId}`, { method: 'POST' }),
    /** A file the browser can show: Office and Google documents arrive as PDF. */
    previewUrl: (id: string) => `${API_BASE}/file-room/files/${encodeURIComponent(id)}/preview`,
    share: (id: string) => request<{ url: string; name: string }>(`/file-room/files/${id}/share`, { method: 'POST' }),
    email: (id: string, to: string, note: string) =>
      request<{ sent: boolean; to: string }>(`/file-room/files/${id}/email`, { method: 'POST', body: JSON.stringify({ to, note }) }),
    sync: (projectId: number) =>
      request<{ added: number; updated: number; removed: number; folders: number; syncedAt?: string }>(`/file-room/sync?projectId=${projectId}`, { method: 'POST' }),
    /** The PDF itself, for the markup viewer. */
    bytes: (id: string) => requestBytes(`/file-room/files/${encodeURIComponent(id)}/content`),
    markups: (id: string) => request<Markup[]>(`/file-room/files/${encodeURIComponent(id)}/markups`),
    addMarkup: (id: string, m: Pick<Markup, 'kind' | 'page' | 'data' | 'private'> & { layer?: string | null }) => request<Markup>(`/file-room/files/${encodeURIComponent(id)}/markups`, { method: 'POST', body: JSON.stringify(m) }),
    editMarkup: (mid: string, patch: Partial<Pick<Markup, 'data' | 'private' | 'layer' | 'linkType' | 'linkId'>>) => request<Markup>(`/file-room/markups/${encodeURIComponent(mid)}`, { method: 'PUT', body: JSON.stringify(patch) }),
    removeMarkup: (mid: string) => request(`/file-room/markups/${encodeURIComponent(mid)}`, { method: 'DELETE' }),
    /** Rename a layer on a drawing (from: its name, or null for someone's own unnamed layer). */
    renameLayer: (id: string, from: string | null, to: string, authorId?: string | null) => request<{ layer: string; updated: number }>(`/file-room/files/${encodeURIComponent(id)}/layers`, { method: 'PUT', body: JSON.stringify({ from, to, authorId }) }),
    addPinPhotos: (mid: string, files: File[] | FileList) => requestForm<Markup>(`/file-room/markups/${encodeURIComponent(mid)}/photos`, filesForm(files)),
    removePinPhoto: (mid: string, fileId: string) => request<Markup>(`/file-room/markups/${encodeURIComponent(mid)}/photos/${encodeURIComponent(fileId)}`, { method: 'DELETE' }),
    /** The PDF with markups drawn in (just these layers, by key, when given). */
    markedUpPdf: (id: string, layers?: string[]) => requestBytes(`/file-room/files/${encodeURIComponent(id)}/markups/pdf${layers?.length ? `?layers=${encodeURIComponent(layers.join(','))}` : ''}`),
    saveMarkedUpCopy: (id: string, layers?: string[]) => request<{ id: string; name: string }>(`/file-room/files/${encodeURIComponent(id)}/markups/copy`, { method: 'POST', body: JSON.stringify({ layers }) }),
    /** Relative on purpose: works through the vite proxy and same-origin in prod. */
    contentUrl: (id: string, opts?: { thumb?: boolean; download?: boolean }) => {
      const q = [opts?.thumb ? 'thumb=1' : '', opts?.download ? 'download=1' : ''].filter(Boolean).join('&');
      return `${API_BASE}/file-room/files/${encodeURIComponent(id)}/content${q ? `?${q}` : ''}`;
    },
  },
  projectPhases: {
    list: (projectId: number) => request(`/project-phases?projectId=${projectId}`),
    board: (projectId: number) => request(`/project-phases/board?projectId=${projectId}`),
    /** Every project's phases with dates worked out from their tasks, for the Schedule. */
    schedule: () => request<any[]>('/project-phases/schedule'),
    /** Every project's phase progress in one call, for the Design board. */
    overview: () => request('/project-phases/overview'),
    /** Bring one project up to the current programme template. */
    applyTemplate: (projectId: number) =>
      request<{ phasesAdded: number; tasksAdded: number; phasesNotInTemplate: string[] }>(
        `/project-phases/apply-template?projectId=${projectId}`, { method: 'POST' }),
    create: (data: unknown) => request('/project-phases', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/project-phases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/project-phases/${id}`, { method: 'DELETE' }),
    /** Give a project a phase (and its template tasks) it doesn't have yet -- e.g. dropping it onto a board column from a different template. */
    adopt: (projectId: number, key: string) =>
      request(`/project-phases/adopt`, { method: 'POST', body: JSON.stringify({ projectId, key }) }),
  },
  programmeTemplate: {
    /** The whole library -- a kitchen remodel and a ground-up build don't share one shape. */
    list: () => request<{ key: string; name: string; phases: unknown[]; projectTypes?: string[]; category?: string }[]>('/project-phases/templates'),
    /** Create (omit key) or replace (pass key) one named template. */
    save: (key: string | undefined, name: string, phases: unknown, projectTypes?: string[], category?: string) =>
      request<{ key: string; name: string; phases: unknown[]; projectTypes?: string[]; category?: string }>('/project-phases/templates', { method: 'PUT', body: JSON.stringify({ key, name, phases, projectTypes, category }) }),
    remove: (key: string) => request(`/project-phases/templates/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  },

  projectSections: {
    list: (projectId: number) => request(`/project-sections?projectId=${projectId}`),
    create: (data: unknown) => request('/project-sections', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/project-sections/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/project-sections/${id}`, { method: 'DELETE' }),
    /** The same columns on every board (Oct 27 sync): each change applies to every project's board and General. */
    addEverywhere: (name: string) => request<{ added: number }>('/project-sections/everywhere', { method: 'POST', body: JSON.stringify({ name }) }),
    renameEverywhere: (id: string, name: string) => request<{ renamed: number }>(`/project-sections/${id}/everywhere`, { method: 'PUT', body: JSON.stringify({ name }) }),
    orderEverywhere: (names: string[]) => request('/project-sections/order-everywhere', { method: 'PUT', body: JSON.stringify({ names }) }),
    removeEverywhere: (id: string) => request<{ removed: number }>(`/project-sections/${id}/everywhere`, { method: 'DELETE' }),
    matchAll: (projectId: number | null) => request<{ boards: number }>(`/project-sections/match/${projectId ?? 'general'}`, { method: 'POST' }),
  },
  workflows: {
    list: (projectId?: number | 'none') => request(`/workflows${projectId !== undefined ? `?projectId=${projectId}` : ''}`),
    create: (data: unknown) => request('/workflows', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/workflows/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/workflows/${id}`, { method: 'DELETE' }),
    apply: (templateId: string, projectId: number) => request('/workflows/apply', { method: 'POST', body: JSON.stringify({ templateId, projectId }) }),
  },
  workflowItems: {
    list: (workflowId: string) => request(`/workflow-items?workflowId=${workflowId}`),
    create: (data: unknown) => request('/workflow-items', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/workflow-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/workflow-items/${id}`, { method: 'DELETE' }),
  },
  tickets: {
    list: () => request('/tickets'),
    create: (data: unknown) => request('/tickets', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/tickets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/tickets/${id}`, { method: 'DELETE' }),
  },
  faqs: {
    list: () => request('/faqs'),
    create: (data: unknown) => request('/faqs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/faqs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/faqs/${id}`, { method: 'DELETE' }),
  },
  consultants: {
    list: () => request('/consultants'),
    create: (data: unknown) => request('/consultants', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/consultants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/consultants/${id}`, { method: 'DELETE' }),
  },
  employees: {
    list: () => request('/employees'),
    get: (id: string) => request(`/employees/${encodeURIComponent(id)}`),
    create: (data: unknown) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/employees/${id}`, { method: 'DELETE' }),
    uploadPhoto: (id: string, file: File) => requestForm(`/employees/${encodeURIComponent(id)}/photo`, filesForm([file])),
    /** Relative, cookie-authenticated -- usable directly as an <img src>. */
    photoUrl: (id: string, version?: string) => `${API_BASE}/employees/${encodeURIComponent(id)}/photo${version ? `?v=${encodeURIComponent(version)}` : ''}`,
  },
  /** Project financials: contract, schedule of values, earned value, invoices and payments. */
  /** The app-wide audit log (admins): who changed what, newest first. */
  /** Who opened a change order or a share we emailed (Oct 27 backlog item 12). */
  tracking: {
    list: (kind: 'co' | 'share', refId: string) => request<{ kind: string; refId: string; recipient?: string | null; createdAt: string; firstOpenedAt?: string | null; lastOpenedAt?: string | null; opens?: number | null }[]>(`/tracking/${kind}/${encodeURIComponent(refId)}`),
  },
  audit: {
    list: (q: Record<string, string> = {}) => request<AuditRow[]>(`/audit?${new URLSearchParams(q).toString()}`),
    /** One project's trail (internal staff; no finance entries). */
    project: (projectId: number) => request<AuditRow[]>(`/audit-project/${projectId}`),
  },
  finance: {
    access: () => request('/finance/access'),
    brand: () => request('/finance/brand'),
    overview: (projectId: number) => request(`/finance/projects/${projectId}`),
    saveSettings: (projectId: number, d: unknown) => request(`/finance/projects/${projectId}`, { method: 'PUT', body: JSON.stringify(d) }),
    addMilestone: (projectId: number, d: unknown) => request(`/finance/projects/${projectId}/milestones`, { method: 'POST', body: JSON.stringify(d) }),
    activity: (projectId: number) => request(`/finance/projects/${projectId}/activity`),
    invoices: (projectId: number) => request(`/finance/projects/${projectId}/invoices`),
    createInvoice: (projectId: number, d: unknown) => request(`/finance/projects/${projectId}/invoices`, { method: 'POST', body: JSON.stringify(d) }),
    payments: (projectId: number) => request(`/finance/projects/${projectId}/payments`),
    updateItem: (kind: string, id: string, d: unknown) => request(`/finance/items/${kind}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(d) }),
    reportProgress: (kind: string, id: string, d: unknown) => request(`/finance/items/${kind}/${encodeURIComponent(id)}/progress`, { method: 'POST', body: JSON.stringify(d) }),
    approveProgress: (kind: string, id: string, d: unknown) => request(`/finance/items/${kind}/${encodeURIComponent(id)}/progress/approve`, { method: 'POST', body: JSON.stringify(d) }),
    progressHistory: (kind: string, id: string) => request(`/finance/items/${kind}/${encodeURIComponent(id)}/progress`),
    itemInvoices: (kind: string, id: string) => request(`/finance/items/${kind}/${encodeURIComponent(id)}/invoices`),
    invoice: (id: string) => request(`/finance/invoices/${id}`),
    updateInvoice: (id: string, d: unknown) => request(`/finance/invoices/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    deleteInvoice: (id: string) => request(`/finance/invoices/${id}`, { method: 'DELETE' }),
    issueInvoice: (id: string, version: number) => request(`/finance/invoices/${id}/issue`, { method: 'POST', body: JSON.stringify({ version }) }),
    voidInvoice: (id: string, d: unknown) => request(`/finance/invoices/${id}/void`, { method: 'POST', body: JSON.stringify(d) }),
    recordPayment: (invoiceId: string, d: unknown) => request(`/finance/invoices/${invoiceId}/payments`, { method: 'POST', body: JSON.stringify(d) }),
    voidPayment: (id: string, d: unknown) => request(`/finance/payments/${id}/void`, { method: 'POST', body: JSON.stringify(d) }),
    uploadAttachments: (id: string, files: File[]) => requestForm(`/finance-invoices/${id}/attachments`, filesForm(files)),
    addLink: (id: string, name: string, url: string) => request(`/finance-invoices/${id}/attachments/link`, { method: 'POST', body: JSON.stringify({ name, url }) }),
    removeAttachment: (id: string, attId: string) => request(`/finance-invoices/${id}/attachments/${attId}`, { method: 'DELETE' }),
    // --- phase 2
    portfolio: () => request('/finance/portfolio'),
    /** Money received per month across projects, oldest first. */
    /** Invoiced vs collected per month, with what's still open on each month's invoices. */
    billing: (months = 6) => request<BillingMonth[]>(`/finance/billing?months=${months}`),
    collections: (months = 6) => request<{ month: string; amount: number }[]>(`/finance/collections?months=${months}`),
    approvals: () => request('/finance/approvals'),
    audit: (q: Record<string, string> = {}) => request(`/finance/audit?${new URLSearchParams(q).toString()}`),
    requestApproval: (id: string, d: unknown) => request(`/finance/invoices/${id}/request-approval`, { method: 'POST', body: JSON.stringify(d) }),
    approveInvoice: (id: string, d: unknown) => request(`/finance/invoices/${id}/approve`, { method: 'POST', body: JSON.stringify(d) }),
    returnDraft: (id: string, d: unknown) => request(`/finance/invoices/${id}/return`, { method: 'POST', body: JSON.stringify(d) }),
    createCredit: (invoiceId: string, d: unknown) => request(`/finance/invoices/${invoiceId}/credit`, { method: 'POST', body: JSON.stringify(d) }),
    allChangeOrders: () => request('/finance/change-orders'),
    changeOrders: (projectId: number) => request(`/finance/projects/${projectId}/change-orders`),
    createChangeOrder: (projectId: number, d: unknown) => request(`/finance/projects/${projectId}/change-orders`, { method: 'POST', body: JSON.stringify(d) }),
    changeOrder: (id: string) => request(`/finance/change-orders/${id}`),
    changeOrderImpact: (id: string) => request(`/finance/change-orders/${id}/impact`),
    updateChangeOrder: (id: string, d: unknown) => request(`/finance/change-orders/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    deleteChangeOrder: (id: string) => request(`/finance/change-orders/${id}`, { method: 'DELETE' }),
    changeOrderStep: (id: string, action: string, d: unknown) => request(`/finance/change-orders/${id}/${action}`, { method: 'POST', body: JSON.stringify(d) }),
    coUpload: (id: string, files: File[]) => requestForm(`/finance-change-orders/${id}/attachments`, filesForm(files)),
    coLink: (id: string, name: string, url: string) => request(`/finance-change-orders/${id}/attachments/link`, { method: 'POST', body: JSON.stringify({ name, url }) }),
    coRemoveAttachment: (id: string, attId: string) => request(`/finance-change-orders/${id}/attachments/${attId}`, { method: 'DELETE' }),
    allReimbursables: () => request('/finance/reimbursables'),
    reimbursables: (projectId: number) => request(`/finance/projects/${projectId}/reimbursables`),
    createReimbursable: (projectId: number, d: unknown) => request(`/finance/projects/${projectId}/reimbursables`, { method: 'POST', body: JSON.stringify(d) }),
    reimbursable: (id: string) => request(`/finance/reimbursables/${id}`),
    /** Other expenses already carrying this receipt number (same vendor, or no vendor given). */
    receiptCheck: (receipt: string, vendor?: string, exclude?: string) =>
      request<{ id: string; number: string; projectName: string; date: string; cost: number; vendor?: string | null }[]>(`/finance/reimbursables/receipt-check?${new URLSearchParams({ receipt, ...(vendor ? { vendor } : {}), ...(exclude ? { exclude } : {}) }).toString()}`),
    updateReimbursable: (id: string, d: unknown) => request(`/finance/reimbursables/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    deleteReimbursable: (id: string) => request(`/finance/reimbursables/${id}`, { method: 'DELETE' }),
    decideReimbursable: (id: string, d: unknown) => request(`/finance/reimbursables/${id}/decision`, { method: 'POST', body: JSON.stringify(d) }),
    reUpload: (id: string, files: File[]) => requestForm(`/finance-reimbursables/${id}/attachments`, filesForm(files)),
    reLink: (id: string, name: string, url: string) => request(`/finance-reimbursables/${id}/attachments/link`, { method: 'POST', body: JSON.stringify({ name, url }) }),
    reRemoveAttachment: (id: string, attId: string) => request(`/finance-reimbursables/${id}/attachments/${attId}`, { method: 'DELETE' }),
    retention: (projectId: number) => request(`/finance/projects/${projectId}/retention`),
    requestRelease: (projectId: number, d: unknown) => request(`/finance/projects/${projectId}/retention/releases`, { method: 'POST', body: JSON.stringify(d) }),
    decideRelease: (id: string, d: unknown) => request(`/finance/retention-releases/${id}/decision`, { method: 'POST', body: JSON.stringify(d) }),
    billRelease: (id: string) => request(`/finance/retention-releases/${id}/bill`, { method: 'POST', body: '{}' }),
    // --- phase 3: job cost and reports
    /** A project's Subcontractors tab (any staff; amounts only with cost rights). */
    projectSubcontractors: (projectId: number) => request<any>(`/finance/projects/${projectId}/subcontractors`),
    costs: (projectId: number) => request(`/finance/projects/${projectId}/costs`),
    saveBudgetLine: (projectId: number, d: unknown) => request(`/finance/projects/${projectId}/budget-lines`, { method: 'POST', body: JSON.stringify(d) }),
    removeBudgetLine: (id: string) => request(`/finance/budget-lines/${id}`, { method: 'DELETE' }),
    setForecast: (projectId: number, d: unknown) => request(`/finance/projects/${projectId}/forecasts`, { method: 'PUT', body: JSON.stringify(d) }),
    saveCommitment: (projectId: number, d: unknown) => request(`/finance/projects/${projectId}/commitments`, { method: 'POST', body: JSON.stringify(d) }),
    commitmentStep: (id: string, action: string, d: unknown) => request(`/finance/commitments/${id}/${action}`, { method: 'POST', body: JSON.stringify(d) }),
    saveCost: (projectId: number, d: unknown) => request(`/finance/projects/${projectId}/cost-entries`, { method: 'POST', body: JSON.stringify(d) }),
    costStep: (id: string, action: string, d: unknown) => request(`/finance/cost-entries/${id}/${action}`, { method: 'POST', body: JSON.stringify(d) }),
    costUpload: (id: string, files: File[]) => requestForm(`/finance-costs/${id}/attachments`, filesForm(files)),
    costLink: (id: string, name: string, url: string) => request(`/finance-costs/${id}/attachments/link`, { method: 'POST', body: JSON.stringify({ name, url }) }),
    costRemoveAttachment: (id: string, attId: string) => request(`/finance-costs/${id}/attachments/${attId}`, { method: 'DELETE' }),
    sharedUpload: (id: string, files: File[]) => requestForm(`/finance-commitment-shared/${id}/attachments`, filesForm(files)),
    sharedLink: (id: string, name: string, url: string) => request(`/finance-commitment-shared/${id}/attachments/link`, { method: 'POST', body: JSON.stringify({ name, url }) }),
    sharedRemove: (id: string, attId: string) => request(`/finance-commitment-shared/${id}/attachments/${attId}`, { method: 'DELETE' }),
    portalAccess: (contractorId: string) => request(`/finance-portal/${encodeURIComponent(contractorId)}`),
    portalInvite: (contractorId: string, d: { email?: string; name?: string }) => request(`/finance-portal/${encodeURIComponent(contractorId)}/invite`, { method: 'POST', body: JSON.stringify(d) }),
    portalRevoke: (contractorId: string) => request(`/finance-portal/${encodeURIComponent(contractorId)}/revoke`, { method: 'POST', body: '{}' }),
    report: (name: 'wip' | 'ar-aging' | 'budget-vs-actual' | 'change-orders' | 'retention' | 'contract-vs-invoiced' | 'cash-forecast', q: Record<string, string> = {}) =>
      request(`/finance/reports/${name}?${new URLSearchParams(q).toString()}`),
  },
  /** The subcontractor portal: only a portal account's own subcontracts, invoices and payments. */
  portal: {
    overview: () => request('/portal/overview'),
    subcontract: (id: string) => request(`/portal/subcontracts/${encodeURIComponent(id)}`),
    invoices: () => request('/portal/invoices'),
    submit: (d: unknown) => request('/portal/invoices', { method: 'POST', body: JSON.stringify(d) }),
    attach: (batchId: string, files: File[] | FileList) => requestForm(`/portal/invoices/${encodeURIComponent(batchId)}/attachments`, filesForm(files)),
    billFileUrl: (entryId: string, attId: string) => `${API_BASE}/portal/bills/${encodeURIComponent(entryId)}/files/${encodeURIComponent(attId)}`,
    sharedFileUrl: (subcontractId: string, attId: string) => `${API_BASE}/portal/subcontracts/${encodeURIComponent(subcontractId)}/files/${encodeURIComponent(attId)}`,
  },
  /** Manpower -> Setup -> Picklists: departments, designations, skills. */
  picklists: {
    get: () => request<{ departments: string[]; designations: string[]; skills: string[] }>('/manpower/picklists'),
    save: (data: unknown) => request<{ departments: string[]; designations: string[]; skills: string[] }>('/manpower/picklists', { method: 'PUT', body: JSON.stringify(data) }),
  },
  subcontractorTrades: {
    list: () => request('/subcontractor-trades'),
    create: (data: unknown) => request('/subcontractor-trades', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/subcontractor-trades/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/subcontractor-trades/${id}`, { method: 'DELETE' }),
  },
  sampleData: {
    status: () => request('/manpower/sample-data'),
    load: () => request('/manpower/sample-data', { method: 'POST' }),
    loadPayroll: () => request('/manpower/sample-data/payroll', { method: 'POST' }),
    remove: () => request('/manpower/sample-data', { method: 'DELETE' }),
  },
  assignments: {
    list: (opts?: { employeeId?: string; projectId?: number; status?: 'current' | 'ended'; workforceRequestId?: string }) => {
      const q = new URLSearchParams();
      if (opts?.employeeId) q.set('employeeId', opts.employeeId);
      if (opts?.projectId != null) q.set('projectId', String(opts.projectId));
      if (opts?.status) q.set('status', opts.status);
      if (opts?.workforceRequestId) q.set('workforceRequestId', opts.workforceRequestId);
      const qs = q.toString();
      return request(`/assignments${qs ? `?${qs}` : ''}`);
    },
    assign: (data: unknown) => request('/assignments', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/assignments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    transfer: (id: string, data: unknown) => request(`/assignments/${id}/transfer`, { method: 'POST', body: JSON.stringify(data) }),
    release: (id: string, data: unknown) => request(`/assignments/${id}/release`, { method: 'POST', body: JSON.stringify(data) }),
    demobilize: (employeeId: string, data: unknown) => request(`/assignments/demobilize/${encodeURIComponent(employeeId)}`, { method: 'POST', body: JSON.stringify(data) }),
  },
  workforceRequests: {
    list: () => request('/workforce-requests'),
    get: (id: string) => request(`/workforce-requests/${id}`),
    create: (data: unknown) => request('/workforce-requests', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/workforce-requests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/workforce-requests/${id}`, { method: 'DELETE' }),
    submit: (id: string) => request(`/workforce-requests/${id}/submit`, { method: 'POST' }),
    approve: (id: string, note?: string) => request(`/workforce-requests/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }) }),
    reject: (id: string, note?: string) => request(`/workforce-requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
    cancel: (id: string) => request(`/workforce-requests/${id}/cancel`, { method: 'POST' }),
    fulfill: (id: string) => request(`/workforce-requests/${id}/fulfill`, { method: 'POST' }),
    allocate: (id: string, data: { lineId: string; employeeIds: string[]; startDate?: string; workArea?: string }) =>
      request(`/workforce-requests/${id}/allocate`, { method: 'POST', body: JSON.stringify(data) }),
  },
  contractors: {
    list: () => request('/contractors'),
    create: (data: unknown) => request('/contractors', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/contractors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/contractors/${id}`, { method: 'DELETE' }),
    uploadAttachments: (id: string, files: File[] | FileList) => requestForm(`/contractors/${id}/attachments`, filesForm(files)),
    addLink: (id: string, name: string, url: string) => request(`/contractors/${id}/attachments/link`, { method: 'POST', body: JSON.stringify({ name, url }) }),
    removeAttachment: (id: string, attId: string) => request(`/contractors/${id}/attachments/${attId}`, { method: 'DELETE' }),
    /** Their estimates, newest first. Each change returns the whole list again. */
    bids: (id: string) => request<ContractorBid[]>(`/contractors/${encodeURIComponent(id)}/bids`),
    addBid: (id: string, d: Partial<ContractorBid>) => request<ContractorBid[]>(`/contractors/${encodeURIComponent(id)}/bids`, { method: 'POST', body: JSON.stringify(d) }),
    updateBid: (bidId: string, d: Partial<ContractorBid>) => request<ContractorBid[]>(`/contractors/bids/${encodeURIComponent(bidId)}`, { method: 'PUT', body: JSON.stringify(d) }),
    removeBid: (bidId: string) => request<ContractorBid[]>(`/contractors/bids/${encodeURIComponent(bidId)}`, { method: 'DELETE' }),
  },
  payroll: {
    /** Tax and deduction summaries: query string from, to, employeeId, drafts=1. */
    report: (qs: string) => request(`/payroll/reports?${qs}`),
    settings: () => request('/payroll/settings'),
    saveSettings: (data: unknown) => request('/payroll/settings', { method: 'PUT', body: JSON.stringify(data) }),
    components: () => request('/payroll/components'),
    createComponent: (data: unknown) => request('/payroll/components', { method: 'POST', body: JSON.stringify(data) }),
    updateComponent: (id: string, data: unknown) => request(`/payroll/components/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    removeComponent: (id: string) => request(`/payroll/components/${id}`, { method: 'DELETE' }),
    runs: () => request('/payroll/runs'),
    run: (id: string) => request(`/payroll/runs/${id}`),
    createRun: (data: unknown) => request('/payroll/runs', { method: 'POST', body: JSON.stringify(data) }),
    recalculate: (id: string) => request(`/payroll/runs/${id}/recalculate`, { method: 'POST' }),
    removeRun: (id: string) => request(`/payroll/runs/${id}`, { method: 'DELETE' }),
    finalize: (id: string) => request(`/payroll/runs/${id}/finalize`, { method: 'POST' }),
    voidRun: (id: string, reason: string) => request(`/payroll/runs/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) }),
    pay: (id: string, data: { payslipIds?: string[]; method?: string; ref?: string; date?: string }) =>
      request(`/payroll/runs/${id}/pay`, { method: 'POST', body: JSON.stringify(data) }),
    updatePayslip: (id: string, data: unknown) => request(`/payroll/payslips/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    employeePayslips: (employeeId: string) => request(`/payroll/employees/${encodeURIComponent(employeeId)}/payslips`),
  },
  overtime: {
    list: (opts?: { employeeId?: string; status?: string; from?: string; to?: string }) => {
      const q = new URLSearchParams();
      Object.entries(opts || {}).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
      const qs = q.toString();
      return request(`/overtime${qs ? `?${qs}` : ''}`);
    },
    suggestions: (from: string, to: string) => request(`/overtime/suggestions?from=${from}&to=${to}`),
    create: (data: unknown) => request('/overtime', { method: 'POST', body: JSON.stringify(data) }),
    bulk: (items: unknown[]) => request('/overtime/bulk', { method: 'POST', body: JSON.stringify({ items }) }),
    approve: (id: string, note?: string) => request(`/overtime/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }) }),
    reject: (id: string, note?: string) => request(`/overtime/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
    cancel: (id: string) => request(`/overtime/${id}/cancel`, { method: 'POST' }),
  },
  advances: {
    list: (opts?: { employeeId?: string; status?: string }) => {
      const q = new URLSearchParams();
      Object.entries(opts || {}).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
      const qs = q.toString();
      return request(`/advances${qs ? `?${qs}` : ''}`);
    },
    create: (data: unknown) => request('/advances', { method: 'POST', body: JSON.stringify(data) }),
    approve: (id: string, note?: string) => request(`/advances/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }) }),
    reject: (id: string, note?: string) => request(`/advances/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
    cancel: (id: string) => request(`/advances/${id}/cancel`, { method: 'POST' }),
    disburse: (id: string, data: { date?: string; method?: string; ref?: string }) => request(`/advances/${id}/disburse`, { method: 'POST', body: JSON.stringify(data) }),
    repay: (id: string, data: { amount: number; date?: string; note?: string }) => request(`/advances/${id}/repay`, { method: 'POST', body: JSON.stringify(data) }),
  },
  leave: {
    types: () => request('/leave/types'),
    createType: (d: unknown) => request('/leave/types', { method: 'POST', body: JSON.stringify(d) }),
    updateType: (id: string, d: unknown) => request(`/leave/types/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    removeType: (id: string) => request(`/leave/types/${id}`, { method: 'DELETE' }),
    holidays: (year?: number) => request(`/leave/holidays${year ? `?year=${year}` : ''}`),
    addHoliday: (d: { date: string; name: string }) => request('/leave/holidays', { method: 'POST', body: JSON.stringify(d) }),
    removeHoliday: (id: string) => request(`/leave/holidays/${id}`, { method: 'DELETE' }),
    addUsFederalHolidays: (year: number) => request('/leave/holidays/us-federal', { method: 'POST', body: JSON.stringify({ year }) }),
    requests: (o?: { employeeId?: string; status?: string; from?: string; to?: string }) => request(`/leave/requests${qs(o)}`),
    preview: (d: unknown) => request('/leave/requests/preview', { method: 'POST', body: JSON.stringify(d) }),
    create: (d: unknown) => request('/leave/requests', { method: 'POST', body: JSON.stringify(d) }),
    approve: (id: string, note?: string) => request(`/leave/requests/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }) }),
    reject: (id: string, note?: string) => request(`/leave/requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
    cancel: (id: string) => request(`/leave/requests/${id}/cancel`, { method: 'POST' }),
    balances: (year: number, employeeId?: string) => request(`/leave/balances${qs({ year, employeeId })}`),
    adjustments: (employeeId: string) => request(`/leave/adjustments?employeeId=${encodeURIComponent(employeeId)}`),
    adjust: (d: unknown) => request('/leave/adjustments', { method: 'POST', body: JSON.stringify(d) }),
    encash: (d: unknown) => request('/leave/encash', { method: 'POST', body: JSON.stringify(d) }),
    carryForward: (fromYear: number) => request('/leave/carry-forward', { method: 'POST', body: JSON.stringify({ fromYear }) }),
    calendar: (from: string, to: string) => request(`/leave/calendar?from=${from}&to=${to}`),
  },
  shifts: {
    templates: () => request('/shifts/templates'),
    createTemplate: (d: unknown) => request('/shifts/templates', { method: 'POST', body: JSON.stringify(d) }),
    updateTemplate: (id: string, d: unknown) => request(`/shifts/templates/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    removeTemplate: (id: string) => request(`/shifts/templates/${id}`, { method: 'DELETE' }),
    assignments: (o?: { employeeId?: string; from?: string; to?: string }) => request(`/shifts/assignments${qs(o)}`),
    assign: (d: unknown) => request('/shifts/assignments', { method: 'POST', body: JSON.stringify(d) }),
    end: (id: string, endDate?: string) => request(`/shifts/assignments/${id}/end`, { method: 'POST', body: JSON.stringify({ endDate }) }),
    remove: (id: string) => request(`/shifts/assignments/${id}`, { method: 'DELETE' }),
  },
  assets: {
    list: () => request('/assets'),
    forEmployee: (employeeId: string) => request(`/assets/employee/${encodeURIComponent(employeeId)}`),
    history: (id: string) => request(`/assets/${id}/history`),
    create: (d: unknown) => request('/assets', { method: 'POST', body: JSON.stringify(d) }),
    update: (id: string, d: unknown) => request(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    setStatus: (id: string, status: string) => request(`/assets/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
    issue: (id: string, d: unknown) => request(`/assets/${id}/issue`, { method: 'POST', body: JSON.stringify(d) }),
    returnIssue: (issueId: string, d: unknown) => request(`/assets/issues/${issueId}/return`, { method: 'POST', body: JSON.stringify(d) }),
    reportLost: (issueId: string, d: unknown) => request(`/assets/issues/${issueId}/lost`, { method: 'POST', body: JSON.stringify(d) }),
  },
  accommodation: {
    overview: () => request('/accommodation'),
    forEmployee: (employeeId: string) => request(`/accommodation/employee/${encodeURIComponent(employeeId)}`),
    createUnit: (d: unknown) => request('/accommodation/units', { method: 'POST', body: JSON.stringify(d) }),
    updateUnit: (id: string, d: unknown) => request(`/accommodation/units/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    removeUnit: (id: string) => request(`/accommodation/units/${id}`, { method: 'DELETE' }),
    allocate: (d: unknown) => request('/accommodation/allocations', { method: 'POST', body: JSON.stringify(d) }),
    checkout: (id: string, date?: string) => request(`/accommodation/allocations/${id}/checkout`, { method: 'POST', body: JSON.stringify({ date }) }),
    reportIssue: (d: unknown) => request('/accommodation/issues', { method: 'POST', body: JSON.stringify(d) }),
    updateIssue: (id: string, d: unknown) => request(`/accommodation/issues/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  },
  transport: {
    routes: () => request('/transport/routes'),
    forEmployee: (employeeId: string) => request(`/transport/employee/${encodeURIComponent(employeeId)}`),
    create: (d: unknown) => request('/transport/routes', { method: 'POST', body: JSON.stringify(d) }),
    update: (id: string, d: unknown) => request(`/transport/routes/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    remove: (id: string) => request(`/transport/routes/${id}`, { method: 'DELETE' }),
    addRider: (routeId: string, d: unknown) => request(`/transport/routes/${routeId}/riders`, { method: 'POST', body: JSON.stringify(d) }),
    endRider: (id: string, date?: string) => request(`/transport/riders/${id}/end`, { method: 'POST', body: JSON.stringify({ date }) }),
  },
  employeeRecords: {
    list: (employeeId: string, kind?: string) =>
      request(`/employee-records?employeeId=${encodeURIComponent(employeeId)}${kind ? `&kind=${kind}` : ''}`),
    create: (data: unknown) => request('/employee-records', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/employee-records/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/employee-records/${id}`, { method: 'DELETE' }),
    uploadAttachments: (id: string, files: File[] | FileList) => requestForm(`/employee-records/${id}/attachments`, filesForm(files)),
    addLink: (id: string, name: string, url: string) => request(`/employee-records/${id}/attachments/link`, { method: 'POST', body: JSON.stringify({ name, url }) }),
    removeAttachment: (id: string, attId: string) => request(`/employee-records/${id}/attachments/${attId}`, { method: 'DELETE' }),
  },
  csiCodes: {
    list: () => request('/csi-codes'),
    create: (data: unknown) => request('/csi-codes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/csi-codes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/csi-codes/${id}`, { method: 'DELETE' }),
  },
  dailyLogs: {
    list: (opts?: { status?: string; projectId?: number }) => {
      const q = new URLSearchParams();
      if (opts?.status) q.set('status', opts.status);
      if (opts?.projectId != null) q.set('projectId', String(opts.projectId));
      const qs = q.toString();
      return request(`/daily-logs${qs ? `?${qs}` : ''}`);
    },
    /** A project's day: the asked-for report (`id`) or the latest version, plus every version. */
    day: (projectId: number, date: string, id?: string) => request(`/daily-logs/day?projectId=${projectId}&date=${date}${id ? `&id=${encodeURIComponent(id)}` : ''}`),
    save: (data: {
      projectId: number; date: string; notes?: string; entries?: unknown[];
      id?: string; newVersion?: boolean; sections?: Record<string, unknown> | null; onBehalfOf?: string;
      certifiedName?: string; signatureDataUrl?: string; dupBaseline?: Record<string, unknown> | null; dupFromDate?: string;
    }) => request('/daily-logs', { method: 'POST', body: JSON.stringify(data) }),
    /** Section I figures: % invoiced, % of schedule, task / RFI / change-order counts. No dollars. */
    summary: (projectId: number, date?: string) => request(`/daily-report/summary?projectId=${projectId}${date ? `&date=${date}` : ''}`),
    templates: () => request('/daily-logs/templates'),
    saveTemplate: (data: { name: string; sections?: Record<string, unknown> | null; entries?: unknown[] }) =>
      request('/daily-logs/templates', { method: 'POST', body: JSON.stringify(data) }),
    removeTemplate: (id: string) => request(`/daily-logs/templates/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    submit: (id: string) => request(`/daily-logs/${id}/submit`, { method: 'POST' }),
    approve: (id: string) => request(`/daily-logs/${id}/approve`, { method: 'POST' }),
    reject: (id: string, note?: string) => request(`/daily-logs/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
    /** A project's week rolled up from its daily reports; `week` is any day in it. */
    weekly: (projectId: number, week: string) => request<WeeklyReport>(`/daily-logs/weekly?projectId=${projectId}&week=${week}`),
    /** Email the week as PDF + Excel -- to the usual backup list, or to `to` (comma-separated). */
    emailWeekly: (projectId: number, week: string, to?: string) => request<{ sent: boolean; to: string[]; attachments: string[] }>('/daily-logs/weekly/email', { method: 'POST', body: JSON.stringify({ projectId, week, to }) }),
    /** Email the day as PDF + Excel -- to the usual backup list, or to `to` (comma-separated). */
    email: (id: string, to?: string) => request<{ sent: boolean; to: string[]; attachments: string[] }>(`/daily-logs/${id}/email`, { method: 'POST', body: JSON.stringify({ to }) }),
  },
  timesheets: {
    /** Hours supervisors logged on daily logs for someone -- a reference, not a timesheet. */
    logged: (employeeId: string, from: string, to: string) =>
      request(`/timesheets/logged?employeeId=${encodeURIComponent(employeeId)}&from=${from}&to=${to}`),
    me: () => request('/timesheets/me'),
    week: (employeeId: string, weekStart: string) => request(`/timesheets/week${qs({ employeeId, weekStart })}`),
    save: (d: unknown) => request('/timesheets/week', { method: 'PUT', body: JSON.stringify(d) }),
    list: (o?: { from?: string; to?: string; status?: string; employeeId?: string }) => request(`/timesheets/list${qs(o)}`),
    submit: (id: string) => request(`/timesheets/${id}/submit`, { method: 'POST' }),
    /** Submitted timesheets waiting for a decision that the caller should hear about (the bell). */
    pendingNotices: () => request<{ id: string; employeeId: string; employeeName: string; weekStart: string; totalHours: number; submittedAt?: string }[]>('/timesheets/pending-notices'),
    approve: (id: string, note?: string) => request(`/timesheets/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }) }),
    reject: (id: string, note?: string) => request(`/timesheets/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
    reopen: (id: string, note?: string) => request(`/timesheets/${id}/reopen`, { method: 'POST', body: JSON.stringify({ note }) }),
    remove: (id: string) => request(`/timesheets/${id}`, { method: 'DELETE' }),
  },
};

export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  connectedEmail: string;
  connectedAt: string;
  senderEmail: string;
  redirectUri: string;
  scopes: string[];
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
}
