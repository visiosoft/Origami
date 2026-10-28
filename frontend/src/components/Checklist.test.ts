import { describe, expect, it, vi } from 'vitest';
vi.mock('../api', () => ({ api: {} }));
vi.mock('../AppContext', () => ({ useApp: () => ({}) }));
import { itemsFromTemplate } from './Checklist';

describe('adding a checklist template', () => {
  it('appends unticked items with fresh ids and skips ones already there', () => {
    const cur = [{ id: 'ci-1', item: 'Rebar tied', done: true }];
    const next = itemsFromTemplate(cur, { items: [{ item: 'rebar tied' }, { item: 'Forms braced' }, { item: ' ' }] }, 'x');
    expect(next).toEqual([cur[0], { id: 'ci-x-0', item: 'Forms braced', done: false }]);
  });
});
