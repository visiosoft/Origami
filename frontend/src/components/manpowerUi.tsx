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
  // A bare date is a calendar day; a full timestamp is converted to local time first.
  const x = d.length === 10 ? new Date(d + 'T00:00:00') : new Date(d);
  return Number.isNaN(x.getTime()) ? d : x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
  tradeIds: string[]; licenseNumber?: string; licenseExpiry?: string;
  contractStatus: 'none' | 'valid' | 'expiring' | 'expired'; insuranceStatus: 'none' | 'valid' | 'expiring' | 'expired';
  licenseStatus: 'none' | 'valid' | 'expiring' | 'expired';
}

/** A licence classification a subcontractor company holds, e.g. C-10 Electrical. */
export interface SubcontractorTrade { id: string; code: string; name: string; category: string; description?: string; active: boolean; order: number }
export const SUBTRADE_CATEGORIES: [string, string][] = [
  ['general_engineering', 'General Engineering (A)'], ['general_building', 'General Building (B)'],
  ['specialty', 'Specialty (C)'], ['limited_specialty', 'Limited Specialty (D)'], ['other', 'Other'],
];

export interface PayrollSettings {
  currency: string; standardDayHours: number; halfDayHours: number; monthDays: number;
  otMultipliers: Record<'normal' | 'weekend' | 'holiday' | 'night', number>; weekendDays: number[];
}
export const DEFAULT_SETTINGS: PayrollSettings = {
  currency: 'USD', standardDayHours: 8, halfDayHours: 4, monthDays: 21.67,
  otMultipliers: { normal: 1.5, weekend: 1.5, holiday: 2, night: 1.1 }, weekendDays: [0, 6],
};

/** $1,234.50 for USD (or any ISO currency); falls back to "CODE 1,234.5" for anything Intl doesn't know. */
export const money = (n: number | null | undefined, currency = 'USD') => {
  const v = Number(n) || 0;
  try { return v.toLocaleString('en-US', { style: 'currency', currency, minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }); }
  catch { return `${currency} ${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`; }
};

export const PAYMENT_METHODS: [string, string][] = [['bank_transfer', 'Direct deposit (ACH)'], ['cheque', 'Check'], ['cash', 'Cash']];
export const methodLabel = (m?: string) => PAYMENT_METHODS.find(([k]) => k === m)?.[1] || m?.replace('_', ' ') || '';

export const US_STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];

export interface PayComponent {
  id: string; name: string; kind: 'earning' | 'deduction'; calcType: 'fixed' | 'percent_basic' | 'percent_gross';
  defaultValue: number; appliesTo: 'all' | 'monthly' | 'daily'; category?: string; active: boolean; order: number;
}

export const ADVANCE_TYPES: [string, string][] = [
  ['salary_advance', 'Salary advance'], ['emergency_advance', 'Emergency advance'], ['loan', 'Employee loan'],
  ['travel_advance', 'Travel advance'], ['project_advance', 'Project advance'],
];

export const expiryTone = (s: string) => (s === 'expired' ? 'red' : s === 'expiring' ? 'amber' : s === 'valid' ? 'green' : 'grey');
export const expiryLabel = (s: string) => (s === 'expired' ? 'Expired' : s === 'expiring' ? 'Expiring soon' : s === 'valid' ? 'Valid' : 'No end date');
