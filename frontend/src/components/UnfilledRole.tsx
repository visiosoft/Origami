import { roleKeyOf, roleLabel } from '../data/projectRoles';

/** Who a task is waiting on when no one has it yet (Nov 13): its role, if no one fills that role on the project. */
export function unfilledLabel(team: string | null | undefined): string | null {
  const key = roleKeyOf(team);
  return key ? `${roleLabel(key)} — unfilled` : null;
}

/** An amber note under a task's assignee: given to a role nobody fills on this project yet. */
export function UnfilledRole({ team, assigned }: { team?: string | null; assigned: boolean }) {
  const label = assigned ? null : unfilledLabel(team);
  if (!label) return null;
  return (
    <div role="note" style={{ marginTop: 6, padding: '6px 9px', borderRadius: 8, background: '#FBEFD5', color: '#7A4B00', fontSize: 11.5, lineHeight: 1.4 }}>
      Given to <b>{label.replace(' — unfilled', '')}</b>, but no one fills that role on this project yet — set the project’s team, or pick someone here.
    </div>
  );
}
