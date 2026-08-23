import { Controller, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Roles } from '../auth/guards/roles.decorator';
import { Claims } from '../auth/guards/claims.decorator';
import type { SessionClaims } from '../auth/crypto.util';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /**
   * Send yourself a sample assignment email.
   *
   * Exists so the template can be checked without assigning real work to a real
   * colleague — the only way to see this email otherwise is to mail someone.
   * Mirrors the existing google/test-email.
   */
  @Roles('admin')
  @Post('test')
  async test(@Claims() claims: SessionClaims | null) {
    if (!claims) return { sent: false, reason: 'no session' };
    return this.notifications.sendAssignment({
      surface: 'board',
      taskId: 'SAMPLE-1',
      title: 'Provide Project Program Details',
      description: 'This is a sample assignment email so you can check how it looks. '
        + 'No task was created and nobody else was emailed.',
      projectName: 'Origami DB Development',
      dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      priority: 'Medium',
      status: 'Not started',
      assigneeId: claims.sub,
      // Deliberately not the recipient, or the self-assignment rule would skip it.
      actor: { name: 'Origami', id: undefined },
    });
  }
}
