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
    let notifications: jest.Mocked<NotificationsService>;

    beforeEach(() => {
        repo = mockRepo<ProjectTaskEntity>();
        users = mockRepo<UserEntity>();
        sections = { forProject: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<SectionsService>;
        const attachments = {} as unknown as AttachmentsService;
        notifications = { taskAssigned: jest.fn(), taskFollowUp: jest.fn() } as unknown as jest.Mocked<NotificationsService>;
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

    describe('collaborators', () => {
        const actor = { name: 'Edward', id: 'U-ED' };

        it('keeps one entry per person, never the assignee, and tells only the newcomers', async () => {
            repo.findOneBy.mockResolvedValue({ id: 'T-1', title: 'Collect disclosures', assigneeId: 'U-AS', collaborators: [{ id: 'U-AN', name: 'Andrea' }], activity: [] } as any);
            const res: any = await service.update('T-1', {
                collaborators: [{ id: 'U-AN', name: 'Andrea' }, { id: 'U-JL', name: 'Jerrod' }, { id: 'U-JL', name: 'Jerrod' }, { id: 'U-AS', name: 'Astrid' }],
            }, actor);
            expect(res.collaborators.map((c: any) => c.id)).toEqual(['U-AN', 'U-JL']);
            expect(res.activity.some((e: any) => e.type === 'collaborators' && /added Jerrod as collaborator/.test(e.text))).toBe(true);
            expect(notifications.taskFollowUp).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'T-1' }), ['U-JL'], { kind: 'added' });
        });

        it('lets collaborators know when the task is done, and about comments (with the assignee)', async () => {
            repo.findOneBy.mockResolvedValue({ id: 'T-1', title: 'X', status: 'In progress', assigneeId: 'U-AS', collaborators: [{ id: 'U-AN', name: 'Andrea' }], activity: [], comments: [] } as any);
            await service.update('T-1', { status: 'Done' }, actor);
            expect(notifications.taskFollowUp).toHaveBeenCalledWith(expect.anything(), ['U-AN'], { kind: 'done' });
            await service.addComment('T-1', 'Client sent the survey', actor);
            expect(notifications.taskFollowUp).toHaveBeenLastCalledWith(expect.anything(), ['U-AN', 'U-AS'], { kind: 'comment', comment: 'Client sent the survey' });
        });
    });
});
