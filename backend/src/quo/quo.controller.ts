import { Body, Controller, Get, Headers, HttpCode, Post, Req, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/guards/public.decorator';
import { Roles } from '../auth/guards/roles.decorator';
import { QuoTasksService } from './quo-tasks.service';

/** Quo's task webhook (D6): public, checked by its signature. */
@Public()
@Controller('quo')
export class QuoWebhookController {
  constructor(private readonly quo: QuoTasksService) {}

  @Post('tasks-webhook')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers() headers: Record<string, string>, @Body() body: unknown) {
    const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(body ?? {});
    return this.quo.webhook(headers, raw, body);
  }
}

/** Quo tasks in Settings (administrators): connect, preview the open ones, import. */
@Roles('admin')
@Controller('quo/tasks')
export class QuoTasksController {
  constructor(private readonly quo: QuoTasksService) {}

  @Get() status() { return this.quo.status(); }
  @Post('connect') connect() { return this.quo.connect(); }
  @Post('disconnect') disconnect() { return this.quo.disconnect(); }
  @Get('preview') preview() { return this.quo.preview(); }
  @Post('import') importOpen(@Body() body: { taskIds?: string[] }) { return this.quo.importOpen(Array.isArray(body?.taskIds) ? body.taskIds.map(String) : undefined); }
}
