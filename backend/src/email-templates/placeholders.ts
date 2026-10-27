import { BadRequestException } from '@nestjs/common';

/**
 * Merge placeholders in templates and outgoing mail (Oct 27 backlog, item 13).
 *
 * `{{clientName}}` is the house style; `{{ clientName }}`, `{client_name}` and
 * `{{client_name}}` are read as the same field. The single-brace form only
 * takes letters, digits and `_`, so CSS such as `p{margin:0}` never matches.
 * Mirrored in frontend/src/data/placeholders.ts -- keep the two in step.
 */
export const PLACEHOLDER_RE = /\{\{\s*([A-Za-z][\w.]*)\s*\}\}|\{([A-Za-z][A-Za-z0-9_]*)\}/g;

export const KNOWN_TOKENS = [
  'clientName', 'clientEmail', 'clientPhone', 'projectTitle', 'projectScope',
  'date', 'senderName', 'senderEmail', 'invoiceNumber', 'documentName',
] as const;

/** Filled in when the document is signed, so they're meant to be there until then. */
export const SIGNING_TOKENS = ['clientSignature', 'signedDate', 'clientSignature2', 'signedDate2', 'initials'] as const;

const LABELS: Record<string, string> = {
  clientName: 'client name', clientEmail: 'client email', clientPhone: 'client phone', projectTitle: 'project title',
  projectScope: 'project scope', date: 'date', senderName: 'your name', senderEmail: 'your email',
  invoiceNumber: 'invoice number', documentName: 'document name',
};

/** `client_name`, `Client-Name`, `ClientName` -> `clientName`; a known field matches whatever its case. */
export function canonical(name: string): string {
  const parts = String(name || '').split(/[_\-\s.]+/).filter(Boolean);
  const camel = parts.map((p, i) => (i === 0 ? p.charAt(0).toLowerCase() + p.slice(1) : p.charAt(0).toUpperCase() + p.slice(1))).join('');
  const all = [...KNOWN_TOKENS, ...SIGNING_TOKENS] as readonly string[];
  return all.find((k) => k.toLowerCase() === camel.toLowerCase()) || camel;
}

export interface Placeholder { raw: string; name: string; known: boolean; signing: boolean }

export function findPlaceholders(text: string): Placeholder[] {
  const out: Placeholder[] = [];
  for (const m of String(text || '').matchAll(PLACEHOLDER_RE)) {
    const name = canonical(m[1] || m[2]);
    out.push({ raw: m[0], name, known: (KNOWN_TOKENS as readonly string[]).includes(name), signing: (SIGNING_TOKENS as readonly string[]).includes(name) });
  }
  return out;
}

/** What's still a placeholder in text about to be sent (signing fields excepted), each once. */
export function unfilled(...texts: (string | null | undefined)[]): Placeholder[] {
  const seen = new Set<string>();
  return texts.flatMap((t) => findPlaceholders(t || '')).filter((p) => !p.signing && !seen.has(p.raw) && !!seen.add(p.raw));
}

export const labelOf = (p: Placeholder) => LABELS[p.name] || p.raw;

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

/** The known field a misspelling most likely meant, if one is close. */
export function suggest(name: string): string | null {
  const n = name.toLowerCase();
  let best: string | null = null; let bestD = Infinity;
  for (const k of KNOWN_TOKENS) { const dd = distance(n, k.toLowerCase()); if (dd < bestD) { bestD = dd; best = k; } }
  return best && bestD <= Math.max(2, Math.floor(n.length / 3)) ? best : null;
}

/** A template may only use fields the app can fill. */
export function assertKnownTokens(...texts: (string | null | undefined)[]): void {
  const bad = texts.flatMap((t) => findPlaceholders(t || '')).filter((p) => !p.known && !p.signing);
  if (!bad.length) return;
  const msgs = [...new Set(bad.map((p) => { const s = suggest(p.name); return `${p.raw} isn't a merge field${s ? ` — did you mean {{${s}}}?` : ''}`; }))];
  throw new BadRequestException(`${msgs.join('; ')}. Available: ${KNOWN_TOKENS.map((k) => `{{${k}}}`).join(', ')}.`);
}

/** Outgoing mail and texts never carry an unfilled placeholder. */
export function assertFilled(...texts: (string | null | undefined)[]): void {
  const left = unfilled(...texts);
  if (left.length) throw new BadRequestException(`Fill in before sending: ${[...new Set(left.map(labelOf))].join(', ')} (${left.map((p) => p.raw).join(' ')}).`);
}
