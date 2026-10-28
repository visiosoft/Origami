import { describe, expect, it } from 'vitest';
import { rememberReturnTo, takeReturnTo } from './returnTo';

// Tests run outside a browser: a stand-in sessionStorage.
if (typeof globalThis.sessionStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } };
}

describe('after signing in', () => {
  it('goes back to the remembered page -- and a second ask straight after gets the same page', () => {
    rememberReturnTo('/tasks?task=K1&project=1');
    expect(takeReturnTo()).toBe('/tasks?task=K1&project=1');
    expect(takeReturnTo()).toBe('/tasks?task=K1&project=1');
  });
  it('never returns the login page or another site', () => {
    rememberReturnTo('/login?x=1');
    rememberReturnTo('//evil.example');
    expect(takeReturnTo()).not.toMatch(/^\/login|^\/\//);
  });
});
