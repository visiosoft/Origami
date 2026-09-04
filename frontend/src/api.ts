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

/**
 * Where the browser fetches an attachment's bytes. Relative on purpose: it works
 * through the vite proxy in dev and same-origin in production. The route is
 * scoped to the task, so a Drive id alone can never reach an arbitrary file.
 */
export const attachmentUrl = (
  scope: 'tasks' | 'project-tasks',
  taskId: string,
  attId: string,
  thumb = false,
) => `${API_BASE}/${scope}/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attId)}/content${thumb ? '?thumb=1' : ''}`;

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: unknown }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me: () => request('/auth/me'),
    setNotificationPrefs: (notifyOnAssignment: boolean) =>
      request('/auth/me/notifications', { method: 'PUT', body: JSON.stringify({ notifyOnAssignment }) }),
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
    board: (projectId: number) => request(`/project-tasks/board?projectId=${projectId}`),
    list: (projectId?: number) => request(`/project-tasks${projectId ? `?projectId=${projectId}` : ''}`),
    create: (data: unknown) => request('/project-tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/project-tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/project-tasks/${id}`, { method: 'DELETE' }),
    reorder: (sectionId: string, ids: string[]) => request('/project-tasks/reorder', { method: 'PUT', body: JSON.stringify({ sectionId, ids }) }),
    uploadAttachments: (id: string, files: File[] | FileList) => requestForm(`/project-tasks/${id}/attachments`, filesForm(files)),
    addLink: (id: string, name: string, url: string) => request(`/project-tasks/${id}/attachments/link`, { method: 'POST', body: JSON.stringify({ name, url }) }),
    removeAttachment: (id: string, attId: string) => request(`/project-tasks/${id}/attachments/${attId}`, { method: 'DELETE' }),
    addComment: (id: string, text: string) => request(`/project-tasks/${id}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),
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
  },
  programmeTemplate: {
    get: () => request('/project-phases/template'),
    save: (phases: unknown) => request('/project-phases/template', { method: 'PUT', body: JSON.stringify(phases) }),
    reset: () => request('/project-phases/template', { method: 'DELETE' }),
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
