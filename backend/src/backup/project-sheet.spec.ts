import { buildTabs } from './sheet-rows';
import { ProjectSheetService } from './project-sheet.service';

const data = {
  boardTasks: [{ id: 'b1', serial: 'T-2026-0002', title: 'Order tiles', status: 'In progress', priority: 'High', assignee: 'Kai', dueDate: '2026-11-10', tags: ['internal'], labels: ['Roof'] }],
  logTasks: [
    { id: 'l1', serial: 'T-2026-0001', topicType: 'Task', subject: 'Call the city', status: 'To Do', assignedTo: 'Ann' },
    { id: 'l2', serial: 'FR-2026-0001', topicType: 'Decision', subject: 'Owner picked oak', status: 'Open', originator: 'Ed', meetingDate: '2026-11-01' },
  ],
  rfis: [{ number: 'RFI-002', subject: 'Beam size', status: 'answered', question: '<p>Which <b>beam</b>?</p>', answer: 'W8x10' }],
  changeOrders: [{ number: 'CO-001', title: 'Extra outlet', status: 'approved', amount: 450, reason: 'client_request', scheduleImpactDays: 1 }],
  meetings: [{ id: 'm1', serial: 'MTG-2026-0001', title: 'OAC', type: 'Internal', date: '2026-11-02', attendees: [{ name: 'Ed' }, { name: 'Ann' }] }],
};

describe('backup sheet rows', () => {
  it('one tab each, header first; board and Log tasks together, FOR RECORD apart', () => {
    const tabs = buildTabs(data);
    expect(tabs.map((t) => t.title)).toEqual(['Tasks', 'RFIs', 'Change orders', 'FOR RECORD', 'Meetings']);
    const tasks = tabs[0].rows;
    expect(tasks.slice(1).map((r) => r[0])).toEqual(['T-2026-0001', 'T-2026-0002']);
    expect(tasks[2][6]).toBe('internal, Roof');
    expect(tabs[3].rows[1].slice(0, 3)).toEqual(['FR-2026-0001', 'Decision', 'Owner picked oak']);
    expect(tabs[1].rows[1][5]).toBe('Which beam ?');
    expect(tabs[2].rows[1][3]).toBe(450);
    expect(tabs[4].rows[1][6]).toBe('Ed, Ann');
  });
});

describe('the backup sheet', () => {
  it('is made once in the project’s Drive folder, then its tabs are rewritten', async () => {
    const calls: string[] = [];
    const real = global.fetch;
    global.fetch = jest.fn(async (url: any, init: any) => {
      calls.push(`${init?.method || 'GET'} ${String(url).replace(/\?.*/, '')}`);
      const body = String(url).includes('drive/v3/files') && init?.method === 'POST' ? { id: 'SHEET1' } : String(url).includes('fields=sheets') ? { sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }] } : {};
      return { ok: true, json: async () => body, text: async () => '' } as any;
    }) as any;
    try {
      const updates: any[] = [];
      const repo = (rows: any[]) => ({ find: async () => rows, update: async (w: any, p: any) => updates.push(p) });
      const svc = new ProjectSheetService(repo([]) as any, repo(data.boardTasks) as any, repo(data.logTasks) as any, repo(data.rfis) as any, repo(data.changeOrders) as any, repo(data.meetings) as any,
        { workspaceToken: async () => 'tok', folderForPath: async () => 'FOLDER', isConnected: async () => true } as any, {} as any);
      const r = await svc.refresh({ id: 3, name: 'Cole Valley', backupSheetId: null } as any);
      expect(r.sheetId).toBe('SHEET1');
      expect(updates).toEqual([{ backupSheetId: 'SHEET1' }]);
      expect(calls).toEqual([
        'POST https://www.googleapis.com/drive/v3/files',
        'GET https://sheets.googleapis.com/v4/spreadsheets/SHEET1',
        'POST https://sheets.googleapis.com/v4/spreadsheets/SHEET1:batchUpdate',
        'POST https://sheets.googleapis.com/v4/spreadsheets/SHEET1/values:batchClear',
        'POST https://sheets.googleapis.com/v4/spreadsheets/SHEET1/values:batchUpdate',
      ]);
      calls.length = 0;
      await svc.refresh({ id: 3, name: 'Cole Valley', backupSheetId: 'SHEET1' } as any);
      expect(calls[0]).toBe('GET https://www.googleapis.com/drive/v3/files/SHEET1');
      expect(calls.some((c) => c === 'POST https://www.googleapis.com/drive/v3/files')).toBe(false);
    } finally { global.fetch = real; }
  });
});
