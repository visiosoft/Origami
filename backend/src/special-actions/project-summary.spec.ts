import { SpecialActionsService } from './special-actions.service';

const qb = (m: string | null) => ({ select: () => ({ where: () => ({ getRawOne: async () => ({ m }) }) }) });

describe('project special actions summary', () => {
  it('counts what is open and says when each kind last changed', async () => {
    const svc = Object.create(SpecialActionsService.prototype) as SpecialActionsService;
    Object.assign(svc, {
      projects: { findOne: jest.fn().mockResolvedValue({ id: 7, name: 'HOM Cafe' }) },
      boardRepo: { createQueryBuilder: () => qb('2026-10-20T10:00:00Z') },
      rfiRepo: { createQueryBuilder: () => qb('2026-10-21T10:00:00Z'), count: jest.fn().mockResolvedValue(2) },
      meetingRepo: { createQueryBuilder: () => qb(null), find: jest.fn().mockResolvedValue([{ date: '2999-01-01', status: 'scheduled' }, { date: '2000-01-01', status: 'occurred' }]) },
      coRepo: { createQueryBuilder: () => qb('2026-10-22T10:00:00Z'), find: jest.fn().mockResolvedValue([{ status: 'draft' }, { status: 'approved' }]) },
      logRepo: { find: jest.fn().mockResolvedValue([
        { topicType: 'Observation', updatedAt: '2026-10-25T00:00:00Z' },
        { topicType: 'Task', updatedAt: '2026-10-26T00:00:00Z' },
        { topicType: 'Decision', updatedAt: '2026-10-24T00:00:00Z' },
      ]) },
    });
    const r = await svc.projectSummary(7);
    expect(r.latest).toEqual({ tasks: '2026-10-26T00:00:00Z', rfis: '2026-10-21T10:00:00Z', meetings: null, forRecord: '2026-10-25T00:00:00Z', changeOrders: '2026-10-22T10:00:00Z' });
    expect(r.counts).toMatchObject({ meetingsUpcoming: 1, meetings: 2, forRecord: 2, changeOrdersOpen: 1, changeOrders: 2, rfisOpen: 2 });
  });
});
