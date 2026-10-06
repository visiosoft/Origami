import type { ReactNode } from 'react';
import './ActionKit.css';

/**
 * Small shared pieces for the list pages built on existing records (Holding &
 * Refer Out, Observations & FYI, Daily Reports, Special Actions): a lead line,
 * stat cards, filter pills and list rows. Styled with theme tokens, so they read
 * right in both the New and the Classic look.
 */
export function AkPage({ lead, action, children }: { lead: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="ak">
      <div className="ak-top"><p>{lead}</p>{action}</div>
      {children}
    </div>
  );
}

export interface AkStat { key: string; label: string; value: ReactNode; sub?: ReactNode; tone?: 'yellow' | 'dark'; onClick?: () => void; on?: boolean }
export function AkStats({ items }: { items: AkStat[] }) {
  return (
    <div className="ak-stats">
      {items.map((s, i) => (
        <button type="button" key={s.key} className={'ak-stat' + (s.tone ? ' is-' + s.tone : '') + (s.on ? ' is-on' : '')} style={{ animationDelay: i * 0.05 + 's' }}
          onClick={s.onClick} disabled={!s.onClick}>
          <span className="ak-stat-label">{s.label}</span>
          <span className="ak-stat-value">{s.value}</span>
          {s.sub != null && <span className="ak-stat-sub">{s.sub}</span>}
        </button>
      ))}
    </div>
  );
}

export function AkSeg<T extends string>({ options, value, onChange }: { options: [T, string, number?][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="ak-seg" role="tablist">
      {options.map(([k, l, n]) => (
        <button type="button" role="tab" key={k} aria-selected={value === k} className={value === k ? 'is-on' : ''} onClick={() => onChange(k)}>
          {l}{n != null && <i>{n}</i>}
        </button>
      ))}
    </div>
  );
}

export function AkPill({ tone = 'soft', children, title }: { tone?: 'soft' | 'yellow' | 'dark' | 'outline' | 'warn' | 'green'; children: ReactNode; title?: string }) {
  return <span className={'ak-pill is-' + tone} title={title}>{children}</span>;
}

/** A row: a short lead (date or number), the title with a sub line, then right-hand bits. */
export function AkRow({ lead, title, sub, right, onClick, muted, index = 0 }: {
  lead?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void; muted?: boolean; index?: number;
}) {
  return (
    <div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} className={'ak-row' + (onClick ? ' is-link' : '') + (muted ? ' is-muted' : '')}
      style={{ animationDelay: Math.min(index, 14) * 0.025 + 's' }}
      onClick={onClick} onKeyDown={(e) => { if (onClick && e.key === 'Enter') onClick(); }}>
      {lead != null && <span className="ak-lead">{lead}</span>}
      <span className="ak-main"><span className="ak-title">{title}</span>{sub != null && <span className="ak-sub">{sub}</span>}</span>
      {right != null && <span className="ak-right">{right}</span>}
    </div>
  );
}

/** A two-line date tile: day number over the month. */
export const AkDate = ({ iso }: { iso?: string }) => {
  if (!iso) return <span className="ak-date is-none">—</span>;
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return <span className="ak-date is-none">—</span>;
  return <span className="ak-date"><b>{d.getDate()}</b>{d.toLocaleDateString('en-US', { month: 'short' })}</span>;
};

export const akDay = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};
export const akToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const akDaysFrom = (iso: string) => Math.round((new Date(iso.slice(0, 10) + 'T12:00:00').getTime() - new Date(akToday() + 'T12:00:00').getTime()) / 86400000);
