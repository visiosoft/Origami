import { useState } from 'react';
import type { User } from '../data/users';
import { initials } from '../data/people';

/**
 * A person's avatar: their Google profile picture when we have one, otherwise
 * their initials. `avatarUrl` is populated when someone signs in with Google.
 */
export function Avatar({
  name,
  user,
  size = 24,
  bg = '#173326',
  title,
}: {
  name?: string;
  user?: Pick<User, 'name' | 'avatarUrl'>;
  size?: number;
  bg?: string;
  title?: string;
}) {
  const [broken, setBroken] = useState(false);
  const label = user?.name ?? name ?? '';
  const src = !broken ? user?.avatarUrl : undefined;

  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: 999,
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
  };

  if (src) {
    return (
      <img
        src={src}
        alt={label}
        title={title ?? label}
        onError={() => setBroken(true)}
        style={{ ...base, objectFit: 'cover' }}
      />
    );
  }

  return (
    <span
      title={title ?? label}
      style={{
        ...base,
        background: label ? bg : '#C9D4CC',
        color: 'white',
        fontSize: Math.max(8, Math.round(size * 0.42)),
        fontWeight: 700,
        letterSpacing: '0.02em',
      }}
    >
      {label ? initials(label) : '?'}
    </span>
  );
}
