import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateProjectTaskDto, UpdateProjectTaskDto } from '../project-tasks/dto/create-project-task.dto';

// The app's pipe: whitelist drops any field a DTO doesn't declare.
const pipe = new ValidationPipe({ whitelist: true, transform: true });
const run = (metatype: ArgumentMetadata['metatype'], value: unknown) => pipe.transform(value, { type: 'body', metatype });

const people = [{ id: 'u1', name: 'Edward' }];

describe('task bodies keep what the forms send', () => {
  it('Request Log create and update keep collaborators; create keeps the resolution', async () => {
    const created = await run(CreateTaskDto, { subject: 'Call back', collaborators: people, resolution: 'Agreed', dateClosed: '2026-10-27' });
    expect(created).toMatchObject({ collaborators: people, resolution: 'Agreed', dateClosed: '2026-10-27' });
    expect(await run(UpdateTaskDto, { collaborators: people })).toMatchObject({ collaborators: people });
  });

  it('board create and update keep collaborators', async () => {
    expect(await run(CreateProjectTaskDto, { title: 'Order tile', description: 'Grey 12x24', assigneeId: 'u1', collaborators: people }))
      .toMatchObject({ description: 'Grey 12x24', collaborators: people });
    expect(await run(UpdateProjectTaskDto, { collaborators: people })).toMatchObject({ collaborators: people });
  });

  it('board updates are a validated patch: no title needed, unknown fields dropped, bad types refused', async () => {
    const patch = await run(UpdateProjectTaskDto, { description: 'Now with notes', activity: [{ text: 'forged' }], createdById: 'x' });
    expect(patch).toEqual(expect.objectContaining({ description: 'Now with notes' }));
    expect(patch).not.toHaveProperty('activity');
    expect(patch).not.toHaveProperty('createdById');
    await expect(run(UpdateProjectTaskDto, { order: 'first' })).rejects.toBeTruthy();
    expect(await run(UpdateProjectTaskDto, { projectId: null, parentId: null })).toMatchObject({ projectId: null, parentId: null });
  });
});
