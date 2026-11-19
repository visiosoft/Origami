import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { StatusController } from '../settings/status.controller';
import { crc32, envName, filesIndex, scrubRow, scrubSettings, toPrune, toTrash, unzipFiles, verifyZip, zipFiles } from './db-export';
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

  it('uploads to its environment’s folder, checks the copy, and keeps 14 nightly / 8 weekly / 12 monthly', async () => {
    const trashed: string[] = []; const sets: Record<string, string> = {}; const folders: string[] = [];
    let uploaded: Buffer = Buffer.alloc(0);
    const days = Array.from({ length: 20 }, (_, i) => { const d = new Date(Date.UTC(2026, 9, 1 + i)); return d.toISOString().slice(0, 10); });
    const google: any = {
      isConnected: async () => true,
      ensureFolder: async (name: string, parent?: string) => { folders.push(parent ? `${parent}/${name}` : name); return parent ? 'ENV' : 'ROOT'; },
      uploadDriveFile: async (o: any) => { uploaded = o.buffer; return { id: 'new', name: o.name, webViewLink: 'https://drive/x' }; },
      driveFileBuffer: async () => uploaded,
      listChildren: async (id: string) => id === 'ENV' ? days.map((d, i) => ({ id: 'f' + i, name: `origami-db-staging-${d}-0300.zip` })) : [{ id: 'old', name: 'origami-db-2026-01-04-0300.zip' }, { id: 'p', name: 'origami-db-odin-2026-01-04-0300.zip' }],
      trashDriveFile: async (id: string) => { trashed.push(id); },
    };
    const data: any = { entityMetadatas: [{ tableName: 'users', tableType: 'regular', target: 'users' }], getRepository: () => ({ find: async () => [{ id: 'U-1' }] }) };
    const svc = new DbBackupService(data, google, { set: async (k: string, v: string) => { sets[k] = v; }, get: async (k: string) => (k === 'app.baseUrl' ? 'https://staging.origamidb.com' : sets[k] ?? null) } as any);
    const r = await svc.run();
    expect(r).toMatchObject({ ok: true, verified: true, env: 'staging', tables: 1, rows: 1 });
    expect(r.name).toMatch(/^origami-db-staging-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/);
    expect(folders).toEqual(['Origami System Backups', 'ROOT/staging']);
    // 20 nightly copies (Oct 1-20): the newest 14 stay; of the 6 older ones, the 1st of the month and the Sunday stay.
    expect(trashed.sort()).toEqual(['f1', 'f2', 'f4', 'f5']); // Oct 1 (the 1st) and Sun Oct 4 stay
    expect(sets['backup.db.lastGoodAt']).toBe(r.at);
  });

  it('flags a copy that doesn’t read back right and emails the admins once a day', async () => {
    const sets: Record<string, string> = {}; const mails: any[] = [];
    const google: any = {
      isConnected: async () => true, ensureFolder: async () => 'F', uploadDriveFile: async () => ({ id: 'new', name: 'x' }),
      driveFileBuffer: async () => Buffer.from('not a zip'), listChildren: async () => [], trashDriveFile: async () => undefined,
      sendMail: async (m: any) => { mails.push(m); },
    };
    const data: any = { entityMetadatas: [], getRepository: (t: any) => ({ find: async () => (t === 'users' ? [] : [{ id: 'A', roleKey: 'admin', email: 'boss@origamidb.com', status: 'active' }]) }) };
    const svc = new DbBackupService(data, google, { set: async (k: string, v: string) => { sets[k] = v; }, get: async (k: string) => sets[k] ?? null } as any);
    const r = await svc.run();
    expect(r).toMatchObject({ ok: true, verified: false });
    await new Promise((res) => setTimeout(res, 0));
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: 'boss@origamidb.com' });
    expect(JSON.parse(sets['backup.db.badIds'])).toEqual(['new']);
    await svc.alert('again', r.at.slice(0, 10));
    expect(mails).toHaveLength(1);
  });

  it('runs once a night at 3am, claiming the night first so a second server skips; warns after 36 hours without a copy', async () => {
    const sets: Record<string, string> = { 'reminders.timezone': 'UTC' }; let runs = 0; const alerts: string[] = [];
    const svc = new DbBackupService({} as any, { isConnected: async () => true } as any, { set: async (k: string, v: string) => { sets[k] = v; }, get: async (k: string) => sets[k] ?? null } as any);
    (svc as any).run = async () => { runs++; };
    (svc as any).alert = async (m: string) => { alerts.push(m); };
    await svc.tick(new Date('2026-11-20T02:10:00Z'));
    expect(runs).toBe(0);
    await svc.tick(new Date('2026-11-20T03:10:00Z'));
    await svc.tick(new Date('2026-11-20T03:40:00Z'));
    expect(runs).toBe(1);
    sets['backup.db.lastResult'] = JSON.stringify({ ok: true, verified: true, at: '2026-11-18T03:00:00Z' });
    await svc.tick(new Date('2026-11-20T12:00:00Z'));
    expect(alerts[0]).toMatch(/more than 36 hours/);
  });
});

describe('database copy: helpers (Nov 19)', () => {
  it('names the environment from the app address', () => {
    expect(envName('https://staging.origamidb.com')).toBe('staging');
    expect(envName('https://odin.origamidb.com/')).toBe('odin');
    expect(envName('http://localhost:3000')).toBe('local');
    expect(envName(null)).toBe('local');
  });

  it('a year of nightly copies keeps 14 nightly, 8 weekly and 12 monthly, and never touches another environment', () => {
    const files: { id: string; name: string }[] = [];
    for (let i = 0; i < 365; i++) { const d = new Date(Date.UTC(2025, 10, 20 + i)).toISOString().slice(0, 10); files.push({ id: d, name: `origami-db-odin-${d}-0300.zip` }); }
    files.push({ id: 'stg', name: 'origami-db-staging-2025-12-01-0300.zip' });
    const gone = new Set(toTrash(files, 'odin').map((f) => f.id));
    const kept = files.filter((f) => !gone.has(f.id) && f.id !== 'stg');
    expect(gone.has('stg')).toBe(false);
    expect(kept.length).toBeGreaterThanOrEqual(30);
    expect(kept.length).toBeLessThanOrEqual(34);
    const keptIds = new Set(kept.map((f) => f.id));
    expect(files.filter((f) => f.id !== 'stg').slice(-14).every((f) => keptIds.has(f.id))).toBe(true);
  });

  it('checks a copy: good, damaged, and wrong row counts', () => {
    const zip = zipFiles([{ name: 'manifest.json', data: Buffer.from(JSON.stringify({ tables: [{ table: 'users', rows: 2 }] })) }, { name: 'users.json', data: Buffer.from('[{"id":1},{"id":2}]') }]);
    expect(unzipFiles(zip).map((f) => f.name)).toEqual(['manifest.json', 'users.json']);
    expect(verifyZip(zip, [{ table: 'users', rows: 2 }])).toEqual({ ok: true, problems: [] });
    expect(verifyZip(zip, [{ table: 'users', rows: 3 }]).problems[0]).toMatch(/users: 2 rows, expected 3/);
    const broken = zip.subarray(0, zip.length - 30);
    expect(verifyZip(broken, [{ table: 'users', rows: 2 }]).ok).toBe(false);
  });

  it('lists where uploaded files sit in Drive', () => {
    const idx = filesIndex([
      { table: 'file_room_files', rows: [{ id: 'F1', projectId: 7, folderPath: ['Drawings', 'Arch'], name: 'A101.pdf', driveId: 'D1' }] },
      { table: 'rfis', rows: [{ id: 'R1', projectId: 7, attachments: JSON.stringify([{ name: 'photo.jpg', fileId: 'D2' }, { name: 'note' }]) }] },
    ]);
    expect(idx).toEqual([
      { table: 'file_room_files', rowId: 'F1', projectId: 7, folder: 'Drawings / Arch', name: 'A101.pdf', driveId: 'D1' },
      { table: 'rfis', rowId: 'R1', projectId: 7, name: 'photo.jpg', driveId: 'D2', url: null },
    ]);
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
