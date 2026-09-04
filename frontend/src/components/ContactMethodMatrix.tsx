import { CONTACT_METHODS, CONTACT_PREFERENCES, type ContactPreference } from '../data/leads';

const cell: React.CSSProperties = {
  width: 78, textAlign: 'center', padding: '6px 0', flexShrink: 0,
};

interface Props {
  value?: Record<string, string>;
  onChange: (matrix: Record<string, string>) => void;
  disabled?: boolean;
}

/**
 * How a person wants to be reached, method by method.
 *
 * One choice per row rather than a free-for-all of checkboxes: a method is the
 * primary way to reach them, a fallback, or not to be used. Several methods can
 * share Primary — people genuinely do say "call or text me".
 *
 * Clicking the chosen box again clears the row, so a mistake needs no undo.
 */
export function ContactMethodMatrix({ value, onChange, disabled }: Props) {
  const matrix = value || {};

  const set = (method: string, pref: ContactPreference) => {
    if (disabled) return;
    const next = { ...matrix };
    if (next[method] === pref) delete next[method];
    else next[method] = pref;
    // "No Preference" is the whole answer, so it clears the rest and vice versa.
    if (method === 'No Preference' && next[method]) {
      onChange({ 'No Preference': next[method] });
      return;
    }
    if (method !== 'No Preference') delete next['No Preference'];
    onChange(next);
  };

  return (
    <div style={{ border: '1px solid rgba(20,8,31,0.12)', borderRadius: 9, overflow: 'hidden', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '7px 10px', borderBottom: '1px solid rgba(20,8,31,0.08)', background: '#FBF8F2' }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#7E9B93' }}>
          Preferred Contact Method
        </span>
        {CONTACT_PREFERENCES.map((p) => (
          <span key={p} style={{ ...cell, fontSize: 10, fontWeight: 700, color: '#7E9B93' }}>{p}</span>
        ))}
      </div>

      {CONTACT_METHODS.map((method, i) => {
        const chosen = matrix[method];
        return (
          <div key={method} style={{ display: 'flex', alignItems: 'center', padding: '0 10px', borderTop: i ? '1px solid rgba(20,8,31,0.04)' : 'none' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: chosen ? '#0B1A12' : '#5c5666', fontWeight: chosen ? 600 : 400 }}>
              {method}
            </span>
            {CONTACT_PREFERENCES.map((pref) => {
              const on = chosen === pref;
              return (
                <span key={pref} style={cell}>
                  <span
                    onClick={() => set(method, pref)}
                    title={`${method} — ${pref}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 17, height: 17, borderRadius: 4, cursor: disabled ? 'default' : 'pointer',
                      border: '1.5px solid ' + (on ? (pref === 'No' ? '#8E2E0A' : '#2F7D4A') : 'rgba(20,8,31,0.22)'),
                      background: on ? (pref === 'No' ? '#8E2E0A' : '#2F7D4A') : 'white',
                      color: 'white', fontSize: 11, fontWeight: 900, lineHeight: 1,
                    }}
                  >
                    {on ? '✓' : ''}
                  </span>
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
