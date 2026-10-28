import { ListCache } from './list-cache';

describe('ListCache', () => {
  it('reads once, shares a read between callers, and reads again after a write', async () => {
    let reads = 0;
    const cache = new ListCache(async () => { reads++; return [reads]; });
    const [a, b] = await Promise.all([cache.get(), cache.get()]);
    expect(a).toEqual([1]); expect(b).toEqual([1]); expect(reads).toBe(1);
    expect(await cache.get()).toEqual([1]);
    cache.invalidate();
    expect(await cache.get()).toEqual([2]);
  });

  it('a write during a read is not lost: that read is not kept', async () => {
    let n = 0;
    let release!: () => void;
    const cache = new ListCache(async () => { n++; if (n === 1) await new Promise<void>((r) => { release = r; }); return [n]; });
    const first = cache.get();
    cache.invalidate();
    release();
    expect(await first).toEqual([1]);
    expect(await cache.get()).toEqual([2]);
  });

  it('expires after its TTL', async () => {
    let n = 0;
    const cache = new ListCache(async () => [++n], 0);
    await cache.get();
    expect(await cache.get()).toEqual([2]);
  });

  it('drops the list when the table is written to', async () => {
    const subscribers: any[] = [];
    class Thing {}
    const repo = { manager: { connection: { subscribers } }, metadata: { target: Thing } };
    let n = 0;
    const cache = new ListCache(async () => [++n]);
    cache.watch(repo as any);
    await cache.get();
    expect(subscribers[0].listenTo()).toBe(Thing);
    subscribers[0].afterUpdate({});
    expect(await cache.get()).toEqual([2]);
  });
});
