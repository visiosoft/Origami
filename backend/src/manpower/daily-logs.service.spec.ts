import { Repository } from 'typeorm';
import { DailyLogsService } from './daily-logs.service';
import { DailyLogEntity, LaborLogEntryEntity } from '../database/entities';

function mockRepo<T extends object>() {
  return {
    findOneBy: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    remove: jest.fn((x) => Promise.resolve(x)),
  } as unknown as jest.Mocked<Repository<T>>;
}

describe('DailyLogsService', () => {
  let logs: jest.Mocked<Repository<DailyLogEntity>>;
  let entries: jest.Mocked<Repository<LaborLogEntryEntity>>;
  let service: DailyLogsService;

  beforeEach(() => {
    logs = mockRepo<DailyLogEntity>();
    entries = mockRepo<LaborLogEntryEntity>();
    service = new DailyLogsService(logs, entries);
  });

  describe('save', () => {
    it('creates a new draft daily log with entries when none exists yet', async () => {
      logs.findOneBy.mockResolvedValue(null);
      const result = await service.save(
        { projectId: 7, date: '2026-09-24', notes: 'Poured slab', entries: [{ employeeId: 'EMP-1', hours: 8 }] },
        { name: 'Supervisor Sam', id: 'U-1' },
      );
      expect(result.log.status).toBe('draft');
      expect(result.log.projectId).toBe(7);
      expect(entries.save).toHaveBeenCalled();
    });

    it('refuses to edit a submitted log', async () => {
      logs.find.mockResolvedValue([{ id: 'DL-1', status: 'submitted', projectId: 7, date: '2026-09-24' } as DailyLogEntity]);
      await expect(service.save({ projectId: 7, date: '2026-09-24', entries: [] }, { name: 'X' }))
        .rejects.toThrow(/already been submitted/);
    });
  });

  describe('submit -> approve', () => {
    it('flips status to submitted then approved, stamping the approver', async () => {
      const draft = { id: 'DL-1', status: 'draft', projectId: 7, date: '2026-09-24', supervisorId: 'U-1' } as DailyLogEntity;
      logs.findOneBy.mockResolvedValue(draft);
      const submitted = await service.submit('DL-1', { name: 'Supervisor Sam', id: 'U-1' });
      expect(submitted.status).toBe('submitted');

      logs.findOneBy.mockResolvedValue(submitted);
      const approved = await service.approve('DL-1', { name: 'Office Olivia', id: 'U-2' });
      expect(approved.status).toBe('approved');
      expect(approved.approvedByName).toBe('Office Olivia');
    });

    it('blocks a supervisor from approving their own submission', async () => {
      const submitted = { id: 'DL-1', status: 'submitted', projectId: 7, date: '2026-09-24', supervisorId: 'U-1' } as DailyLogEntity;
      logs.findOneBy.mockResolvedValue(submitted);
      await expect(service.approve('DL-1', { name: 'Supervisor Sam', id: 'U-1' }))
        .rejects.toThrow(/own submission/);
    });
  });

  describe('reject', () => {
    it('records the rejection note and rejector', async () => {
      const submitted = { id: 'DL-1', status: 'submitted', projectId: 7, date: '2026-09-24', supervisorId: 'U-1' } as DailyLogEntity;
      logs.findOneBy.mockResolvedValue(submitted);
      const rejected = await service.reject('DL-1', 'Missing CSI codes', { name: 'Office Olivia', id: 'U-2' });
      expect(rejected.status).toBe('rejected');
      expect(rejected.rejectionNote).toBe('Missing CSI codes');
    });
  });

  describe('a worker split across two projects the same day', () => {
    it('creates two independent daily logs, one per project, each with its own entry', async () => {
      logs.findOneBy.mockResolvedValueOnce(null);
      const first = await service.save(
        { projectId: 1, date: '2026-09-24', entries: [{ employeeId: 'EMP-1', hours: 5 }] },
        { name: 'Supervisor Sam', id: 'U-1' },
      );
      logs.findOneBy.mockResolvedValueOnce(null);
      const second = await service.save(
        { projectId: 2, date: '2026-09-24', entries: [{ employeeId: 'EMP-1', hours: 3 }] },
        { name: 'Supervisor Sam', id: 'U-1' },
      );
      expect(first.log.projectId).toBe(1);
      expect(second.log.projectId).toBe(2);
      expect(first.log.id).not.toBe(second.log.id);
    });
  });

  describe('Daily Report: versions, signature, templates', () => {
    /** An in-memory table so versions of a day can be found again. */
    function table(rows: any[] = []) {
      const match = (r: any, w: any) => Object.entries(w || {}).every(([k, v]) => r[k] === v);
      return {
        rows,
        find: jest.fn(async (o?: any) => rows.filter((r) => match(r, o?.where))),
        findOneBy: jest.fn(async (w: any) => rows.find((r) => match(r, w)) || null),
        create: jest.fn((x: any) => ({ ...x })),
        save: jest.fn(async (x: any) => { const list = Array.isArray(x) ? x : [x]; for (const it of list) { const i = rows.findIndex((r) => r.id === it.id); if (i >= 0) rows[i] = it; else rows.push(it); } return x; }),
        remove: jest.fn(async (x: any) => { for (const it of Array.isArray(x) ? x : [x]) { const i = rows.findIndex((r) => r.id === it.id); if (i >= 0) rows.splice(i, 1); } return x; }),
      };
    }
    const sam = { name: 'Supervisor Sam', id: 'U-1' };
    const sections = { activity: { worked: 'yes', photos: 'yes' } };
    function setup(users: any[] = []) {
      const l = table(); const e = table(); const t = table(); const u = table(users);
      return { l, t, svc: new DailyLogsService(l as any, e as any, t as any, u as any) };
    }

    it('adds an updated report as the next version of the day, and lists every version', async () => {
      const { svc } = setup();
      const first = await svc.save({ projectId: 7, date: '2026-10-14', sections }, sam);
      const second = await svc.save({ projectId: 7, date: '2026-10-14', sections, newVersion: true }, sam);
      expect(first.log.version).toBe(1);
      expect(second.log).toMatchObject({ version: 2, versionOf: first.log.id });
      const day = await svc.getForDay(7, '2026-10-14');
      expect(day.log.id).toBe(second.log.id); // latest by default
      expect(day.versions.map((v) => v.version)).toEqual([1, 2]);
      expect((await svc.getForDay(7, '2026-10-14', first.log.id)).log.id).toBe(first.log.id);
    });

    it("won't move a draft onto a day that already has a report unless it's an update", async () => {
      const { svc } = setup();
      await svc.save({ projectId: 7, date: '2026-10-13', sections }, sam);
      const draft = await svc.save({ projectId: 7, date: '2026-10-14', sections }, sam);
      await expect(svc.save({ id: draft.log.id, projectId: 7, date: '2026-10-13', sections }, sam)).rejects.toThrow(/already a report for 2026-10-13/);
      const moved = await svc.save({ id: draft.log.id, projectId: 7, date: '2026-10-13', sections, newVersion: true }, sam);
      expect(moved.log).toMatchObject({ date: '2026-10-13', version: 2 });
    });

    it('stamps the signature time once and keeps it', async () => {
      const { svc } = setup();
      const a = await svc.save({ projectId: 7, date: '2026-10-14', sections, certifiedName: 'Sam', signatureDataUrl: 'data:image/png;base64,AAA' }, sam);
      const at = a.log.signedAt;
      expect(at).toBeTruthy();
      await new Promise((r) => setTimeout(r, 5));
      const b = await svc.save({ id: a.log.id, projectId: 7, date: '2026-10-14', sections, notes: 'later', certifiedName: 'Sam', signatureDataUrl: 'data:image/png;base64,BBB' }, sam);
      expect(b.log.signedAt).toBe(at);
    });

    it('needs Section II answered and Section X signed before a full report is submitted', async () => {
      const { svc } = setup();
      const draft = await svc.save({ projectId: 7, date: '2026-10-14', sections: { activity: {} } }, sam);
      await expect(svc.submit(draft.log.id, sam)).rejects.toThrow(/Did work occur today/);
      await svc.save({ id: draft.log.id, projectId: 7, date: '2026-10-14', sections }, sam);
      await expect(svc.submit(draft.log.id, sam)).rejects.toThrow(/Sign the certification/);
      await svc.save({ id: draft.log.id, projectId: 7, date: '2026-10-14', certifiedName: 'Sam', signatureDataUrl: 'data:x' }, sam);
      expect((await svc.submit(draft.log.id, sam)).status).toBe('submitted');
    });

    it('approving an updated report supersedes the earlier approved one, so hours count once', async () => {
      const { svc, l } = setup();
      const office = { name: 'Office Olivia', id: 'U-2' };
      const one = await svc.save({ projectId: 7, date: '2026-10-14' }, sam);
      await svc.submit(one.log.id, sam); await svc.approve(one.log.id, office);
      const two = await svc.save({ projectId: 7, date: '2026-10-14', newVersion: true }, sam);
      await svc.submit(two.log.id, sam); await svc.approve(two.log.id, office);
      expect(l.rows.find((r) => r.id === one.log.id).status).toBe('superseded');
      expect(l.rows.find((r) => r.id === two.log.id).status).toBe('approved');
    });

    it('shares named templates; only the maker or an admin can delete one', async () => {
      const { svc, t } = setup([{ id: 'U-9', roleKey: 'admin' }]);
      const tpl = await svc.saveTemplate({ name: 'Framing day', sections, entries: [{ employeeId: 'E1', hours: 8, taskDetail: 'x' }] }, sam);
      expect(tpl.entries).toEqual([{ employeeId: 'E1', hours: 8, csiCodeId: undefined, team: undefined, taskStatus: undefined }]);
      expect((await svc.listTemplates()).map((x) => x.name)).toEqual(['Framing day']);
      await expect(svc.saveTemplate({ name: 'framing DAY' }, { name: 'Other', id: 'U-3' })).rejects.toThrow(/already a template/);
      await expect(svc.removeTemplate(tpl.id, { name: 'Other', id: 'U-3' })).rejects.toThrow(/Only Supervisor Sam/);
      await svc.removeTemplate(tpl.id, { name: 'Admin', id: 'U-9' });
      expect(t.rows).toHaveLength(0);
    });
  });
});
