import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Public } from '../auth/guards/public.decorator';
import { SettingsService } from './settings.service';

/** The build this server is serving: the hashed name of the app bundle in client/index.html. */
function servedBuild(): string {
  const index = join(__dirname, '..', '..', 'client', 'index.html');
  if (!existsSync(index)) return '';
  const m = readFileSync(index, 'utf8').match(/assets\/(index-[\w-]+\.js)/);
  return m ? m[1] : '';
}
const BUILD = servedBuild();

/**
 * A cheap heartbeat the app checks once a minute: is the server up, which
 * build is it serving (so an open page can offer "new version -- refresh"),
 * and is there a notice from an administrator ("updates 3-4 pm").
 * Public, so it answers even for a page whose session has lapsed.
 */
@Public()
@Controller('status')
export class StatusController {
  constructor(private readonly settings: SettingsService, private readonly data: DataSource) {}

  @Get()
  async status() {
    const s = await this.settings.getMany(['app.noticeActive', 'app.notice']);
    const on = s['app.noticeActive'] === 'true' && !!(s['app.notice'] || '').trim();
    return { build: BUILD, notice: on ? s['app.notice'].trim() : null };
  }

  /**
   * For the uptime check (Batch 6): the server answers and the database
   * does. 503 when the database doesn't, so a monitor sees a failure.
   */
  @Get('health')
  async health() {
    const time = new Date().toISOString();
    try {
      let timer: NodeJS.Timeout | undefined;
      try {
        await Promise.race([this.data.query('SELECT 1 AS ok'), new Promise((_, no) => { timer = setTimeout(() => no(new Error('timed out')), 10_000); })]);
      } finally { if (timer) clearTimeout(timer); }
      return { ok: true, db: 'ok', build: BUILD, time };
    } catch (e) {
      throw new HttpException({ ok: false, db: 'down', error: (e as Error).message.slice(0, 200), build: BUILD, time }, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
