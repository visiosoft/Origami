import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { NotifyFeedItem } from '../data/notifications';

const dayOf = (at: string) => new Date(at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const timeOf = (at: string) => new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/**
 * Everything you've been notified about, newest first -- what the text and
 * email digests link to (?digest=daily|weekly shows just that digest's items).
 */
export function NotificationsFeed() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const digest = params.get('digest') === 'daily' || params.get('digest') === 'weekly' ? (params.get('digest') as 'daily' | 'weekly') : undefined;
  const [items, setItems] = useState<NotifyFeedItem[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setItems(null);
    api.notifications.feed(digest).then(setItems).catch((e: Error) => setError(e.message));
  }, [digest]);

  const days = [...new Set((items || []).map((i) => dayOf(i.at)))];
  const chip = (key: 'all' | 'daily' | 'weekly', label: string) => {
    const on = (digest || 'all') === key;
    return (
      <button key={key} type="button" onClick={() => setParams(key === 'all' ? {} : { digest: key })}
        style={{ padding: '7px 14px', borderRadius: 999, border: '1px solid ' + (on ? 'var(--ink)' : 'rgba(var(--rgb-shade), 0.14)'), background: on ? 'var(--ink)' : 'var(--surface)', color: on ? 'var(--surface)' : 'var(--body)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {chip('all', 'Everything')}{chip('daily', 'Daily digest')}{chip('weekly', 'Weekly digest')}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => navigate('/settings?tab=notifications')} style={{ border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--forest)', cursor: 'pointer' }}>Notification settings →</button>
      </div>
      {error && <div style={{ fontSize: 13, color: '#8E2E0A' }}>{error}</div>}
      {!items && !error && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}
      {items && items.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Nothing yet{digest ? ` in your ${digest} digest` : ''}.</div>}
      {days.map((d) => (
        <section key={d}>
          <h3 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>{d}</h3>
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), 0.08)', borderRadius: 'var(--r-12)', overflow: 'hidden' }}>
            {items!.filter((i) => dayOf(i.at) === d).map((i, n) => (
              <div key={i.id} role={i.url ? 'link' : undefined} tabIndex={i.url ? 0 : undefined}
                onClick={() => i.url && navigate(i.url)} onKeyDown={(e) => { if (e.key === 'Enter' && i.url) navigate(i.url); }}
                style={{ display: 'flex', gap: 12, padding: '11px 16px', borderTop: n ? '1px solid rgba(var(--rgb-shade), 0.06)' : 0, cursor: i.url ? 'pointer' : 'default', alignItems: 'baseline' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', width: 64, flexShrink: 0 }}>{timeOf(i.at)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--forest)' }}>{i.label}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 600, overflowWrap: 'anywhere' }}>{i.title}</div>
                  {i.body && <div style={{ fontSize: 12.5, color: 'var(--body)', whiteSpace: 'pre-wrap', marginTop: 2, overflowWrap: 'anywhere' }}>{i.body}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
