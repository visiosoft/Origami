import sharp = require('sharp');
import { FilePreviewsService } from './file-previews.service';
import { isStagingHost, makeVariants, MAX_TRIES, retryAfterMs } from './previews';

const photo = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: '#7a8a5c' } }).jpeg({ quality: 92 }).toBuffer();

type Row = Record<string, any>;
function setup(rows: Row[], opts: { photoBytes?: Buffer; render?: Buffer | null; backfill?: string | null; connected?: boolean } = {}) {
  const uploads: Row[] = [];
  const trashed: string[] = [];
  const isIn = (v: any) => v && typeof v === 'object' && '_value' in v;
  const isNull = (v: any) => v && typeof v === 'object' && v._type === 'isNull';
  const match = (r: Row, w: Row = {}) => Object.entries(w).every(([k, v]) => (isNull(v) ? r[k] == null : isIn(v) ? v._value.includes(r[k]) : r[k] === v));
  const files = {
    find: async (o: any = {}) => rows.filter((r) => match(r, o.where)).slice(0, o.take ?? 1e9),
    update: async (w: Row, patch: Row) => { rows.filter((r) => match(r, w)).forEach((r) => Object.assign(r, patch)); },
  };
  const google = {
    isConnected: async () => opts.connected !== false,
    driveFileBuffer: jest.fn(async (id: string) => (id.startsWith('up-') ? Buffer.from(`webp:${id}`) : opts.photoBytes!)),
    driveThumbnail: jest.fn(async () => (opts.render === undefined ? null : opts.render)),
    ensureFolder: jest.fn(async () => 'previews-folder'),
    uploadDriveFile: jest.fn(async (o: Row) => { uploads.push(o); return { id: `up-${uploads.length}` }; }),
    trashDriveFile: jest.fn(async (id: string) => { trashed.push(id); }),
  };
  const settings = { get: async () => opts.backfill ?? null };
  const svc = new FilePreviewsService(files as any, google as any, settings as any);
  return { svc, rows, uploads, trashed, google };
}

describe('file thumbnails and previews', () => {
  it('a photo becomes a 300 px square WebP thumbnail and a 1200 px preview, both small', async () => {
    const big = await photo(4032, 3024);
    const out = await makeVariants(big, 'photo');
    const t = await sharp(out.thumb).metadata();
    const p = await sharp(out.preview).metadata();
    expect([t.format, t.width, t.height]).toEqual(['webp', 300, 300]);
    expect([p.format, p.width, p.height]).toEqual(['webp', 1200, 900]);
    expect(out.thumb.length).toBeLessThan(30_000);
    expect(out.preview.length).toBeLessThan(200_000);
    // a small image is never enlarged
    const small = await sharp((await makeVariants(await photo(640, 480), 'photo')).preview).metadata();
    expect(small.width).toBe(640);
  });

  it('new photos are made from the original and saved in the hidden previews folder', async () => {
    const { svc, rows, uploads, google } = setup([{ id: 'fr1', name: 'IMG_0784.jpg', mimeType: 'image/jpeg', size: 1_100_000, driveId: 'd1', previewState: 'pending', previewTries: 0 }], { photoBytes: await photo(2000, 1500) });
    expect(await svc.tick()).toBe(1);
    expect(google.driveFileBuffer).toHaveBeenCalledWith('d1');
    expect(uploads.map((u) => [u.name, u.mimeType, u.parentId])).toEqual([['fr1.thumb.webp', 'image/webp', 'previews-folder'], ['fr1.preview.webp', 'image/webp', 'previews-folder']]);
    expect(rows[0]).toMatchObject({ previewState: 'ready', thumbDriveId: 'up-1', previewDriveId: 'up-2', previewTries: 1 });
    expect(google.ensureFolder).toHaveBeenCalledWith('Origami previews');
  });

  it('PDFs use Drive’s render of page 1; while Drive is still rendering, it tries again later and then gives up', async () => {
    const pdf = { id: 'fr2', name: 'A-201.pdf', mimeType: 'application/pdf', size: 900_000, driveId: 'd2', previewState: 'pending', previewTries: 0 };
    const { svc, rows } = setup([pdf], { render: null });
    await svc.tick(Date.now());
    expect(rows[0]).toMatchObject({ previewState: 'pending', previewTries: 1 });
    expect(await svc.tick(Date.now())).toBe(0); // not due yet
    expect(await svc.tick(Date.now() + retryAfterMs(1) + 1)).toBe(1);
    rows[0].previewTries = MAX_TRIES - 1; rows[0].previewAt = null;
    await svc.tick();
    expect(rows[0].previewState).toBe('none');

    const ok = setup([{ ...pdf, previewState: 'pending', previewTries: 0, previewAt: null }], { render: await photo(1100, 1600) });
    await ok.svc.tick();
    expect(ok.rows[0].previewState).toBe('ready');
  });

  it('older files are filled in on staging (or when switched on), not on Odin by default', async () => {
    const old = () => [{ id: 'fr3', name: 'old.jpg', mimeType: 'image/jpeg', size: 10, driveId: 'd3', previewState: null }];
    const bytes = await photo(800, 600);
    const prod = setup(old(), { photoBytes: bytes });
    const host = process.env.WEBSITE_HOSTNAME;
    process.env.WEBSITE_HOSTNAME = 'origami-odin.azurewebsites.net';
    try {
      expect(await prod.svc.tick()).toBe(0);
      const on = setup(old(), { photoBytes: bytes, backfill: 'on' });
      expect(await on.svc.tick()).toBe(1);
      process.env.WEBSITE_HOSTNAME = 'dev-bzg9gyceeua8d5e9.canadacentral-01.azurewebsites.net';
      const staging = setup(old(), { photoBytes: bytes });
      expect(await staging.svc.tick()).toBe(1);
      const off = setup(old(), { photoBytes: bytes, backfill: 'off' });
      expect(await off.svc.tick()).toBe(0);
    } finally { if (host === undefined) delete process.env.WEBSITE_HOSTNAME; else process.env.WEBSITE_HOSTNAME = host; }
    expect(isStagingHost('dev-abc.azurewebsites.net')).toBe(true);
    expect(isStagingHost('https://odin.origamidb.com')).toBe(false);
  });

  it('serves thumbnails from memory after the first read; previews are fetched each time', async () => {
    const f = { id: 'fr4', previewState: 'ready', thumbDriveId: 'up-9', previewDriveId: 'up-10' } as any;
    const { svc, google } = setup([]);
    await svc.variant(f, 'thumb'); await svc.variant(f, 'thumb');
    expect(google.driveFileBuffer).toHaveBeenCalledTimes(1);
    await svc.variant(f, 'preview'); await svc.variant(f, 'preview');
    expect(google.driveFileBuffer).toHaveBeenCalledTimes(3);
    await expect(svc.variant({ ...f, previewState: 'pending' }, 'thumb')).rejects.toThrow(/No small copy/);
  });

  it('remaking replaces the old copies; deleting a file trashes them', async () => {
    const { svc, trashed, rows } = setup([{ id: 'fr5', name: 'x.jpg', mimeType: 'image/jpeg', size: 10, driveId: 'd5', previewState: 'pending', thumbDriveId: 'old-t', previewDriveId: 'old-p' }], { photoBytes: await photo(400, 300) });
    await svc.tick();
    expect(trashed).toEqual(['old-t', 'old-p']);
    await svc.forget(rows[0] as any);
    expect(trashed.slice(2)).toEqual(['up-1', 'up-2']);
  });

  it('nothing runs without a Google connection', async () => {
    const { svc } = setup([{ id: 'fr6', previewState: 'pending', driveId: 'd6' }], { connected: false });
    expect(await svc.tick()).toBe(0);
  });
});
