const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
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
  },
  pipeline: {
    list: () => request('/pipeline'),
    stages: () => request('/pipeline/stages'),
    get: (id: string) => request(`/pipeline/${id}`),
    create: (data: unknown) => request('/pipeline', { method: 'POST', body: JSON.stringify(data) }),
    updateStage: (id: string, stage: string) => request(`/pipeline/${id}/stage`, { method: 'PUT', body: JSON.stringify({ stage }) }),
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
  users: {
    list: () => request('/users'),
    create: (data: unknown) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/users/${id}`, { method: 'DELETE' }),
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
