import { PhasesService } from './phases.service';

/** The Schedule: phase and project dates come from the tasks under them. */
describe('PhasesService.schedule', () => {
  const make = (tasks: any[]) => {
    const svc = Object.create(PhasesService.prototype) as PhasesService;
    (svc as any).tasks = { find: async () => tasks };
    (svc as any).overview = async () => [
      { projectId: 1, name: 'Chelliah', stage: 'Design', progress: 40, currentPhaseKey: 'sd',
        phases: [{ id: 'P1', key: 'sd', name: 'Schematic', color: '#000', progress: 50, complete: false, total: 2 }, { id: 'P2', key: 'cd', name: 'Construction docs', color: '#111', progress: 0, complete: false, total: 1 }] },
      { projectId: 2, name: 'Undated', stage: 'Construction', progress: 0, phases: [] },
    ];
    return svc;
  };

  it('spans each phase from its earliest start to its latest end, due date or duration', async () => {
    const out = await make([
      { projectId: 1, phaseId: 'P1', startDate: '2026-10-01', endDate: '2026-10-10' },
      { projectId: 1, phaseId: 'P1', startDate: '2026-09-20', dueDate: '2026-10-05' },
      { projectId: 1, phaseId: 'P2', startDate: '2026-11-01', durationDays: 10 },
      { projectId: 1, phaseId: null, dueDate: '2026-12-15' },             // a board task widens the project
      { projectId: 1, phaseId: 'P1', parentId: 'X', startDate: '2026-01-01' }, // subtasks don't count
      { projectId: 1, phaseId: 'P2' },                                       // undated: ignored
    ]).schedule();
    const p = out.find((r) => r.projectId === 1)!;
    expect(p.phases.map((ph) => [ph.key, ph.start, ph.end])).toEqual([['sd', '2026-09-20', '2026-10-10'], ['cd', '2026-11-01', '2026-11-10']]);
    expect([p.start, p.end]).toEqual(['2026-09-20', '2026-12-15']);
  });

  it('leaves projects with nothing dated without dates', async () => {
    const out = await make([]).schedule();
    expect(out.find((r) => r.projectId === 2)).toMatchObject({ start: null, end: null, phases: [] });
  });
});
