import { useState, type CSSProperties, type InputHTMLAttributes } from 'react';

/** A password field with a Show / Hide button, so people can check what they typed (handy on phones). */
export function PasswordInput({ style, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { style?: CSSProperties }) {
  const [shown, setShown] = useState(false);
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input {...props} type={shown ? 'text' : 'password'} autoCapitalize="off" autoCorrect="off" spellCheck={false}
        style={{ ...style, width: '100%', boxSizing: 'border-box', paddingRight: 64 }} />
      <button type="button" onClick={() => setShown((v) => !v)} aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown}
        disabled={props.disabled}
        style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', height: 30, minWidth: 52, padding: '0 10px', border: 0, borderRadius: 999,
          background: 'transparent', font: 'inherit', fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', cursor: props.disabled ? 'default' : 'pointer' }}>
        {shown ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
