import { CONTACT_STATUS_HINT, CONTACT_STATUS_LABEL, contactStatusOf, internalLevelOf, type Person } from '../data/people';
import { SortHeader, useSort } from './SortHeader';
import './PeopleTable.css';

/** Soft avatar colours, picked from the name so a person keeps theirs. */
const AVATAR_TONES = ['#F3D9B1', '#CFE0CC', '#F2CFC4', '#D5DCE8', '#F5E3A1', '#E3D3EC', '#CFE5E4', '#EBD8C8'];
const toneFor = (name: string) => AVATAR_TONES[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_TONES.length];
const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/** How each kind reads in the Type column. */
const LEVEL_PILL: Record<string, string> = {
  Executive: 'pt-pill is-exec', Staff: 'pt-pill is-staff', Super: 'pt-pill is-warm', Foreman: 'pt-pill is-warm', Labor: 'pt-pill is-soft',
};
const TYPE_PILL: Record<Person['kind'], string> = {
  Staff: 'pt-pill is-staff', Client: 'pt-pill is-client', Consultant: 'pt-pill is-soft', Sub: 'pt-pill is-warm',
  Authority: 'pt-pill is-soft', Vendor: 'pt-pill is-soft',
};

/**
 * The People list in the New look: one rounded card, quiet column heads, a
 * tick box per row (ticked rows turn yellow) and a pill for the record type.
 * Clicking a row opens the person.
 */
export function PeopleTable({ people, picked, onPick, onPickAll, onOpen }: {
  people: Person[];
  picked: Set<number>;
  onPick: (id: number) => void;
  onPickAll: (on: boolean) => void;
  onOpen: (id: number) => void;
}) {
  const allOn = people.length > 0 && people.every((p) => picked.has(p.id));
  // Click a heading to sort by it, again to reverse.
  const { sorted, sort, toggle } = useSort(people, {
    name: (p) => p.name, role: (p) => p.role, company: (p) => p.company, projects: (p) => p.projects.length,
    since: (p) => (/^\d{4}-\d{2}-\d{2}/.test(p.since || '') ? p.since : ''), type: (p) => internalLevelOf(p) || p.kind,
  }, null, { since: 'desc', projects: 'desc' });
  const H = (k: string, label: string) => <SortHeader k={k} sort={sort} onSort={toggle}>{label}</SortHeader>;
  return (
    <div className="pt-card">
      <div className="pt-row pt-head" role="row">
        <span className="pt-check">
          <input type="checkbox" aria-label="Select all" checked={allOn} onChange={(e) => onPickAll(e.target.checked)} />
        </span>
        <span>{H('name', 'Name')}</span>
        <span className="pt-hide-sm">{H('role', 'Role')}</span>
        <span className="pt-hide-md">{H('company', 'Company')}</span>
        <span className="pt-hide-md">{H('projects', 'Projects')}</span>
        <span className="pt-hide-sm">{H('since', 'Since')}</span>
        <span>{H('type', 'Type')}</span>
      </div>
      {people.length === 0 && <div className="pt-empty">No one matches.</div>}
      {sorted.map((p, i) => {
        const on = picked.has(p.id);
        const alert = p.comply && !p.comply.ok;
        return (
          <div
            key={p.id}
            role="row"
            className={'pt-row pt-body' + (on ? ' is-on' : '')}
            style={{ animationDelay: Math.min(i, 12) * 0.03 + 's' }}
            onClick={() => onOpen(p.id)}
          >
            <span className="pt-check" onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" aria-label={'Select ' + p.name} checked={on} onChange={() => onPick(p.id)} />
            </span>
            <span className="pt-name">
              <span className="pt-avatar" style={{ background: toneFor(p.name) }}>{initials(p.name)}</span>
              <span className="pt-name-text">
                <span className="pt-strong">{p.name}</span>
                <span className="pt-sub pt-show-sm">{p.role}</span>
              </span>
            </span>
            <span className="pt-cell pt-hide-sm">{p.role}</span>
            <span className="pt-cell pt-hide-md">{p.company}</span>
            <span className="pt-cell pt-hide-md">
              {p.projects.length === 0 ? <span className="pt-muted">—</span> : <>{p.projects[0]}{p.projects.length > 1 && <span className="pt-muted"> +{p.projects.length - 1}</span>}</>}
            </span>
            <span className="pt-cell pt-hide-sm">{p.since || '—'}</span>
            <span className="pt-type">
              {(() => { const lv = internalLevelOf(p); return lv
                ? <span className={LEVEL_PILL[lv]}><i />{lv}</span>
                : <span className={TYPE_PILL[p.kind] || 'pt-pill is-soft'}><i />{p.kind === 'Sub' ? 'Sub' : p.kind}</span>; })()}
              {contactStatusOf(p) !== 'active' && <span className={'pt-pill is-' + contactStatusOf(p)} title={p.contactStatusReason || CONTACT_STATUS_HINT[contactStatusOf(p)]}>{CONTACT_STATUS_LABEL[contactStatusOf(p)]}</span>}
              {alert && <span className="pt-pill is-alert" title={p.comply?.label || 'Insurance or licence needs attention'}>!</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
