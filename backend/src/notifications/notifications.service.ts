import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity, UserEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService } from '../google/google.service';
import { loadEmailBrand } from '../email/shell';
import { assignmentEmail } from './assignment.template';

/** Which task surface a notification refers to — they have separate id spaces. */
export type TaskSurface = 'board' | 'log';

export interface AssignmentNotice {
  surface: TaskSurface;
  taskId: string;
  title: string;
  description?: string;
  projectId?: number | string;
  /** Free-text project name, used by the Request Log which has no project id. */
  projectName?: string;
  dueDate?: string;
  priority?: string;
  status?: string;
  /** The user being assigned. Null for a free-text name with no account. */
  assigneeId?: string | null;
  /** Who performed the assignment. */
  actor?: { name: string; id?: string };
}

@Injectable()
export class NotificationsService {
  private readonly log = new Logger('Notifications');

  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    private readonly settings: SettingsService,
    private readonly google: GoogleService,
  ) {}

  /**
   * Tell someone they have been given a task.
   *
   * Deliberately fire-and-forget: assigning work must succeed whether or not
   * the mail does, and a Gmail round trip is far too slow to sit in the path of
   * the request that created the task. Callers use `void`.
   */
  taskAssigned(notice: AssignmentNotice): void {
    void this.sendAssignment(notice).catch((err) => {
      this.log.warn(`Assignment email failed for ${notice.taskId}: ${(err as Error).message}`);
    });
  }

  /** Separated from the fire-and-forget wrapper so the test endpoint can await it. */
  async sendAssignment(notice: AssignmentNotice): Promise<{ sent: boolean; reason?: string }> {
    const skip = (reason: string) => {
      this.log.log(`No assignment email for ${notice.taskId}: ${reason}`);
      return { sent: false, reason };
    };

    if ((await this.settings.get('notifications.assignmentEmail')) === 'false') {
      return skip('assignment emails are switched off for the workspace');
    }
    if (!notice.assigneeId) return skip('assignee is not a platform user');
    // Being handed work by yourself is not news.
    if (notice.actor?.id && notice.actor.id === notice.assigneeId) return skip('self-assignment');

    const user = await this.users.findOneBy({ id: notice.assigneeId });
    if (!user) return skip(`no user ${notice.assigneeId}`);
    if (!user.email) return skip(`${user.id} has no email address`);
    if (user.status === 'suspended') return skip(`${user.email} is suspended`);
    if (user.notifyOnAssignment === false) return skip(`${user.email} has these emails turned off`);

    if (!(await this.google.isConnected())) return skip('no Google account is connected');

    const base = await this.settings.baseUrl();
    const brand = await loadEmailBrand(this.settings);

    const mail = assignmentEmail({
      brand,
      recipientName: user.name || user.email,
      assignerName: notice.actor?.name || 'Someone',
      title: notice.title || notice.taskId,
      description: notice.description,
      project: await this.projectLabel(notice),
      dueDate: notice.dueDate,
      priority: notice.priority,
      status: notice.status,
      url: this.taskUrl(base, notice),
      settingsUrl: `${base}/settings?tab=notifications`,
    });

    await this.google.sendMail({ to: user.email, subject: mail.subject, html: mail.html });
    this.log.log(`Assignment email sent to ${user.email} for ${notice.taskId}`);
    return { sent: true };
  }

  /** Deep link that opens this one task. See Tasks.tsx for the parameters. */
  taskUrl(base: string, notice: Pick<AssignmentNotice, 'surface' | 'taskId' | 'projectId'>) {
    const params = new URLSearchParams({ task: notice.taskId });
    if (notice.surface === 'log') params.set('type', 'log');
    else if (notice.projectId != null) params.set('project', String(notice.projectId));
    return `${base}/tasks?${params.toString()}`;
  }

  private async projectLabel(notice: AssignmentNotice): Promise<string | undefined> {
    if (notice.projectName) return notice.projectName;
    if (notice.projectId == null) return undefined;
    const project = await this.projects.findOneBy({ id: Number(notice.projectId) });
    return project?.name ?? `Project ${notice.projectId}`;
  }
}
