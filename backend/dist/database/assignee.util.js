"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAssignee = resolveAssignee;
exports.backfillAssignees = backfillAssignees;
const norm = (s) => String(s ?? '').trim().toLowerCase();
async function resolveAssignee(users, input) {
    const id = (input.id ?? '').trim();
    const name = (input.name ?? '').trim();
    if (id) {
        const byId = await users.findOneBy({ id });
        if (byId)
            return { id: byId.id, name: byId.name };
    }
    if (name) {
        const all = await users.find();
        const match = all.find((u) => norm(u.name) === norm(name));
        if (match)
            return { id: match.id, name: match.name };
        return { id: null, name };
    }
    return { id: null, name: '' };
}
async function backfillAssignees(tasks, users, idField, nameField, log) {
    const rows = await tasks.find();
    const pending = rows.filter((r) => !r[idField] && String(r[nameField] ?? '').trim());
    if (!pending.length)
        return;
    const all = await users.find();
    const byName = new Map(all.map((u) => [norm(u.name), u]));
    let matched = 0;
    for (const row of pending) {
        const user = byName.get(norm(row[nameField]));
        if (!user)
            continue;
        row[idField] = user.id;
        row[nameField] = user.name;
        await tasks.save(row);
        matched++;
    }
    log.log(`Backfilled ${matched} assignee ids, ${pending.length - matched} unmatched`);
}
//# sourceMappingURL=assignee.util.js.map