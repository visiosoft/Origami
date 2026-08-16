import { WorkflowsView } from '../components/WorkflowsView';

const BG = "'Bricolage Grotesque', serif";

export function Workflows() {
  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 22, color: '#0B1A12' }}>Workflows</div>
        <div style={{ fontSize: 13, color: '#5C6B65' }}>Reusable processes and per-project workflows — each with its own items and estimated / planned / completed time.</div>
      </div>
      <WorkflowsView />
    </div>
  );
}
