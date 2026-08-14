import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ScoringCriterion } from '../data/scoring';
import { totalPossible } from '../data/scoring';
import { useApp } from '../AppContext';
import { useWindowWidth } from '../useWindowWidth';

const BG = "'Bricolage Grotesque', serif";

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.14)', background: 'white', fontFamily: 'inherit',
  fontSize: 13, color: '#0B1A12', outline: 'none',
};

// Settings sections and their sub-links. Extend this as more settings are added.
const SECTIONS: { group: string; items: { key: string; label: string }[] }[] = [
  { group: 'Templates', items: [{ key: 'lead-scoring', label: 'Lead Qualification Scoring Template' }] },
];

export function Settings() {
  const isMobile = useWindowWidth() < 768;
  const [active, setActive] = useState('lead-scoring');

  const nav = (
    <div style={{ flexShrink: 0, width: isMobile ? '100%' : 240 }}>
      {SECTIONS.map((sec) => (
        <div key={sec.group} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7E9B93', padding: '0 12px 8px' }}>{sec.group}</div>
          {sec.items.map((it) => {
            const on = active === it.key;
            return (
              <div key={it.key} onClick={() => setActive(it.key)} style={{ padding: '9px 12px', borderRadius: 9, fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer', color: on ? '#0B1A12' : '#43514D', background: on ? '#E7F0E8' : 'transparent', borderLeft: '3px solid ' + (on ? '#2F7D4A' : 'transparent'), marginBottom: 2, lineHeight: 1.3 }}>{it.label}</div>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: '4px 4px 40px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 22, color: '#0B1A12', marginBottom: 4 }}>Settings</div>
      <div style={{ fontSize: 13, color: '#5C6B65', marginBottom: 20 }}>Manage templates and configuration for the workspace.</div>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 16 : 28, alignItems: 'flex-start' }}>
        {nav}
        <div style={{ flex: 1, minWidth: 0, width: isMobile ? '100%' : 'auto' }}>
          {active === 'lead-scoring' && <ScoringTemplateEditor />}
        </div>
      </div>
    </div>
  );
}

function ScoringTemplateEditor() {
  const { toast } = useApp();
  const [criteria, setCriteria] = useState<ScoringCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.scoring.getTemplate()
      .then((res) => { if (Array.isArray(res)) setCriteria(res as ScoringCriterion[]); })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const updateCrit = (i: number, patch: Partial<ScoringCriterion>) =>
    setCriteria((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const updateOption = (ci: number, oi: number, patch: Partial<{ label: string; points: number }>) =>
    setCriteria((prev) => prev.map((c, idx) => idx === ci
      ? { ...c, options: c.options.map((o, oidx) => (oidx === oi ? { ...o, ...patch } : o)) }
      : c));

  const addOption = (ci: number) =>
    setCriteria((prev) => prev.map((c, idx) => idx === ci ? { ...c, options: [...c.options, { label: '', points: 0 }] } : c));

  const deleteOption = (ci: number, oi: number) =>
    setCriteria((prev) => prev.map((c, idx) => idx === ci ? { ...c, options: c.options.filter((_, oidx) => oidx !== oi) } : c));

  const addCriterion = () =>
    setCriteria((prev) => [...prev, { key: 'c_' + Date.now(), order: prev.length + 1, name: 'New Criterion', subCriteria: '', maxPoints: 0, options: [] }]);

  const deleteCriterion = (ci: number) =>
    setCriteria((prev) => prev.filter((_, idx) => idx !== ci).map((c, idx) => ({ ...c, order: idx + 1 })));

  const save = () => {
    setSaving(true);
    api.scoring.saveTemplate(criteria)
      .then((res) => { if (Array.isArray(res)) setCriteria(res as ScoringCriterion[]); toast('Scoring template saved'); })
      .catch(() => toast('⚠ Failed to save template'))
      .finally(() => setSaving(false));
  };

  const total = totalPossible(criteria);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, color: '#0B1A12' }}>Lead Qualification Scoring Template</div>
          <div style={{ fontSize: 12.5, color: '#5C6B65', marginTop: 4, maxWidth: 620 }}>
            Client Qualification Checklist &amp; Point System. Used on the <strong>Project Fit Review</strong> stage to score each lead. Edit criteria, options and points below.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93' }}>Total Possible</div>
            <div style={{ fontFamily: BG, fontWeight: 800, fontSize: 24, color: '#173326', lineHeight: 1 }}>{total}</div>
          </div>
          <div onClick={saving ? undefined : save} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', background: saving ? '#9AB0A4' : '#173326', color: 'white', whiteSpace: 'nowrap' }}>{saving ? 'Saving…' : 'Save Template'}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: '#7E9B93' }}>Loading template…</div>
      ) : (
        <>
          {criteria.map((c, ci) => (
            <div key={c.key} style={{ background: 'white', border: '1px solid rgba(20,8,31,0.07)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#173326', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{ci + 1}</div>
                <div style={{ flex: '2 1 200px', minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', marginBottom: 3 }}>Qualifying Criteria</div>
                  <input value={c.name} onChange={(e) => updateCrit(ci, { name: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: '2 1 200px', minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', marginBottom: 3 }}>Sub Criteria</div>
                  <input value={c.subCriteria} onChange={(e) => updateCrit(ci, { subCriteria: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: '0 0 120px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', marginBottom: 3 }}>Max Points</div>
                  <input type="number" value={c.maxPoints} onChange={(e) => updateCrit(ci, { maxPoints: Number(e.target.value) })} style={inputStyle} />
                </div>
                <div onClick={() => deleteCriterion(ci)} style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#8E2E0A', border: '1px solid rgba(142,46,10,0.25)' }}>Delete</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {c.options.map((o, oi) => (
                  <div key={oi} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input value={o.label} onChange={(e) => updateOption(ci, oi, { label: e.target.value })} placeholder="Option label" style={{ ...inputStyle, flex: 1 }} />
                    <input type="number" value={o.points} onChange={(e) => updateOption(ci, oi, { points: Number(e.target.value) })} style={{ ...inputStyle, width: 90, flexShrink: 0 }} />
                    <div onClick={() => deleteOption(ci, oi)} title="Remove option" style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#8E2E0A', border: '1px solid rgba(20,8,31,0.1)' }}>✕</div>
                  </div>
                ))}
              </div>
              <div onClick={() => addOption(ci)} style={{ marginTop: 10, display: 'inline-block', padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#173326', border: '1px solid rgba(20,8,31,0.14)' }}>+ Add option</div>
            </div>
          ))}

          <div onClick={addCriterion} style={{ display: 'inline-block', padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#D2EAD3', color: '#173326' }}>+ Add criterion</div>
        </>
      )}
    </div>
  );
}
