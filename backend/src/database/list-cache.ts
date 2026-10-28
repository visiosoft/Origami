import type { EntitySubscriberInterface, Repository } from 'typeorm';

/**
 * A whole table's list, kept in memory between requests.
 *
 * The task lists were rebuilt from the database on every request -- several
 * seconds each on the hosted database -- although they change only when
 * someone saves. The list is read once, served from memory, and dropped the
 * moment anything in the app writes to the table (any repository save,
 * update, insert or delete, from any module, is seen through a TypeORM
 * subscriber). The TTL is a safety net for writes it can't see: another
 * server instance, or raw SQL.
 */
export class ListCache<T> {
  private rows: T[] | null = null;
  private at = 0;
  private loading: Promise<T[]> | null = null;
  private generation = 0;

  constructor(private readonly load: () => Promise<T[]>, private readonly ttlMs = 60_000) {}

  /** Something changed: the next read loads afresh (a load already under way is not reused). */
  invalidate() {
    this.generation++;
    this.rows = null;
    this.loading = null;
  }

  async get(): Promise<T[]> {
    if (this.rows && Date.now() - this.at < this.ttlMs) return this.rows;
    if (this.loading) return this.loading;
    const generation = this.generation;
    // Requests arriving together share one read.
    const loading = this.load().then((rows) => {
      if (generation === this.generation) { this.rows = rows; this.at = Date.now(); }
      return rows;
    }).finally(() => { if (this.loading === loading) this.loading = null; });
    this.loading = loading;
    return loading;
  }

  /** Drop the list whenever the repository's table is written to (call once, at start-up). */
  watch(repo: Repository<any>) {
    const ds = (repo as any)?.manager?.dataSource ?? (repo as any)?.manager?.connection;
    const target = (repo as any)?.metadata?.target;
    if (!ds?.subscribers || !target) return;
    const drop = () => this.invalidate();
    const sub: EntitySubscriberInterface = {
      listenTo: () => target,
      afterInsert: drop, afterUpdate: drop, afterRemove: drop, afterSoftRemove: drop, afterRecover: drop,
    };
    ds.subscribers.push(sub);
  }
}
