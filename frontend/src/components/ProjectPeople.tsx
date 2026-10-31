import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { EmailLink, PhoneLink } from './ContactLinks';
import type { Person } from '../data/people';
import { Skeleton } from './Skeleton';

/** Who shows first: our team, the client, then everyone else. */
const ORDER: Person['kind'][] = ['Staff', 'Client', 'Consultant', 'Sub', 'Vendor', 'Authority'];
const LABEL: Record<string, string> = { Staff: 'Our team', Client: 'Client', Consultant: 'Consultants', Sub: 'Subcontractors', Vendor: 'Vendors', Authority: 'Authorities' };

/** The phases of a project someone can be on (Oct 26 review notes). */
const PHASES: [string, string][] = [['crm', 'CRM'], ['design', 'Design'], ['precon', 'Precon'], ['construction', 'Construction']];

/**
 * Everyone attached to a project in People, grouped by type (Oct 20: the
 * design module's "People", not just its subcontractors), with the phases each
 * works on -- CRM, Design, Precon, Construction (Oct 26) -- and a phase filter.
 */
export function ProjectPeople({ projectName }: { projectName: string }) {
  const { can, toast } = useApp();
  const canEdit = can('people', 'manage');
  const [people, setPeople] = useState<Person[] | null>(null);
  const [phase, setPhase] = useState('');
  const phasesOf = (p: Person) => p.projectPhases?.[projectName] || [];
  const toggle = (p: Person, key: string) => {
    const cur = phasesOf(p);
    const next = cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key];
    setPeople((list) => (list || []).map((x) => (x.id === p.id ? { ...x, projectPhases: { ...(x.projectPhases || {}), [projectName]: next } } : x)));
    api.people.setProjectPhases(p.id, projectName, next).catch((e: Error) => toast('⚠ Not saved — ' + (e.message || 'try again')));
  };
  useEffect(() => {
    let live = true;
    (api.people.list(projectName) as Promise<any>)
      .then((r) => { if (live) setPeople((Array.isArray(r) ? r : []).filter((p: Person) => (p.projects || []).includes(projectName))); })
      .catch(() => { if (live) setPeople([]); });
    return () => { live = false; };
  }, [projectName]);
  if (!people) return <Skeleton label="Loading people…" />;
  if (!people.length) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>No one is attached to {projectName} yet. Add them to the project in People.</div>;
  const kinds = [...ORDER, ...[...new Set(people.map((p) => p.kind))].filter((k) => !ORDER.includes(k))];
  const shown = phase ? people.filter((p) => phasesOf(p).includes(phase)) : people;
  const chip = (on: boolean) => ({ padding: '3px 9px', borderRadius: 999, border: '1px solid ' + (on ? 'var(--forest)' : 'rgba(var(--rgb-shade), 0.14)'), background: on ? 'var(--forest)' : 'var(--surface)', color: on ? '#fff' : 'var(--muted)', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: canEdit ? 'pointer' : 'default' });
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div role="toolbar" aria-label="Phase" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Phase</span>
        {[['', 'Everyone'] as [string, string], ...PHASES].map(([k, l]) => (
          <button key={k || 'all'} type="button" aria-pressed={phase === k} onClick={() => setPhase(k)} style={{ ...chip(phase === k), cursor: 'pointer', padding: '5px 12px', fontSize: 12 }}>
            {l}{k && ` · ${people.filter((p) => phasesOf(p).includes(k)).length}`}
          </button>
        ))}
      </div>
      {!shown.length && <div style={{ fontSize: 13, color: 'var(--muted)' }}>No one is marked for this phase yet.</div>}
      {kinds.filter((k) => shown.some((p) => p.kind === k)).map((k) => (
        <section key={k}>
          <h4 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>{LABEL[k] || k} · {shown.filter((p) => p.kind === k).length}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 8 }}>
            {shown.filter((p) => p.kind === k).map((p) => (
              <div key={p.id} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(var(--rgb-shade), 0.1)', background: 'var(--surface)', minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', overflowWrap: 'anywhere' }}>{[p.role, p.company !== p.name ? p.company : ''].filter(Boolean).join(' · ')}</div>
                <div style={{ fontSize: 11.5, marginTop: 4, display: 'grid', gap: 1 }}><PhoneLink phone={p.phone} /><EmailLink email={p.email} /></div>
                <div role="group" aria-label={`Phases for ${p.name}`} style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                  {PHASES.map(([key, l]) => {
                    const on = phasesOf(p).includes(key);
                    return canEdit
                      ? <button key={key} type="button" aria-pressed={on} onClick={() => toggle(p, key)} style={chip(on)}>{l}</button>
                      : on ? <span key={key} style={chip(true)}>{l}</span> : null;
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
