import { Repository } from 'typeorm';
import { ProjectTasksService } from './project-tasks.service';
import { SectionsService } from './sections.service';
import { ProjectTaskEntity, UserEntity } from '../database/entities';
import { AttachmentsService } from '../google/attachments.service';
import { NotificationsService } from '../notifications/notifications.service';

function mockRepo<T extends object>() {
    return {
        findOneBy: jest.fn(),
        findBy: jest.fn().mockResolvedValue([]),
        find: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn((x) => x),
        save: jest.fn((x) => Promise.resolve(x)),
        remove: jest.fn((x) => Promise.resolve(x)),
    } as unknown as jest.Mocked<Repository<T>>;
}

describe('ProjectTasksService', () => {
    let repo: jest.Mocked<Repository<ProjectTaskEntity>>;
    let users: jest.Mocked<Repository<UserEntity>>;
    let sections: jest.Mocked<SectionsService>;
    let service: ProjectTasksService;

    beforeEach(() => {
        repo = mockRepo<ProjectTaskEntity>();
        users = mockRepo<UserEntity>();
        sections = { forProject: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<SectionsService>;
        const attachments = {} as unknown as AttachmentsService;
        const notifications = { taskAssigned: jest.fn() } as unknown as NotificationsService;
        service = new ProjectTasksService(repo, users, sections, attachments, notifications);
    });

    describe('create', () => {
        it('creates a General Tasks board task with no projectId', async () => {
            const task = await service.create({ title: 'Order office supplies', sectionId: 'S-general-0' });
            expect(task.projectId).toBeNull();
        });

        it('still creates a project-scoped task when a projectId is supplied', async () => {
            const task = await service.create({ title: 'Confirm survey', projectId: 7, sectionId: 'S-7-0' });
            expect(task.projectId).toBe(7);
        });
    });

    describe('findAll', () => {
        const rows = () => ([
            { id: 'T-1', projectId: 7, title: 'Project task' },
            { id: 'T-2', projectId: null, title: 'General task' },
        ] as unknown as ProjectTaskEntity[]);

        it('returns everything when no projectId filter is given (My Tasks / dashboard use this)', async () => {
            repo.find.mockResolvedValue(rows());
            const all = await service.findAll(undefined);
            expect(all).toHaveLength(2);
        });

        it('returns only General Tasks board items when projectId is explicitly null', async () => {
            repo.find.mockResolvedValue(rows());
            const general = await service.findAll(null);
            expect(general).toHaveLength(1);
            expect(general[0].id).toBe('T-2');
        });

        it("returns only that project's tasks when a projectId number is given", async () => {
            repo.find.mockResolvedValue(rows());
            const scoped = await service.findAll(7);
            expect(scoped).toHaveLength(1);
            expect(scoped[0].id).toBe('T-1');
        });
    });

    describe('board', () => {
        it('builds the General Tasks board payload when projectId is null', async () => {
            repo.find.mockResolvedValue([{ id: 'T-2', projectId: null, title: 'General task' } as unknown as ProjectTaskEntity]);
            const { tasks } = await service.board(null);
            expect(sections.forProject).toHaveBeenCalledWith(null);
            expect(tasks).toHaveLength(1);
        });
    });
});
