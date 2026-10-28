/**
 * When does a click on a tracked link count as the client opening it (Oct 27
 * backlog item 12)? Mail security scanners (Outlook Safe Links, Mimecast,
 * Proofpoint, Gmail's image proxy...) fetch every link in a message the moment
 * it arrives, so a hit within a minute of sending, or from a scanner, is not
 * the client. Pure, so the rules are tested on their own.
 */
export const SCANNER_WINDOW_MS = 60_000;

const SCANNER_UA = /bot\b|crawler|spider|preview|scanner|safelinks|microsoft office|ms-office|outlook|googleimageproxy|google-safety|barracuda|mimecast|proofpoint|symantec|trend ?micro|forcepoint|fireeye|cisco|zscaler|headless|python-requests|curl\/|wget|go-http-client|okhttp|java\//i;

export function isScannerHit(sentAt: string, now: Date, userAgent?: string | null): boolean {
  const ua = String(userAgent || '').trim();
  if (!ua || SCANNER_UA.test(ua)) return true;
  const sent = Date.parse(sentAt);
  return Number.isFinite(sent) && now.getTime() - sent < SCANNER_WINDOW_MS;
}

export interface OpenCounts {
  createdAt: string; firstOpenedAt?: string | null; lastOpenedAt?: string | null;
  opens?: number | null; scannerHits?: number | null; lastUserAgent?: string | null;
}

/** Count one hit on `link`, in place: an open, or a scanner. Returns which. */
export function recordHit(link: OpenCounts, now: Date, userAgent?: string | null): 'open' | 'scanner' {
  if (isScannerHit(link.createdAt, now, userAgent)) {
    link.scannerHits = (link.scannerHits || 0) + 1;
    return 'scanner';
  }
  const at = now.toISOString();
  if (!link.firstOpenedAt) link.firstOpenedAt = at;
  link.lastOpenedAt = at;
  link.opens = (link.opens || 0) + 1;
  link.lastUserAgent = String(userAgent || '').slice(0, 300) || null;
  return 'open';
}
