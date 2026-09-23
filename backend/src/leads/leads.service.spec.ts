import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { LeadsService } from './leads.service';
import { LeadEntity } from '../database/entities';
import { TasksService } from '../tasks/tasks.service';

/** Minimal stand-in for the pieces of Repository this service actually calls. */
function mockRepo() {
    return {
        findOneBy: jest.fn(),
        create: jest.fn((x) => x),
        save: jest.fn((x) => Promise.resolve(x)),
        remove: jest.fn((x) => Promise.resolve(x)),
        find: jest.fn(),
    } as unknown as jest.Mocked<Repository<LeadEntity>>;
}

/** Lets a syncHomeworkTask() call fired-and-forgotten by create()/update()
 *  finish before assertions run, since the caller never awaits it. */
const flush = () => new Promise((r) => setImmediate(r));

describe('LeadsService', () => {
    let repo: jest.Mocked<Repository<LeadEntity>>;
    let tasks: jest.Mocked<TasksService>;
    let service: LeadsService;

    beforeEach(() => {
        repo = mockRepo();
        tasks = {
            findAll: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockResolvedValue({ id: 'T-1' }),
            update: jest.fn().mockResolvedValue({ id: 'T-1' }),
        } as unknown as jest.Mocked<TasksService>;
        service = new LeadsService(repo, tasks);
    });

    describe('create', () => {
        it('uses the caller-supplied id so a lead links 1:1 with its pipeline deal', async () => {
            repo.findOneBy.mockResolvedValue(null);
            await service.create({ id: 'PL-1004', leadName: 'Qamaria Coffee' });
            expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'PL-1004' }));
        });

        it('mints an LD- id when none is supplied', async () => {
            repo.findOneBy.mockResolvedValue(null);
            await service.create({ leadName: 'Standalone Lead' });
            const saved = (repo.create as jest.Mock).mock.calls[0][0];
            expect(saved.id).toMatch(/^LD-/);
        });

        it('rejects a supplied id that already exists instead of silently upserting onto it', async () => {
            // Regression test: two unrelated leads used to silently merge into
            // one record whenever a client-minted id collided with an existing
            // lead's id, because save() upserts by primary key. The service must
            // now fail loudly instead.
            repo.findOneBy.mockResolvedValue({ id: 'PL-1004' } as LeadEntity);
            await expect(service.create({ id: 'PL-1004', leadName: 'Neon Project' })).rejects.toBeInstanceOf(ConflictException);
            expect(repo.save).not.toHaveBeenCalled();
        });
    });

    describe('findOne', () => {
        it('throws NotFoundException when the lead does not exist', async () => {
            repo.findOneBy.mockResolvedValue(null);
            await expect(service.findOne('LD-9999')).rejects.toBeInstanceOf(NotFoundException);
        });

        it('returns the lead when it exists', async () => {
            const lead = { id: 'LD-1', leadName: 'Maria Santos' } as LeadEntity;
            repo.findOneBy.mockResolvedValue(lead);
            await expect(service.findOne('LD-1')).resolves.toBe(lead);
        });
    });

    describe('update', () => {
        it('creates the row (upsert) when saving against an id with no existing lead', async () => {
            repo.findOneBy.mockResolvedValue(null);
            await service.update('PL-2000', { phone: '555-0100' });
            expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'PL-2000', phone: '555-0100' }));
            expect(repo.save).toHaveBeenCalled();
        });

        it('rejects a save whose expectedUpdatedAt is stale', async () => {
            const existing = { id: 'LD-1', updatedAt: '2026-01-01T00:00:00.000Z' } as LeadEntity;
            repo.findOneBy.mockResolvedValue(existing);
            await expect(
                service.update('LD-1', { expectedUpdatedAt: '2025-12-31T00:00:00.000Z', phone: '555-0100' }),
            ).rejects.toBeInstanceOf(ConflictException);
            expect(repo.save).not.toHaveBeenCalled();
        });

        it('allows the save when expectedUpdatedAt matches the row', async () => {
            const existing = { id: 'LD-1', updatedAt: '2026-01-01T00:00:00.000Z' } as LeadEntity;
            repo.findOneBy.mockResolvedValue(existing);
            await service.update('LD-1', { expectedUpdatedAt: '2026-01-01T00:00:00.000Z', phone: '555-0100' });
            expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ phone: '555-0100' }));
        });

        it('allows the save when the row has no updatedAt stamp yet (pre-existing rows)', async () => {
            const existing = { id: 'LD-1' } as LeadEntity;
            repo.findOneBy.mockResolvedValue(existing);
            await service.update('LD-1', { expectedUpdatedAt: '2026-01-01T00:00:00.000Z', phone: '555-0100' });
            expect(repo.save).toHaveBeenCalled();
        });
    });

    describe('homework task sync', () => {
        it('creates exactly one task listing only the selected homework items when a lead is created', async () => {
            repo.findOneBy.mockResolvedValue(null);
            await service.create({ id: 'PL-1', leadName: 'Neon Project', homeworkCompleted: ['As-Builts', 'Survey'] });
            await flush();
            expect(tasks.create).toHaveBeenCalledTimes(1);
            const payload = (tasks.create as jest.Mock).mock.calls[0][0];
            expect(payload.project).toBe('PL-1');
            expect(payload.labels).toContain('kind:homework-collection');
            expect(payload.description).toBe('Collect from client: As-Builts, Survey');
            expect(payload.description).not.toContain('Soils'); // sanity: an unselected item is not listed
        });

        it('updates the same task on a later save instead of creating a second one', async () => {
            const existing = { id: 'T-1', description: 'Collect from client: Survey', labels: ['kind:homework-collection'] };
            tasks.findAll.mockResolvedValue([existing] as any);
            const lead = { id: 'PL-1', updatedAt: '2026-01-01T00:00:00.000Z' } as LeadEntity;
            repo.findOneBy.mockResolvedValue(lead);
            await service.update('PL-1', { homeworkCompleted: ['As-Builts', 'Survey', 'Soils / Geotechnical Report'] });
            await flush();
            expect(tasks.create).not.toHaveBeenCalled();
            expect(tasks.update).toHaveBeenCalledWith('T-1', { description: 'Collect from client: As-Builts, Survey, Soils / Geotechnical Report' }, expect.anything());
        });

        it('does not touch the task when a save omits homeworkCompleted entirely', async () => {
            const lead = { id: 'PL-1', updatedAt: '2026-01-01T00:00:00.000Z' } as LeadEntity;
            repo.findOneBy.mockResolvedValue(lead);
            await service.update('PL-1', { phone: '555-0100' });
            await flush();
            expect(tasks.findAll).not.toHaveBeenCalled();
            expect(tasks.create).not.toHaveBeenCalled();
            expect(tasks.update).not.toHaveBeenCalled();
        });

        it('leaves an existing task open with a neutral message when everything gets unchecked', async () => {
            const existing = { id: 'T-1', description: 'Collect from client: Sketches', labels: ['kind:homework-collection'] };
            tasks.findAll.mockResolvedValue([existing] as any);
            const lead = { id: 'PL-1', updatedAt: '2026-01-01T00:00:00.000Z' } as LeadEntity;
            repo.findOneBy.mockResolvedValue(lead);
            await service.update('PL-1', { homeworkCompleted: [] });
            await flush();
            expect(tasks.create).not.toHaveBeenCalled();
            expect(tasks.update).toHaveBeenCalledWith('T-1', { description: 'No homework items selected yet.' }, expect.anything());
        });

        it('does not create a task when nothing has ever been selected', async () => {
            tasks.findAll.mockResolvedValue([]);
            repo.findOneBy.mockResolvedValue(null);
            await service.create({ id: 'PL-2', leadName: 'Blank Lead', homeworkCompleted: [] });
            await flush();
            expect(tasks.create).not.toHaveBeenCalled();
        });
    });

    describe('remove', () => {
        it('removes the lead when it exists', async () => {
            const lead = { id: 'LD-1' } as LeadEntity;
            repo.findOneBy.mockResolvedValue(lead);
            await service.remove('LD-1');
            expect(repo.remove).toHaveBeenCalledWith(lead);
        });

        it('does not error when the lead is already gone', async () => {
            repo.findOneBy.mockResolvedValue(null);
            await expect(service.remove('LD-404')).resolves.toEqual({ id: 'LD-404', deleted: true });
            expect(repo.remove).not.toHaveBeenCalled();
        });
    });
});
