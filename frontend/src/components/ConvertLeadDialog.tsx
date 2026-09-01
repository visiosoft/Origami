import { useState } from 'react';
import { api } from '../api';
import { deliveryCode } from '../data/pipeline';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9,
  border: '1px solid rgba(20,8,31,0.12)', background: 'white', fontSize: 13,
  fontFamily: 'inherit', color: '#0B1A12', outline: 'none',
};

/** Where a converted lead can land. Mirrors ProjectEntity.stage. */
const PROJECT_STAGES = [
  { key: 'Leads', label: 'Leads', hint: 'Won, but not started — sits at the top of the project list.' },
  { key: 'Design', label: 'Design & Preconstruction', hint: 'Straight into design and preconstruction.' },
  { key: 'Construction', label: 'Construction', hint: 'Already building.' },
];

interface Props {
  deal: { id: string; name: string; value: string };
  /** The lead's delivery method, which decides where the work starts. */
  contractType?: string;
  onCancel: () => void;
  onConverted: (project: { id: number; name: string; stage: string }) => void;
}

/**
 * Turns an approved lead into a project.
 *
 * Everything captured during intake travels with it server-side; this only
 * collects the few things worth confirming at the moment of conversion.
 */
export function ConvertLeadDialog({ deal, contractType, onCancel, onConverted }: Props) {
  const code = deliveryCode(contractType);
  const [name, setName] = useState(deal.name);
  const [contractAmt, setContractAmt] = useState(deal.value || '');
  // Build Only has no design to run, so it starts in construction.
  const [stage, setStage] = useState(code === 'BO' ? 'Construction' : 'Design');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const convert = () => {
    if (!name.trim()) { setError('The project needs a name.'); return; }
    setSaving(true);
    setError('');
    api.pipeline.convert(deal.id, { name: name.trim(), contractAmt: contractAmt.trim(), stage })
      .then((res) => onConverted(res.project))
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false));
  };

  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(11,26,18,0.4)', display: 'grid', placeItems: 'center', zIndex: 400, padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 460, maxWidth: '100%', background: 'white', borderRadius: 14, boxShadow: '0 24px 60px rgba(11,26,18,0.28)', overflow: 'hidden' }}
      >
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0B1A12' }}>Convert to Project</div>
          <div style={{ fontSize: 12, color: '#7E9B93', marginTop: 4, lineHeight: 1.55 }}>
            The intake details, scope, location and source all transfer. The card leaves the pipeline board —
            its audit trail stays with the lead and remains reachable from the project.
            {code === 'BO' && ' This is a Build Only lead, so it starts in Construction.'}
          </div>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ padding: '10px 12px', borderRadius: 9, background: '#F7E4DB', border: '1px solid rgba(142,46,10,0.18)', fontSize: 12, fontWeight: 600, color: '#8E2E0A' }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#43514D' }}>Project name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#43514D' }}>Contract amount</label>
            <input value={contractAmt} onChange={(e) => setContractAmt(e.target.value)} placeholder="$0" style={{ ...inputStyle, marginTop: 4 }} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#43514D' }}>Starts in</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {PROJECT_STAGES.map((s) => (
                <label
                  key={s.key}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 11px', borderRadius: 9, cursor: 'pointer', border: '1px solid ' + (stage === s.key ? '#2F7D4A' : 'rgba(20,8,31,0.1)'), background: stage === s.key ? '#F4F9F4' : 'white' }}
                >
                  <input type="radio" checked={stage === s.key} onChange={() => setStage(s.key)} style={{ marginTop: 2 }} />
                  <span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0B1A12', display: 'block' }}>{s.label}</span>
                    <span style={{ fontSize: 10.5, color: '#7E9B93' }}>{s.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(20,8,31,0.06)', display: 'flex', gap: 8, justifyContent: 'flex-end', background: '#FBF8F2' }}>
          <div onClick={onCancel} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', color: '#7E9B93' }}>Cancel</div>
          <div
            onClick={saving ? undefined : convert}
            style={{ padding: '9px 20px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: saving ? 'default' : 'pointer', background: saving ? '#9AB0A4' : '#173326', color: 'white' }}
          >
            {saving ? 'Converting…' : 'Convert to Project'}
          </div>
        </div>
      </div>
    </div>
  );
}
