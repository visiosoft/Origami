import { mergeProblem, planMerge } from './task-merge';
import { epicProgress } from './epics.service';

/** Nov 17 (Astrid): duplicate PG&E tasks, each with its own updates and files. */
describe('merging duplicate tasks', () => {
  const keep = {
    id: 'T1', title: 'PG&E service', projectId: 7, epicId: 'EP-1', assigneeId: 'U1',
    attachments: [{ id: 'a1', name: 'app.pdf', kind: 'drive' as const }],
    comments: [{ id: 'c1', author: 'Astrid', text: 'Applied', date: '2026-11-01' }],
    activity: [{ id: 'e1', type: 'created' as const, by: 'Astrid', at: '2026-11-01T10:00:00Z' }],
    collaborators: [{ id: 'U2', name: 'Bo' }], labels: ['PG&E'], tags: ['internal'],
  };
  const dupe = {
    id: 'T2', title: 'PGE meter', projectId: 7,
    attachments: [{ id: 'a2', name: 'meter.jpg', kind: 'drive' as const }],
    comments: [{ id: 'c2', author: 'Bo', text: 'Meter date set', date: '2026-11-05' }],
    activity: [{ id: 'e2', type: 'field' as const, field: 'Due date', from: '11/10', to: '11/20', by: 'Bo', at: '2026-11-05T09:00:00Z' }],
    collaborators: [{ id: 'U3', name: 'Cy' }, { id: 'U1', name: 'Al' }], labels: ['Utilities'], tags: ['internal'],
  };

  it('refuses merges that would lose or mix things', () => {
    expect(mergeProblem(null, [dupe])).toMatch(/no longer exists/);
    expect(mergeProblem(keep, [])).toMatch(/at least one/);
    expect(mergeProblem(keep, [{ ...dupe, parentId: 'X' }])).toMatch(/subtask/);
    expect(mergeProblem(keep, [{ ...dupe, projectId: 8 }])).toMatch(/another board/);
    expect(mergeProblem(keep, [keep])).toMatch(/itself/);
    expect(mergeProblem(keep, [dupe])).toBeNull();
  });

  it('keeps every file, comment and history entry, and closes the duplicate as a subtask', () => {
    const plan = planMerge(keep, [dupe], { name: 'Ehsan', id: 'U9' }, '2026-11-17T12:00:00Z');
    expect(plan.keep.attachments.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(plan.keep.comments.map((c) => c.text)).toEqual(['Applied', '[from #T2 “PGE meter”] Meter date set']);
    expect(plan.keep.commentCount).toBe(2);
    expect(plan.keep.activity.map((e) => e.at)).toEqual(['2026-11-01T10:00:00Z', '2026-11-05T09:00:00Z', '2026-11-17T12:00:00Z']);
    expect(plan.keep.activity[1].text).toContain('[#T2 “PGE meter”]');
    expect(plan.keep.collaborators.map((c) => c.id)).toEqual(['U2', 'U3']); // not the assignee
    expect(plan.keep.labels).toEqual(['PG&E', 'Utilities']);
    expect(plan.dupes).toHaveLength(1);
    expect(plan.dupes[0].patch).toMatchObject({ parentId: 'T1', epicId: 'EP-1', completed: true, status: 'Done', completionNote: 'Merged into #T1 “PG&E service”' });
  });
});

describe('epic progress', () => {
  it('counts top-level tasks, done or archived', () => {
    const tasks = [
      { epicId: 'E', status: 'Done' }, { epicId: 'E', status: 'In progress' }, { epicId: 'E', parentId: 'x', status: 'Done' },
      { epicId: 'E', archivedAt: '2026-11-01' }, { epicId: 'F', status: 'Done' },
    ];
    expect(epicProgress('E', tasks)).toEqual({ total: 3, done: 2 });
  });
});
