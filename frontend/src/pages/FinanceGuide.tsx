import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const BG = "'Bricolage Grotesque', serif";
const INK = '#0B1A12';
const MUTED = '#5E7A71';
const ACCENT = '#173326';
const SOFT = '#DCE7DE';
const AMBER = '#8A6D12';
const AMBER_SOFT = '#FBF0CC';
const LINE = 'rgba(20,8,31,0.08)';
/** The worked example the guide walks through: the outsourced software build. */
const EXAMPLE = 'Origami DB Development';

const Ui = ({ children }: { children: ReactNode }) => (
  <span style={{ fontWeight: 700, color: ACCENT, background: SOFT, padding: '1px 7px', borderRadius: 6, whiteSpace: 'nowrap', fontSize: '0.92em' }}>{children}</span>
);
const Safe = () => <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: SOFT, color: ACCENT, marginLeft: 6, verticalAlign: 2 }}>Safe — just looking</span>;
const Saves = () => <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: AMBER_SOFT, color: AMBER, marginLeft: 6, verticalAlign: 2 }}>Saves a record</span>;
const Result = ({ children }: { children: ReactNode }) => <div style={{ fontSize: 13.5, color: MUTED, borderLeft: '2px solid ' + SOFT, paddingLeft: 12, marginTop: 6 }}>{children}</div>;
const Eyebrow = ({ children }: { children: ReactNode }) => <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: MUTED }}>{children}</div>;
const H2 = ({ children }: { children: ReactNode }) => <h2 style={{ fontFamily: BG, fontSize: 23, margin: 0, color: INK, letterSpacing: '-0.01em' }}>{children}</h2>;
const H3 = ({ children }: { children: ReactNode }) => <h3 style={{ fontFamily: BG, fontSize: 16.5, margin: '6px 0 0', color: INK }}>{children}</h3>;

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 14 }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr)', gap: 12 }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', fontFamily: BG, fontWeight: 700, fontSize: 13, background: SOFT, color: ACCENT }}>{i + 1}</span>
          <div style={{ lineHeight: 1.65 }}>{it}</div>
        </li>
      ))}
    </ol>
  );
}

function Section({ id, children }: { id: string; children: ReactNode }) {
  return <section id={id} style={{ display: 'grid', gap: 14, scrollMarginTop: 20 }}>{children}</section>;
}

const TOC: [string, string][] = [
  ['two-sides', 'The two sides of money'], ['tour', `Tour: ${EXAMPLE}`], ['next-invoice', 'When Ehsan sends an invoice'],
  ['other-events', 'Other things that happen'], ['clients', 'When a client pays you'], ['words', 'What the words mean'], ['rules', 'Good to know'],
];

/**
 * Help → Finance guide. Teaches project finance on the real outsourced job
 * (Origami DB Development), marking what only looks from what saves a record.
 */
export function FinanceGuide() {
  const navigate = useNavigate();
  const [exampleId, setExampleId] = useState<number | null>(null);
  useEffect(() => {
    api.projects.list().then((r: any) => setExampleId((Array.isArray(r) ? r : []).find((p: any) => p.name === EXAMPLE)?.id ?? null)).catch(() => {});
  }, []);
  const open = (tab: 'overview' | 'phases' | 'financial') => exampleId && navigate(`/projects?open=${exampleId}&tab=${tab}`);
  const OpenBtn = ({ tab, label }: { tab: 'overview' | 'phases' | 'financial'; label: string }) => (exampleId ? (
    <span onClick={() => open(tab)} style={{ display: 'inline-flex', marginTop: 6, padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid ' + LINE, background: 'white', color: ACCENT }}>{label} →</span>
  ) : null);
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', color: INK }}>
      <div onClick={() => navigate('/help')} style={{ fontSize: 12.5, color: MUTED, cursor: 'pointer', marginBottom: 12 }}>← Help &amp; Support</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 210px', gap: 40, alignItems: 'start' }} className="finance-guide">
        <main style={{ display: 'grid', gap: 44, maxWidth: 740, fontSize: 14.5, lineHeight: 1.65 }}>
          <header style={{ display: 'grid', gap: 8 }}>
            <Eyebrow>Finance guide</Eyebrow>
            <h1 style={{ fontFamily: BG, fontSize: 30, margin: 0, letterSpacing: '-0.02em' }}>Your first week with project finance</h1>
            <p style={{ margin: 0, fontSize: 15.5, color: MUTED, maxWidth: '62ch' }}>
              Learn it on a real job: <b style={{ color: INK }}>{EXAMPLE}</b>, the software build you've outsourced to Ehsan Afzal.
              Steps marked <Safe /> change nothing. Steps marked <Saves /> are for when something really happens.
            </p>
          </header>

          <Section id="two-sides">
            <Eyebrow>Start here</Eyebrow>
            <H2>The two sides of money</H2>
            <p style={{ margin: 0 }}>Everything in Finance is one of two directions. Keep them apart and the screens make sense.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {[
                ['Clients → you', ['You bill the client for work done', 'The client pays you'], 'Work done, Billed to client, Received, Client owes'],
                ['You → subcontractors, vendors, consultants', ['You agree a price with them (a subcontract)', 'They bill you, and you pay them'], 'Committed, Billed to us, Paid out, Still to pay'],
              ].map(([t, items, words]) => (
                <div key={t as string} style={{ background: 'white', border: '1px solid ' + LINE, borderRadius: 14, padding: '14px 16px', display: 'grid', gap: 6 }}>
                  <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 16 }}>{t}</div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: MUTED, fontSize: 13.5 }}>{(items as string[]).map((x) => <li key={x}>{x}</li>)}</ul>
                  <div style={{ fontSize: 12.5, color: MUTED }}>Words you'll see: <b style={{ color: INK, fontWeight: 600 }}>{words}</b></div>
                </div>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: MUTED }}>{EXAMPLE} has only the right-hand side: nobody pays you for it, and you pay Ehsan. A construction job for a client usually has both sides.</p>
          </Section>

          <Section id="tour">
            <Eyebrow>Part 1 · Safe tour</Eyebrow>
            <H2>Tour of {EXAMPLE}</H2>
            <p style={{ margin: 0 }}>Ten minutes, nothing is saved.</p>
            <Steps items={[
              <><b>Open the project.</b><Safe /><br /><Ui>Projects</Ui> → {EXAMPLE}. The panel has tabs: Overview, Phase Board, Tasks, <b>Financial</b>, Guest Access.<br /><OpenBtn tab="overview" label="Open it now" /></>,
              <><b>Look at the Phase Board.</b><Safe /><br />The 9 milestones from your spreadsheet, in order — Mobilization, Projects and CRM, System Architecture… through Testing and Go-Live and the final 10%. Each column holds its sub-milestones as tasks; open one to read its deliverable and what's required from us.
                <Result>The design-template phases this project doesn't use are hidden — "8 hidden phases · Show" brings them back.</Result><OpenBtn tab="phases" label="Open the Phase Board" /></>,
              <><b>Open the Financial tab.</b><Safe /><br />It says <b>No client contract</b> — right for outsourced work. Below it, the four numbers that matter:
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, margin: '8px 0' }}>
                  {[['Budget', '$12,000', 'What you planned to spend'], ['Committed', '$12,000', 'Agreed with Ehsan'], ['Paid out', '$2,370.50', 'Invoices #1–#3'], ['Still to pay', '$9,629.50', 'Not billed to you yet']].map(([l, v, s], i) => (
                    <div key={l} style={{ background: 'white', border: '1px solid ' + LINE, borderRadius: 12, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: MUTED }}>{l}</div>
                      <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 19, color: i === 3 ? AMBER : INK, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                      <div style={{ fontSize: 11.5, color: MUTED }}>{s}</div>
                    </div>
                  ))}
                </div>
                <Result>These are today's figures; the screen always shows the latest. The bar under the cards shows the same thing as colors: dark green = paid, light green = agreed but not yet billed.</Result><OpenBtn tab="financial" label="Open the Financial tab" /></>,
              <><b>Open the subcontract.</b><Safe /><br />Click <Ui>Subcontracts &amp; POs</Ui>, then <b>SC-001</b> — the agreement with Ehsan: one line per milestone, adding up to $12,000, status <b>Approved</b>. At the bottom, <b>Their bills against it</b> lists what he has billed; the Notes hold the milestone deliverables from the sheet.<Result>Close it with the × — nothing changed.</Result></>,
              <><b>See his bills.</b><Safe /><br />Click <Ui>Costs</Ui>. His Invoices #1, #2 and #3 appear as 8 lines — one per milestone they covered — each marked <b>Paid</b>.</>,
              <><b>See it across all projects.</b><Safe /><br />Left menu: <Ui>Financial</Ui> → <Ui>Project</Ui>. Try <b>Project portfolio</b> (this project shows paid out and still to pay), <b>Reports</b> → Budget vs actual and Cash forecast, and <b>Audit log</b> — who did what, and when.
                <br /><span onClick={() => navigate('/fin_project')} style={{ display: 'inline-flex', marginTop: 6, padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid ' + LINE, background: 'white', color: ACCENT }}>Open Project Finance →</span></>,
            ]} />
          </Section>

          <Section id="next-invoice">
            <Eyebrow>Part 2 · The real thing</Eyebrow>
            <H2>When Ehsan sends his next invoice</H2>
            <p style={{ margin: 0 }}>What you'll do most: record it, approve it, and once you've paid him, mark it paid.</p>
            <Steps items={[
              <><b>Record the bill.</b><Saves /><br />Financial → <Ui>Costs</Ui> → <Ui>+ Cost</Ui>, and fill it in like this:
                <div style={{ background: 'white', border: '1px solid ' + LINE, borderRadius: 12, overflowX: 'auto', margin: '8px 0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                    <tbody>
                      {[
                        ['Type', 'Subcontractor pay app'], ['Against commitment', 'SC-001 Ehsan Afzal — his name fills in by itself'], ['Bill / invoice #', 'Invoice #4'],
                        ['Amount ($)', 'The amount on his invoice'], ['For', 'The milestone it covers, e.g. People under Projects and CRM'],
                        ['Description', 'e.g. "Invoice #4 — People (remaining 50%)"'], ['Date / Due', 'The invoice date; due defaults to 30 days later'],
                      ].map(([k, v], i) => (
                        <tr key={k}><th style={{ textAlign: 'left', padding: '7px 14px', borderTop: i ? '1px solid ' + LINE : 0, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: MUTED, width: '34%', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{k}</th>
                          <td style={{ padding: '7px 14px', borderTop: i ? '1px solid ' + LINE : 0 }}>{v}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                Click <Ui>Record cost</Ui>. It shows as <b>Recorded</b> — waiting for approval.
                <Result>If one invoice covers two milestones, record two costs with the same invoice number — one per milestone — so "what's left per milestone" stays right.</Result></>,
              <><b>Approve it.</b><Saves /><br />Check it against his invoice, then <Ui>Approve</Ui>. It now counts in <b>Still to pay</b> as billed and unpaid.</>,
              <><b>Mark it paid — after the money has gone.</b><Saves /><br /><Ui>Mark paid</Ui>, then the date you paid and the bank reference (ACH, wire or check number).<Result>Paid out goes up, Still to pay goes down, and the Cash forecast stops expecting it.</Result></>,
              <><b>Attach his invoice PDF.</b><Saves /><br />Open the cost and use <b>Attachments</b> at the bottom. Uploading needs the Google account connected (Settings → Integrations); pasting a link always works.</>,
              <><b>Tick off the work.</b><Saves /><br />On the <Ui>Phase Board</Ui>, open the sub-milestone's task and set its status to <b>Done</b> (or In progress).</>,
            ]} />
            <div style={{ background: AMBER_SOFT, borderRadius: 12, padding: '12px 16px', fontSize: 14 }}>
              <b style={{ color: AMBER }}>Made a mistake?</b> A cost still marked Recorded can be edited or deleted. Once it's approved or paid, use <b>Void</b> with a reason and record it again — nothing disappears without a trace.
            </div>
          </Section>

          <Section id="other-events">
            <Eyebrow>Part 2 · Less often</Eyebrow>
            <H2>Other things that happen</H2>
            <H3>His bill is more than what's left</H3>
            <p style={{ margin: 0 }}>The app warns you: <i>"This bills past the commitment."</i> Usually the price changed and the subcontract should say so first (next item). You can still record it by giving a reason; the reason is kept.</p>
            <H3>You agree extra work with Ehsan</H3>
            <p style={{ margin: 0 }}>Open <b>SC-001</b>, add a line (what, which milestone, the price) and <Ui>Save revision</Ui>. It asks why — e.g. "Added SMS reminders, agreed by email 3 Oct". Then add the same amount on the <Ui>Budget</Ui> tab so the budget keeps up.</p>
            <H3>The last 10%</H3>
            <p style={{ margin: 0 }}>"10% from Major Milestones" ($1,020) is its own milestone. Record it like any other bill, <b>For</b> that milestone, when go-live is accepted.</p>
            <H3>When the job is finished</H3>
            <p style={{ margin: 0 }}>Open SC-001 and <Ui>Close</Ui>. Nothing more is expected on it, and it stops counting as "still to pay".</p>
          </Section>

          <Section id="clients">
            <Eyebrow>Part 3 · Reference</Eyebrow>
            <H2>When a client pays you</H2>
            <p style={{ margin: 0 }}>For a project a client pays you for. The order is always the same.</p>
            <Steps items={[
              <><b>Set up client billing.</b> Financial tab → <Ui>Set up client billing</Ui>: contract value, retention %, tax %, payment terms, who to bill.<Result>After the first invoice is issued the contract value is locked — changes go through change orders.</Result></>,
              <><b>Give the milestones their value.</b> <Ui>Schedule of values</Ui>: type a value against each milestone (or its tasks). The bar at the top shows how much of the contract is shared out.</>,
              <><b>Update progress</b> as work gets done: click a milestone's progress and enter the %. A "Ready to bill" amount appears.</>,
              <><b>Bill the client.</b> <Ui>Bill ready work</Ui> makes a draft invoice from everything ready. Check it, then <Ui>Issue invoice</Ui> — it gets its number and can't be edited after that.</>,
              <><b>Record the payment received</b> when the client pays: open the invoice → <Ui>Record payment received</Ui>.</>,
              <><b>Extras the client asks for</b> are <Ui>Change orders</Ui>: price it, submit, then record the client's signature. Only then does the contract go up.</>,
            ]} />
          </Section>

          <Section id="words">
            <Eyebrow>Look it up</Eyebrow>
            <H2>What the words mean</H2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {([
                ['Paying side (subcontractors, vendors)', [['Budget', 'What you planned to spend on the job.'], ['Committed', "What you've agreed to pay in approved subcontracts and purchase orders."], ['Billed to us', "What they've invoiced you so far."], ['Paid out', "What you've actually paid them."], ['Still to pay', 'Billed but unpaid, plus agreed but not yet billed.'], ['Forecast', 'What the job will cost by the end — your estimate if you set one.'], ['Variance', 'Budget minus forecast. Red means heading over budget.']]],
                ['Client side', [['Client contract', 'What the client agreed to pay, plus approved change orders.'], ['Work done', 'The value of work finished so far, by progress.'], ['Ready to bill', "Work done that hasn't been invoiced yet."], ['Billed to client', "What you've invoiced them."], ['Received', "What they've paid you."], ['Client owes', 'Invoiced but not yet paid.'], ['Retention', 'A % the client holds back from each invoice and pays at the end.']]],
              ] as [string, [string, string][]][]).map(([title, terms]) => (
                <dl key={title} style={{ margin: 0, background: 'white', border: '1px solid ' + LINE, borderRadius: 14, padding: '4px 16px' }}>
                  <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 14.5, padding: '10px 0 2px' }}>{title}</div>
                  {terms.map(([t, d], i) => (
                    <div key={t} style={{ padding: '8px 0', borderTop: i ? '1px solid ' + LINE : 0 }}>
                      <dt style={{ fontWeight: 700 }}>{t}</dt><dd style={{ margin: 0, color: MUTED, fontSize: 13.5 }}>{d}</dd>
                    </div>
                  ))}
                </dl>
              ))}
            </div>
          </Section>

          <Section id="rules">
            <Eyebrow>Good to know</Eyebrow>
            <H2>Good to know</H2>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
              <li><b>Nothing is lost.</b> Issued invoices, approved bills and payments are never deleted — they're voided with a reason, and the Audit log keeps the history.</li>
              <li><b>Drafts are free.</b> A draft invoice or a Recorded cost can be changed or deleted until it's issued or approved.</li>
              <li><b>Someone else changed it?</b> If you see "changed since you opened it", the screen reloads — just redo your edit.</li>
              <li><b>Who can do what</b> is set per role in <Ui>User Access &amp; Roles</Ui> → Financial actions — for example, someone who can record bills but not mark them paid.</li>
              <li><b>Export anything.</b> Every report and cost list has <Ui>Export CSV</Ui> for Excel or Google Sheets.</li>
            </ul>
          </Section>
        </main>

        <nav aria-label="Contents" style={{ position: 'sticky', top: 20, display: 'grid', gap: 2, fontSize: 13 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: MUTED, marginBottom: 6 }}>In this guide</div>
          {TOC.map(([id, label]) => <span key={id} onClick={() => go(id)} style={{ color: MUTED, cursor: 'pointer', padding: '4px 0' }}>{label}</span>)}
        </nav>
      </div>
      <style>{'@media (max-width: 900px) { .finance-guide { grid-template-columns: 1fr !important; } .finance-guide > nav { display: none !important; } }'}</style>
    </div>
  );
}
