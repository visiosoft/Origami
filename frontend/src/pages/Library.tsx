import { useState } from 'react';
import { ProgrammeTemplate } from './ProgrammeTemplate';
import { ScoringTemplateEditor, EmailTemplatesEditor } from './Settings';

const BG = "'Bricolage Grotesque', serif";

const TABS = [
  { key: 'programme', label: 'Programme Template', hint: 'Phases and tasks every new project starts from' },
  { key: 'scoring', label: 'Lead Qualification Scoring', hint: 'How a lead is scored for fit' },
  { key: 'messages', label: 'Email, SMS & Documents', hint: 'Message templates and standard documents' },
] as const;

type TabKey = typeof TABS[number]['key'];

/**
 * Document & Template Library.
 *
 * Everything the office has decided once and reuses on every job. These used to
 * sit in Settings, which is where configuration belongs — a programme or a
 * proposal is content people write, not a setting.
 */
export function Library() {
  const [active, setActive] = useState<TabKey>('programme');

  return (
    <div style={{ padding: '18px 22px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: BG, fontSize: 20, fontWeight: 700, color: '#0B1A12' }}>Document &amp; Template Library</div>
        <div style={{ fontSize: 12.5, color: '#7E9B93', marginTop: 3, maxWidth: 640, lineHeight: 1.6 }}>
          The things decided once and reused on every job — the delivery programme, how leads are scored, and the
          messages and documents sent out.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18, borderBottom: '1px solid rgba(20,8,31,0.07)', paddingBottom: 12 }}>
        {TABS.map((t) => {
          const on = active === t.key;
          return (
            <div
              key={t.key}
              onClick={() => setActive(t.key)}
              title={t.hint}
              style={{
                padding: '8px 15px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                background: on ? '#173326' : 'white',
                color: on ? 'white' : '#7E9B93',
                border: '1px solid ' + (on ? '#173326' : 'rgba(20,8,31,0.1)'),
              }}
            >
              {t.label}
            </div>
          );
        })}
      </div>

      {active === 'programme' && <ProgrammeTemplate />}
      {active === 'scoring' && <ScoringTemplateEditor />}
      {active === 'messages' && <EmailTemplatesEditor />}
    </div>
  );
}
