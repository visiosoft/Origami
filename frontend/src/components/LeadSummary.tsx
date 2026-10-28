import { useNavigate } from 'react-router-dom';
import { seedContactsFromLead, type LeadContact } from '../data/leadContacts';

const head: React.CSSProperties = { fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' };
const box: React.CSSProperties = { padding: '12px 14px', background: 'var(--panel)', borderRadius: 10, minWidth: 0 };
const k: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 };
const v: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5, wordBreak: 'break-word' };

const when = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const join = (...parts: (string | undefined | null)[]) => parts.map((p) => (p || '').trim()).filter(Boolean).join(', ');

/**
 * What the CRM knows about the client, shown on the project so it isn't lost
 * once a lead becomes a job. Read from the lead itself -- nothing is copied.
 */
export function LeadSummary({ lead }: { lead: Record<string, any> }) {
  const navigate = useNavigate();
  const contacts: LeadContact[] = Array.isArray(lead.contacts) && lead.contacts.length ? lead.contacts : seedContactsFromLead(lead);
  const notes: { id: string; text: string; at?: string }[] = Array.isArray(lead.clientBackground?.notes) ? lead.clientBackground.notes : [];
  const address = join(lead.projectStreetAddress || lead.projectStreetName, lead.projectAddress2, lead.projectCity, lead.projectZipCode);
  const source = join(lead.leadSource, lead.leadSourceReferrerName && `referred by ${lead.leadSourceReferrerName}${lead.leadSourceReferrerPhone ? ` (${lead.leadSourceReferrerPhone})` : ''}`, lead.leadSourceEventDetail);
  const facts: [string, string][] = ([
    ['Lead source', source],
    ['Site address', join(address, lead.countyLocation && `${lead.countyLocation} County`)],
    ['Property', join(lead.propertyType, lead.occupancyStatus, lead.hasHOA === 'Yes' ? 'HOA' : '')],
    ['Budget', join(lead.budgetPosition, lead.fundingStatus)],
    ['Wants to start', join(lead.desiredStart, lead.expectedDuration && `about ${lead.expectedDuration}`)],
    ['Decision makers', lead.decisionMakers || ''],
    ['First meeting', when(lead.virtualMeetingAt)],
    ['Site visit', when(lead.siteVisitAt)],
  ] as [string, string][]).filter(([, val]) => val);

  return (
    <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ ...head, flex: 1 }}>From the lead</div>
        <span onClick={() => navigate(`/pipeline?open=${encodeURIComponent(lead.id)}`)} style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--forest)', cursor: 'pointer' }}>Open lead ↗</span>
      </div>

      {contacts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 10 }}>
          {contacts.map((c) => {
            const full = [c.firstName, c.lastName].map((x) => (x || '').trim()).filter(Boolean).join(' ');
            const name = c.goByName && c.goByName !== c.firstName ? `${c.goByName} (${full})` : full;
            return (
              <div key={c.id} style={box}>
                <div style={k}>{c.title || (c.id === 'C-primary' ? 'Primary contact' : 'Contact')}</div>
                <div style={v}>{name || '—'}</div>
                <div style={{ fontSize: 12.5, color: 'var(--body)', marginTop: 3, display: 'grid', gap: 2 }}>
                  {c.phone && <a href={`tel:${c.phone}`} style={{ color: 'inherit' }}>{c.phone}</a>}
                  {c.email && <a href={`mailto:${c.email}`} style={{ color: 'inherit', wordBreak: 'break-all' }}>{c.email}</a>}
                  {c.preferredContactMethod && <span style={{ color: 'var(--muted)' }}>Prefers {c.preferredContactMethod.toLowerCase()}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {facts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {facts.map(([key, val]) => <div key={key} style={box}><div style={k}>{key}</div><div style={v}>{val}</div></div>)}
        </div>
      )}

      {(lead.clientPersonality || notes.length > 0) && (
        <div style={{ ...box, marginTop: 10 }}>
          <div style={k}>About the client</div>
          {lead.clientPersonality && <div style={{ fontSize: 13, color: 'var(--body)', lineHeight: 1.6 }}>{lead.clientPersonality}</div>}
          {notes.slice(-5).map((n) => (
            <div key={n.id} style={{ fontSize: 13, color: 'var(--body)', lineHeight: 1.6, marginTop: 6 }}>
              {n.text}{n.at && <span style={{ color: 'var(--muted)', fontSize: 11.5 }}> · {new Date(n.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
