import { addBusinessDays, archiveDueAt, cleanDeadReason, cleanLossReason, deadReasonLabels, isDueForArchive } from './dead-leads';

describe('dead leads', () => {
  it('counts business days, skipping weekends', () => {
    // Fri 2026-10-30 + 7 business days = Tue 2026-11-10
    expect(addBusinessDays(new Date('2026-10-30T10:00:00Z'), 7).toISOString().slice(0, 10)).toBe('2026-11-10');
  });

  it('archives Cold / Lost and Cancelled / Pass 7 business days after they got there', () => {
    const deal = { stage: 'cold', stageEnteredAt: '2026-11-02T09:00:00Z' }; // Mon
    expect(archiveDueAt(deal)!.toISOString().slice(0, 10)).toBe('2026-11-11');
    expect(isDueForArchive(deal, new Date('2026-11-10T23:00:00Z'))).toBe(false);
    expect(isDueForArchive(deal, new Date('2026-11-11T10:00:00Z'))).toBe(true);
    expect(isDueForArchive({ ...deal, stage: 'rejected' }, new Date('2026-12-01'))).toBe(true);
  });

  it('leaves holds, referrals, archived and converted leads alone', () => {
    const later = new Date('2027-06-01');
    for (const stage of ['hold_1m', 'referred_monitoring', 'proposal']) expect(isDueForArchive({ stage, stageEnteredAt: '2026-01-01' }, later)).toBe(false);
    expect(isDueForArchive({ stage: 'cold', stageEnteredAt: '2026-01-01', archived: true }, later)).toBe(false);
    expect(isDueForArchive({ stage: 'cold', stageEnteredAt: '2026-01-01', convertedProjectId: 4 }, later)).toBe(false);
  });

  it('gives leads already dead the full 7 business days from the day the rule shipped', () => {
    const old = { stage: 'cold', stageEnteredAt: '2025-03-01T00:00:00Z' };
    expect(archiveDueAt(old)!.toISOString().slice(0, 10)).toBe('2026-11-06');
    expect(isDueForArchive(old, new Date('2026-10-29'))).toBe(false);
    expect(archiveDueAt({ stage: 'rejected' })!.toISOString().slice(0, 10)).toBe('2026-11-06');
  });

  it('only takes known loss reasons', () => {
    expect(cleanLossReason(' timeline ')).toBe('Timeline');
    expect(cleanLossReason('Price')).toBeNull();
  });
});

import { PipelineService } from './pipeline.service';
describe('PipelineService dead-lead sweep and loss', () => {
  const make = (rows: any[]) => {
    const repo: any = { find: jest.fn().mockResolvedValue(rows), save: jest.fn(async (x: any) => x), findOneBy: jest.fn(async ({ id }: any) => rows.find((r) => r.id === id)) };
    const svc = Object.create(PipelineService.prototype) as PipelineService;
    Object.assign(svc, { repo, leads: { findOneBy: jest.fn().mockResolvedValue(null) }, log: { log: jest.fn(), warn: jest.fn() } });
    return { svc, repo };
  };
  it('archives only the dead leads that are due, with a timeline line', async () => {
    const rows = [
      { id: 'A', stage: 'cold', stageEnteredAt: '2026-11-02T09:00:00Z', timeline: [] },
      { id: 'B', stage: 'rejected', stageEnteredAt: '2026-11-20T09:00:00Z', timeline: [] },
    ];
    const { svc, repo } = make(rows);
    expect(await svc.archiveDeadLeads(new Date('2026-11-12T00:00:00Z'))).toBe(1);
    expect(rows[0]).toMatchObject({ archived: true });
    expect((rows[0].timeline as any[])[0].action).toMatch(/Archived automatically/);
    expect((rows[1] as any).archived).toBeUndefined();
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
  it('records a Cold / Lost reason', async () => {
    const rows = [{ id: 'A', stage: 'cold', timeline: [] }];
    const { svc } = make(rows);
    (svc as any).leadMoved = jest.fn();
    const saved: any = await svc.setLoss('A', { lossReason: 'trust', note: 'Chose their cousin' });
    expect(saved.lossReason).toBe('Trust');
    expect(saved.timeline[0].action).toBe('Lost — Trust: Chose their cousin');
    await expect(svc.setLoss('A', { lossReason: 'Other' })).rejects.toThrow(/note/);
  });

  it('records why a lead died in full, and asks for a review follow-up on Reputation', async () => {
    const rows = [{ id: 'A', name: 'Campus Burger', stage: 'cold', assignee: 'Edward', timeline: [] }];
    const { svc } = make(rows);
    const tasks = { create: jest.fn().mockResolvedValue({}) };
    Object.assign(svc, { tasks, leadMoved: jest.fn() });
    const saved: any = await svc.setDeadReason('A', { kind: 'lost', reasons: ['value', 'reputation', 'bogus'], note: 'Went cheaper', reviewWhere: 'Yelp' }, { name: 'Andrea' } as any);
    expect(saved.deadReason).toMatchObject({ kind: 'lost', reasons: ['value', 'reputation'], reviewWhere: 'Yelp', by: 'Andrea' });
    expect(saved.lossReason).toBe('Value, Reputation');
    expect(saved.timeline[0].action).toBe('Lost — Value; Reputation: Went cheaper (review found: Yelp)');
    expect(tasks.create).toHaveBeenCalledWith(expect.objectContaining({ leadId: 'A', priority: 'High', assignedTo: 'Edward', subject: expect.stringMatching(/bad review/) }), expect.anything());
  });

  it('checks each kind: cold needs one reason and the last conversation date; cancelled takes sub-reasons', () => {
    expect(cleanDeadReason({ kind: 'cold', reasons: ['ours', 'theirs'], lastContactAt: '2026-10-01' })).toMatchObject({ ok: false, message: expect.stringMatching(/one reason/) });
    expect(cleanDeadReason({ kind: 'cold', reasons: ['theirs'] })).toMatchObject({ ok: false, message: expect.stringMatching(/last known conversation/) });
    expect(cleanDeadReason({ kind: 'cold', reasons: ['theirs'], lastContactAt: '2026-10-01T10:00' })).toMatchObject({ ok: true, value: { lastContactAt: '2026-10-01' } });
    expect(cleanDeadReason({ kind: 'lost', reasons: ['reputation'] })).toMatchObject({ ok: false, message: expect.stringMatching(/review/) });
    expect(cleanDeadReason({ kind: 'nope', reasons: ['x'] }).ok).toBe(false);
    const c = cleanDeadReason({ kind: 'cancelled', reasons: ['funding.lender', 'legal.zoning'] });
    expect(c.ok && deadReasonLabels('cancelled', c.value.reasons)).toEqual(['Funding and financial failure: Lender denied the loan', 'Legal roadblocks: Zoning']);
    expect(cleanDeadReason({ kind: 'pass', reasons: [] })).toMatchObject({ ok: false, message: expect.stringMatching(/at least one/) });
  });
});
