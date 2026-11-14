import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { StatusController } from '../settings/status.controller';
import { crc32, scrubRow, scrubSettings, toPrune, zipFiles } from './db-export';
import { DbBackupService } from './db-backup.service';

describe('database copy: what goes in', () => {
  it('leaves out passwords, sign-in secrets and tokens', () => {
    const u = { id: 'U-1', name: 'Bea', email: 'b@o.co', passwordHash: 'x', inviteToken: 'x', totpSecret: 'x', totpPending: 'x', backupCodes: ['x'], trustedDevices: [], otpHash: 'x', otpPending: 'x', mailRefreshToken: 'x', calendarRefreshToken: 'x', totpEnabledAt: '2026-01-01' };
    expect(scrubRow(u)).toEqual({ id: 'U-1', name: 'Bea', email: 'b@o.co', totpEnabledAt: '2026-01-01' });
  });

  it('leaves out secret settings', () => {
    const rows = [{ key: 'google.clientSecret', value: 's' }, { key: 'sms.quoApiKey', value: 'k' }, { key: 'custom.webhookToken', value: 't' }, { key: 'reminders.timezone', value: 'America/Los_Angeles' }];
    expect(scrubSettings(rows, ['google.clientSecret'])).toEqual([{ key: 'reminders.timezone', value: 'America/Los_Angeles' }]);
  });

  it('keeps only the newest 8 copies', () => {
    const files = Array.from({ length: 10 }, (_, i) => ({ id: String(i), name: `origami-db-2026-11-${String(i + 10).padStart(2, '0')}-0300.zip` }));
    files.push({ id: 'other', name: 'notes.txt' });
    expect(toPrune(files).map((f) => f.id)).toEqual(['1', '0']);
  });
});

describe('database copy: the zip', () => {
  it('is a real zip that standard tools open', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
    const big = JSON.stringify(Array.from({ length: 2000 }, (_, i) => ({ id: i, name: 'Row ' + i, note: 'naïve – “quotes”' })));
    const zip = zipFiles([{ name: 'manifest.json', data: Buffer.from('{"ok":true}') }, { name: 'users.json', data: Buffer.from(big) }]);
    expect(zip.length).toBeLessThan(big.length);
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    writeFileSync(join(dir, 'a.zip'), zip);
    expect(execFileSync('unzip', ['-t', join(dir, 'a.zip')]).toString()).toMatch(/No errors detected/);
    execFileSync('unzip', ['-o', '-q', join(dir, 'a.zip'), '-d', dir]);
    expect(readFileSync(join(dir, 'users.json'), 'utf8')).toBe(big);
  });

  it('builds one JSON per table and a manifest', async () => {
    const tables: Record<string, any[]> = { users: [{ id: 'U-1', passwordHash: 'x' }], app_settings: [{ key: 'auth.jwtSecret', value: 'x' }, { key: 'app.notice', value: 'hi' }] };
    const data: any = {
      entityMetadatas: [{ tableName: 'users', tableType: 'regular', target: 'users' }, { tableName: 'app_settings', tableType: 'regular', target: 'app_settings' }, { tableName: 'v', tableType: 'view', target: 'v' }],
      getRepository: (t: string) => ({ find: async () => tables[t] }),
    };
    const svc = new DbBackupService(data, {} as any, {} as any);
    const out = await svc.build();
    expect(out.tables).toEqual([{ table: 'app_settings', rows: 1 }, { table: 'users', rows: 1 }]);
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    writeFileSync(join(dir, 'b.zip'), out.zip);
    execFileSync('unzip', ['-o', '-q', join(dir, 'b.zip'), '-d', dir]);
    expect(JSON.parse(readFileSync(join(dir, 'users.json'), 'utf8'))).toEqual([{ id: 'U-1' }]);
    expect(JSON.parse(readFileSync(join(dir, 'app_settings.json'), 'utf8'))).toEqual([{ key: 'app.notice', value: 'hi' }]);
    expect(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')).tables).toHaveLength(2);
  });

  it('uploads to its own folder and trashes copies past the last 8', async () => {
    const trashed: string[] = []; const sets: Record<string, string> = {};
    const google: any = {
      isConnected: async () => true, ensureFolder: async () => 'F1',
      uploadDriveFile: async (o: any) => ({ id: 'new', name: o.name, webViewLink: 'https://drive/x' }),
      listChildren: async () => Array.from({ length: 9 }, (_, i) => ({ id: 'f' + i, name: `origami-db-2026-10-${String(i + 10).padStart(2, '0')}-0300.zip` })),
      trashDriveFile: async (id: string) => { trashed.push(id); },
    };
    const data: any = { entityMetadatas: [], getRepository: () => ({ find: async () => [] }) };
    const svc = new DbBackupService(data, google, { set: async (k: string, v: string) => { sets[k] = v; }, get: async () => null } as any);
    const r = await svc.run();
    expect(r).toMatchObject({ ok: true, removed: 1 });
    expect(trashed).toEqual(['f0']);
    expect(JSON.parse(sets['backup.db.lastResult']).ok).toBe(true);
  });
});

describe('health', () => {
  it('answers ok when the database does, 503 when it doesn’t', async () => {
    const up = new StatusController({} as any, { query: async () => [{ ok: 1 }] } as any);
    expect(await up.health()).toMatchObject({ ok: true, db: 'ok' });
    const down = new StatusController({} as any, { query: async () => { throw new Error('ECONNREFUSED'); } } as any);
    await expect(down.health()).rejects.toMatchObject({ status: 503 });
  });
});
