import type { ReactNode } from 'react';
import type { Attachment } from '../data/projectTasks';

export const BG = "'Bricolage Grotesque', serif";
export const INK = '#0B1A12';
export const MUTED = '#7E9B93';
export const ACCENT = '#173326';
export const ACCENT_BG = '#DCE7DE';
export const LINE = 'rgba(20,8,31,.09)';
export const DANGER = '#8E2E0A';

export const input: React.CSSProperties = {
  boxSizing: 'border-box', width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.13)', background: 'white', fontFamily: 'inherit',
  fontSize: 13, color: INK, outline: 'none',
};

export const btn = (primary = false, disabled = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 15px', borderRadius: 999,
  fontSize: 12.5, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap',
  background: primary ? ACCENT : '#fff', color: primary ? '#fff' : ACCENT,
  border: '1px solid ' + (primary ? ACCENT : 'rgba(20,8,31,.14)'), opacity: disabled ? 0.55 : 1,
});

export const card: React.CSSProperties = { background: 'white', border: '1px solid ' + LINE, borderRadius: 14 };

export const headRow = (cols: string): React.CSSProperties => ({
  display: 'grid', gridTemplateColumns: cols, gap: 10, padding: '9px 14px', background: '#F7F3EA',
  fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9c96a4',
});

export const bodyRow = (cols: string): React.CSSProperties => ({
  display: 'grid', gridTemplateColumns: cols, gap: 10, alignItems: 'center', padding: '9px 14px',
  borderTop: '1px solid rgba(20,8,31,.05)',
});

export function Label({ text }: { text: string }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{text}</div>;
}

const TONES: Record<string, { bg: string; c: string }> = {
  green: { bg: '#D2EAD3', c: '#1E6B36' },
  amber: { bg: '#FBE9AE', c: '#8A6D12' },
  red: { bg: '#F2DFD4', c: DANGER },
  blue: { bg: '#D8E2F0', c: '#3C5C8A' },
  grey: { bg: '#EFEDE8', c: '#5C6B65' },
};
export function Badge({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  const t = TONES[tone];
  return <span style={{ display: 'inline-flex', alignItems: 'center', height: 21, padding: '0 9px', borderRadius: 999, background: t.bg, color: t.c, fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</span>;
}

/** A right-hand panel over a dimmed page, with a fixed header and footer. */
export function Drawer({ title, subtitle, width = 600, onClose, footer, children }: {
  title: string; subtitle?: string; width?: number; onClose: () => void; footer?: ReactNode; children: ReactNode;
}) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.45)', zIndex: 160, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: `min(${width}px, 100vw)`, height: '100%', background: 'white', display: 'flex', flexDirection: 'column', boxShadow: '-24px 0 60px rgba(20,8,31,0.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: BG, fontSize: 18, fontWeight: 700, color: INK }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{subtitle}</div>}
          </div>
          <div onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', color: MUTED, fontSize: 18 }}>×</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>{children}</div>
        {footer && <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(20,8,31,0.06)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>{footer}</div>}
      </div>
    </div>
  );
}

/** The calendar date where the user is -- toISOString() alone is UTC, which is 'yesterday' in the early morning east of Greenwich. */
export const localISO = (d: Date = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const todayISO = () => localISO();
export const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const x = new Date(d + (d.length === 10 ? 'T00:00:00' : ''));
  return Number.isNaN(x.getTime()) ? d : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ----------------------------------------------------------------- shared types

export interface Project { id: number; name: string }

export interface Assignment {
  id: string; employeeId: string; projectId: number; workArea?: string; tradeId?: string; designation?: string;
  assignmentType: 'regular' | 'temporary'; startDate: string; endDate?: string; status: string;
  endReason?: string; transferredFromId?: string; workforceRequestId?: string; requestLineId?: string;
  notes?: string; createdByName?: string; endedByName?: string; createdAt: string; current: boolean;
}

export interface Contractor {
  id: string; companyName: string; personId?: number; contactPerson?: string; phone?: string; email?: string;
  address?: string; contractNumber?: string; contractStart?: string; contractEnd?: string; scopeOfWork?: string;
  agreedRates?: string; insuranceProvider?: string; insurancePolicyNumber?: string; insuranceExpiry?: string;
  status: string; notes?: string; attachments: Attachment[]; workerCount: number;
  contractStatus: 'none' | 'valid' | 'expiring' | 'expired'; insuranceStatus: 'none' | 'valid' | 'expiring' | 'expired';
}

export const expiryTone = (s: string) => (s === 'expired' ? 'red' : s === 'expiring' ? 'amber' : s === 'valid' ? 'green' : 'grey');
export const expiryLabel = (s: string) => (s === 'expired' ? 'Expired' : s === 'expiring' ? 'Expiring soon' : s === 'valid' ? 'Valid' : 'No end date');
