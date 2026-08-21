import type { CSSProperties, ReactNode } from 'react';
import { Logo } from '../components/Logo';

const BG = "'Bricolage Grotesque', serif";

const AUTH_POINTS = [
  'Lead to invoice tracked on one timeline',
  'Role-scoped access for staff, clients and consultants',
  'Live budget, schedule and site activity in one place',
];

export const authInput: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10,
  border: '1px solid rgba(20,8,31,0.12)', background: '#ffffff', fontFamily: 'inherit',
  fontSize: 13.5, color: '#0B1A12', outline: 'none',
};

export const label: CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7E9B93',
};

/** The split brand/form frame shared by the log-in and set-password screens. */
export function AuthLayout({ showBrand, title, subtitle, children }: {
  showBrand: boolean;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', background: '#FBF8F2', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", overflow: 'hidden' }}>
      <div style={{ width: '42%', minWidth: 340, background: '#0F2417', display: showBrand ? 'flex' : 'none', flexDirection: 'column', justifyContent: 'space-between', padding: '40px 44px', flexShrink: 0 }}>
        <div style={{ background: '#FBF8F2', borderBottom: '3px solid #D2822E', borderRadius: 10, padding: '14px 18px', display: 'inline-flex', width: 'fit-content' }}>
          <Logo markSize={30} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 400 }}>
          <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 34, lineHeight: 1.15, letterSpacing: '-0.025em', color: '#ffffff', textWrap: 'pretty' }}>One place for every job, from first call to final invoice.</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.65, color: 'rgba(255,255,255,0.6)', textWrap: 'pretty' }}>Leads, projects, people, budgets and site activity — tracked together so nothing falls between design and build.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 6 }}>
            {AUTH_POINTS.map((pt) => (
              <div key={pt} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: '#D2822E', flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.78)' }}>{pt}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em' }}>Origami Design + Build · Internal platform</div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 22, animation: 'fadeIn 0.3s ease' }}>
          <div>
            <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', color: '#0B1A12' }}>{title}</div>
            <div style={{ fontSize: 13, color: '#7E9B93', marginTop: 5, lineHeight: 1.5 }}>{subtitle}</div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
