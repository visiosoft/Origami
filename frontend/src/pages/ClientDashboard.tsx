import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { PROJECTS, PR_COLORS } from '../data/projects';

const BG = "'Bricolage Grotesque', serif";

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid rgba(20,8,31,0.06)', borderRadius: 14, padding: 16, flex: '1 1 150px', minWidth: 140 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93' }}>{label}</div>
      <div style={{ fontFamily: BG, fontWeight: 800, fontSize: 26, color: accent || '#173326', lineHeight: 1.1, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export function ClientDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  // Data scoping (client sees only their projects) is a follow-up; show the portfolio for now.
  const projects = PROJECTS;
  const inDesign = projects.filter((p) => p.stage === 'Design').length;
  const inConstruction = projects.filter((p) => p.stage === 'Construction').length;
  const avg = Math.round(projects.reduce((s, p) => s + p.progress, 0) / (projects.length || 1));

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 24, color: '#0B1A12' }}>Welcome{currentUser ? `, ${currentUser.name}` : ''}</div>
        <div style={{ fontSize: 13, color: '#5C6B65' }}>Your projects, approvals and documents at a glance.</div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0' }}>
        <Stat label="My Projects" value={String(projects.length)} />
        <Stat label="In Design" value={String(inDesign)} accent="#2F6F68" />
        <Stat label="In Construction" value={String(inConstruction)} accent="#D2822E" />
        <Stat label="Avg Progress" value={`${avg}%`} accent="#2F7D4A" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {projects.map((p) => {
          const c = PR_COLORS[p.stage] || { bg: '#EFEDE8', c: '#3A423E' };
          return (
            <div key={p.id} onClick={() => navigate('/projects')} style={{ background: 'white', border: '1px solid rgba(20,8,31,0.06)', borderRadius: 14, padding: 16, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0B1A12', lineHeight: 1.3 }}>{p.name}</div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: c.bg, color: c.c, flexShrink: 0 }}>{p.stage}</span>
              </div>
              <div style={{ fontSize: 11.5, color: '#7E9B93', marginBottom: 10 }}>{p.location} · {p.typeOfWork}</div>
              <div style={{ height: 6, borderRadius: 3, background: '#EDEAE3', overflow: 'hidden' }}>
                <div style={{ width: `${p.progress}%`, height: '100%', background: '#2F7D4A' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#7E9B93', marginTop: 6 }}>
                <span>{p.progress}% complete</span><span>{p.contractAmt}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
