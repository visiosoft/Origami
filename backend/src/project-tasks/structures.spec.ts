import { PhasesService } from './phases.service';
import { baseKey, programmeFor, scopedDeps, structureKey, structureOfKey } from './structures';

describe('structures: keys', () => {
  it('reads the base key and structure off a phase key', () => {
    expect(baseKey('framing@adu')).toBe('framing');
    expect(baseKey('framing')).toBe('framing');
    expect(structureOfKey('framing@adu')).toBe('adu');
    expect(structureOfKey('framing')).toBe('main');
  });

  it('makes a short unique key from a name', () => {
    expect(structureKey('ADU', ['main'])).toBe('adu');
    expect(structureKey('ADU', ['main', 'adu'])).toBe('adu-2');
    expect(structureKey('Main', ['main'])).toBe('main-2');
    expect(structureKey('!!!', [])).toBe('structure');
  });

  it('copies the programme for a structure: phase keys, dependencies and task ids', () => {
    const plan = [{ key: 'found', tasks: [{ id: 't1' }] }, { key: 'frame', dependsOn: ['found'], tasks: [{ id: 't2' }] }];
    expect(programmeFor(plan, 'adu')).toEqual([
      { key: 'found@adu', dependsOn: undefined, tasks: [{ id: 't1@adu' }] },
      { key: 'frame@adu', dependsOn: ['found@adu'], tasks: [{ id: 't2@adu' }] },
    ]);
    expect(scopedDeps('frame@adu', ['found'])).toEqual(['found@adu']);
    expect(scopedDeps('frame', ['found'])).toEqual(['found']);
  });
});

describe('PhasesService structures', () => {
  const setup = (taskRows: any[] = []) => {
    const project: any = { id: 5, name: 'Lot 9', structures: null };
    const phases: any[] = [{ id: 'PH-5-found', projectId: 5, key: 'found', order: 0, structureKey: null }, { id: 'PH-5-frame', projectId: 5, key: 'frame', order: 1, structureKey: null }];
    const tasks: any[] = [...taskRows];
    const seeded: any[] = [];
    const svc = Object.create(PhasesService.prototype) as PhasesService;
    (svc as any).projects = { findOneBy: async () => project, save: async (p: any) => p };
    (svc as any).repo = {
      find: async (o: any) => phases.filter((p) => p.projectId === o.where.projectId && (o.where.structureKey === undefined || p.structureKey === o.where.structureKey)),
      create: (x: any) => x,
      save: async (rows: any) => { (Array.isArray(rows) ? rows : [rows]).forEach((r: any) => phases.push(r)); return rows; },
      remove: async (rows: any[]) => rows.forEach((r) => phases.splice(phases.indexOf(r), 1)),
    };
    (svc as any).tasks = { find: async () => tasks, remove: async (rows: any[]) => rows.forEach((r) => tasks.splice(tasks.indexOf(r), 1)) };
    (svc as any).forProject = async () => phases;
    (svc as any).programmeFor = async () => [{ key: 'found', name: 'Foundation', color: '#111', tasks: [{ id: 'a', title: 'Pour' }] }, { key: 'frame', name: 'Framing', color: '#222', dependsOn: ['found'], tasks: [] }];
    (svc as any).seedChecklists = async (_pid: number, rows: any[], plan: any[]) => { seeded.push({ rows: rows.map((r) => r.id), plan: plan.map((p) => p.tasks.map((t: any) => t.id)) }); };
    return { svc, project, phases, tasks, seeded };
  };

  it('adding the ADU names the main house and copies the programme’s phases and tasks for it', async () => {
    const { svc, project, phases, seeded } = setup();
    const r = await svc.addStructure(5, 'ADU');
    expect(r).toEqual({ structures: [{ key: 'main', name: 'Main house' }, { key: 'adu', name: 'ADU' }], phasesAdded: 2 });
    expect(project.structures).toHaveLength(2);
    expect(phases.filter((p) => p.structureKey === 'adu').map((p) => [p.id, p.name, p.order])).toEqual([['PH-5-found@adu', 'Foundation', 2], ['PH-5-frame@adu', 'Framing', 3]]);
    expect(seeded[0]).toEqual({ rows: ['PH-5-found@adu', 'PH-5-frame@adu'], plan: [['a@adu'], []] });
    await expect(svc.addStructure(5, 'adu')).rejects.toThrow(/already/);
  });

  it('a structure comes off only while none of its work has started', async () => {
    const { svc, project, phases, tasks } = setup();
    await svc.addStructure(5, 'ADU');
    tasks.push({ id: 'T-5-a@adu', projectId: 5, phaseId: 'PH-5-found@adu', status: 'In progress' });
    await expect(svc.removeStructure(5, 'adu')).rejects.toThrow(/started/);
    tasks[0].status = 'Not started';
    await expect(svc.removeStructure(5, 'main')).rejects.toThrow(/main structure stays/);
    expect(await svc.removeStructure(5, 'adu')).toEqual({ structures: [] });
    expect(project.structures).toBeNull();
    expect(phases.every((p) => !p.structureKey)).toBe(true);
    expect(tasks).toEqual([]);
  });
});
