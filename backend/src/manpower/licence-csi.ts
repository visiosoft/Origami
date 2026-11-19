/**
 * Nov 19 (Edward: "connect what CSI codes should be attached to the CSLB
 * licenses ... show up on each sub's profile. Note A, B, B-2 have special
 * notes"): a first draft of the CSI MasterFormat divisions each licence
 * covers, for the office to check and change in Settings → Licence
 * classifications. Only fills licences that have none yet.
 */
export const LICENCE_CSI: Record<string, string[]> = {
  'C-2': ['07', '09'], 'C-4': ['23'], 'C-5': ['06'], 'C-6': ['06', '12'], 'C-7': ['27', '28'], 'C-8': ['03'], 'C-9': ['09'], 'C-10': ['26'],
  'C-11': ['14'], 'C-12': ['31', '32'], 'C-13': ['32'], 'C-15': ['09'], 'C-16': ['21'], 'C-17': ['08'], 'C-20': ['23'], 'C-21': ['02'],
  'C-22': ['02'], 'C-23': ['05'], 'C-27': ['32'], 'C-28': ['08', '28'], 'C-29': ['04'], 'C-31': ['01'], 'C-32': ['32'], 'C-33': ['09'],
  'C-34': ['33'], 'C-35': ['09'], 'C-36': ['22'], 'C-38': ['23'], 'C-39': ['07'], 'C-42': ['33'], 'C-43': ['07', '23'], 'C-45': ['10'],
  'C-46': ['48'], 'C-47': ['13'], 'C-50': ['03'], 'C-51': ['05'], 'C-53': ['13'], 'C-54': ['09'], 'C-55': ['22'], 'C-57': ['33'],
  'C-60': ['05'], 'D-03': ['10'], 'D-04': ['11'], 'D-06': ['03'], 'D-10': ['09'], 'D-12': ['06'], 'D-16': ['08'], 'D-24': ['05'],
  'D-28': ['08'], 'D-29': ['09'], 'D-30': ['31'], 'D-34': ['11'], 'D-35': ['13'], 'D-38': ['09'], 'D-39': ['01'], 'D-41': ['07', '06'],
  'D-42': ['10'], 'D-49': ['32'], 'D-50': ['09'], 'D-52': ['12'], 'D-56': ['31'], 'D-62': ['23'], 'D-63': ['01'], 'D-65': ['07'],
};
/** General licences: no one division -- they may do any, with these limits. */
export const GENERAL_LICENCE_NOTE: Record<string, string> = {
  A: 'General engineering — fixed works (grading, paving, utilities, concrete for them); any division that work needs.',
  B: 'General building — any division, but at least two unrelated trades besides framing / carpentry; fire protection (C-16) and well drilling (C-57) need their own licence.',
  'B-2': 'Residential remodeling — existing homes only, three or more unrelated trades; no structural, plumbing, electrical or HVAC work on its own.',
};
export const B2_LICENCE = {
  id: 'SCT-B-2', code: 'B-2', name: 'Residential Remodeling', category: 'general_building', active: true, order: 2,
  description: 'A residential remodeling contractor makes improvements to, on, or in an existing residential wood frame structure, using at least three unrelated building trades or crafts for a single contract. The contractor may not take a prime contract for framing / carpentry alone, or for plumbing, electrical or HVAC work, unless it holds that licence too. (BPC §7057.5)',
};
