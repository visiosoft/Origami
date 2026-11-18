import { rfiBuckets, rfiDueNotices, rfiMine } from './rfi-alerts';
import { todayPanel } from '../dashboard/today';
import { eventOf } from '../notifications/matrix';

/** Nov 17: RFIs assigned to me, coming due, and the Today panel. */
describe('RFI alerts', () => {
  const me = { id: 'U1', email: 'ed@o.com', altEmails: ['ed@apogee.com'] };
  const rfi = (o: any) => ({ id: 'R', number: 'RFI-001', projectId: 7, status: 'open', ownerId: 'U2', to: { email: 'ED@apogee.com' }, dateDue: '2026-11-19', ...o });

  it('whose turn: the recipient while open, the owner as a draft or once answered', () => {
    expect(rfiMine(rfi({}), me)).toBe(true); // sent to my other address
    expect(rfiMine(rfi({ to: { email: 'x@y.com' } }), me)).toBe(false);
    expect(rfiMine(rfi({ status: 'draft', ownerId: 'U1' }), me)).toBe(true);
    expect(rfiMine(rfi({ status: 'answered', ownerId: 'U1' }), me)).toBe(true);
    expect(rfiMine(rfi({ status: 'closed', ownerId: 'U1' }), me)).toBe(false);
  });

  it('due soon and overdue, for RFIs I own or was sent', () => {
    const b = rfiBuckets([rfi({ id: 'A', dateDue: '2026-11-19' }), rfi({ id: 'B', dateDue: '2026-11-10', to: { email: 'x@y.com' }, ownerId: 'U1' }), rfi({ id: 'C', dateDue: '2026-12-30' })], me, '2026-11-18');
    expect(b.dueSoon.map((r) => r.id)).toEqual(['A']);
    expect(b.overdue.map((r) => r.id)).toEqual(['B']);
    expect(b.mine.map((r) => r.id)).toEqual(['A', 'C']);
  });

  it('the daily check tells the owner and the recipient', () => {
    const n = rfiDueNotices([rfi({ dateDue: '2026-11-19' }), rfi({ id: 'P', dateDue: '2026-11-01' }), rfi({ id: 'Z', dateDue: '2026-11-25' })] as any, [me, { id: 'U2', email: 'owner@o.com' }], '2026-11-18');
    expect(n.filter((x) => x.rfiId === 'R').map((x) => x.userId).sort()).toEqual(['U1', 'U2']);
    expect(n.find((x) => x.rfiId === 'R')!.title).toMatch(/^RFI due tomorrow: RFI-001/);
    expect(n.find((x) => x.rfiId === 'P')!.title).toMatch(/past due \(was due 2026-11-01\)/);
    expect(n.some((x) => x.rfiId === 'Z')).toBe(false);
  });

  it('the events are in the notification settings, under RFIs', () => {
    expect(eventOf('rfi_assigned')?.group).toBe('RFIs');
    expect(eventOf('rfi_due')?.defaults).toEqual(['email_daily']);
  });
});

describe('Today panel', () => {
  it('lists my Emergency / Urgent, overdue and due-today tasks, most pressing first', () => {
    const board = [
      { id: '1', title: 'Due today', assigneeId: 'U1', dueDate: '2026-11-18', projectId: 7 },
      { id: '2', title: 'Urgent', assigneeId: 'U1', priority: 'Urgent', dueDate: '2026-12-01', projectId: 7 },
      { id: '3', title: 'Late', assigneeId: 'U1', dueDate: '2026-11-10', projectId: 7 },
      { id: '4', title: 'Someone else', assigneeId: 'U9', priority: 'Emergency', projectId: 7 },
      { id: '5', title: 'Done', assigneeId: 'U1', priority: 'Emergency', completed: true, projectId: 7 },
      { id: '6', title: 'Next week', assigneeId: 'U1', dueDate: '2026-11-25', projectId: 7 },
    ];
    const log = [{ id: 'L1', subject: 'Emergency log', assignedToId: 'U1', priority: 'Emergency', status: 'In Progress' }];
    const r = todayPanel(board, log, [], { id: 'U1', email: 'ed@o.com' }, { today: '2026-11-18', projectName: () => 'Countryside', logClosed: () => false });
    expect(r.tasks.map((t) => t.title)).toEqual(['Emergency log', 'Urgent', 'Late', 'Due today']);
    expect(r.tasks.map((t) => t.tag)).toEqual(['emergency', 'urgent', 'overdue', 'today']);
  });
});
