import { Logo } from '../components/Logo';

/**
 * Public privacy policy — deliberately outside the authentication guard, since
 * Google requires the URL to be reachable without signing in when reviewing the
 * OAuth consent screen.
 *
 * Everything here describes what the application actually does. If the Google
 * scopes or the data we store change, this page has to change with them.
 */

const LAST_UPDATED = '22 August 2026';
const CONTACT_EMAIL = 'Systems@origamidb.com';

const BG = "'Bricolage Grotesque', serif";

const page: React.CSSProperties = {
  minHeight: '100vh',
  background: '#FBF8F2',
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  color: '#0B1A12',
};

const shell: React.CSSProperties = {
  maxWidth: 760,
  margin: '0 auto',
  padding: '40px 24px 72px',
};

const h2: React.CSSProperties = {
  fontFamily: BG,
  fontWeight: 700,
  fontSize: 19,
  letterSpacing: '-0.01em',
  color: '#0B1A12',
  margin: '34px 0 10px',
};

const p: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.75,
  color: '#43514D',
  margin: '0 0 12px',
};

const li: React.CSSProperties = { ...p, margin: '0 0 8px' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={h2}>{title}</h2>
      {children}
    </section>
  );
}

export function Privacy() {
  return (
    <div style={page}>
      <header style={{ background: '#0F2417', padding: '26px 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: '#FBF8F2', borderBottom: '3px solid #D2822E', borderRadius: 10, padding: '10px 14px', display: 'inline-flex' }}>
            <Logo markSize={26} />
          </div>
          <div>
            <div style={{ color: '#ffffff', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Privacy Policy</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 3 }}>
              Origami Design + Build
            </div>
          </div>
        </div>
      </header>

      <main style={shell}>
        <p style={{ ...p, fontSize: 12.5, color: '#7E9B93', marginBottom: 24 }}>Last updated: {LAST_UPDATED}</p>

        <p style={p}>
          Origami Design + Build ("Origami", "we") is a private project delivery platform used by the staff, clients and
          consultants of Origami Design + Build. This policy explains what information the platform holds, how Google
          account data is used when you connect one, and how to have that data removed.
        </p>
        <p style={p}>
          Origami is not a consumer product. Accounts are created by an administrator; there is no public sign-up.
        </p>

        <Section title="Information we hold">
          <p style={p}>For each account: name, email address, assigned role and access tier, the date the account was
            created, the time of the last sign-in, and — if you sign in with Google — your Google profile picture.</p>
          <p style={p}>Passwords are never stored. When you set one it is hashed with scrypt, and only that hash is kept.</p>
          <p style={p}>Beyond accounts, the platform stores the working records your team enters: projects, leads, contacts,
            tasks, comments, checklists and any files attached to them.</p>
        </Section>

        <Section title="Google account data">
          <p style={p}>Origami uses Google OAuth in two separate ways.</p>

          <p style={{ ...p, fontWeight: 700, color: '#0B1A12', marginTop: 16 }}>Signing in</p>
          <p style={p}>
            "Continue with Google" requests only <code>openid</code>, <code>email</code> and <code>profile</code>. We use
            your email address to match you to an existing Origami account, and your name and profile picture to show who
            you are inside the app. Sign-in only succeeds if an administrator has already created an account for that
            address.
          </p>

          <p style={{ ...p, fontWeight: 700, color: '#0B1A12', marginTop: 16 }}>The connected workspace account</p>
          <p style={p}>
            An administrator may connect one Google Workspace account that the platform then acts on behalf of. That
            connection requests two additional scopes:
          </p>
          <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
            <li style={li}>
              <strong>Send email on your behalf</strong> (<code>gmail.send</code>) — used to send account invitations,
              password reset links, task reminders and project correspondence that your team composes in the app. This
              scope permits sending only; it gives no ability to read your mailbox.
            </li>
            <li style={li}>
              <strong>Google Drive</strong> (<code>drive</code>) — used to store files that people attach to tasks. Origami
              creates a folder in that account's Drive, uploads attachments into it, retrieves them when someone views a
              task, and moves them to the Drive trash when an attachment is deleted. The platform can also list recent
              files in that account so an administrator can confirm the connection is working.
            </li>
          </ul>
          <p style={p}>
            Google issues Origami a refresh token for the connected account, which is stored in the platform's own
            database so mail can be sent and files retrieved without a person present. Short-lived access tokens are held
            in memory only. Disconnecting the account in Settings deletes the stored token immediately.
          </p>
        </Section>

        <Section title="Limited use of Google user data">
          <p style={{ ...p, background: 'white', border: '1px solid rgba(20,8,31,0.08)', borderRadius: 10, padding: '14px 16px' }}>
            Origami's use and transfer of information received from Google APIs to any other app will adhere to the{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer"
               style={{ color: '#2F7D4A', fontWeight: 600 }}>
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
          <p style={p}>
            Specifically: we do not sell Google user data, we do not use it for advertising, and we do not use it to train
            generalised artificial-intelligence models. It is used only to provide the features described above, and is
            read by a person only where necessary for support that you have asked for, for security investigations, or
            where the law requires it.
          </p>
        </Section>

        <Section title="Who your information is shared with">
          <p style={p}>
            Origami does not sell or rent personal information, and does not share it with third parties for their own
            purposes. Information is visible inside the platform to other members of your organisation according to the
            role you have been given — clients and consultants see only the work assigned to them.
          </p>
          <p style={p}>
            The platform runs on Microsoft Azure (application hosting and database) and uses Google Workspace APIs for
            email and file storage as described above. These providers process data on our behalf.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p style={p}>
            Account and project records are kept for as long as the account is active and the business needs the record.
            When an administrator deletes an account, the account record and its credentials are removed. Files uploaded
            to Drive are moved to that account's trash, from where Google deletes them according to its own schedule.
          </p>
        </Section>

        <Section title="Your choices">
          <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
            <li style={li}>Ask an administrator to correct or delete your account and the personal data on it.</li>
            <li style={li}>
              Revoke Origami's access to your Google account at any time from{' '}
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer"
                 style={{ color: '#2F7D4A', fontWeight: 600 }}>
                your Google account permissions
              </a>
              . Doing so ends Google sign-in and, for a connected workspace account, stops outgoing mail and Drive access.
            </li>
            <li style={li}>Sign in with an email address and password instead of Google, if you prefer not to link the accounts.</li>
            <li style={li}>Request a copy of the personal information held about you by writing to the address below.</li>
          </ul>
        </Section>

        <Section title="Security">
          <p style={p}>
            Traffic is served over HTTPS. Passwords are stored only as scrypt hashes. Session tokens are signed and expire
            after twelve hours. Credentials for connected services are stored server-side and never sent to the browser.
            No system is perfectly secure, and we do not claim otherwise.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p style={p}>
            If what the platform does with your information changes, this page is updated and the date at the top changes
            with it.
          </p>
        </Section>

        <Section title="Contact">
          <p style={p}>
            Questions about this policy, or requests relating to your information, can be sent to{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#2F7D4A', fontWeight: 600 }}>{CONTACT_EMAIL}</a>.
          </p>
        </Section>

        <p style={{ ...p, fontSize: 12, color: '#9AA39D', marginTop: 36, paddingTop: 18, borderTop: '1px solid rgba(20,8,31,0.08)' }}>
          Origami Design + Build · Internal project delivery platform
        </p>
      </main>
    </div>
  );
}
