import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BG = "'Bricolage Grotesque', serif";

const AUTH_POINTS = [
  'Lead to invoice tracked on one timeline',
  'Role-scoped access for staff, clients and consultants',
  'Live budget, schedule and site activity in one place',
];

const AUTH_ROLES = ['Principal', 'Project Manager', 'Designer', 'Estimator', 'Site Super', 'Admin'];

export function Auth({ mode }: { mode: 'login' | 'signup' }) {
  const navigate = useNavigate();
  const isLogin = mode === 'login';
  const isSignup = mode === 'signup';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Project Manager');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');

  const submit = () => {
    if (!email.trim() || !password.trim() || (isSignup && !name.trim())) {
      setError('Please fill in all required fields to continue.');
      return;
    }
    setError('');
    navigate('/dashboard');
  };

  const fields = isSignup
    ? [
        { label: 'Full name', type: 'text', value: name, set: setName, placeholder: 'e.g. Dana Whitfield' },
        { label: 'Work email', type: 'email', value: email, set: setEmail, placeholder: 'name@origamidb.com' },
        { label: 'Password', type: 'password', value: password, set: setPassword, placeholder: 'Create a password' },
      ]
    : [
        { label: 'Work email', type: 'email', value: email, set: setEmail, placeholder: 'name@origamidb.com' },
        { label: 'Password', type: 'password', value: password, set: setPassword, placeholder: 'Enter your password' },
      ];

  const tab = (label: string, active: boolean, to: string) => (
    <div
      key={label}
      onClick={() => { setError(''); navigate(to); }}
      style={{ flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', background: active ? 'white' : 'transparent', color: active ? '#0B1A12' : '#7E9B93', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}
    >
      {label}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', background: '#FBF8F2', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", overflow: 'hidden' }}>
      {/* Brand panel */}
      <div style={{ width: '42%', minWidth: 340, background: '#0F2417', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '40px 44px', flexShrink: 0 }}>
        <div style={{ background: '#FBF8F2', borderBottom: '3px solid #D2822E', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, width: 190 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#0F2417', color: '#D2822E', display: 'grid', placeItems: 'center', fontSize: 15, flexShrink: 0 }}>◈</div>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', color: '#173326' }}>Origami</div>
            <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7E9B93' }}>Design + Build</div>
          </div>
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

      {/* Form panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 22, animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'flex', background: '#EEF3EE', borderRadius: 999, padding: 3, gap: 3 }}>
            {tab('Log in', isLogin, '/login')}
            {tab('Sign up', isSignup, '/signup')}
          </div>

          <div>
            <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', color: '#0B1A12' }}>{isLogin ? 'Welcome back' : 'Create your account'}</div>
            <div style={{ fontSize: 13, color: '#7E9B93', marginTop: 5, lineHeight: 1.5 }}>{isLogin ? 'Sign in to pick up where the team left off.' : 'Request access to the Origami platform.'}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {fields.map((f) => (
              <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7E9B93' }}>{f.label}</label>
                <input type={f.type} value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.placeholder} style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(20,8,31,0.12)', background: '#ffffff', fontFamily: 'inherit', fontSize: 13.5, color: '#0B1A12', outline: 'none' }} />
              </div>
            ))}

            {isSignup && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7E9B93' }}>Your role</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {AUTH_ROLES.map((r) => {
                    const active = role === r;
                    return (
                      <div key={r} onClick={() => setRole(r)} style={{ padding: '8px 13px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: active ? '#173326' : 'white', color: active ? 'white' : '#7E9B93', border: '1px solid ' + (active ? '#173326' : 'rgba(20,8,31,0.12)') }}>{r}</div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {isLogin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div onClick={() => setRemember((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <span style={{ width: 16, height: 16, borderRadius: 5, display: 'grid', placeItems: 'center', flexShrink: 0, background: remember ? '#173326' : 'white', border: '1px solid ' + (remember ? '#173326' : 'rgba(20,8,31,0.2)') }}>
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: remember ? 1 : 0 }}><path d="M20 6L9 17l-5-5" /></svg>
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: '#43514D' }}>Keep me signed in</span>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, color: '#173326', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>Forgot password?</span>
            </div>
          )}

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderRadius: 10, background: '#F7E4DB', border: '1px solid rgba(142,46,10,0.18)' }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: '#8E2E0A', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#8E2E0A' }}>{error}</span>
            </div>
          )}

          <div onClick={submit} style={{ padding: '14px 0', borderRadius: 10, background: '#173326', color: '#ffffff', textAlign: 'center', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>{isLogin ? 'Log in' : 'Create account'}</div>

          {isSignup && (
            <div style={{ fontSize: 11.5, lineHeight: 1.6, color: '#7E9B93', textAlign: 'center', textWrap: 'pretty' }}>New accounts are reviewed by an administrator before access is granted.</div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, height: 1, background: 'rgba(20,8,31,0.09)' }} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7E9B93' }}>or</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(20,8,31,0.09)' }} />
          </div>

          <div onClick={submit} style={{ padding: '13px 0', borderRadius: 10, background: '#ffffff', border: '1px solid rgba(20,8,31,0.12)', color: '#0B1A12', textAlign: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#173326" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.3V21H3V3h8.7" /><path d="M14 3h7v7" /><path d="M10 14L21 3" /></svg>
            <span>Continue with Microsoft 365</span>
          </div>

          <div style={{ fontSize: 12.5, color: '#7E9B93', textAlign: 'center' }}>
            <span>{isLogin ? 'Need an account?' : 'Already have access?'}</span>
            <span onClick={() => { setError(''); navigate(isLogin ? '/signup' : '/login'); }} style={{ fontWeight: 700, color: '#173326', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, marginLeft: 5 }}>{isLogin ? 'Sign up' : 'Log in'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
