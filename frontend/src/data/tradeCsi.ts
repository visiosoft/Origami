/**
 * Nov 17 (Edward): show CSI (MasterFormat) divisions in the trade lists, so a
 * trade can be matched to the estimate's line items. Worked out from the
 * trade's name; trades with no clear division show none.
 */
const DIVISIONS: [RegExp, string][] = [
  [/asbestos|hazard|lead[- ]?related|demoli|wrecking/i, '02'],
  [/concrete|steel fixer|rebar|reinforc/i, '03'],
  [/mason/i, '04'],
  [/weld|structural steel|ornamental metal|steel(?! fixer)/i, '05'],
  [/carpent|framing|cabinet|millwork|wood/i, '06'],
  [/roof|insulat|waterproof|sheet metal(?!.*hvac)/i, '07'],
  [/glaz|window|door/i, '08'],
  [/paint|drywall|lath|plaster|tile|floor|acoustic|wall ?cover/i, '09'],
  [/sign/i, '10'],
  [/elevator/i, '14'],
  [/fire protection|sprinkler/i, '21'],
  [/plumb/i, '22'],
  [/hvac|warm[- ]air|refrigerat|heating|air condition/i, '23'],
  [/low voltage|communicat/i, '27'],
  [/electric|solar/i, '26'],
  [/alarm|security/i, '28'],
  [/earthwork|excavat|grading|paving|equipment operator|crane/i, '31'],
  [/landscap|fenc|swimming pool|pool|parking|irrigat/i, '32'],
  [/pipeline|sewer|well drill|septic|utility|water/i, '33'],
];

export function tradeCsi(name: string | null | undefined): string | null {
  const n = String(name || '');
  for (const [re, div] of DIVISIONS) if (re.test(n)) return div;
  return null;
}

/** "26 · Electrician", or the name alone when there is no division. */
export const tradeLabel = (name: string | null | undefined) => { const d = tradeCsi(name); return d ? `${d} · ${name}` : String(name || ''); };
