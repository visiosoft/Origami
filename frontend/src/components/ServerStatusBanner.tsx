import { useEffect, useMemo, useState } from 'react';

/** Which app bundle this page loaded (the hashed name in index.html); empty in development. */
const loadedBuild = () =>
  document.querySelector('script[src*="/assets/index-"]')?.getAttribute('src')?.match(/index-[\w-]+\.js/)?.[0] || '';

const DISMISSED_KEY = 'origami.dismissedNotice';

/**
 * Tells people when the system is being updated, so nobody is caught out
 * mid-edit: while the server is restarting (a deploy), when a new version
 * has been installed, and when an administrator has posted a notice
 * (Settings -> System notice). One small request a minute; every 8 seconds
 * while the server is down, so the banner clears as soon as it's back.
 */
export function ServerStatusBanner() {
  const loaded = useMemo(loadedBuild, []);
  const [down, setDown] = useState(false);
  const [newBuild, setNewBuild] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(DISMISSED_KEY) || ''; } catch { return ''; } });

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const check = async () => {
      let ok = false;
      try {
        const r = await fetch('/api/status', { cache: 'no-store' });
        if (r.ok) {
          const b = await r.json();
          ok = true;
          setNotice(b?.notice || null);
          if (loaded && b?.build && b.build !== loaded) setNewBuild(true);
        }
      } catch { /* unreachable: counts as down */ }
      if (stopped) return;
      setDown(!ok);
      timer = window.setTimeout(check, ok ? 60000 : 8000);
    };
    void check();
    const onFocus = () => { window.clearTimeout(timer); void check(); };
    window.addEventListener('focus', onFocus);
    return () => { stopped = true; window.clearTimeout(timer); window.removeEventListener('focus', onFocus); };
  }, [loaded]);

  const bar = (bg: string, border: string, color: string, children: React.ReactNode) => (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '9px 32px', background: bg, borderBottom: '1px solid ' + border, color, fontSize: 13, lineHeight: 1.45 }}>{children}</div>
  );
  const button = (label: string, onClick: () => void, color: string) => (
    <span onClick={onClick} style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 999, border: '1px solid ' + color, color, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}</span>
  );

  return (
    <>
      {down && bar('#FBF0CC', '#EAD48A', '#6B540C', (
        <>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: '#C7A64A', animation: 'pulse 1s ease-in-out infinite', flexShrink: 0 }} />
          <span><b>Updating the system.</b> The server is restarting — keep working; your changes save as soon as it’s back (usually under a minute).</span>
        </>
      ))}
      {!down && newBuild && bar('#DCE7DE', '#B9CDBD', '#173326', (
        <>
          <span><b>A new version was just installed.</b> Refresh when you’re at a good point — your changes are saved.</span>
          {button('Refresh', () => window.location.reload(), '#173326')}
        </>
      ))}
      {!down && notice && notice !== dismissed && bar('#D8E2F0', '#B5C6DE', '#2B476E', (
        <>
          <span style={{ whiteSpace: 'pre-wrap' }}><b>Notice:</b> {notice}</span>
          {button('Dismiss', () => { setDismissed(notice); try { localStorage.setItem(DISMISSED_KEY, notice); } catch { /* ignore */ } }, '#2B476E')}
        </>
      ))}
    </>
  );
}
