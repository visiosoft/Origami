import { useEffect, useMemo, useState } from 'react';
import { RELEASES, markReleaseSeen, releaseSeen } from '../data/releaseNotes';

const INK = '#0B1A12';
const MUTED = '#7E9B93';
const BG = "'Bricolage Grotesque', serif";
const KIND: Record<string, [string, string, string]> = {
  new: ['New', '#D2EAD3', '#1E6B36'], improved: ['Improved', '#D6E8E5', '#2F6F68'], fixed: ['Fixed', '#FBE9AE', '#93520F'],
};
const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

/** Release notes (Help & Support -> What's new): what changed, newest first, by area. */
export function WhatsNew() {
  const [area, setArea] = useState('All');
  useEffect(() => { if (!releaseSeen()) markReleaseSeen(); }, []);
  const areas = useMemo(() => ['All', ...new Set(RELEASES.flatMap((r) => r.items.map((i) => i.area)))], []);
  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 860 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {areas.map((a) => (
          <span key={a} onClick={() => setArea(a)} style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + (area === a ? '#173326' : 'rgba(20,8,31,0.12)'), background: area === a ? '#173326' : 'white', color: area === a ? 'white' : '#43514D' }}>{a}</span>
        ))}
      </div>
      {RELEASES.map((r, ri) => {
        const items = r.items.filter((i) => area === 'All' || i.area === area);
        if (!items.length) return null;
        return (
          <section key={r.id} style={{ background: 'white', border: '1px solid rgba(20,8,31,0.07)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{longDate(r.date)}</div>
              {ri === 0 && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#173326', color: 'white' }}>Latest</span>}
            </div>
            <div style={{ fontFamily: BG, fontSize: 17, fontWeight: 700, color: INK, marginBottom: 12, lineHeight: 1.3 }}>{r.title}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {items.map((i, k) => {
                const [label, bg, fg] = KIND[i.kind || 'new'];
                return (
                  <div key={k} style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: 12, alignItems: 'start' }}>
                    <div style={{ display: 'grid', gap: 4, justifyItems: 'start' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: bg, color: fg }}>{label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>{i.area}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, color: INK, lineHeight: 1.55 }}>{i.text}</div>
                      {i.where && <div style={{ fontSize: 11.5, color: '#173326', fontWeight: 600, marginTop: 2 }}>{i.where}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
