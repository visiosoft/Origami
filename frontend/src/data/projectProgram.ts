// The Project Program form, one wizard step per sheet of FORM - PROJECT PROGRAM.xlsx.
//
// The office fills this in early on every job: it is what the "Project Program
// DRAFT" step of the programme produces. The shape lives here rather than in
// the backend because it is the form's layout, not its data -- the API stores
// whatever this collects as a single JSON document per project.
//
// Spelling has been tidied where the workbook had obvious slips (HoweOwners,
// Accesory, Egnineer, Tile15nd, Insuance, Programing, Commerical Ti). The
// wording is otherwise the workbook's.

export type FieldKind = 'text' | 'number' | 'money' | 'date' | 'phone' | 'textarea' | 'select';

export interface PField {
  key: string;
  label: string;
  kind: FieldKind;
  /** Name of a list in PICKLISTS. */
  options?: string;
  /** Shown under the field: where the answer comes from. */
  hint?: string;
  /** Spans both columns. */
  wide?: boolean;
}

export interface PRow {
  key: string;
  label: string;
}

export interface PSection {
  key: string;
  title?: string;
  kind: 'fields' | 'table' | 'weeks' | 'list';
  /** kind: 'fields' */
  fields?: PField[];
  /** kind: 'table' | 'weeks' */
  rows?: PRow[];
  /** kind: 'list' -- free rows the office adds itself. */
  placeholder?: string;
  note?: string;
}

export interface PStep {
  key: string;
  name: string;
  blurb?: string;
  sections: PSection[];
  /** A running total shown at the foot of the step, over these section keys. */
  totalOf?: string[];
}

/* ------------------------------------------------------------------ *
 * Picklists -- the workbook's "PT" sheet.
 * ------------------------------------------------------------------ */

export const PICKLISTS: Record<string, string[]> = {
  projectType: [
    'Residential Interior Resurfacing - Kitchen Only w/o Structural',
    'Residential Interior Resurfacing - Bathroom Only w/o Structural',
    'Residential Interior Resurfacing - Kitchen and Bathroom Only w/o Structural',
    'Residential Interior Resurfacing - Whole House w/o Structural',
    'Residential Interior Remodel - w/ Structural',
    'Addition',
    'Addition and Renovation',
    'Addition and Renovation w/ Attached ADU',
    'Addition and Renovation w/ Detached ADU',
    'Addition ADU attached only',
    'Addition ADU detached only',
    'Ground Up Single Family Residence Raw Land',
    'Ground Up Single Family Residence and ADU Raw Land',
    'Ground Up Single Family Residence w/ Existing Structures',
    'Ground Up ADU Single Family Residence w/ Existing Structures',
    'Commercial TI',
    'Multi-Family',
    'Mixed Use',
    'Campus Development',
    'Other',
  ],
  stories: [
    '1 Story', '2 Stories', '3 Stories', '4 Stories', '5 Stories',
    '6–10 Stories', '11–20 Stories', '21–30 Stories', '31–50 Stories', '51+ Stories',
    'Unknown / TBD',
  ],
  constructionType: [
    'Type I-A', 'Type I-B', 'Type II-A', 'Type II-B', 'Type III-A', 'Type III-B',
    'Type IV-A', 'Type IV-B', 'Type IV-C', 'Type IV-HT', 'Type V-A', 'Type V-B',
    'Unknown / TBD',
  ],
  occupancy: [
    'Single-Family Residential', 'Multi-Family Residential', 'Mixed-Use', 'Retail',
    'Restaurant / Food Service', 'Office', 'Hotel / Hospitality', 'Educational / School',
    'Healthcare / Medical', 'Senior Living / Assisted Living', 'Industrial / Manufacturing',
    'Warehouse / Distribution', 'Parking Structure', 'Government / Civic', 'Religious / Worship',
    'Recreation / Fitness', 'Entertainment / Assembly', 'Laboratory / Research', 'Other',
    'Unknown / TBD',
  ],
  county: [
    'County of Alameda', 'County of Alpine', 'County of Amador', 'County of Butte',
    'County of Calaveras', 'County of Colusa', 'County of Contra Costa', 'County of Del Norte',
    'County of El Dorado', 'County of Fresno', 'County of Glenn', 'County of Humboldt',
    'County of Imperial', 'County of Inyo', 'County of Kern', 'County of Kings',
    'County of Lake', 'County of Lassen', 'County of Los Angeles', 'County of Madera',
    'County of Marin', 'County of Mariposa', 'County of Mendocino', 'County of Merced',
    'County of Modoc', 'County of Mono', 'County of Monterey', 'County of Napa',
    'County of Nevada', 'County of Orange', 'County of Placer', 'County of Plumas',
    'County of Riverside', 'County of Sacramento', 'County of San Benito',
    'County of San Bernardino', 'County of San Diego', 'County of San Francisco',
    'County of San Joaquin', 'County of San Luis Obispo', 'County of San Mateo',
    'County of Santa Barbara', 'County of Santa Clara', 'County of Santa Cruz',
    'County of Shasta', 'County of Sierra', 'County of Siskiyou', 'County of Solano',
    'County of Sonoma', 'County of Stanislaus', 'County of Sutter', 'County of Tehama',
    'County of Trinity', 'County of Tulare', 'County of Tuolumne', 'County of Ventura',
    'County of Yolo', 'County of Yuba',
  ],
  city: [
    'City of Alameda', 'City of Albany', 'City of American Canyon', 'City of Antioch',
    'City of Belmont', 'City of Belvedere', 'City of Benicia', 'City of Berkeley',
    'City of Brentwood', 'City of Brisbane', 'City of Burbank', 'City of Burlingame',
    'City of Calistoga', 'City of Campbell', 'City of Clayton', 'City of Cloverdale',
    'Town of Colma', 'City of Concord', 'Town of Corte Madera', 'City of Cotati',
    'City of Cupertino', 'City of Daly City', 'Town of Danville', 'City of Dixon',
    'City of Dublin', 'City of East Palo Alto', 'City of El Cerrito', 'City of Emeryville',
    'City of Fairfield', 'City of Foster City', 'City of Fremont', 'City of Gilroy',
    'City of Half Moon Bay', 'City of Hayward', 'City of Healdsburg', 'City of Hercules',
    'Town of Hillsborough', 'City of Lafayette', 'City of Larkspur', 'City of Livermore',
    'City of Los Altos', 'Town of Los Altos Hills', 'Town of Los Gatos', 'City of Martinez',
    'City of Menlo Park', 'City of Mill Valley', 'City of Millbrae', 'City of Milpitas',
    'City of Monte Sereno', 'Town of Moraga', 'City of Morgan Hill', 'City of Mountain View',
    'City of Napa', 'City of Newark', 'City of Novato', 'City of Oakland', 'City of Oakley',
    'City of Orinda', 'City of Pacifica', 'City of Palo Alto', 'City of Petaluma',
    'City of Piedmont', 'City of Pinole', 'City of Pittsburg', 'City of Pleasant Hill',
    'City of Pleasanton', 'Town of Portola Valley', 'City of Redwood City', 'City of Richmond',
    'City of Rio Vista', 'City of Rohnert Park', 'Town of Ross', 'City of San Anselmo',
    'City of San Bruno', 'City of San Carlos', 'City and County of San Francisco',
    'City of San José', 'City of San Leandro', 'City of San Mateo', 'City of San Pablo',
    'City of San Rafael', 'City of San Ramon', 'City of Santa Clara', 'City of Santa Rosa',
    'City of Saratoga', 'City of Sausalito', 'City of Sebastopol', 'City of Sonoma',
    'City of South San Francisco', 'City of St. Helena', 'City of Suisun City',
    'City of Sunnyvale', 'Town of Tiburon', 'City of Union City', 'City of Vacaville',
    'City of Vallejo', 'City of Walnut Creek', 'Town of Windsor', 'Town of Woodside',
    'Town of Yountville',
  ],
};

/** Where a district or purveyor is looked up. Repeated on a lot of fields. */
const GIS = 'Look up in the county GIS';

const f = (key: string, label: string, kind: FieldKind = 'text', extra: Partial<PField> = {}): PField =>
  ({ key, label, kind, ...extra });
const r = (key: string, label: string): PRow => ({ key, label });

/** The utility districts, asked on both the parcel and the zoning sheets. */
const DISTRICT_FIELDS: PField[] = [
  f('waterDistrict', 'Water District', 'text', { hint: GIS }),
  f('sanitaryDistrict', 'Sanitary District', 'text', { hint: GIS }),
  f('fireDistrict', 'Fire District', 'text', { hint: GIS }),
  f('schoolDistrict', 'School District', 'text', { hint: GIS }),
  f('electricPurveyor', 'Electric Purveyor', 'text', { hint: GIS }),
  f('gasPurveyor', 'Gas Purveyor', 'text', { hint: 'Look up in Zillow' }),
];

export const PROGRAM_STEPS: PStep[] = [
  {
    key: 'title',
    name: 'Title Page',
    blurb: 'The cover of the program document.',
    sections: [
      {
        key: 'main', kind: 'fields', fields: [
          f('projectTitle', 'Project Title'),
          f('projectScope', 'Project Scope', 'select', { options: 'projectType' }),
          f('projectLocation', 'Project Location', 'text', { hint: 'Carried over from the lead', wide: true }),
          f('date', 'Date', 'date', { hint: 'Defaults to the day it was started' }),
          f('contactName', 'Name of Contact'),
          f('phone', 'Phone Number', 'phone'),
          f('address', 'Address', 'text', { wide: true }),
        ],
      },
    ],
  },
  {
    key: 'parcel',
    name: 'Parcel Description',
    blurb: 'What is on the land today, and who has authority over it.',
    sections: [
      {
        key: 'main', kind: 'fields', fields: [
          f('projectName', 'Project Name'),
          f('projectLocation', 'Project Location', 'text', { hint: 'Carried over from the lead' }),
          f('apn', 'APN', 'text', { hint: GIS }),
          f('lotSize', 'Lot Size', 'number', { hint: GIS }),
          f('description', 'Description', 'textarea', { hint: GIS, wide: true }),
        ],
      },
      {
        key: 'authority', title: 'Jurisdiction of Authority', kind: 'fields', fields: [
          f('city', 'City', 'select', { options: 'city' }),
          f('county', 'County', 'select', { options: 'county' }),
          f('hoa', 'Homeowners Association', 'text', { wide: true }),
          ...DISTRICT_FIELDS,
        ],
      },
      {
        key: 'existing', title: 'Existing Structure', kind: 'fields', fields: [
          f('description', 'Description', 'textarea', { wide: true }),
          f('constructionType', 'Construction Type', 'select', { options: 'constructionType' }),
          f('originalBuild', 'Original Build', 'number', { hint: GIS }),
          f('accessoryStructures', 'Accessory Structures', 'text', { wide: true }),
        ],
      },
    ],
  },
  {
    key: 'zoning',
    name: 'Zoning Code Analysis',
    blurb: 'What the code allows on this parcel. Most of it comes from the city’s zoning code, using the APN.',
    sections: [
      {
        key: 'authority', title: 'Jurisdiction of Authority', kind: 'fields', fields: [
          f('county', 'County', 'select', { options: 'county', hint: GIS }),
          f('city', 'City', 'select', { options: 'city', hint: GIS }),
          f('hoa', 'Homeowners Association', 'text', { wide: true }),
          ...DISTRICT_FIELDS,
        ],
      },
      {
        key: 'analysis', title: 'Zoning Analysis', kind: 'fields', fields: [
          f('generalPlan', 'General Plan', 'text', { hint: 'City website, searched by APN' }),
          f('zoningDistrict', 'Zoning District', 'text', { hint: 'City website, searched by APN. e.g. R-1' }),
          f('precisePlan', 'Precise Plan'),
          f('historic', 'Historic'),
          f('neighborhood', 'Neighborhood', 'text', { wide: true }),
        ],
      },
      {
        key: 'envelope', title: 'Building Envelope Limitation',
        note: 'Set by the zoning district in the city’s zoning code.',
        kind: 'fields', fields: [
          f('lotCoverage', 'Lot Coverage Limitation'),
          f('floorArea', 'Floor Area Limitation'),
          f('setbackFront', 'Setback — Front'),
          f('setbackRear', 'Setback — Rear'),
          f('setbackSide', 'Setback — Side'),
          f('setbackStreetSide', 'Setback — Street Side'),
          f('height', 'Height'),
          f('daylightPlane', 'Daylight Plane'),
          f('parking', 'Parking', 'text', { wide: true }),
        ],
      },
      {
        key: 'adu', title: 'Accessory Dwelling Unit Limitation',
        note: 'Set by the zoning district in the city’s zoning code.',
        kind: 'fields', fields: [
          f('floorArea', 'Floor Area Limitation'),
          f('setbackFront', 'Setback — Front', 'number'),
          f('setbackRear', 'Setback — Rear', 'number'),
          f('setbackSide', 'Setback — Side', 'number'),
          f('height', 'Height', 'number'),
        ],
      },
    ],
  },
  {
    key: 'goals',
    name: 'Project Goals',
    blurb: 'What the client wants out of the building.',
    sections: [
      {
        key: 'primary', title: 'Primary Building Goals', kind: 'fields', fields: [
          f('facadePlanning', 'Façade Planning', 'textarea', { wide: true }),
          f('area', 'Area'),
          f('stories', 'Height and/or Stories', 'select', { options: 'stories' }),
          f('constructionType', 'Type of Construction', 'select', { options: 'constructionType' }),
          f('occupancy', 'Occupancy / Use', 'select', { options: 'occupancy' }),
          f('lotCoverage', 'Lot Coverage Limitation'),
          f('floorArea', 'Floor Area Limitation'),
        ],
      },
      { key: 'siteWork', title: 'Site Work and Landscaping', kind: 'list', placeholder: 'Add a site work or landscaping goal…' },
      { key: 'interior', title: 'Interior Description', kind: 'list', placeholder: 'Add an interior goal…' },
    ],
  },
  {
    key: 'budget',
    name: 'Project Budget Projection',
    blurb: 'The whole job at a glance. The detail behind the AEC and municipal lines is on their own steps.',
    totalOf: ['soft', 'hard'],
    sections: [
      { key: 'opening', kind: 'table', rows: [r('titleInsurance', 'Title Insurance')] },
      {
        key: 'soft', title: 'Soft Cost', kind: 'table', rows: [
          r('aecDesignTeam', 'AEC Design Team'),
          r('municipalFees', 'Municipal Fees'),
        ],
      },
      {
        key: 'hard', title: 'Hard Costs', kind: 'table', rows: [
          r('demolition', 'Demolition'),
          r('siteImprovements', 'Site Improvements'),
          r('construction', 'Construction'),
          r('interiorAllowances', 'Interior Allowances'),
        ],
      },
      { key: 'contingency', title: 'Contingency', kind: 'table', rows: [r('contingency', 'Contingency')] },
    ],
  },
  {
    key: 'milestones',
    name: 'Milestone Schedule',
    blurb: 'How long each stage runs, in weeks.',
    sections: [
      {
        key: 'preconstruction', title: 'Pre-Construction: Design, Engineering, and Municipal Review', kind: 'weeks', rows: [
          r('schematicDesign', 'Schematic Design'),
          r('designDevelopment', 'Design Development'),
          r('planningReview', 'Municipal Planning Review'),
          r('constructionDocuments', 'Construction Documents & Engineering'),
          r('buildingPermitReview', 'Municipal Building Permit Review'),
          r('permitIssuance', 'Permit Issuance'),
        ],
      },
      {
        key: 'construction', title: 'Construction', kind: 'weeks', rows: [
          r('mobilization', 'Mobilization'),
          r('demolition', 'Demolition, Shoring and Protection'),
          r('foundation', 'Foundation and Earthwork'),
          r('framing', 'Structural Framing'),
          r('roofing', 'Roofing and Penetrations'),
          r('exterior', 'Exterior Fenestrations and Siding'),
          r('plumbingRough', 'Plumbing Rough-In'),
          r('mechanicalRough', 'Mechanical (HVAC) Rough-In'),
          r('electricalRough', 'Electrical Rough-In'),
          r('drywall', 'Insulation and Drywall'),
          r('painting', 'Painting and Coatings'),
          r('millwork', 'Cabinetry, Countertops, Tile and Millwork'),
          r('flooring', 'Flooring, Fixtures and Equipment'),
        ],
      },
    ],
  },
  {
    key: 'aec',
    name: 'AEC Team',
    blurb: 'Every consultant the job needs, grouped by the phase that brings them on.',
    totalOf: ['programming', 'designDevelopment', 'constructionDocuments', 'constructionAdmin'],
    sections: [
      {
        key: 'programming', title: 'Programming & Schematic Design', kind: 'table', rows: [
          r('titleInsurance', 'Title Insurance'),
          r('landSurveyor', 'Land Surveyor'),
          r('hazmat', 'HazMat Inspection'),
          r('architect', 'Architect'),
          r('arborist', 'Arborist'),
          r('historian', 'Historian'),
        ],
      },
      {
        key: 'designDevelopment', title: 'Design Development & Municipal Planning Review', kind: 'table', rows: [
          r('geotech', 'Geotech Engineer'),
          r('civil', 'Civil Engineer'),
          r('landscape', 'Landscape Architect'),
          r('geologist', 'Geologist'),
        ],
      },
      {
        key: 'constructionDocuments', title: 'Construction Documents & Engineering', kind: 'table', rows: [
          r('structural', 'Structural Engineer'),
          r('mechanical', 'Mechanical Engineer'),
          r('plumbing', 'Plumbing Engineer'),
          r('electrical', 'Electrical Engineer'),
          r('energyCompliance', 'Energy Compliance Analyst'),
          r('fireSuppression', 'Fire Suppression Engineer'),
        ],
      },
      {
        key: 'constructionAdmin', title: 'Construction Administration', kind: 'table', rows: [
          r('interiorDesigner', 'Interior Designer'),
          r('avSecurity', 'AV & Security Consultant'),
          r('energyCertification', 'Energy Consultant Certification'),
        ],
      },
    ],
  },
  {
    key: 'fees',
    name: 'Municipal Fee Schedule',
    blurb: 'What the jurisdiction charges, by department.',
    totalOf: ['planning', 'permitReview', 'development'],
    sections: [
      {
        key: 'planning', title: 'Planning', kind: 'table', rows: [
          r('preApplication', 'Pre-Application'),
          r('designReview', 'Design Review'),
          r('usePermit', 'Use Permit'),
          r('planningCommission', 'Planning Commission'),
        ],
      },
      {
        key: 'permitReview', title: 'Building Permit Review', kind: 'table', rows: [
          r('buildingDepartment', 'Building Department'),
          r('transportation', 'Transportation'),
          r('stormWater', 'Storm Water'),
          r('fireDistrictReview', 'Fire District Review'),
        ],
      },
      {
        key: 'development', title: 'Development Fees', kind: 'table', rows: [
          r('parkDedication', 'Park Dedication Fee'),
          r('trafficImpact', 'Traffic Impact Fee'),
          r('sewerImpact', 'Sewer Impact Fee'),
          r('misc', 'Misc'),
        ],
      },
    ],
  },
  {
    key: 'construction',
    name: 'Construction Budget Projection',
    blurb: 'The build itself, by trade.',
    totalOf: ['sitework', 'shell', 'systems', 'finishes'],
    sections: [
      {
        key: 'sitework', title: 'Site Work', kind: 'table', rows: [
          r('demolition', 'Demolition, Shoring and Protection'),
          r('earthwork', 'Foundation and Earthwork'),
          r('siteImprovements', 'Site Improvements and Landscaping'),
          r('utilities', 'Utilities and Service Connections'),
        ],
      },
      {
        key: 'shell', title: 'Shell', kind: 'table', rows: [
          r('framing', 'Structural Framing'),
          r('roofing', 'Roofing and Penetrations'),
          r('exterior', 'Exterior Fenestrations and Siding'),
          r('insulation', 'Insulation and Drywall'),
        ],
      },
      {
        key: 'systems', title: 'Systems', kind: 'table', rows: [
          r('plumbing', 'Plumbing'),
          r('mechanical', 'Mechanical (HVAC)'),
          r('electrical', 'Electrical'),
          r('fireSuppression', 'Fire Suppression'),
        ],
      },
      {
        key: 'finishes', title: 'Finishes', kind: 'table', rows: [
          r('painting', 'Painting and Coatings'),
          r('millwork', 'Cabinetry, Countertops, Tile and Millwork'),
          r('flooring', 'Flooring, Fixtures and Equipment'),
          r('appliances', 'Appliances and Equipment'),
        ],
      },
    ],
  },
];


/* ------------------------------------------------------------------ *
 * The programme tasks this form answers.
 *
 * "Project Programming" on the Phase Board and "Project Program" here are the
 * same piece of work seen twice: the phase is the checklist of what to do, the
 * form is what doing it produces. Keyed on the template task id, which is the
 * stable half of a task's id (T-<project>-<template id>), so renaming a task
 * in the template does not break the link.
 * ------------------------------------------------------------------ */

export const TASK_STEP: Record<string, string> = {
  'pp-03': 'title',       // Project Program DRAFT -- the whole document
  'pp-04': 'zoning',      // Municipality: Zoning Analysis, Permit History, Review Procedure
  'pp-05': 'aec',         // AEC Team outline
  'pp-13': 'budget',      // Project Budget and Milestone Schedule
  'pp-06': 'construction', // Client Review -- where it is sent from
};

/** The step a phase task opens, or null if it is not part of this form. */
export function stepForTaskId(taskId?: string): string | null {
  if (!taskId) return null;
  const m = /^T-\d+-(.+)$/.exec(taskId);
  return (m && TASK_STEP[m[1]]) || null;
}

/** What the API stores: one bag of answers per step key. */
export type ProgramData = Record<string, Record<string, any>>;

/** Money cells arrive as strings; this is what adds them up. */
export function num(v: any): number {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function money(n: number): string {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/** A step's budget/actual totals, over the sections named in totalOf. */
export function stepTotals(step: PStep, values: Record<string, any> = {}) {
  let budget = 0;
  let actual = 0;
  for (const section of step.sections) {
    if (section.kind !== 'table') continue;
    if (step.totalOf && !step.totalOf.includes(section.key)) continue;
    for (const row of section.rows || []) {
      const cell = values[row.key] || {};
      budget += num(cell.budget);
      actual += num(cell.actual);
    }
  }
  return { budget, actual };
}

/** How much of a step has been answered, for the progress rail. */
export function stepFilled(step: PStep, values: Record<string, any> = {}) {
  let total = 0;
  let done = 0;
  for (const section of step.sections) {
    if (section.kind === 'fields') {
      for (const field of section.fields || []) {
        total += 1;
        if (String(values[`${section.key}.${field.key}`] ?? '').trim()) done += 1;
      }
    } else if (section.kind === 'table' || section.kind === 'weeks') {
      for (const row of section.rows || []) {
        total += 1;
        const cell = values[row.key];
        const filled = section.kind === 'weeks'
          ? String(cell ?? '').trim()
          : String(cell?.budget ?? '').trim() || String(cell?.actual ?? '').trim();
        if (filled) done += 1;
      }
    } else if (section.kind === 'list') {
      total += 1;
      if ((values[section.key] || []).some((x: string) => String(x || '').trim())) done += 1;
    }
  }
  return { total, done };
}
