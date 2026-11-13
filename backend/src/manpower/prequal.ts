/**
 * GC / sub prequalification (Nov 13 sync): before a sub can be asked to bid,
 * staff approve them and their licence and insurance are on file and current.
 */
export type PrequalStatus = 'pending' | 'approved' | 'rejected';

export interface PrequalFacts {
  prequalStatus?: string | null;
  licenseNumber?: string | null; licenseExpiry?: string | null;
  insuranceProvider?: string | null; insuranceExpiry?: string | null;
}

const day = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Why this company can't be invited to bid (null = it can). */
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

/** What the sub (or staff) fills in on the prequal form. */
export const PREQUAL_FIELDS = ['licenseNumber', 'licenseExpiry', 'insuranceProvider', 'insurancePolicyNumber', 'insuranceExpiry'] as const;
export interface PrequalAnswers { trades?: string; yearsInBusiness?: number | null; references?: string; w9OnFile?: boolean; notes?: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function cleanPrequal(dto: any): { fields: Partial<Record<(typeof PREQUAL_FIELDS)[number], string>>; answers: PrequalAnswers } {
  const fields: Partial<Record<(typeof PREQUAL_FIELDS)[number], string>> = {};
  for (const k of PREQUAL_FIELDS) {
    if (dto?.[k] === undefined) continue;
    const v = String(dto[k] ?? '').trim().slice(0, 200);
    if (k.endsWith('Expiry') && v && !DATE.test(v)) throw new Error(`${k === 'licenseExpiry' ? 'Licence' : 'Insurance'} expiry must be a date.`);
    fields[k] = v;
  }
  const years = dto?.yearsInBusiness === '' || dto?.yearsInBusiness == null ? null : Math.max(0, Math.min(200, Math.round(Number(dto.yearsInBusiness) || 0)));
  return {
    fields,
    answers: {
      trades: String(dto?.trades || '').trim().slice(0, 500) || undefined,
      yearsInBusiness: years,
      references: String(dto?.references || '').trim().slice(0, 4000) || undefined,
      w9OnFile: !!dto?.w9OnFile,
      notes: String(dto?.notes || '').trim().slice(0, 4000) || undefined,
    },
  };
}
