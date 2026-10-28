import { useState } from 'react';
import { CONTACT_STATUS_LABEL, companyOf, contactStatusOf, formerPeopleOf, type FormerCompany, type Person } from '../data/people';

const input: React.CSSProperties = { boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 12.5, color: 'var(--ink)', outline: 'none', minWidth: 0 };
const head: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 };
const link: React.CSSProperties = { border: 0, background: 'transparent', padding: 0, font: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--forest)', cursor: 'pointer' };

/**
 * Connections (Oct 27 backlog): where this person used to work, and -- on a
 * company -- the people who used to work there and where they are now. Keeps
 * a previous employee who moved to a new company connected to both.
 */
export function ContactConnections({ person, people, canManage, onSave, onOpen }: {
  person: Person; people: Person[]; canManage: boolean; onSave: (list: FormerCompany[]) => Promise<void>; onOpen: (id: number) => void;
}) {
  const former = person.formerCompanies || [];
  const formerPeople = formerPeopleOf(person, people);
  const [adding, setAdding] = useState<FormerCompany | null>(null);
  const companies = [...new Set(people.map(companyOf).filter(Boolean))].sort();
  const recordFor = (f: FormerCompany) => people.find((x) => x.id === f.personId) || people.find((x) => companyOf(x).toLowerCase() === f.company.trim().toLowerCase() && x.kind !== 'Client' && x.kind !== 'Staff');
  const save = async (list: FormerCompany[]) => { await onSave(list); setAdding(null); };
  if (!former.length && !formerPeople.length && !canManage) return null;
  return (
    <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)', display: 'grid', gap: 14 }}>
      <div>
        <div style={head}>Connections · previously at</div>
        {former.length === 0 && !adding && <div style={{ fontSize: 12, color: 'var(--muted)' }}>No earlier companies.</div>}
        <div style={{ display: 'grid', gap: 6 }}>
          {former.map((f) => {
            const rec = recordFor(f);
            return (
              <div key={f.company} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9, background: 'var(--panel)', flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--ink)' }}>
                  <b>{f.company}</b>{f.role ? ` · ${f.role}` : ''}{f.until ? <span style={{ color: 'var(--muted)' }}> · until {f.until}</span> : null}
                </span>
                {rec && <button type="button" style={link} onClick={() => onOpen(rec.id)}>Open</button>}
                {canManage && <button type="button" aria-label={`Remove ${f.company}`} onClick={() => void save(former.filter((x) => x !== f))} style={{ ...link, color: '#8E2E0A', fontWeight: 500 }}>×</button>}
              </div>
            );
          })}
        </div>
        {canManage && (adding ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6, marginTop: 8 }}>
            <input list="pc-companies" autoFocus placeholder="Company" aria-label="Former company" value={adding.company} onChange={(e) => setAdding({ ...adding, company: e.target.value })} style={input} />
            <datalist id="pc-companies">{companies.map((c) => <option key={c} value={c} />)}</datalist>
            <input placeholder="Role there" aria-label="Role there" value={adding.role || ''} onChange={(e) => setAdding({ ...adding, role: e.target.value })} style={input} />
            <input placeholder="Until (e.g. 2025)" aria-label="Until" value={adding.until || ''} onChange={(e) => setAdding({ ...adding, until: e.target.value })} style={input} />
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" disabled={!adding.company.trim()} onClick={() => { const rec = people.find((x) => companyOf(x).toLowerCase() === adding.company.trim().toLowerCase() && !['Client', 'Staff'].includes(x.kind)); void save([...former, { ...adding, personId: rec?.id ?? null }]); }}
                style={{ padding: '7px 14px', borderRadius: 999, border: 0, background: adding.company.trim() ? 'var(--forest)' : 'var(--border)', color: '#fff', font: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Add</button>
              <button type="button" onClick={() => setAdding(null)} style={{ ...link, color: 'var(--muted)', fontWeight: 500 }}>Cancel</button>
            </span>
          </div>
        ) : <button type="button" style={{ ...link, marginTop: 8 }} onClick={() => setAdding({ company: '', role: '', until: '' })}>+ Add a company they worked at</button>)}
      </div>
      {formerPeople.length > 0 && (
        <div>
          <div style={head}>People who used to work at {companyOf(person) || person.name}</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {formerPeople.map((x) => {
              const st = contactStatusOf(x);
              return (
                <button type="button" key={x.id} onClick={() => onOpen(x.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9, background: 'var(--panel)', border: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer', flexWrap: 'wrap' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--ink)' }}><b>{x.kind === 'Client' || x.kind === 'Staff' ? x.name : x.contact || x.name}</b> · now at {companyOf(x) || '—'}</span>
                  {st !== 'active' && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--sand)', color: 'var(--body)' }}>{CONTACT_STATUS_LABEL[st]}</span>}
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest)' }}>Open</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
