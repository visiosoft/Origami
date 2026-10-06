import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { TIER_STYLE } from '../data/users';
import './SettingsBoard.css';

export type SettingsTab = 'account' | 'workspace' | 'integrations';
export interface SettingsSection { key: string; label: string; hint: string; tab: SettingsTab; render: () => ReactNode }

const TONES = ['#F3D9B1', '#CFE0CC', '#F2CFC4', '#D5DCE8', '#F5E3A1', '#E3D3EC', '#CFE5E4', '#EBD8C8'];
const toneFor = (s: string) => TONES[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length];
const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
const TABS: [SettingsTab, string][] = [['account', 'My account'], ['workspace', 'Workspace'], ['integrations', 'Integrations']];

/**
 * Settings in the New look: tabs across the top (My account, Workspace,
 * Integrations). My account shows your profile, sign-in, notifications and
 * calendar side by side; the other tabs list their sections as pills, each
 * opening the same settings panel as the Classic page.
 */
export function SettingsBoard({ sections, initialTab, initialSection }: { sections: SettingsSection[]; initialTab: SettingsTab; initialSection?: string }) {
  const { currentUser, currentRole, can, signOut, toast } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const firstOf = (t: SettingsTab) => sections.find((s) => s.tab === t)?.key || '';
  const [picked, setPicked] = useState<Record<SettingsTab, string>>({
    account: '', workspace: firstOf('workspace'), integrations: firstOf('integrations'),
    ...(initialSection ? { [initialTab]: initialSection } : {}),
  });
  const [sending, setSending] = useState(false);

  const inTab = sections.filter((s) => s.tab === tab);
  const current = inTab.find((s) => s.key === picked[tab]) || inTab[0];
  const section = (k: string) => sections.find((s) => s.key === k);

  const name = currentUser?.name || 'You';
  const resetLink = () => {
    if (!currentUser?.email || sending) return;
    setSending(true);
    api.auth.forgotPassword(currentUser.email)
      .then((r) => toast(r?.ok === false ? '⚠ ' + (r.reason || 'Could not send the email') : `Password link sent to ${currentUser.email}`))
      .catch((e: Error) => toast('⚠ ' + (e.message || 'Could not send the email')))
      .finally(() => setSending(false));
  };

  return (
    <div className="st">
      <p className="st-lead">Your account, how Origami reaches you, and how the workspace is set up.</p>
      <div className="st-tabs" role="tablist">
        {TABS.map(([k, l]) => (
          <button type="button" role="tab" key={k} aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'account' ? (
        <div className="st-account">
          <div className="st-col">
            <section className="st-card">
              <h2>Profile</h2>
              <span className="st-sub">How you appear to your team</span>
              <div className="st-me">
                <span className="st-avatar" style={{ background: toneFor(name) }}>{initials(name)}</span>
                <div>
                  <b>{name}</b>
                  <small>{currentRole?.name || currentUser?.roleKey}{currentUser?.tier && currentUser.tier !== 'internal' ? ` · ${TIER_STYLE[currentUser.tier].label}` : ''}</small>
                </div>
              </div>
              <div className="st-fields">
                <div><span>Full name</span><b>{currentUser?.name || '—'}</b></div>
                <div><span>Email</span><b>{currentUser?.email || '—'}</b></div>
                <div><span>Role</span><b>{currentRole?.name || '—'}</b></div>
                <div><span>Account type</span><b>{currentUser?.tier ? TIER_STYLE[currentUser.tier].label : '—'}</b></div>
              </div>
              <div className="st-foot">
                <span>Your name, email and role are set by an administrator.</span>
                {can('users', 'manage') && <button type="button" className="st-btn is-dark" onClick={() => navigate('/users')}>Edit in User Access</button>}
              </div>
            </section>

            <section className="st-card">
              <h2>Sign-in and security</h2>
              <span className="st-sub">Signed in as {currentUser?.email}</span>
              <div className="st-rows">
                <div className="st-row">
                  <div><b>Password</b><small>We'll email you a link to choose a new one.</small></div>
                  <button type="button" className="st-btn" disabled={sending} onClick={resetLink}>{sending ? 'Sending…' : 'Email me a link'}</button>
                </div>
                <div className="st-row">
                  <div><b>Sign out</b><small>Ends your session on this device.</small></div>
                  <button type="button" className="st-btn" onClick={signOut}>Sign out</button>
                </div>
              </div>
            </section>

            {section('my-calendar') && <section className="st-card st-embed">{section('my-calendar')!.render()}</section>}
          </div>
          <div className="st-col">
            {section('notifications') && <section className="st-card st-embed">{section('notifications')!.render()}</section>}
          </div>
        </div>
      ) : (
        <div className="st-split">
          <nav className="st-nav">
            {inTab.map((s) => (
              <button type="button" key={s.key} className={current?.key === s.key ? 'is-on' : ''} onClick={() => setPicked((p) => ({ ...p, [tab]: s.key }))}>
                <b>{s.label}</b><small>{s.hint}</small>
              </button>
            ))}
          </nav>
          <section className="st-card st-embed st-panel" key={current?.key}>{current?.render()}</section>
        </div>
      )}
    </div>
  );
}
