import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserEntity } from './entities';

/**
 * Assignment used to be a bare display name, which meant renaming a user
 * silently orphaned their tasks. Tasks now carry a user id as well; the name is
 * kept alongside it as a denormalized label so every existing read path — and
 * every row written before this change — still works.
 */

export interface ResolvedAssignee {
  id: string | null;
  name: string;
}

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

/**
 * Work out the id + current name for an assignment, given whichever of the two
 * the caller supplied. An unmatched name is preserved as-is rather than dropped,
 * so assignments to people without accounts survive.
 */
export async function resolveAssignee(
  users: Repository<UserEntity>,
  input: { id?: string | null; name?: string | null },
): Promise<ResolvedAssignee> {
  const id = (input.id ?? '').trim();
  const name = (input.name ?? '').trim();

  if (id) {
    const byId = await users.findOneBy({ id });
    if (byId) return { id: byId.id, name: byId.name };
  }
  if (name) {
    const all = await users.find();
    const match = all.find((u) => norm(u.name) === norm(name));
    if (match) return { id: match.id, name: match.name };
    return { id: null, name };           // free-text assignee, kept verbatim
  }
  return { id: null, name: '' };         // unassigned
}

/**
 * One-time (idempotent) pass giving pre-existing rows an assignee id by matching
 * their stored name. Safe to run on every boot — rows that already have an id,
 * or whose name matches nobody, are skipped.
 */
export async function backfillAssignees<T extends Record<string, any>>(
  tasks: Repository<any>,
  users: Repository<UserEntity>,
  idField: string,
  nameField: string,
  log: Logger,
): Promise<void> {
  const rows: T[] = await tasks.find();
  const pending = rows.filter((r) => !r[idField] && String(r[nameField] ?? '').trim());
  if (!pending.length) return;

  const all = await users.find();
  const byName = new Map(all.map((u) => [norm(u.name), u]));

  let matched = 0;
  for (const row of pending) {
    const user = byName.get(norm(row[nameField]));
    if (!user) continue;
    (row as any)[idField] = user.id;
    (row as any)[nameField] = user.name;
    await tasks.save(row);
    matched++;
  }
  log.log(`Backfilled ${matched} assignee ids, ${pending.length - matched} unmatched`);
}
