// Which county each California city sits in.
//
// Written as county -> cities because that is how the fact is actually known,
// and because a duplicate or a missing city shows up immediately when the list
// is checked against the city dropdown. The lookup used by the form is derived
// from it below.
//
// The county is filled in as a suggestion and stays editable: a few cities sit
// on a county line or share a name with a place elsewhere, and the person
// filling the form is the authority, not this table.

export const CITIES_BY_COUNTY: Record<string, string[]> = {
  Alameda: ['Alameda', 'Albany', 'Berkeley', 'Dublin', 'Emeryville', 'Fremont', 'Hayward', 'Livermore', 'Newark', 'Oakland', 'Piedmont', 'Pleasanton', 'San Leandro', 'Union City'],
  Amador: ['Amador City', 'Ione', 'Jackson', 'Plymouth', 'Sutter Creek'],
  Butte: ['Biggs', 'Chico', 'Gridley', 'Oroville', 'Paradise'],
  Calaveras: ['Angels Camp'],
  Colusa: ['Colusa', 'Williams'],
  'Contra Costa': ['Antioch', 'Brentwood', 'Clayton', 'Concord', 'Danville', 'El Cerrito', 'Hercules', 'Lafayette', 'Martinez', 'Moraga', 'Oakley', 'Orinda', 'Pinole', 'Pittsburg', 'Pleasant Hill', 'Richmond', 'San Pablo', 'San Ramon', 'Walnut Creek'],
  'Del Norte': ['Crescent City'],
  'El Dorado': ['Placerville', 'South Lake Tahoe'],
  Fresno: ['Clovis', 'Coalinga', 'Firebaugh', 'Fowler', 'Fresno', 'Huron', 'Kerman', 'Kingsburg', 'Mendota', 'Orange Cove', 'Parlier', 'Reedley', 'San Joaquin', 'Sanger', 'Selma'],
  Glenn: ['Orland', 'Willows'],
  Humboldt: ['Arcata', 'Blue Lake', 'Eureka', 'Ferndale', 'Fortuna', 'Rio Dell', 'Trinidad'],
  Imperial: ['Brawley', 'Calexico', 'Calipatria', 'El Centro', 'Holtville', 'Imperial', 'Westmorland'],
  Inyo: ['Bishop'],
  Kern: ['Arvin', 'Bakersfield', 'California City', 'Delano', 'Maricopa', 'McFarland', 'Ridgecrest', 'Shafter', 'Taft', 'Tehachapi', 'Wasco'],
  Kings: ['Avenal', 'Corcoran', 'Hanford', 'Lemoore'],
  Lake: ['Clearlake', 'Lakeport'],
  Lassen: ['Susanville'],
  'Los Angeles': ['Agoura Hills', 'Alhambra', 'Arcadia', 'Artesia', 'Avalon', 'Azusa', 'Baldwin Park', 'Bell', 'Bell Gardens', 'Bellflower', 'Beverly Hills', 'Bradbury', 'Burbank', 'Calabasas', 'Carson', 'Cerritos', 'Claremont', 'Commerce', 'Compton', 'Covina', 'Cudahy', 'Culver City', 'Diamond Bar', 'Downey', 'Duarte', 'El Monte', 'El Segundo', 'Gardena', 'Glendale', 'Glendora', 'Hawaiian Gardens', 'Hawthorne', 'Hermosa Beach', 'Hidden Hills', 'Huntington Park', 'Industry', 'Inglewood', 'Irwindale', 'La Cañada Flintridge', 'La Habra Heights', 'La Mirada', 'La Puente', 'La Verne', 'Lakewood', 'Lancaster', 'Lawndale', 'Lomita', 'Long Beach', 'Los Angeles', 'Lynwood', 'Malibu', 'Manhattan Beach', 'Maywood', 'Monrovia', 'Montebello', 'Monterey Park', 'Norwalk', 'Palmdale', 'Palos Verdes Estates', 'Paramount', 'Pasadena', 'Pico Rivera', 'Pomona', 'Rancho Palos Verdes', 'Redondo Beach', 'Rolling Hills', 'Rolling Hills Estates', 'Rosemead', 'San Dimas', 'San Fernando', 'San Gabriel', 'San Marino', 'Santa Clarita', 'Santa Fe Springs', 'Santa Monica', 'Sierra Madre', 'Signal Hill', 'South El Monte', 'South Gate', 'South Pasadena', 'Temple City', 'Torrance', 'Walnut', 'West Covina', 'West Hollywood', 'Westlake Village', 'Whittier'],
  Madera: ['Chowchilla', 'Madera'],
  Marin: ['Belvedere', 'Corte Madera', 'Fairfax', 'Larkspur', 'Mill Valley', 'Novato', 'Ross', 'San Anselmo', 'San Rafael', 'Sausalito', 'Tiburon'],
  Mendocino: ['Fort Bragg', 'Point Arena', 'Ukiah', 'Willits'],
  Merced: ['Atwater', 'Dos Palos', 'Gustine', 'Livingston', 'Los Banos', 'Merced'],
  Modoc: ['Alturas'],
  Mono: ['Mammoth Lakes'],
  Monterey: ['Carmel-by-the-Sea', 'Del Rey Oaks', 'Gonzales', 'Greenfield', 'King City', 'Marina', 'Monterey', 'Pacific Grove', 'Salinas', 'Sand City', 'Seaside', 'Soledad'],
  Napa: ['American Canyon', 'Calistoga', 'Napa', 'St. Helena', 'Yountville'],
  Nevada: ['Grass Valley', 'Nevada City', 'Truckee'],
  Orange: ['Aliso Viejo', 'Anaheim', 'Brea', 'Buena Park', 'Costa Mesa', 'Cypress', 'Dana Point', 'Fountain Valley', 'Fullerton', 'Garden Grove', 'Huntington Beach', 'Irvine', 'La Habra', 'La Palma', 'Laguna Beach', 'Laguna Hills', 'Laguna Niguel', 'Laguna Woods', 'Lake Forest', 'Los Alamitos', 'Mission Viejo', 'Newport Beach', 'Orange', 'Placentia', 'Rancho Santa Margarita', 'San Clemente', 'San Juan Capistrano', 'Santa Ana', 'Seal Beach', 'Stanton', 'Tustin', 'Villa Park', 'Westminster', 'Yorba Linda'],
  Placer: ['Auburn', 'Colfax', 'Lincoln', 'Loomis', 'Rocklin', 'Roseville'],
  Plumas: ['Portola'],
  Riverside: ['Banning', 'Beaumont', 'Blythe', 'Calimesa', 'Canyon Lake', 'Cathedral City', 'Coachella', 'Corona', 'Desert Hot Springs', 'Eastvale', 'Hemet', 'Indian Wells', 'Indio', 'Jurupa Valley', 'La Quinta', 'Lake Elsinore', 'Menifee', 'Moreno Valley', 'Murrieta', 'Norco', 'Palm Desert', 'Palm Springs', 'Perris', 'Rancho Mirage', 'Riverside', 'San Jacinto', 'Temecula', 'Wildomar'],
  Sacramento: ['Citrus Heights', 'Elk Grove', 'Folsom', 'Galt', 'Isleton', 'Rancho Cordova', 'Sacramento'],
  'San Benito': ['Hollister', 'San Juan Bautista'],
  'San Bernardino': ['Adelanto', 'Apple Valley', 'Barstow', 'Big Bear Lake', 'Chino', 'Chino Hills', 'Colton', 'Fontana', 'Grand Terrace', 'Hesperia', 'Highland', 'Loma Linda', 'Montclair', 'Needles', 'Ontario', 'Rancho Cucamonga', 'Redlands', 'Rialto', 'San Bernardino', 'Twentynine Palms', 'Upland', 'Victorville'],
  'San Diego': ['Carlsbad', 'Chula Vista', 'Coronado', 'Del Mar', 'El Cajon', 'Encinitas', 'Escondido', 'Imperial Beach', 'La Mesa', 'Lemon Grove', 'National City', 'Oceanside', 'Poway', 'San Diego', 'San Marcos', 'Santee', 'Solana Beach', 'Vista'],
  'San Francisco': ['San Francisco'],
  'San Joaquin': ['Escalon', 'Lathrop', 'Lodi', 'Manteca', 'Ripon', 'Stockton', 'Tracy'],
  'San Luis Obispo': ['Arroyo Grande', 'Atascadero', 'Grover Beach', 'Morro Bay', 'Paso Robles', 'Pismo Beach', 'San Luis Obispo'],
  'San Mateo': ['Atherton', 'Belmont', 'Brisbane', 'Burlingame', 'Colma', 'Daly City', 'East Palo Alto', 'Foster City', 'Half Moon Bay', 'Hillsborough', 'Menlo Park', 'Millbrae', 'Pacifica', 'Portola Valley', 'Redwood City', 'San Bruno', 'San Carlos', 'San Mateo', 'South San Francisco', 'Woodside'],
  'Santa Barbara': ['Buellton', 'Carpinteria', 'Goleta', 'Guadalupe', 'Lompoc', 'Santa Barbara', 'Santa Maria', 'Solvang'],
  'Santa Clara': ['Campbell', 'Cupertino', 'Gilroy', 'Los Altos', 'Los Altos Hills', 'Los Gatos', 'Milpitas', 'Monte Sereno', 'Morgan Hill', 'Mountain View', 'Palo Alto', 'San Jose', 'Santa Clara', 'Saratoga', 'Sunnyvale'],
  'Santa Cruz': ['Capitola', 'Santa Cruz', 'Scotts Valley', 'Watsonville'],
  Shasta: ['Anderson', 'Redding', 'Shasta Lake'],
  Sierra: ['Loyalton'],
  Siskiyou: ['Dorris', 'Dunsmuir', 'Etna', 'Fort Jones', 'Montague', 'Mount Shasta', 'Tulelake', 'Weed', 'Yreka'],
  Solano: ['Benicia', 'Dixon', 'Fairfield', 'Rio Vista', 'Suisun City', 'Vacaville', 'Vallejo'],
  Sonoma: ['Cloverdale', 'Cotati', 'Healdsburg', 'Petaluma', 'Rohnert Park', 'Santa Rosa', 'Sebastopol', 'Sonoma', 'Windsor'],
  Stanislaus: ['Ceres', 'Hughson', 'Modesto', 'Newman', 'Oakdale', 'Patterson', 'Riverbank', 'Turlock', 'Waterford'],
  Sutter: ['Live Oak', 'Yuba City'],
  Tehama: ['Corning', 'Red Bluff', 'Tehama'],
  Tulare: ['Dinuba', 'Exeter', 'Farmersville', 'Lindsay', 'Porterville', 'Tulare', 'Visalia', 'Woodlake'],
  Tuolumne: ['Sonora'],
  Ventura: ['Camarillo', 'Fillmore', 'Moorpark', 'Ojai', 'Oxnard', 'Port Hueneme', 'San Buenaventura', 'Santa Paula', 'Simi Valley', 'Thousand Oaks'],
  Yolo: ['Davis', 'West Sacramento', 'Winters', 'Woodland'],
  Yuba: ['Marysville', 'Wheatland'],
};

/** City -> county, built once from the table above. */
export const COUNTY_BY_CITY: Record<string, string> = Object.entries(CITIES_BY_COUNTY)
  .reduce((acc, [county, cities]) => {
    cities.forEach((city) => { acc[city] = `County of ${county}`; });
    return acc;
  }, {} as Record<string, string>);

/** The county for a city, or '' when it is not one we know. */
export const countyForCity = (city?: string): string => COUNTY_BY_CITY[(city || '').trim()] || '';
