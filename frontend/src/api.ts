const API_BASE = '/api';

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
export const session = {
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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
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
    throw new Error(msg || `API error: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/**
 * Multipart POST. Deliberately omits Content-Type so the browser can set the
 * multipart boundary itself, while keeping the Authorization header.
 */
async function requestForm<T>(path: string, form: FormData): Promise<T> {
  const token = session.get();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = body && (Array.isArray(body.message) ? body.message[0] : body.message);
    throw new Error(msg || `Upload failed: ${res.status}`);
  }
  return res.json();
}

/** Build a FormData from a browser FileList / File[]. */
function filesForm(files: File[] | FileList): FormData {
  const form = new FormData();
  Array.from(files).forEach((f) => form.append('files', f, f.name));
  return form;
}

export type AttachmentScope = 'tasks' | 'project-tasks' | 'employee-records' | 'contractors';

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
  settings: {
    get: () => request<Record<string, string>>('/settings'),
    save: (data: Record<string, unknown>) => request<Record<string, string>>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },
  sms: {
    status: () => request<{ configured: boolean; enabled: boolean; fromNumber: string; accountSid: string }>('/sms/status'),
    send: (to: string, body: string) =>
      request<{ sent: boolean; to: string; segments: number }>('/sms/send', { method: 'POST', body: JSON.stringify({ to, body }) }),
    test: (to: string) =>
      request<{ sent: boolean; to: string }>('/sms/test', { method: 'POST', body: JSON.stringify({ to }) }),
  },

  notifications: {
    /** Sends the caller a sample assignment email, for checking the template. */
    test: () => request<{ sent: boolean; reason?: string }>('/notifications/test', { method: 'POST' }),
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
  },
  people: {
    list: (project?: string) => request(`/people${project ? `?project=${encodeURIComponent(project)}` : ''}`),
    get: (id: string) => request(`/people/${id}`),
    create: (data: unknown) => request('/people', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string | number, data: unknown) => request(`/people/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string | number) => request(`/people/${id}`, { method: 'DELETE' }),
  },
  tasks: {
    list: (tab?: string, project?: string) => {
      const params = new URLSearchParams();
      if (tab) params.set('tab', tab);
      if (project) params.set('project', project);
      const qs = params.toString();
      return request(`/tasks${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) => request(`/tasks/${id}`),
    create: (data: unknown) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/tasks/${id}`, { method: 'DELETE' }),
    uploadAttachments: (id: string, files: File[] | FileList) => requestForm(`/tasks/${id}/attachments`, filesForm(files)),
    addLink: (id: string, name: string, url: string) => request(`/tasks/${id}/attachments/link`, { method: 'POST', body: JSON.stringify({ name, url }) }),
    removeAttachment: (id: string, attId: string) => request(`/tasks/${id}/attachments/${attId}`, { method: 'DELETE' }),
    addComment: (id: string, text: string) => request(`/tasks/${id}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),
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
    setRejection: (id: string, data: { rejectionType: 'internal' | 'client' | 'referred'; rejectionReason?: string; referredToName?: string; referredToCompany?: string; referredToContact?: string }) =>
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
  reminders: {
    run: () => request<{ sent: number; skipped: number; recipients: string[] }>('/reminders/run', { method: 'POST' }),
  },
  users: {
    list: () => request('/users'),
    create: (data: unknown) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/users/${id}`, { method: 'DELETE' }),
    resendInvite: (id: string) => request<{ invite: { sent: boolean; url?: string; error?: string } }>(`/users/${id}/resend-invite`, { method: 'POST' }),
  },
  roles: {
    list: () => request('/roles'),
    create: (data: unknown) => request('/roles', { method: 'POST', body: JSON.stringify(data) }),
    update: (key: string, data: unknown) => request(`/roles/${key}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (key: string) => request(`/roles/${key}`, { method: 'DELETE' }),
  },
  projectTasks: {
    /** projectId: a number scopes to that project; null scopes to the
     *  General Tasks board; omitted (list only) returns everything. */
    board: (projectId: number | null) => request(`/project-tasks/board?projectId=${projectId === null ? 'null' : projectId}`),
    list: (projectId?: number | null) => request(`/project-tasks${projectId === undefined ? '' : `?projectId=${projectId === null ? 'null' : projectId}`}`),
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
      location?: string; attendees?: string[]; video?: boolean;
    }) => request<{ id: string; htmlLink: string; meetLink?: string }>('/scheduling/events', { method: 'POST', body: JSON.stringify(payload) }),
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
    share: (id: string) => request<{ url: string; name: string }>(`/file-room/files/${id}/share`, { method: 'POST' }),
    email: (id: string, to: string, note: string) =>
      request<{ sent: boolean; to: string }>(`/file-room/files/${id}/email`, { method: 'POST', body: JSON.stringify({ to, note }) }),
    sync: (projectId: number) =>
      request<{ added: number; updated: number; removed: number; folders: number }>(`/file-room/sync?projectId=${projectId}`, { method: 'POST' }),
    /** Relative on purpose: works through the vite proxy and same-origin in prod. */
    contentUrl: (id: string, opts?: { thumb?: boolean; download?: boolean }) => {
      const q = [opts?.thumb ? 'thumb=1' : '', opts?.download ? 'download=1' : ''].filter(Boolean).join('&');
      return `${API_BASE}/file-room/files/${encodeURIComponent(id)}/content${q ? `?${q}` : ''}`;
    },
  },
  projectPhases: {
    list: (projectId: number) => request(`/project-phases?projectId=${projectId}`),
    board: (projectId: number) => request(`/project-phases/board?projectId=${projectId}`),
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
  },
  payroll: {
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
    day: (projectId: number, date: string) => request(`/daily-logs/day?projectId=${projectId}&date=${date}`),
    save: (data: { projectId: number; date: string; notes?: string; entries?: unknown[] }) =>
      request('/daily-logs', { method: 'POST', body: JSON.stringify(data) }),
    submit: (id: string) => request(`/daily-logs/${id}/submit`, { method: 'POST' }),
    approve: (id: string) => request(`/daily-logs/${id}/approve`, { method: 'POST' }),
    reject: (id: string, note?: string) => request(`/daily-logs/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
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
