import { isOtherValue } from '../data/leads';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.12)', background: 'white', fontSize: 12.5,
  fontFamily: 'inherit', color: '#0B1A12', outline: 'none',
};

interface Props {
  /** The answer given for the field this belongs to. */
  value?: string;
  /** The field's name, used as the key in the lead's otherDetails map. */
  field: string;
  details?: Record<string, string>;
  onChange: (details: Record<string, string>) => void;
  placeholder?: string;
}

/**
 * The box that appears when someone answers "Other".
 *
 * Without it, "Other" records nothing — the answer is that the list did not fit,
 * and the useful part is what the real answer was.
 */
export function OtherDetail({ value, field, details, onChange, placeholder }: Props) {
  if (!isOtherValue(value)) return null;
  return (
    <input
      value={details?.[field] || ''}
      onChange={(e) => onChange({ ...(details || {}), [field]: e.target.value })}
      placeholder={placeholder || 'Please specify…'}
      style={{ ...inputStyle, marginTop: 6 }}
    />
  );
}
