import { AssignmentsService } from './assignments.service';
import { summarizeLines, WorkforceRequestsService } from './workforce-requests.service';
import { EmployeeAssignmentEntity, EmployeeEntity, ProjectEntity } from '../database/entities';

/** An in-memory table good enough for the find/findBy/findOneBy/save calls these services make. */
function table<T extends { id: any }>(rows: T[]) {
  const match = (row: any, where: any) => Object.entries(where || {}).every(([k, v]: [string, any]) => {
    if (v && typeof v === 'object' && '_value' in v && Array.isArray(v._value)) return v._value.includes(row[k]); // In(...)
    return row[k] === v;
  });
  return {
    rows,
    find: jest.fn(async (opts?: any) => rows.filter((r) => match(r, opts?.where))),
    findBy: jest.fn(async (where: any) => rows.filter((r) => match(r, where))),
    findOneBy: jest.fn(async (where: any) => rows.find((r) => match(r, where)) ?? null),
    count: jest.fn(async (opts?: any) => rows.filter((r) => match(r, opts?.where)).length),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => {
      for (const item of Array.isArray(x) ? x : [x]) {
        const i = rows.findIndex((r) => r.id === item.id);
        if (i >= 0) rows[i] = item; else rows.push(item);
      }
      return x;
    }),
  };
}

const actor = { name: 'Site Super', id: 'U-1' };

function setup(employees: Partial<EmployeeEntity>[], assignments: Partial<EmployeeAssignmentEntity>[] = []) {
  const emp = table(employees as EmployeeEntity[]);
  const asg = table(assignments as EmployeeAssignmentEntity[]);
  const proj = table([{ id: 1, name: 'Tower A' }, { id: 2, name: 'Villa B' }] as ProjectEntity[]);
  const manager = {
    getRepository: (entity: any) => (entity === EmployeeEntity ? emp : asg),
    transaction: async (fn: any) => fn(manager),
  };
  (asg as any).manager = manager;
  const service = new AssignmentsService(asg as any, emp as any, proj as any);
  return { service, emp, asg, proj };
}

describe('AssignmentsService', () => {
  it('deploys several workers at once, carrying their trade and designation', async () => {
    const { service, asg } = setup([
      { id: 'E1', name: 'Ali', employmentStatus: 'active', tradeId: 'TRD-01', designation: 'Mason' },
      { id: 'E2', name: 'Bilal', employmentStatus: 'active', tradeId: 'TRD-01' },
    ]);
    const made = await service.assign({ employeeIds: ['E1', 'E2'], projectId: 1, startDate: '2026-09-24', workArea: 'Tower A' }, actor);
    expect(made).toHaveLength(2);
    expect(asg.rows[0]).toMatchObject({ projectId: 1, tradeId: 'TRD-01', designation: 'Mason', status: 'active', assignmentType: 'regular' });
  });

  it('refuses the whole batch if anyone is already deployed or not active, naming each', async () => {
    const { service, asg } = setup(
      [
        { id: 'E1', name: 'Ali', employmentStatus: 'active' },
        { id: 'E2', name: 'Bilal', employmentStatus: 'resigned' },
        { id: 'E3', name: 'Chand', employmentStatus: 'active' },
      ],
      [{ id: 'A1', employeeId: 'E1', projectId: 2, status: 'active', assignmentType: 'regular', startDate: '2026-09-01' }],
    );
    await expect(service.assign({ employeeIds: ['E1', 'E2', 'E3'], projectId: 1 }, actor))
      .rejects.toThrow(/Ali is already deployed.*Bilal is not active/);
    expect(asg.rows).toHaveLength(1);
  });

  it('allows temporary cover alongside a regular assignment, but requires its end date', async () => {
    const { service } = setup(
      [{ id: 'E1', name: 'Ali', employmentStatus: 'active' }],
      [{ id: 'A1', employeeId: 'E1', projectId: 2, status: 'active', assignmentType: 'regular', startDate: '2026-09-01' }],
    );
    await expect(service.assign({ employeeIds: ['E1'], projectId: 1, assignmentType: 'temporary' }, actor)).rejects.toThrow(/needs an end date/);
    const made = await service.assign({ employeeIds: ['E1'], projectId: 1, assignmentType: 'temporary', startDate: '2026-09-24', endDate: '2026-09-30' }, actor);
    expect(made[0].assignmentType).toBe('temporary');
  });

  it('transfer closes the old stint on the effective date and links the new one back to it', async () => {
    const { service, asg } = setup(
      [{ id: 'E1', name: 'Ali', employmentStatus: 'active' }],
      [{ id: 'A1', employeeId: 'E1', projectId: 1, workArea: 'Tower A', status: 'active', assignmentType: 'regular', startDate: '2026-09-01', designation: 'Mason' }],
    );
    const to = await service.transfer('A1', { projectId: 2, startDate: '2026-09-24' }, actor);
    const from = asg.rows.find((a) => a.id === 'A1')!;
    expect(from).toMatchObject({ status: 'ended', endDate: '2026-09-24', endReason: 'transfer' });
    expect(to).toMatchObject({ projectId: 2, transferredFromId: 'A1', designation: 'Mason', status: 'active' });
    expect(asg.rows).toHaveLength(2);
  });

  it('refuses a transfer to the same project and work area', async () => {
    const { service } = setup(
      [{ id: 'E1', name: 'Ali', employmentStatus: 'active' }],
      [{ id: 'A1', employeeId: 'E1', projectId: 1, workArea: 'Tower A', status: 'active', assignmentType: 'regular', startDate: '2026-09-01' }],
    );
    await expect(service.transfer('A1', { projectId: 1, workArea: 'Tower A' }, actor)).rejects.toThrow(/same project/);
  });

  it('demobilize ends every open stint and marks the employee demobilized', async () => {
    const { service, asg, emp } = setup(
      [{ id: 'E1', name: 'Ali', employmentStatus: 'active', status: 'active' }],
      [
        { id: 'A1', employeeId: 'E1', projectId: 1, status: 'active', assignmentType: 'regular', startDate: '2026-09-01' },
        { id: 'A2', employeeId: 'E1', projectId: 2, status: 'active', assignmentType: 'temporary', startDate: '2026-09-20', endDate: '2026-12-01' },
      ],
    );
    const res = await service.demobilize('E1', { date: '2026-09-24' }, actor);
    expect(res.ended).toBe(2);
    expect(asg.rows.every((a) => a.status === 'ended' && a.endReason === 'demobilized')).toBe(true);
    expect(emp.rows[0]).toMatchObject({ employmentStatus: 'demobilized', status: 'inactive' });
  });
});

describe('summarizeLines', () => {
  it('reports required, allocated, available pool, shortage and surplus per trade', () => {
    const request = { id: 'WR1', lines: [{ id: 'L1', tradeId: 'MASON', quantity: 3 }, { id: 'L2', tradeId: 'ELEC', quantity: 1 }] };
    const employees = [
      { id: 'E1', tradeId: 'MASON', employmentStatus: 'active' },
      { id: 'E2', tradeId: 'MASON', employmentStatus: 'active' },
      { id: 'E3', tradeId: 'MASON', employmentStatus: 'resigned' },
      { id: 'E4', tradeId: 'ELEC', employmentStatus: 'active' },
      { id: 'E5', tradeId: 'ELEC', employmentStatus: 'active' },
    ] as EmployeeEntity[];
    const openRegular = new Map<string, unknown>([['E2', {}], ['E4', {}], ['E5', {}]]);
    const linked = [
      { workforceRequestId: 'WR1', requestLineId: 'L1' },
      { workforceRequestId: 'WR1', requestLineId: 'L2' },
      { workforceRequestId: 'WR1', requestLineId: 'L2' },
    ] as EmployeeAssignmentEntity[];
    const [mason, elec] = summarizeLines(request, employees, openRegular, linked);
    expect(mason).toMatchObject({ allocated: 1, available: 1, shortage: 2, surplus: 0 });
    expect(elec).toMatchObject({ allocated: 2, available: 0, shortage: 0, surplus: 1 });
  });
});

describe('WorkforceRequestsService approvals', () => {
  it('stops the requester approving their own request', async () => {
    const repo = { findOneBy: jest.fn().mockResolvedValue({ id: 'WR1', status: 'submitted', requestedById: 'U-1', lines: [] }) };
    const svc = new WorkforceRequestsService(repo as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    await expect(svc.approve('WR1', undefined, actor)).rejects.toThrow(/own request/);
  });

  it('only allocates against an approved request', async () => {
    const repo = { findOneBy: jest.fn().mockResolvedValue({ id: 'WR1', status: 'submitted', lines: [{ id: 'L1', tradeId: 'X', quantity: 1 }] }) };
    const svc = new WorkforceRequestsService(repo as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    await expect(svc.allocate('WR1', { lineId: 'L1', employeeIds: ['E1'] }, actor)).rejects.toThrow(/approved request/);
  });
});
