import { useState } from 'react';
import { useApp } from '../AppContext';

export interface HubTab { key: string; label: string; perm: string; render: () => React.ReactNode }

/**
 * One page for several modules (Oct 30 sync): Resource Enterprise Management
 * (procurement, equipment, manpower) and QA/QC & Safety. Each tab shows only
 * to people who can see that module; ?tab= opens a given one.
 */
export function TabHub({ title, tabs }: { title: string; tabs: HubTab[] }) {
  const { can } = useApp();
  const shown = tabs.filter((t) => can(t.perm, 'view'));
  const fromUrl = new URLSearchParams(window.location.search).get('tab');
  const [tab, setTab] = useState(() => (shown.some((t) => t.key === fromUrl) ? fromUrl! : shown[0]?.key || ''));
  const pick = (k: string) => {
    setTab(k);
    const u = new URL(window.location.href); u.searchParams.set('tab', k); window.history.replaceState(null, '', u.toString());
  };
  const active = shown.find((t) => t.key === tab) || shown[0];
  if (!active) return <div style={{ padding: 24, color: 'var(--muted)' }}>Nothing here for your role.</div>;
  return (
    <div>
      <div role="tablist" aria-label={title} style={{ display: 'flex', gap: 3, background: 'var(--c-efede8)', padding: 3, borderRadius: 999, width: 'fit-content', maxWidth: '100%', overflowX: 'auto', marginBottom: 16 }}>
        {shown.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={t.key === active.key} onClick={() => pick(t.key)}
            style={{ padding: '7px 16px', borderRadius: 999, border: 0, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', background: t.key === active.key ? 'var(--seg-on)' : 'transparent', color: t.key === active.key ? 'var(--ink)' : 'var(--muted)' }}>{t.label}</button>
        ))}
      </div>
      <div key={active.key}>{active.render()}</div>
    </div>
  );
}
