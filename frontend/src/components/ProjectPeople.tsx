import { useEffect, useState } from 'react';
import { api } from '../api';
import { EmailLink, PhoneLink } from './ContactLinks';
import type { Person } from '../data/people';

/** Who shows first: our team, the client, then everyone else. */
const ORDER: Person['kind'][] = ['Staff', 'Client', 'Consultant', 'Sub', 'Vendor', 'Authority'];
const LABEL: Record<string, string> = { Staff: 'Our team', Client: 'Client', Consultant: 'Consultants', Sub: 'Subcontractors', Vendor: 'Vendors', Authority: 'Authorities' };

/**
 * Everyone attached to a project in People, grouped by type (Oct 20: the
 * design module's "People", not just its subcontractors).
 */
export function ProjectPeople({ projectName }: { projectName: string }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  useEffect(() => {
    let live = true;
    (api.people.list(projectName) as Promise<any>)
      .then((r) => { if (live) setPeople((Array.isArray(r) ? r : []).filter((p: Person) => (p.projects || []).includes(projectName))); })
      .catch(() => { if (live) setPeople([]); });
    return () => { live = false; };
  }, [projectName]);
  if (!people) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading people…</div>;
  if (!people.length) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>No one is attached to {projectName} yet. Add them to the project in People.</div>;
  const kinds = [...ORDER, ...[...new Set(people.map((p) => p.kind))].filter((k) => !ORDER.includes(k))];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {kinds.filter((k) => people.some((p) => p.kind === k)).map((k) => (
        <section key={k}>
          <h4 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>{LABEL[k] || k} · {people.filter((p) => p.kind === k).length}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 8 }}>
            {people.filter((p) => p.kind === k).map((p) => (
              <div key={p.id} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(var(--rgb-shade), 0.1)', background: 'var(--surface)', minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', overflowWrap: 'anywhere' }}>{[p.role, p.company !== p.name ? p.company : ''].filter(Boolean).join(' · ')}</div>
                <div style={{ fontSize: 11.5, marginTop: 4, display: 'grid', gap: 1 }}><PhoneLink phone={p.phone} /><EmailLink email={p.email} /></div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
