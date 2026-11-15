/**
 * GC / sub prequalification (Nov 13 sync), as the server applies it
 * (backend/src/manpower/prequal.ts, prequalBlock): only approved companies
 * with a current licence and insurance can be invited to bid.
 */
export interface PrequalFacts {
  prequalStatus?: string | null;
  licenseNumber?: string | null; licenseExpiry?: string | null;
  insuranceProvider?: string | null; insuranceExpiry?: string | null;
}

const day = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export function prequalBlock(c: PrequalFacts, on = new Date().toISOString().slice(0, 10)): string | null {
  if (c.prequalStatus === 'rejected') return 'Prequalification was turned down';
  if (c.prequalStatus !== 'approved') return c.prequalStatus === 'pending' ? 'Prequalification waiting for review' : 'Not prequalified yet';
  if (!String(c.licenseNumber || '').trim()) return 'No licence on file';
  if (!c.licenseExpiry) return 'No licence expiry date';
  if (c.licenseExpiry.slice(0, 10) < on) return `Licence expired ${day(c.licenseExpiry)}`;
  if (!String(c.insuranceProvider || '').trim()) return 'No insurance on file';
  if (!c.insuranceExpiry) return 'No insurance expiry date';
  if (c.insuranceExpiry.slice(0, 10) < on) return `Insurance expired ${day(c.insuranceExpiry)}`;
  return null;
}

export const PREQUAL_LABEL: Record<string, string> = { pending: 'Waiting for review', approved: 'Prequalified', rejected: 'Turned down' };
