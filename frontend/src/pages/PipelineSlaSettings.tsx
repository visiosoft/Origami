import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { STAGES, DEFAULT_SLA_DAYS, slaExempt } from '../data/pipeline';

const BG = "'Bricolage Grotesque', serif";

/**
 * Settings → Response Times.
 *
 * How long a lead may sit in each stage before its card starts asking for
 * attention. Hold and closed stages are left out: parked work is not late.
 */
export function PipelineSlaSettings() {
  const { toast } = useApp();
  const [days, setDays] = useState<Record<string, number>>(DEFAULT_SLA_DAYS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const tracked = STAGES.filter((s) => !slaExempt(s));

  useEffect(() => {
    api.settings.get()
      .then((res: any) => {
        try {
          const parsed = JSON.parse(res?.['pipeline.slaDays'] || '{}');
          if (parsed && typeof parsed === 'object') setDays({ ...DEFAULT_SLA_DAYS, ...parsed });
        } catch { /* keep the defaults */ }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: string, value: string) => {
    const num = Number(value);
    setDays((prev) => ({ ...prev, [key]: Number.isFinite(num) && num >= 0 ? num : 0 }));
  };

  const save = () => {
    setSaving(true);
    setError('');
    api.settings.save({ 'pipeline.slaDays': JSON.stringify(days) })
      .then(() => toast('Response times saved'))
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false));
  };

  const reset = () => { setDays({ ...DEFAULT_SLA_DAYS }); toast('Back to the defaults — save to apply'); };

  if (loading) return <div style={{ fontSize: 13, color: '#7E9B93' }}>Loading…</div>;

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, color: '#0B1A12' }}>CRM Response Times</div>
        <div style={{ fontSize: 12.5, color: '#5C6B65', marginTop: 4, maxWidth: 640, lineHeight: 1.6 }}>
          How long a lead may sit in each stage before its card starts asking for attention. Each card shows the time
          left; once the target passes it turns red and pulses until somebody acts. Set a stage to 0 to stop tracking it.
        </div>
      </div>

      {error && (
        <div style={{ padding: '11px 14px', borderRadius: 10, background: '#F7E4DB', border: '1px solid rgba(142,46,10,0.18)', marginBottom: 16, fontSize: 12.5, fontWeight: 600, color: '#8E2E0A' }}>
          {error}
        </div>
      )}

      <div style={{ background: 'white', border: '1px solid rgba(20,8,31,0.08)', borderRadius: 12, padding: 6, marginBottom: 16 }}>
        {tracked.map((stage, i) => (
          <div
            key={stage.key}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderTop: i ? '1px solid rgba(20,8,31,0.05)' : 'none' }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 2, background: stage.color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0B1A12' }}>{stage.name}</div>
              <div style={{ fontSize: 10.5, color: '#9AA39D', marginTop: 1 }}>
                {stage.owner === 'PC' ? 'Client Coordinator' : 'Project Manager'}
                {days[stage.key] === DEFAULT_SLA_DAYS[stage.key] ? '' : ` · default ${DEFAULT_SLA_DAYS[stage.key] ?? 0}d`}
              </div>
            </div>
            <input
              type="number"
              min={0}
              step={0.5}
              value={days[stage.key] ?? 0}
              onChange={(e) => set(stage.key, e.target.value)}
              style={{ width: 74, boxSizing: 'border-box', padding: '7px 9px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.12)', background: 'white', fontSize: 13, fontFamily: 'inherit', color: '#0B1A12', outline: 'none', textAlign: 'right' }}
            />
            <span style={{ fontSize: 11.5, color: '#7E9B93', width: 30 }}>
              {(days[stage.key] ?? 0) === 1 ? 'day' : 'days'}
            </span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11.5, color: '#9AA39D', marginBottom: 16, lineHeight: 1.5 }}>
        Hold and closed stages are not tracked — parked work is not late. Half days are allowed, so 0.5 is twelve hours.
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div onClick={saving ? undefined : save} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', background: saving ? '#9AB0A4' : '#173326', color: 'white' }}>
          {saving ? 'Saving…' : 'Save response times'}
        </div>
        <div onClick={reset} style={{ padding: '10px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.12)', color: '#173326' }}>
          Restore defaults
        </div>
      </div>
    </div>
  );
}
