import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { PROJECTS } from '../data/projects';

const BG = "'Bricolage Grotesque', serif";

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid rgba(20,8,31,0.06)', borderRadius: 14, padding: 16, flex: '1 1 150px', minWidth: 140 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93' }}>{label}</div>
      <div style={{ fontFamily: BG, fontWeight: 800, fontSize: 26, color: accent || '#173326', lineHeight: 1.1, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export function ConsultantDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  // Assignment-based scoping is a follow-up; show assignable projects for now.
  const assigned = PROJECTS.filter((p) => p.stage === 'Design' || p.stage === 'Leads');

  const rows = [
    { label: 'RFP — Structural package', project: assigned[0]?.name ?? '—', due: 'Aug 22', status: 'Open' },
    { label: 'Deliverable — Geotech report', project: assigned[1]?.name ?? '—', due: 'Aug 27', status: 'In Progress' },
    { label: 'RFI response — Foundation detail', project: assigned[0]?.name ?? '—', due: 'Aug 18', status: 'Open' },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 24, color: '#0B1A12' }}>Welcome{currentUser ? `, ${currentUser.name}` : ''}</div>
        <div style={{ fontSize: 13, color: '#5C6B65' }}>Your assigned scopes, RFPs and deliverables.</div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0' }}>
        <Stat label="Assigned Scopes" value={String(assigned.length)} />
        <Stat label="Open RFIs" value="2" accent="#D2822E" />
        <Stat label="Deliverables Due" value="3" accent="#8E2E0A" />
      </div>

      <div style={{ background: 'white', border: '1px solid rgba(20,8,31,0.06)', borderRadius: 14, padding: 18, marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93', marginBottom: 12 }}>My Queue</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#FBF8F2', borderRadius: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0B1A12' }}>{r.label}</div>
                <div style={{ fontSize: 11, color: '#7E9B93', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.project}</div>
              </div>
              <span style={{ fontSize: 11, color: '#7E9B93' }}>Due {r.due}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: r.status === 'Open' ? '#EFEDE8' : '#D6E8E5', color: r.status === 'Open' ? '#3A423E' : '#2F6F68' }}>{r.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div onClick={() => navigate('/prequal')} style={{ display: 'inline-block', padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white' }}>View prequalification &amp; scopes</div>
    </div>
  );
}
