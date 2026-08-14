import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ScoringCriterion } from '../data/scoring';
import { totalPossible } from '../data/scoring';
import { useApp } from '../AppContext';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.14)', background: 'white', fontFamily: 'inherit',
  fontSize: 13, color: '#0B1A12', outline: 'none',
};

export function Settings() {
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
    <div style={{ padding: '4px 4px 40px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "'Bricolage Grotesque', serif", fontWeight: 700, fontSize: 22, color: '#0B1A12' }}>Lead Scoring Template</div>
          <div style={{ fontSize: 13, color: '#5C6B65', marginTop: 4, maxWidth: 620 }}>
            Client Qualification Checklist &amp; Point System. Used on the <strong>Project Fit Review</strong> stage to score each lead. Edit criteria, options and points below.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93' }}>Total Points Possible</div>
            <div style={{ fontFamily: "'Bricolage Grotesque', serif", fontWeight: 800, fontSize: 26, color: '#173326', lineHeight: 1 }}>{total}</div>
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
