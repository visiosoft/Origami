/**
 * The project's street address as one line -- "1311 Countryside Ct, Unit B,
 * Milpitas, 95035" -- from the parts the lead intake collects. Empty when no
 * street is known (a city or county alone isn't an address to drive to).
 */
export function leadStreetAddress(l?: {
  projectStreetAddress?: string | null; projectStreetName?: string | null; projectAddress2?: string | null;
  projectCity?: string | null; projectZipCode?: string | null;
} | null): string {
  if (!l) return '';
  const clean = (v?: string | null) => (v || '').trim();
  const number = clean(l.projectStreetAddress);
  const street = clean(l.projectStreetName);
  // Some leads have the whole street in the first field already.
  const line1 = number && street && !number.toLowerCase().includes(street.toLowerCase()) ? `${number} ${street}` : number || street;
  if (!line1) return '';
  return [line1, clean(l.projectAddress2), clean(l.projectCity), clean(l.projectZipCode)].filter(Boolean).join(', ');
}
