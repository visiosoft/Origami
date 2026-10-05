import { describe, expect, it } from 'vitest';
import { buildIndex, searchIndex } from './globalSearchIndex';
import { formatLike } from './CountUp';
import { tint } from '../theme';

const index = buildIndex({
  pages: [{ label: 'Projects', route: 'projects', icon: 'folder' }, { label: 'People', route: 'people', icon: 'people' }],
  projects: [{ id: 3, name: 'Chelliah Residence', location: 'Fremont', stage: 'Design' }, { id: 4, name: 'Jayaraman ADU', location: 'Fremont' }],
  deals: [{ id: 'D-1', name: 'Noe Valley Remodel', client: 'Sara Ruiz', stage: 'Proposal Sent' }],
  people: [{ id: 7, name: 'Manju Rao', role: 'Owner Representative', company: 'Narvaes Family Trust', kind: 'Client' }],
  employees: [{ id: 'E-9', name: 'José Peña', workerId: 'W-2026-0007', designation: 'Foreman', status: 'Active' }],
  projectTasks: [{ id: 'T1', title: 'Order windows', projectId: 3, assignee: 'Edward M.' }, { id: 'T2', title: 'Office move', projectId: null, completed: true }],
  logTasks: [{ id: 'L1', description: 'Send revised plans\nto the city', project: 'Chelliah Residence', status: 'Open' }],
  headline: (t) => t.split('\n')[0],
});

describe('global search index', () => {
  it('links every record to the page that opens it', () => {
    const to = Object.fromEntries(index.map((i) => [i.kind + ':' + i.id, i.to]));
    expect(to['project:3']).toBe('/projects?open=3');
    expect(to['deal:D-1']).toBe('/pipeline?open=D-1');
    expect(to['person:7']).toBe('/people?open=7');
    expect(to['employee:E-9']).toBe('/manpower_con?employee=E-9');
    expect(to['task:p:T1']).toBe('/tasks?task=T1&project=3');
    expect(to['task:p:T2']).toBe('/tasks?task=T2&project=null');
    expect(to['task:l:L1']).toBe('/tasks?task=L1&type=log');
  });
  it('names a task by its project, or General Tasks', () => {
    expect(index.find((i) => i.id === 'p:T1')!.sub).toContain('Chelliah Residence');
    expect(index.find((i) => i.id === 'p:T2')!.sub).toContain('General Tasks');
    expect(index.find((i) => i.id === 'l:L1')!.title).toBe('Send revised plans');
  });
  it('skips records without a name', () => {
    expect(buildIndex({ projects: [{ id: 1 }], deals: [{ name: 'x' }] })).toEqual([]);
  });
});

describe('searchIndex', () => {
  const titles = (q: string) => searchIndex(index, q).map((i) => i.title);
  it('lists only pages for an empty query', () => {
    expect(titles('')).toEqual(['Projects', 'People']);
  });
  it('matches every word, case- and accent-insensitively, across fields', () => {
    expect(titles('jose')).toEqual(['José Peña']);
    expect(titles('FREMONT adu')).toEqual(['Jayaraman ADU']);
    expect(titles('sara')).toEqual(['Noe Valley Remodel']);
    expect(titles('w-2026-0007')).toEqual(['José Peña']);
    expect(titles('zzz')).toEqual([]);
  });
  it('groups by kind and puts title matches first', () => {
    const r = searchIndex(index, 'chelliah');
    expect(r.map((i) => i.kind)).toEqual(['project', 'task', 'task']);
    expect(r[0].title).toBe('Chelliah Residence');
  });
  it('caps each kind', () => {
    const many = buildIndex({ projects: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: `House ${i + 1}` })) });
    expect(searchIndex(many, 'house', 6)).toHaveLength(6);
  });
});

describe('formatLike (dashboard count-up)', () => {
  it('keeps decimals and thousands separators of the target', () => {
    expect(formatLike(1234.5, '5,520')).toBe('1,235');
    expect(formatLike(6.55, '6.6')).toBe('6.5');
    expect(formatLike(0, '144.0')).toBe('0.0');
    expect(formatLike(1234567, '1234567')).toBe('1234567');
  });
});

describe('tint', () => {
  it('appends hex alpha to a plain colour', () => {
    expect(tint('#173326', '22')).toBe('#17332622');
  });
  it('mixes a theme variable with transparency', () => {
    expect(tint('var(--forest)', '80')).toBe('color-mix(in srgb, var(--forest) 50.2%, transparent)');
    expect(tint('var(--forest)', 'ff')).toBe('color-mix(in srgb, var(--forest) 100%, transparent)');
  });
});
