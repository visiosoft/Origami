/**
 * Nov 17 sync (Edward): "How do I know an RFI is coming?" -- RFIs assigned to
 * me, RFIs coming due, and the RFI log. Whose turn an RFI is: while it's open,
 * the person it was sent to (if they have a login here); as a draft or once
 * answered, its owner on our side.
 */
export interface RfiLike {
  id: string; number: string; subject?: string | null; projectId: number; status: string;
  ownerId?: string | null; to?: { email?: string | null; name?: string | null } | null; dateDue?: string | null;
}
export interface Me { id: string; email?: string | null; altEmails?: string[] | null }

const norm = (e: unknown) => String(e || '').trim().toLowerCase();
const DAY = /^\d{4}-\d{2}-\d{2}/;
const addDays = (iso: string, n: number) => { const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Is it this person's turn on the RFI? */
export function rfiMine(r: RfiLike, me: Me): boolean {
  if (r.status === 'draft' || r.status === 'answered') return !!me.id && r.ownerId === me.id;
  if (r.status === 'open') {
    const to = norm(r.to?.email);
    if (!to) return false;
    return [me.email, ...(me.altEmails || [])].some((e) => norm(e) === to);
  }
  return false;
}

/** Open RFIs I'm involved in (owner or recipient) that are due within `days`, or overdue. */
export function rfiBuckets(rfis: RfiLike[], me: Me, today: string, days = 2) {
  const live = rfis.filter((r) => r.status === 'open' || r.status === 'draft' || r.status === 'answered');
  const involved = (r: RfiLike) => rfiMine(r, me) || (r.status === 'open' && !!me.id && r.ownerId === me.id);
  const soonEnd = addDays(today, days);
  const due = (r: RfiLike) => (DAY.test(r.dateDue || '') ? r.dateDue!.slice(0, 10) : null);
  return {
    mine: live.filter((r) => rfiMine(r, me)),
    dueSoon: live.filter((r) => r.status === 'open' && involved(r) && !!due(r) && due(r)! >= today && due(r)! <= soonEnd),
    overdue: live.filter((r) => r.status === 'open' && involved(r) && !!due(r) && due(r)! < today),
  };
}

/** For the daily check: who to tell about each open RFI due tomorrow or overdue (owner + recipient with a login). */
export function rfiDueNotices(rfis: RfiLike[], users: Me[], today: string) {
  const tomorrow = addDays(today, 1);
  const out: { userId: string; event: 'rfi_due'; title: string; rfiId: string; projectId: number }[] = [];
  for (const r of rfis) {
    if (r.status !== 'open' || !DAY.test(r.dateDue || '')) continue;
    const due = r.dateDue!.slice(0, 10);
    if (due !== tomorrow && due >= today) continue;
    const who = new Set<string>();
    if (r.ownerId) who.add(r.ownerId);
    for (const u of users) if (rfiMine(r, u)) who.add(u.id);
    const label = `${r.number}${r.subject ? ` — ${r.subject}` : ''}`;
    for (const userId of who) out.push({ userId, event: 'rfi_due', rfiId: r.id, projectId: r.projectId, title: due === tomorrow ? `RFI due tomorrow: ${label}` : `RFI past due (was due ${due}): ${label}` });
  }
  return out;
}

/**
 * Nov 19 (Edward): the weekly RFI Log -- for each person, the RFIs still open
 * or answered on the projects they're on (in the project's team, or the RFI's
 * owner / recipient), overdue first.
 */
export function rfiLogs(rfis: (RfiLike & { id: string; number?: string | null; subject?: string | null; projectId: number })[], users: Me[], teamOf: (projectId: number) => string[], today: string) {
  const live = rfis.filter((r) => r.status === 'open' || r.status === 'answered');
  const out: { userId: string; title: string; body: string }[] = [];
  for (const u of users) {
    if (!u.id) continue;
    const mine = live.filter((r) => teamOf(r.projectId).includes(u.id!) || r.ownerId === u.id || rfiMine(r, u));
    if (!mine.length) continue;
    const due = (r: RfiLike) => (DAY.test(r.dateDue || '') ? r.dateDue!.slice(0, 10) : '');
    const late = (r: RfiLike) => r.status === 'open' && !!due(r) && due(r) < today;
    mine.sort((a, b) => Number(late(b)) - Number(late(a)) || (due(a) || '9').localeCompare(due(b) || '9'));
    const overdue = mine.filter(late).length;
    out.push({
      userId: u.id,
      title: `RFI Log: ${mine.length} open${overdue ? `, ${overdue} overdue` : ''}`,
      body: mine.slice(0, 25).map((r) => `${r.number || r.id} — ${r.subject || 'RFI'} · ${late(r) ? `OVERDUE (due ${due(r)})` : r.status === 'answered' ? 'answered' : due(r) ? `due ${due(r)}` : 'open'}`).join('\n') + (mine.length > 25 ? `\n…and ${mine.length - 25} more` : ''),
    });
  }
  return out;
}
