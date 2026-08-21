import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';

/**
 * Public home page, reachable without signing in.
 *
 * Google's OAuth verification requires a home page that explains what the
 * application is for and that carries the same app name as the consent screen.
 * The consent screen is registered as "origamidb", so that name leads here —
 * if the consent screen is ever renamed, APP_NAME has to change with it.
 */

const APP_NAME = 'origamidb';
const OPERATOR = 'Origami Design + Build';
const CONTACT_EMAIL = 'Systems@origamidb.com';

const BG = "'Bricolage Grotesque', serif";

const page: React.CSSProperties = {
  minHeight: '100vh',
  background: '#FBF8F2',
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  color: '#0B1A12',
};

const shell: React.CSSProperties = { maxWidth: 860, margin: '0 auto', padding: '0 24px' };

const h2: React.CSSProperties = {
  fontFamily: BG, fontWeight: 700, fontSize: 21, letterSpacing: '-0.015em',
  color: '#0B1A12', margin: '0 0 12px',
};

const body: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.75, color: '#43514D', margin: '0 0 14px' };

const FEATURES: { title: string; text: string }[] = [
  {
    title: 'Leads and intake',
    text: 'Capture an enquiry with a structured questionnaire, score it against a qualification template, and move it through the pipeline to a live project.',
  },
  {
    title: 'Projects and phases',
    text: 'Track each job through programming, schematic design, design development, construction documents, interiors and construction administration.',
  },
  {
    title: 'Tasks',
    text: 'A board and a meeting request log, with assignment, due dates, checklists, comments and a record of what changed.',
  },
  {
    title: 'People and access',
    text: 'Staff, clients and consultants each get a role that decides what they can see. Clients and consultants only ever see work assigned to them.',
  },
  {
    title: 'Documents and correspondence',
    text: 'Introduction letters and other templated email sent from the practice mailbox, with files attached to the task or project they belong to.',
  },
];

export function Home() {
  return (
    <div style={page}>
      <header style={{ background: '#0F2417', padding: '54px 0 60px' }}>
        <div style={shell}>
          <div style={{ background: '#FBF8F2', borderBottom: '3px solid #D2822E', borderRadius: 10, padding: '12px 16px', display: 'inline-flex', marginBottom: 26 }}>
            <Logo markSize={28} />
          </div>
          <h1 style={{ fontFamily: BG, fontWeight: 700, fontSize: 40, lineHeight: 1.12, letterSpacing: '-0.025em', color: '#ffffff', margin: '0 0 14px', maxWidth: 620 }}>
            {APP_NAME}
          </h1>
          <p style={{ fontSize: 16.5, lineHeight: 1.65, color: 'rgba(255,255,255,0.72)', margin: 0, maxWidth: 640 }}>
            The project delivery platform used by {OPERATOR} to run design-and-build work — from a first enquiry through
            design, permitting and construction to final invoice.
          </p>
        </div>
      </header>

      <main style={{ ...shell, padding: '44px 24px 72px' }}>
        <section style={{ marginBottom: 40 }}>
          <h2 style={h2}>What this application is for</h2>
          <p style={body}>
            {APP_NAME} is the internal system {OPERATOR}, a residential design and construction practice, uses to manage
            its work. One place holds the enquiries the practice receives, the projects those become, the people involved
            in each, the tasks each phase requires, and the correspondence and files that go with them.
          </p>
          <p style={body}>
            It replaces spreadsheets and scattered email threads: a job's brief, programme, drawings, approvals, task list
            and client correspondence stay attached to the job rather than living in someone's inbox.
          </p>
          <p style={body}>
            It is a private business system, not a consumer product. There is no public sign-up — accounts are created by
            an administrator for the practice's own staff, and for the clients and consultants working on a given project.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={h2}>What it does</h2>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ background: 'white', border: '1px solid rgba(20,8,31,0.08)', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0B1A12', marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 13, lineHeight: 1.65, color: '#5C6B65' }}>{f.text}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={h2}>How Google accounts are used</h2>
          <p style={body}>
            Staff may sign in with their Google account instead of a password; {APP_NAME} reads only the name, email
            address and profile picture in order to match the person to an account an administrator has already created.
          </p>
          <p style={body}>
            Separately, an administrator may connect one Google Workspace account belonging to the practice. {APP_NAME}
            then sends account invitations, password reset links, task reminders and project correspondence from that
            mailbox, and stores files attached to tasks in that account's Google Drive. It does not read the mailbox.
          </p>
          <p style={body}>
            What is collected, how long it is kept and how to have it removed is set out in full in the{' '}
            <Link to="/privacy" style={{ color: '#2F7D4A', fontWeight: 600 }}>privacy policy</Link>.
          </p>
        </section>

        <section>
          <h2 style={h2}>Contact</h2>
          <p style={body}>
            {APP_NAME} is operated by {OPERATOR}. Questions about the application or about data held in it can be sent to{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#2F7D4A', fontWeight: 600 }}>{CONTACT_EMAIL}</a>.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
            <Link to="/login" style={{ padding: '12px 24px', borderRadius: 10, background: '#173326', color: 'white', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Sign in
            </Link>
            <Link to="/privacy" style={{ padding: '12px 24px', borderRadius: 10, background: 'white', border: '1px solid rgba(20,8,31,0.12)', color: '#0B1A12', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
              Privacy policy
            </Link>
          </div>
        </section>

        <p style={{ fontSize: 12, color: '#9AA39D', marginTop: 44, paddingTop: 18, borderTop: '1px solid rgba(20,8,31,0.08)' }}>
          {APP_NAME} · {OPERATOR}
        </p>
      </main>
    </div>
  );
}
