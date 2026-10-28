import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, cacheableRead, clearReadCache } from './api';

describe('read cache', () => {
  let calls: string[];
  beforeEach(() => {
    calls = [];
    clearReadCache();
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method || 'GET'} ${url}`);
      return new Response(JSON.stringify([{ id: 'a', n: calls.length }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('serves a list read again from memory, as a copy', async () => {
    const a: any = await api.projects.list();
    a[0].n = 999;
    const b: any = await api.projects.list();
    expect(calls).toHaveLength(1);
    expect(b[0].n).toBe(1);
  });

  it('a save clears it, so the next read goes to the server', async () => {
    await api.projects.list();
    await api.tasks.update('T-1', { status: 'Done' });
    await api.projects.list();
    expect(calls.filter((c) => c.startsWith('GET'))).toHaveLength(2);
  });

  it('never caches a record opened to edit, sign-in or the server status', () => {
    expect(cacheableRead('/tasks/T-2026-0007')).toBe(false);
    expect(cacheableRead('/people/42')).toBe(false);
    expect(cacheableRead('/auth/me')).toBe(false);
    expect(cacheableRead('/status')).toBe(false);
    expect(cacheableRead('/project-tasks/board?projectId=3')).toBe(true);
    expect(cacheableRead('/tasks/page?page=2')).toBe(true);
    expect(cacheableRead('/projects', { method: 'POST' })).toBe(false);
    expect(cacheableRead('/projects', { cache: 'no-store' })).toBe(false);
  });

  it('two screens asking at once share one request', async () => {
    await Promise.all([api.projects.list(), api.projects.list()]);
    expect(calls).toHaveLength(1);
  });
});
