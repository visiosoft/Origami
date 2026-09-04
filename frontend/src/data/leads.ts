import { PROJECT_TYPE_OPTIONS, CONTRACT_TYPES } from './projectTypes';

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
    projectCity: ['Adelanto', 'Agoura Hills', 'Alameda', 'Albany', 'Alhambra', 'Aliso Viejo', 'Alturas', 'Amador City', 'American Canyon', 'Anaheim', 'Anderson', 'Angels Camp', 'Antioch', 'Apple Valley', 'Arcadia', 'Arcata', 'Arroyo Grande', 'Artesia', 'Arvin', 'Atascadero', 'Atherton', 'Atwater', 'Auburn', 'Avalon', 'Avenal', 'Azusa', 'Bakersfield', 'Baldwin Park', 'Banning', 'Barstow', 'Beaumont', 'Bell', 'Bell Gardens', 'Bellflower', 'Belmont', 'Belvedere', 'Benicia', 'Berkeley', 'Beverly Hills', 'Big Bear Lake', 'Biggs', 'Bishop', 'Blue Lake', 'Blythe', 'Bradbury', 'Brawley', 'Brea', 'Brentwood', 'Brisbane', 'Buellton', 'Buena Park', 'Burbank', 'Burlingame', 'Calabasas', 'Calexico', 'California City', 'Calimesa', 'Calipatria', 'Calistoga', 'Camarillo', 'Campbell', 'Canyon Lake', 'Capitola', 'Carlsbad', 'Carmel-by-the-Sea', 'Carpinteria', 'Carson', 'Cathedral City', 'Ceres', 'Cerritos', 'Chico', 'Chino', 'Chino Hills', 'Chowchilla', 'Chula Vista', 'Citrus Heights', 'Claremont', 'Clayton', 'Clearlake', 'Cloverdale', 'Clovis', 'Coachella', 'Coalinga', 'Colfax', 'Colma', 'Colton', 'Colusa', 'Commerce', 'Compton', 'Concord', 'Corcoran', 'Corning', 'Corona', 'Coronado', 'Corte Madera', 'Costa Mesa', 'Cotati', 'Covina', 'Crescent City', 'Cudahy', 'Culver City', 'Cupertino', 'Cypress', 'Daly City', 'Dana Point', 'Danville', 'Davis', 'Del Mar', 'Del Rey Oaks', 'Delano', 'Desert Hot Springs', 'Diamond Bar', 'Dinuba', 'Dixon', 'Dorris', 'Dos Palos', 'Downey', 'Duarte', 'Dublin', 'Dunsmuir', 'East Palo Alto', 'Eastvale', 'El Cajon', 'El Centro', 'El Cerrito', 'El Monte', 'El Segundo', 'Elk Grove', 'Emeryville', 'Encinitas', 'Escalon', 'Escondido', 'Etna', 'Eureka', 'Exeter', 'Fairfax', 'Fairfield', 'Farmersville', 'Ferndale', 'Fillmore', 'Firebaugh', 'Folsom', 'Fontana', 'Fort Bragg', 'Fort Jones', 'Fortuna', 'Foster City', 'Fountain Valley', 'Fowler', 'Fremont', 'Fresno', 'Fullerton', 'Galt', 'Garden Grove', 'Gardena', 'Gilroy', 'Glendale', 'Glendora', 'Goleta', 'Gonzales', 'Grand Terrace', 'Grass Valley', 'Greenfield', 'Gridley', 'Grover Beach', 'Guadalupe', 'Gustine', 'Half Moon Bay', 'Hanford', 'Hawaiian Gardens', 'Hawthorne', 'Hayward', 'Healdsburg', 'Hemet', 'Hercules', 'Hermosa Beach', 'Hesperia', 'Hidden Hills', 'Highland', 'Hillsborough', 'Hollister', 'Holtville', 'Hughson', 'Huntington Beach', 'Huntington Park', 'Huron', 'Imperial', 'Imperial Beach', 'Indian Wells', 'Indio', 'Industry', 'Inglewood', 'Ione', 'Irvine', 'Irwindale', 'Isleton', 'Jackson', 'Jurupa Valley', 'Kerman', 'King City', 'Kingsburg', 'La Cañada Flintridge', 'La Habra', 'La Habra Heights', 'La Mesa', 'La Mirada', 'La Palma', 'La Puente', 'La Quinta', 'La Verne', 'Lafayette', 'Laguna Beach', 'Laguna Hills', 'Laguna Niguel', 'Laguna Woods', 'Lake Elsinore', 'Lake Forest', 'Lakeport', 'Lakewood', 'Lancaster', 'Larkspur', 'Lathrop', 'Lawndale', 'Lemon Grove', 'Lemoore', 'Lincoln', 'Lindsay', 'Live Oak', 'Livermore', 'Livingston', 'Lodi', 'Loma Linda', 'Lomita', 'Lompoc', 'Long Beach', 'Loomis', 'Los Alamitos', 'Los Altos', 'Los Altos Hills', 'Los Angeles', 'Los Banos', 'Los Gatos', 'Loyalton', 'Lynwood', 'Madera', 'Malibu', 'Mammoth Lakes', 'Manhattan Beach', 'Manteca', 'Maricopa', 'Marina', 'Martinez', 'Marysville', 'Maywood', 'McFarland', 'Mendota', 'Menifee', 'Menlo Park', 'Merced', 'Mill Valley', 'Millbrae', 'Milpitas', 'Mission Viejo', 'Modesto', 'Monrovia', 'Montague', 'Montclair', 'Monte Sereno', 'Montebello', 'Monterey', 'Monterey Park', 'Moorpark', 'Moraga', 'Moreno Valley', 'Morgan Hill', 'Morro Bay', 'Mountain View', 'Mount Shasta', 'Murrieta', 'Napa', 'National City', 'Needles', 'Nevada City', 'Newark', 'Newman', 'Newport Beach', 'Norco', 'Norwalk', 'Novato', 'Oakdale', 'Oakland', 'Oakley', 'Oceanside', 'Ojai', 'Ontario', 'Orange', 'Orange Cove', 'Orinda', 'Orland', 'Oroville', 'Oxnard', 'Pacific Grove', 'Pacifica', 'Palm Desert', 'Palm Springs', 'Palmdale', 'Palo Alto', 'Palos Verdes Estates', 'Paradise', 'Paramount', 'Parlier', 'Pasadena', 'Paso Robles', 'Patterson', 'Perris', 'Petaluma', 'Pico Rivera', 'Piedmont', 'Pinole', 'Pismo Beach', 'Pittsburg', 'Placentia', 'Placerville', 'Pleasant Hill', 'Pleasanton', 'Plymouth', 'Point Arena', 'Pomona', 'Port Hueneme', 'Porterville', 'Portola', 'Portola Valley', 'Poway', 'Rancho Cordova', 'Rancho Cucamonga', 'Rancho Mirage', 'Rancho Palos Verdes', 'Rancho Santa Margarita', 'Red Bluff', 'Redding', 'Redlands', 'Redondo Beach', 'Redwood City', 'Reedley', 'Rialto', 'Richmond', 'Ridgecrest', 'Rio Dell', 'Rio Vista', 'Ripon', 'Riverbank', 'Riverside', 'Rocklin', 'Rohnert Park', 'Rolling Hills', 'Rolling Hills Estates', 'Rosemead', 'Roseville', 'Ross', 'Sacramento', 'Salinas', 'San Anselmo', 'San Bernardino', 'San Bruno', 'San Buenaventura', 'San Carlos', 'San Clemente', 'San Diego', 'San Dimas', 'San Fernando', 'San Francisco', 'San Gabriel', 'San Jacinto', 'San Joaquin', 'San Jose', 'San Juan Bautista', 'San Juan Capistrano', 'San Leandro', 'San Luis Obispo', 'San Marcos', 'San Marino', 'San Mateo', 'San Pablo', 'San Rafael', 'San Ramon', 'Sand City', 'Sanger', 'Santa Ana', 'Santa Barbara', 'Santa Clara', 'Santa Clarita', 'Santa Cruz', 'Santa Fe Springs', 'Santa Maria', 'Santa Monica', 'Santa Paula', 'Santa Rosa', 'Santee', 'Saratoga', 'Sausalito', 'Scotts Valley', 'Seal Beach', 'Seaside', 'Sebastopol', 'Selma', 'Shafter', 'Shasta Lake', 'Sierra Madre', 'Signal Hill', 'Simi Valley', 'Solana Beach', 'Soledad', 'Solvang', 'Sonoma', 'Sonora', 'South El Monte', 'South Gate', 'South Lake Tahoe', 'South Pasadena', 'South San Francisco', 'St. Helena', 'Stanton', 'Stockton', 'Suisun City', 'Sunnyvale', 'Susanville', 'Sutter Creek', 'Taft', 'Tehachapi', 'Tehama', 'Temecula', 'Temple City', 'Thousand Oaks', 'Tiburon', 'Torrance', 'Tracy', 'Trinidad', 'Truckee', 'Tulare', 'Tulelake', 'Turlock', 'Tustin', 'Twentynine Palms', 'Ukiah', 'Union City', 'Upland', 'Vacaville', 'Vallejo', 'Victorville', 'Villa Park', 'Visalia', 'Vista', 'Walnut', 'Walnut Creek', 'Wasco', 'Waterford', 'Watsonville', 'Weed', 'West Covina', 'West Hollywood', 'West Sacramento', 'Westlake Village', 'Westminster', 'Westmorland', 'Wheatland', 'Whittier', 'Wildomar', 'Williams', 'Willits', 'Willows', 'Windsor', 'Winters', 'Woodlake', 'Woodland', 'Woodside', 'Yorba Linda', 'Yountville', 'Yreka', 'Yuba City'],
    countyLocation: ['County of Alameda', 'County of Alpine', 'County of Amador', 'County of Butte', 'County of Calaveras', 'County of Colusa', 'County of Contra Costa', 'County of Del Norte', 'County of El Dorado', 'County of Fresno', 'County of Glenn', 'County of Humboldt', 'County of Imperial', 'County of Inyo', 'County of Kern', 'County of Kings', 'County of Lake', 'County of Lassen', 'County of Los Angeles', 'County of Madera', 'County of Marin', 'County of Mariposa', 'County of Mendocino', 'County of Merced', 'County of Modoc', 'County of Mono', 'County of Monterey', 'County of Napa', 'County of Nevada', 'County of Orange', 'County of Placer', 'County of Plumas', 'County of Riverside', 'County of Sacramento', 'County of San Benito', 'County of San Bernardino', 'County of San Diego', 'County of San Francisco', 'County of San Joaquin', 'County of San Luis Obispo', 'County of San Mateo', 'County of Santa Barbara', 'County of Santa Clara', 'County of Santa Cruz', 'County of Shasta', 'County of Sierra', 'County of Siskiyou', 'County of Solano', 'County of Sonoma', 'County of Stanislaus', 'County of Sutter', 'County of Tehama', 'County of Trinity', 'County of Tulare', 'County of Tuolumne', 'County of Ventura', 'County of Yolo', 'County of Yuba'],
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
