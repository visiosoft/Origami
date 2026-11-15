import { AsyncLocalStorage } from 'async_hooks';

/**
 * View as (Nov 13, Batch 4): an administrator sees the app as a role or a
 * person -- read-only. The `X-View-As` header ("role:<key>" or
 * "person:<userId>") is kept for the length of the request here, so every
 * place that reads the caller (the guard, and the many controllers that
 * call AuthService.verify themselves) gets the same answer.
 */
export const viewAsStore = new AsyncLocalStorage<{ header: string | null }>();

export function parseViewAs(raw: unknown): { kind: 'role' | 'person'; id: string } | null {
  const m = /^(role|person):([A-Za-z0-9_.:@-]{1,80})$/.exec(String(raw || '').trim());
  return m ? { kind: m[1] as 'role' | 'person', id: m[2] } : null;
}

/** Express middleware: remember this request's header. */
export function viewAsMiddleware(req: { headers: Record<string, unknown> }, _res: unknown, next: () => void) {
  const h = req.headers['x-view-as'];
  viewAsStore.run({ header: typeof h === 'string' ? h : null }, next);
}
