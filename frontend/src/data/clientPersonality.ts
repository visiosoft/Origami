import { canonical, PLACEHOLDER_RE } from './placeholders';

// The intake asks how a client communicates and decides. That answer chooses
// which version of a message goes out.
//
// These are variants of tone and structure, not of substance: each one says
// what has happened, what is needed and by when. A client who is told less is
// not told something different.

export const PERSONALITY_TEMPLATE: Record<string, string> = {
  'Analytical / Detail-Oriented': 'client_email_analytical',
  'Driver / Decisive': 'client_email_driver',
  'Expressive / Visionary': 'client_email_expressive',
  'Amiable / Collaborative': 'client_email_amiable',
  'Skeptical / Cautious': 'client_email_skeptical',
  'Overwhelmed / Needs Guidance': 'client_email_overwhelmed',
  'Hands-Off / Delegator': 'client_email_hands_off',
  'Not Yet Determined': 'client_email_neutral',
};

/** The template key for a personality, falling back to the standard one. */
export function templateKeyForPersonality(personality?: string): string {
  return PERSONALITY_TEMPLATE[String(personality || '').trim()] || 'client_email_neutral';
}

/**
 * Fill merge fields -- {{clientName}}, {{ clientName }} or {client_name} --
 * leaving unknown or unfilled ones visible (the send check then names them).
 */
export function mergeTokens(text: string, values: Record<string, string>): string {
  return String(text || '').replace(PLACEHOLDER_RE, (whole, a?: string, b?: string) => {
    const v = values[canonical(a || b || '')];
    return v === undefined || v === '' ? whole : v;
  });
}
