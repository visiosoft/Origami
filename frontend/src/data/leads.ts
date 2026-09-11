import { PROJECT_TYPE_OPTIONS, CONTRACT_TYPES } from './projectTypes';
import { CITIES_BY_COUNTY, COUNTY_BY_CITY } from './californiaCounties';

export interface Lead {
    id: string;
    leadName: string;
    firstName: string;
    lastName: string;
    goByName: string;
    pronouns: string;
    namePronunciation: string;
    phone: string;
    email: string;
    primaryPointOfContact: string;
    secondPointOfContact: string;
    nameOfSecondContact: string;
    phoneOfSecondContact: string;
    emailOfSecondContact: string;
    relationshipOfSecondContact: string;
    preferredContactMethodOfSecondContact: string;
    pronounsOfSecondContact: string;
    contacts?: unknown[];
    decisionMakers: string;
    preferredContactMethod: string;
    preferredContactMatrix?: Record<string, string>;
    leadSource: string;
    leadSourceReferrerName: string;
    leadSourceReferrerPhone: string;
    otherDetails?: Record<string, string>;
    leadSourceEventDetail: string;
    projectStreetAddress: string;
    projectStreetName: string;
    projectAddress2: string;
    occupancyStatus: string;
    projectCity: string;
    projectZipCode: string;
    countyLocation: string;
    hasHOA: string;
    propertyType: string;
    potentialProjectType: string;
    contractType: string;
    homeworkCompleted: string[];
    projectVision: string;
    reasonForProject: string;
    budgetPosition: string;
    fundingStatus: string;
    desiredStart: string;
    expectedDuration: string;
    expectedLengthOfOwnership: string;
    clientPersonality: string;
    createdAt: string;
}

export const LEAD_DROPDOWN_OPTIONS = {
    pronouns: ['She / Her', 'He / Him', 'They / Them', 'She / They', 'He / They', 'Prefer not to say', 'Other'],
    primaryPointOfContact: ['Yes – Primary Contact', 'No – Not Primary Contact'],
    secondPointOfContact: ['Yes', 'No'],
    relationshipOfSecondContact: ['Spouse', 'Partner', 'Business Partner', 'Family Member', 'Tenant', 'Property Manager', 'Architect', 'Designer', 'Contractor', 'Attorney', 'Other'],
    decisionMakers: ['Lead Only', 'Lead + Spouse', 'Lead + Partner', 'Lead + Business Partner', 'Lead + Family Member', 'Committee / Board', 'Other'],
    preferredContactMethod: ['Phone Call', 'Text Message', 'Email', 'Video Call', 'In Person', 'No Preference'],
    leadSource: ['Website', 'Referral from Client', 'Referral from Networking', 'Referral Family and Friend', 'Google Search', 'Social Media', 'Drive-by', 'Event', 'Repeat Client', 'Other'],
    // Derived from californiaCounties.ts rather than hand-maintained here --
    // that file and this one used to be two separate lists that could
    // silently drift apart. They were identical when checked (479 cities, 58
    // counties either way), but deriving from one source is what keeps them
    // that way going forward.
    projectCity: Object.keys(COUNTY_BY_CITY).sort(),
    countyLocation: Object.keys(CITIES_BY_COUNTY).sort().map((c) => `County of ${c}`),
    occupancyStatus: ['Owner - occupies the property', 'Owner - does not occupy', 'Tenant / renting the space', 'Prospective buyer', 'Property manager', 'Owner’s representative', 'Other'],
    propertyType: ['Single Family Residence', 'Multi-Family Residence', 'Commercial', 'Commercial Tenant Improvement (TI)', 'Mixed Use', 'Campus Development', 'Other'],
    potentialProjectType: PROJECT_TYPE_OPTIONS,
    contractType: CONTRACT_TYPES.map((c) => `${c.label} (${c.code})`),
    homeworkCompleted: ['As-Builts', 'Survey', 'Soils / Geotechnical Report', 'Hazardous Materials Report', 'Seismic Report', 'Inspection Files', 'Disclosures', 'Renderings', 'Lease', 'City Contact / Research', 'Permit Set', 'Finish Selections', 'Inspiration Images', 'Sketches'],
    reasonForProject: ['Rental', 'Retirement', 'Growing Family', 'Selling Asset', 'Forever Home', '5-Year Home', 'Developer Sale', 'Refresh Home', 'Other'],
    budgetPosition: ['Has Budget – Design to Budget', 'Design Dream First', 'Exploring', 'Unknown'],
    fundingStatus: ['Funds Ready', 'Partial – Needs Help', 'Possible / Uncertain', 'Needs Financing', 'No'],
    desiredStart: ['Ready to Start', 'Ready in 1 Month', 'Ready in 3 Months', 'Ready in 6 Months', 'Ready in 12 Months'],
    expectedDuration: ['1–2 Months', '5–6 Months', '6–8 Months', '12 Months', '18+ Months', 'Doesn\u2019t Matter', 'Unknown'],
    expectedLengthOfOwnership: ['Up to 5 Years', '5–10 Years', 'Forever Home', 'Rental', 'Selling', 'Unknown', 'Doesn\u2019t Matter'],
    clientPersonality: ['Analytical / Detail-Oriented', 'Driver / Decisive', 'Expressive / Visionary', 'Amiable / Collaborative', 'Skeptical / Cautious', 'Overwhelmed / Needs Guidance', 'Hands-Off / Delegator', 'Not Yet Determined'],
};

export const LEADS: Lead[] = [
    {
        id: 'LD-001',
        leadName: 'Maria Santos',
        firstName: 'Maria',
        lastName: 'Santos',
        goByName: '',
        pronouns: '',
        namePronunciation: 'Mah-REE-ah SAN-tohs',
        phone: '(310) 555-0147',
        email: 'maria.santos@gmail.com',
        primaryPointOfContact: 'Yes – Primary Contact',
        secondPointOfContact: 'Yes',
        nameOfSecondContact: 'Carlos Santos',
        phoneOfSecondContact: '(310) 555-0148',
        emailOfSecondContact: 'carlos.santos@gmail.com',
        relationshipOfSecondContact: 'Spouse / Partner',
        preferredContactMethodOfSecondContact: '',
        pronounsOfSecondContact: '',
        decisionMakers: 'Lead + Spouse/Partner',
        preferredContactMethod: 'Phone Call',
        leadSource: 'Referral – Past Client',
        leadSourceReferrerName: '',
        leadSourceReferrerPhone: '',
        leadSourceEventDetail: '',
        projectStreetAddress: '1247',
        projectStreetName: 'Pacific Coast Highway',
        projectAddress2: '',
        occupancyStatus: '',
        projectCity: 'Malibu',
        projectZipCode: '90265',
        countyLocation: 'Los Angeles',
        hasHOA: 'No',
        propertyType: 'Single Family Residence',
        potentialProjectType: 'Full Home Remodel',
        contractType: '',
        homeworkCompleted: ['Architectural Plans', 'Budget Established', 'Financing Secured'],
        projectVision: 'Complete remodel of 3,200 sq ft coastal home. Open floor plan, new kitchen with ocean views, master suite expansion, outdoor living space with pool. Maintain mid-century character.',
        reasonForProject: 'Lifestyle Upgrade',
        budgetPosition: 'Has a Defined Budget',
        fundingStatus: 'Cash / Savings Ready',
        desiredStart: 'Within 1 Month',
        expectedDuration: '6–12 Months',
        expectedLengthOfOwnership: '20+ Years / Forever Home',
        clientPersonality: 'Expressive / Visionary',
        createdAt: '2024-07-20',
    },
    {
        id: 'LD-002',
        leadName: 'James Chen',
        firstName: 'James',
        lastName: 'Chen',
        goByName: '',
        pronouns: '',
        namePronunciation: '',
        phone: '(415) 555-0293',
        email: 'jchen@techstartup.io',
        primaryPointOfContact: 'Yes – Primary Contact',
        secondPointOfContact: 'No',
        nameOfSecondContact: '',
        phoneOfSecondContact: '',
        emailOfSecondContact: '',
        relationshipOfSecondContact: '',
        preferredContactMethodOfSecondContact: '',
        pronounsOfSecondContact: '',
        decisionMakers: 'Lead Only',
        preferredContactMethod: 'Email',
        leadSource: 'Google Search',
        leadSourceReferrerName: '',
        leadSourceReferrerPhone: '',
        leadSourceEventDetail: '',
        projectStreetAddress: '550',
        projectStreetName: 'Market Street',
        projectAddress2: '',
        occupancyStatus: '',
        projectCity: 'San Francisco',
        projectZipCode: '94105',
        countyLocation: 'San Francisco',
        hasHOA: 'No',
        propertyType: 'Commercial – Office',
        potentialProjectType: 'Commercial Tenant Improvement',
        contractType: '',
        homeworkCompleted: ['Budget Established'],
        projectVision: 'Modern tech office buildout for 40-person startup. Open collaboration spaces, private phone booths, server room, and kitchen/lounge area.',
        reasonForProject: 'Business Expansion',
        budgetPosition: 'Has a Range in Mind',
        fundingStatus: 'Cash / Savings Ready',
        desiredStart: 'Immediately / ASAP',
        expectedDuration: '1–3 Months',
        expectedLengthOfOwnership: '2–5 Years',
        clientPersonality: 'Driver / Decisive',
        createdAt: '2024-07-22',
    },
    {
        id: 'LD-003',
        leadName: 'Patricia Okonkwo',
        firstName: 'Patricia',
        lastName: 'Okonkwo',
        goByName: '',
        pronouns: '',
        namePronunciation: 'Pah-TREE-sha Oh-KOHN-kwoh',
        phone: '(818) 555-0361',
        email: 'patricia.o@outlook.com',
        primaryPointOfContact: 'Yes – Primary Contact',
        secondPointOfContact: 'Yes',
        nameOfSecondContact: 'David Okonkwo',
        phoneOfSecondContact: '(818) 555-0362',
        emailOfSecondContact: 'david.okonkwo@outlook.com',
        relationshipOfSecondContact: 'Spouse / Partner',
        preferredContactMethodOfSecondContact: '',
        pronounsOfSecondContact: '',
        decisionMakers: 'Lead + Spouse/Partner',
        preferredContactMethod: 'Text Message',
        leadSource: 'Houzz',
        leadSourceReferrerName: '',
        leadSourceReferrerPhone: '',
        leadSourceEventDetail: '',
        projectStreetAddress: '4821',
        projectStreetName: 'Ventura Boulevard',
        projectAddress2: '',
        occupancyStatus: '',
        projectCity: 'Calabasas',
        projectZipCode: '91302',
        countyLocation: 'Los Angeles',
        hasHOA: 'No',
        propertyType: 'Single Family Residence',
        potentialProjectType: 'Addition (ADU / Room)',
        contractType: '',
        homeworkCompleted: ['Design Concept / Mood Board', 'HOA Approval'],
        projectVision: 'Adding a detached ADU (800 sq ft) for aging parents. Single story, accessible design, small kitchen, one bedroom, one bathroom, covered patio connecting to main house.',
        reasonForProject: 'Aging in Place / Accessibility',
        budgetPosition: 'Has a Range in Mind',
        fundingStatus: 'Home Equity Loan / HELOC Approved',
        desiredStart: '1–3 Months',
        expectedDuration: '3–6 Months',
        expectedLengthOfOwnership: '10–20 Years',
        clientPersonality: 'Amiable / Collaborative',
        createdAt: '2024-07-23',
    },
];

/**
 * `leadName` is the display name used across deals, projects and letters. The
 * intake form collects the parts, so it is composed rather than typed.
 */
export const composeLeadName = (firstName: string, lastName: string, fallback = '') => {
    const composed = [firstName, lastName].map((p) => (p || '').trim()).filter(Boolean).join(' ');
    return composed || fallback.trim();
};

/**
 * Split an existing single-field name so a lead captured before the form was
 * separated can still be edited. Everything after the first word is the last
 * name, which keeps compound surnames ("van der Berg") intact.
 */
export const splitLeadName = (leadName: string) => {
    const parts = (leadName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

/** How to address them in conversation: the go-by name if they gave one. */
export const preferredName = (lead: { goByName?: string; firstName?: string; leadName?: string }) =>
    (lead.goByName || '').trim() || (lead.firstName || '').trim() || (lead.leadName || '').trim();

/**
 * Options for a select, guaranteeing the value currently stored is offered.
 *
 * Needed where an option list has changed -- a lead saved as 'Spouse / Partner'
 * before Spouse and Partner were separated would otherwise render blank and be
 * silently overwritten on the next save.
 */
export const optionsWith = (options: readonly string[], value?: string) =>
    value && !options.includes(value) ? [value, ...options] : [...options];

/**
 * A referral needs to record who made it; an event or networking source needs
 * to record where. Both are matched on the option text, so a legacy value from
 * the older source list ("Referral - Past Client") still counts.
 */
export const isReferralSource = (source?: string) => /referral/i.test(source || '');
export const isEventSource = (source?: string) => /event|networking|show/i.test(source || '');

/**
 * Whether a dropdown offers "Other", and therefore needs somewhere to say what
 * the other thing actually is. Selecting "Other" and moving on records nothing.
 */
export const offersOther = (optKey?: keyof typeof LEAD_DROPDOWN_OPTIONS) =>
    !!optKey && (LEAD_DROPDOWN_OPTIONS[optKey] as readonly string[]).some((o) => /^other/i.test(o));

/** Whether a stored answer is the "Other" one, including the coded project type. */
export const isOtherValue = (value?: string) => /^other/i.test((value || '').trim());

/** Every way a person might be reached, as a row on the contact-method matrix. */
export const CONTACT_METHODS = [
    'No Preference',
    'Cell Phone Call',
    'Cell Phone Text',
    'House Phone Call',
    'Office Phone',
    'Primary Email',
    'Secondary Email',
    'Video Call',
    'In-Person',
];

export const CONTACT_PREFERENCES = ['Primary', 'Secondary', 'No'] as const;
export type ContactPreference = typeof CONTACT_PREFERENCES[number];

/**
 * The single headline answer, derived from the matrix.
 *
 * Kept so everything already reading preferredContactMethod -- cards, the
 * summary, the letter -- kept working when the matrix replaced the dropdown.
 */
export function primaryContactMethod(matrix?: Record<string, string>): string {
    if (!matrix) return '';
    const primary = CONTACT_METHODS.filter((m) => matrix[m] === 'Primary');
    if (primary.length) return primary.join(', ');
    const secondary = CONTACT_METHODS.filter((m) => matrix[m] === 'Secondary');
    return secondary.length ? secondary.join(', ') : '';
}

/** A readable summary of the whole matrix, for the read-only views. */
export function contactMatrixSummary(matrix?: Record<string, string>): string {
    if (!matrix) return '';
    const parts = CONTACT_PREFERENCES.map((pref) => {
        const methods = CONTACT_METHODS.filter((m) => matrix[m] === pref);
        return methods.length ? `${pref}: ${methods.join(', ')}` : '';
    }).filter(Boolean);
    return parts.join(' · ');
}

/**
 * What the free-text box beside Lead Source is asking for.
 *
 * Every source deserves a note -- which page of the website, what they
 * searched, whose van they saw -- not just referrals.
 */
export function sourceDetailLabel(source?: string): { label: string; hint: string; ph: string } {
    if (isReferralSource(source)) {
        return { label: 'Referred By', hint: 'Who made the referral.', ph: 'Name of the person referring' };
    }
    if (isEventSource(source)) {
        return { label: 'Where It Was', hint: 'Which event, or where the networking happened.', ph: 'Event or networking group' };
    }
    return { label: 'Source Details', hint: 'Anything worth knowing about how they found us.', ph: 'e.g. which page, what they searched, who mentioned us' };
}
