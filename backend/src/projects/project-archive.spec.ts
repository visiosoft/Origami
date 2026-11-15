import { archiveDue, archiveOn, archivePlan, isArchiveStage } from './project-archive';
import { ProjectsService } from './projects.service';

const DAY = 86_400_000;
const now = Date.parse('2026-11-20T12:00:00Z');
const ago = (d: number) => new Date(now - d * DAY).toISOString();

describe('closed-out and cancelled projects go to the archive after 10 days (Nov 13)', () => {
  it('only Closeout / Cancelled, 10 calendar days after the stage changed', () => {
    expect(isArchiveStage('Closeout') && isArchiveStage('Cancelled') && isArchiveStage('closed')).toBe(true);
    expect(isArchiveStage('Construction')).toBe(false);
    expect(archiveDue({ id: 1, name: 'a', stage: 'Closeout', stageChangedAt: ago(10) }, now)).toBe(true);
    expect(archiveDue({ id: 1, name: 'a', stage: 'Closeout', stageChangedAt: ago(9.9) }, now)).toBe(false);
    expect(archiveDue({ id: 1, name: 'a', stage: 'Design', stageChangedAt: ago(40) }, now)).toBe(false);
    expect(archiveOn({ id: 1, name: 'a', stage: 'Cancelled', stageChangedAt: ago(40), archivedAt: ago(1) })).toBeNull();
  });

  it('the preview: due now, waiting, and undated (counted from today)', () => {
    const plan = archivePlan([
      { id: 1, name: 'Due', stage: 'Closeout', stageChangedAt: ago(12) },
      { id: 2, name: 'Waiting', stage: 'Cancelled', stageChangedAt: ago(3) },
      { id: 3, name: 'Undated', stage: 'Closeout' },
      { id: 4, name: 'Live', stage: 'Construction' },
    ], now);
    expect(plan.due.map((p) => p.id)).toEqual([1]);
    expect(plan.waiting.map((p) => p.id)).toEqual([2]);
    expect(plan.undated.map((p) => [p.id, p.on.slice(0, 10)])).toEqual([[3, '2026-11-30']]);
  });

  function svc(rows: any[], settings: Record<string, string> = {}) {
    const repo = {
      find: async () => rows,
      findOneBy: async (w: any) => rows.find((r) => r.id === w.id) || null,
      update: async (w: any, patch: any) => { Object.assign(rows.find((r) => r.id === w.id), patch); },
    };
    const st = { get: async (k: string) => settings[k] ?? null, set: async (k: string, v: string) => { settings[k] = v; } };
    return { s: new ProjectsService(repo as any, undefined, undefined, st as any), settings };
  }

  it('does nothing until switched on; Apply archives the due ones and starts the count for undated ones', async () => {
    const rows: any[] = [
      { id: 1, name: 'Due', stage: 'Closeout', stageChangedAt: ago(12) },
      { id: 3, name: 'Undated', stage: 'Cancelled' },
    ];
    const { s, settings } = svc(rows);
    expect(await s.archiveSweep(now)).toBe(0);
    const r = await s.applyArchive(now);
    expect(r).toEqual({ archived: 1, counting: 1 });
    expect(settings['projects.autoArchive']).toBe('1');
    expect(!!rows[0].archivedAt && !rows[1].archivedAt && !!rows[1].stageChangedAt).toBe(true);
    expect((await s.findAll()).map((p) => p.id)).toEqual([3]);
    expect((await s.findAll('only')).map((p) => p.id)).toEqual([1]);
  });

  it('a stage change starts the count; restore clears the archive and restarts the 10 days', async () => {
    const rows: any[] = [{ id: 5, name: 'X', stage: 'Construction', archivedAt: null }];
    const { s } = svc(rows);
    await s.update('5', { stage: 'Closeout', archivedAt: 'hack' });
    expect(rows[0].stageChangedAt).toBeTruthy();
    expect(rows[0].archivedAt).toBeNull();
    await s.setArchived('5', true);
    expect(rows[0].archivedAt).toBeTruthy();
    await s.setArchived('5', false);
    expect(rows[0].archivedAt).toBeNull();
  });
});
