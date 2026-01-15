/**
 * Map Intelligence System
 * Provides strategic location data for AI Game Master decision-making
 * Data sourced from PLANOPS Atlas (https://atlas.plan-ops.fr)
 */

export interface MapLocation {
  name: string;
  type: 'city' | 'village' | 'military' | 'industrial' | 'district' | 'landmark';
  position: [number, number];  // [x, y] in Arma 3 coordinates
  strategicValue: number;      // 1-10
  description: string;
}

export interface MapData {
  name: string;
  displayName: string;
  size: [number, number];  // km
  area: number;            // km²
  locations: MapLocation[];
  terrain: string;
  setting: string;
}

// Fallujah 2.0 map data from PLANOPS Atlas
const FALLUJAH_MAP: MapData = {
  name: 'fallujah',
  displayName: 'Fallujah 2.0',
  size: [10.2, 10.2],
  area: 105,
  terrain: 'Urban/Desert',
  setting: 'Iraq - Modern Middle East',
  locations: [
    { name: 'Al-Fallujah', type: 'city', position: [5479, 5103], strategicValue: 10, description: 'Main city center - high population, major objective' },
    { name: 'Jolan', type: 'district', position: [3314, 5335], strategicValue: 9, description: 'Dense urban district - traditional stronghold, narrow streets' },
    { name: 'Askari', type: 'district', position: [6691, 5710], strategicValue: 7, description: 'Military/government district - likely fortified' },
    { name: 'Industrial Park', type: 'industrial', position: [5946, 4684], strategicValue: 8, description: 'Industrial zone - warehouses, open areas, vehicle storage' },
    { name: 'Jeghaifi', type: 'village', position: [6015, 6381], strategicValue: 5, description: 'Northern village - staging area' },
    { name: 'Mualimeen', type: 'district', position: [4311, 6339], strategicValue: 6, description: 'Residential district - civilian presence' },
    { name: 'Muhandisin', type: 'district', position: [4388, 5428], strategicValue: 7, description: 'Central district - good defensive positions' },
    { name: 'Nazal Old City', type: 'district', position: [4669, 4417], strategicValue: 8, description: 'Historic old city - narrow alleys, rooftop positions' },
    { name: 'Resafa', type: 'district', position: [3866, 3969], strategicValue: 6, description: 'Southwest district - approach route' },
    { name: 'Shuhada', type: 'district', position: [5592, 2971], strategicValue: 5, description: 'Southern district - outskirts' },
    { name: 'Shurta', type: 'district', position: [5274, 6271], strategicValue: 7, description: 'Police district - potential enemy HQ' },
    { name: 'Sinai', type: 'district', position: [5325, 3169], strategicValue: 5, description: 'Southern approach - open terrain' },
  ]
};

// Altis map data
const ALTIS_MAP: MapData = {
  name: 'altis',
  displayName: 'Altis',
  size: [30, 30],
  area: 270,
  terrain: 'Mediterranean Island',
  setting: 'Greece - NATO vs CSAT',
  locations: [
    { name: 'Kavala', type: 'city', position: [3500, 13000], strategicValue: 10, description: 'Major port city - eastern coast' },
    { name: 'Pyrgos', type: 'city', position: [16700, 12900], strategicValue: 9, description: 'Largest city - central Altis' },
    { name: 'Athira', type: 'city', position: [14500, 18700], strategicValue: 7, description: 'Northern town - mountain approach' },
    { name: 'Sofia', type: 'village', position: [10400, 11900], strategicValue: 5, description: 'Central village - crossroads' },
    { name: 'Agios Dionysios', type: 'village', position: [5800, 20800], strategicValue: 4, description: 'Northwestern village' },
    { name: 'Neochori', type: 'village', position: [14500, 14500], strategicValue: 5, description: 'Central highlands village' },
    { name: 'AAC Airfield', type: 'military', position: [14300, 18800], strategicValue: 9, description: 'Main airfield - strategic air base' },
    { name: 'Camp Rogain', type: 'military', position: [11600, 11200], strategicValue: 8, description: 'Military camp - central Altis' },
    { name: 'Salt Flats', type: 'industrial', position: [19000, 20000], strategicValue: 6, description: 'Industrial area - open terrain' },
  ]
};

// Takistan map data
const TAKISTAN_MAP: MapData = {
  name: 'takistan',
  displayName: 'Takistan',
  size: [12.8, 12.8],
  area: 164,
  terrain: 'Mountainous Desert',
  setting: 'Central Asia - Insurgency',
  locations: [
    { name: 'Zargabad', type: 'city', position: [4000, 4700], strategicValue: 10, description: 'Capital city - dense urban' },
    { name: 'Rasman', type: 'city', position: [4600, 7400], strategicValue: 8, description: 'Major town - northern region' },
    { name: 'Feruz Abad', type: 'city', position: [2200, 3600], strategicValue: 7, description: 'Western city - border region' },
    { name: 'Nur', type: 'village', position: [3800, 5800], strategicValue: 5, description: 'Central village - crossroads' },
    { name: 'Loy Manara', type: 'village', position: [5800, 5200], strategicValue: 6, description: 'Eastern village - mountain pass' },
    { name: 'Zavarak', type: 'military', position: [4800, 3600], strategicValue: 8, description: 'Military airfield' },
  ]
};

// Chernarus map data
const CHERNARUS_MAP: MapData = {
  name: 'chernarus',
  displayName: 'Chernarus',
  size: [15, 15],
  area: 225,
  terrain: 'Eastern European Forest',
  setting: 'Post-Soviet - Civil War',
  locations: [
    { name: 'Chernogorsk', type: 'city', position: [6400, 2700], strategicValue: 10, description: 'Major coastal city - port' },
    { name: 'Elektrozavodsk', type: 'city', position: [10200, 2100], strategicValue: 9, description: 'Industrial city - power plant' },
    { name: 'Berezino', type: 'city', position: [12200, 9200], strategicValue: 8, description: 'Eastern port city' },
    { name: 'Stary Sobor', type: 'village', position: [6100, 7700], strategicValue: 7, description: 'Central village - military base nearby' },
    { name: 'Novy Sobor', type: 'village', position: [7100, 7000], strategicValue: 6, description: 'Central crossroads' },
    { name: 'Balota Airfield', type: 'military', position: [4500, 2400], strategicValue: 9, description: 'Coastal airfield' },
    { name: 'NWAF', type: 'military', position: [4500, 10200], strategicValue: 10, description: 'Northwest Airfield - major military' },
  ]
};

// Lythium map data (Afghanistan)
const LYTHIUM_MAP: MapData = {
  name: 'lythium',
  displayName: 'Lythium',
  size: [20, 20],
  area: 400,
  terrain: 'Mountainous/Desert',
  setting: 'Afghanistan - ISAF Operations',
  locations: [
    { name: 'Herat', type: 'city', position: [6500, 11500], strategicValue: 10, description: 'Major city - dense urban, bazaars' },
    { name: 'Shindand', type: 'military', position: [4200, 8900], strategicValue: 9, description: 'Major airbase - strategic air operations' },
    { name: 'Farah', type: 'city', position: [3800, 5200], strategicValue: 8, description: 'Provincial capital - government buildings' },
    { name: 'Adraskan', type: 'village', position: [5500, 7800], strategicValue: 5, description: 'Valley village - mountain approaches' },
    { name: 'Gulistan', type: 'village', position: [7200, 9400], strategicValue: 4, description: 'Rural village - farming area' },
    { name: 'Camp Arena', type: 'military', position: [6200, 11200], strategicValue: 8, description: 'NATO base - ISAF HQ' },
    { name: 'FOB Cobra', type: 'military', position: [4800, 6500], strategicValue: 7, description: 'Forward Operating Base' },
    { name: 'Green Zone', type: 'industrial', position: [5900, 10800], strategicValue: 6, description: 'Agricultural area - IED risk' },
  ]
};

// Tanoa map data (Pacific)
const TANOA_MAP: MapData = {
  name: 'tanoa',
  displayName: 'Tanoa (Apex)',
  size: [15, 15],
  area: 100,
  terrain: 'Tropical Jungle',
  setting: 'South Pacific - Counter-insurgency',
  locations: [
    { name: 'Georgetown', type: 'city', position: [11800, 2600], strategicValue: 10, description: 'Capital city - port, government district' },
    { name: 'Blue Pearl Industrial', type: 'industrial', position: [7500, 9600], strategicValue: 8, description: 'Industrial port - cargo shipping' },
    { name: 'Lijnhaven', type: 'city', position: [4900, 9100], strategicValue: 7, description: 'Port town - western coast' },
    { name: 'Tanouka', type: 'village', position: [5600, 6200], strategicValue: 5, description: 'Jungle village - difficult terrain' },
    { name: 'Tuvanaka', type: 'military', position: [3500, 11800], strategicValue: 9, description: 'Airfield - military airport' },
    { name: 'Sosovu', type: 'village', position: [8200, 6500], strategicValue: 4, description: 'Remote village - jungle interior' },
    { name: 'Bala Airstrip', type: 'military', position: [13200, 11900], strategicValue: 7, description: 'Small airstrip - resupply point' },
  ]
};

// Stratis map data
const STRATIS_MAP: MapData = {
  name: 'stratis',
  displayName: 'Stratis',
  size: [8, 8],
  area: 20,
  terrain: 'Mediterranean Island',
  setting: 'Greece - Small Island Operations',
  locations: [
    { name: 'Agia Marina', type: 'village', position: [4000, 4100], strategicValue: 8, description: 'Main settlement - central village' },
    { name: 'Air Station Mike-26', type: 'military', position: [2000, 5700], strategicValue: 10, description: 'Main airfield - strategic objective' },
    { name: 'Camp Rogain', type: 'military', position: [3900, 6200], strategicValue: 8, description: 'Military camp - northern hills' },
    { name: 'Camp Maxwell', type: 'military', position: [5400, 5700], strategicValue: 7, description: 'Training facility' },
    { name: 'Girna', type: 'village', position: [5300, 3200], strategicValue: 5, description: 'Coastal village - beach approach' },
    { name: 'Kamino', type: 'village', position: [2400, 3200], strategicValue: 6, description: 'Western settlement' },
    { name: 'LZ Connor', type: 'military', position: [6400, 5600], strategicValue: 6, description: 'Helicopter landing zone' },
  ]
};

// Livonia map data (Contact DLC)
const LIVONIA_MAP: MapData = {
  name: 'livonia',
  displayName: 'Livonia (Contact)',
  size: [12.8, 12.8],
  area: 163,
  terrain: 'Eastern European Forest/Plains',
  setting: 'Poland - NATO Exercise Zone',
  locations: [
    { name: 'Topolin', type: 'city', position: [5200, 10200], strategicValue: 9, description: 'Major town - central Livonia' },
    { name: 'Nadbor', type: 'city', position: [8600, 8200], strategicValue: 8, description: 'Eastern town - industrial' },
    { name: 'Gieraltow', type: 'village', position: [3200, 8800], strategicValue: 6, description: 'Western village' },
    { name: 'Lukow', type: 'village', position: [9800, 5200], strategicValue: 5, description: 'Southern village' },
    { name: 'Adamow', type: 'military', position: [6200, 6800], strategicValue: 8, description: 'Military base - training grounds' },
    { name: 'Radio Antenna', type: 'landmark', position: [3800, 10800], strategicValue: 7, description: 'Communications tower - high ground' },
  ]
};

// Malden map data
const MALDEN_MAP: MapData = {
  name: 'malden',
  displayName: 'Malden 2035',
  size: [8, 8],
  area: 62,
  terrain: 'Mediterranean Island',
  setting: 'France - NATO Operations',
  locations: [
    { name: 'Le Port', type: 'city', position: [7500, 7800], strategicValue: 9, description: 'Main port - eastern coast' },
    { name: 'La Trinite', type: 'city', position: [6200, 6800], strategicValue: 8, description: 'Central town' },
    { name: 'Gosse', type: 'village', position: [4500, 5200], strategicValue: 5, description: 'Western village' },
    { name: 'Dourdan', type: 'village', position: [5800, 8500], strategicValue: 5, description: 'Coastal village' },
    { name: 'Airfield', type: 'military', position: [8200, 5500], strategicValue: 10, description: 'Main airport - strategic' },
    { name: 'Military Base', type: 'military', position: [2800, 6200], strategicValue: 8, description: 'Western military compound' },
  ]
};

// Sahrani map data (CUP)
const SAHRANI_MAP: MapData = {
  name: 'sahrani',
  displayName: 'Sahrani',
  size: [20, 20],
  area: 400,
  terrain: 'Mediterranean/Tropical',
  setting: 'Fictional Island - North vs South',
  locations: [
    { name: 'Paraiso', type: 'city', position: [4500, 5500], strategicValue: 10, description: 'Capital of South Sahrani' },
    { name: 'Corazol', type: 'city', position: [4200, 11500], strategicValue: 9, description: 'Northern city - contested' },
    { name: 'Bagango', type: 'city', position: [10500, 9500], strategicValue: 8, description: 'Central town' },
    { name: 'Rahmadi', type: 'military', position: [1800, 12200], strategicValue: 9, description: 'Airfield - strategic' },
    { name: 'Tiberia', type: 'village', position: [6800, 7500], strategicValue: 5, description: 'Mountain village' },
  ]
};

// Vidda map data (Winter)
const VIDDA_MAP: MapData = {
  name: 'vidda',
  displayName: 'Vidda',
  size: [25, 25],
  area: 625,
  terrain: 'Arctic/Subarctic',
  setting: 'Norway - Winter Warfare',
  locations: [
    { name: 'Storvik', type: 'city', position: [12500, 15200], strategicValue: 9, description: 'Main town - central valley' },
    { name: 'Hammervik', type: 'city', position: [8500, 11800], strategicValue: 8, description: 'Coastal town - port' },
    { name: 'Norvik', type: 'village', position: [15200, 18500], strategicValue: 5, description: 'Northern settlement' },
    { name: 'Fjordvik', type: 'village', position: [6200, 8500], strategicValue: 5, description: 'Fjord village - isolated' },
    { name: 'Airbase', type: 'military', position: [10500, 12800], strategicValue: 10, description: 'Military airfield' },
    { name: 'Radar Station', type: 'military', position: [18500, 21000], strategicValue: 8, description: 'Mountain radar - high ground' },
  ]
};

// Fapovo map data (Eastern European)
const FAPOVO_MAP: MapData = {
  name: 'fapovo',
  displayName: 'Fapovo',
  size: [10.2, 10.2],
  area: 105,
  terrain: 'Eastern European Industrial',
  setting: 'Fictional - Industrial/Oil Region',
  locations: [
    // Major settlements
    { name: 'Ivanograd', type: 'city', position: [4307, 913], strategicValue: 8, description: 'Southern city - urban center' },
    { name: 'Beratna', type: 'city', position: [8839, 5634], strategicValue: 7, description: 'Eastern town - residential area' },
    { name: 'Botana', type: 'city', position: [7838, 7651], strategicValue: 7, description: 'Central-east town' },
    { name: 'Sharkovo', type: 'village', position: [8630, 1648], strategicValue: 5, description: 'Southeastern village' },
    { name: 'Viruvitia', type: 'village', position: [3332, 6186], strategicValue: 5, description: 'Central village' },
    { name: 'Sossana', type: 'village', position: [3357, 7642], strategicValue: 5, description: 'Northern village' },

    // Military installations
    { name: 'Base Owl', type: 'military', position: [4521, 9988], strategicValue: 10, description: 'Main military base - strategic HQ' },
    { name: 'SBP Armybase', type: 'military', position: [1047, 535], strategicValue: 9, description: 'Southern army base - fortified' },
    { name: 'SBP HQ', type: 'military', position: [1266, 365], strategicValue: 9, description: 'Military headquarters - command center' },
    { name: 'Training Facility', type: 'military', position: [910, 3896], strategicValue: 7, description: 'Military training grounds' },
    { name: 'Range Tiren', type: 'military', position: [7280, 5300], strategicValue: 6, description: 'Firing range - open terrain' },

    // Industrial/Oil infrastructure
    { name: 'Laguna Refinery', type: 'industrial', position: [3728, 9348], strategicValue: 9, description: 'Major oil refinery - high value target' },
    { name: 'Oil Terminal', type: 'industrial', position: [4839, 9849], strategicValue: 8, description: 'Oil terminal - strategic infrastructure' },
    { name: 'Oil Aris', type: 'industrial', position: [3588, 8347], strategicValue: 7, description: 'Oil facility' },
    { name: 'Oil Bosco', type: 'industrial', position: [3325, 9049], strategicValue: 7, description: 'Oil processing plant' },
    { name: 'Oil Coyote', type: 'industrial', position: [4338, 9688], strategicValue: 7, description: 'Oil storage' },
    { name: 'Graltech Ltd.', type: 'industrial', position: [2772, 9987], strategicValue: 6, description: 'Industrial complex' },

    // Other notable locations
    { name: 'Gova Hill', type: 'landmark', position: [7897, 5858], strategicValue: 6, description: 'Elevated position - good overwatch' },
    { name: 'Magnola Slums', type: 'district', position: [4395, 10033], strategicValue: 4, description: 'Slum area - CQB terrain' },
    { name: 'Gypsy Camp', type: 'village', position: [9692, 1360], strategicValue: 3, description: 'Remote camp - eastern edge' },
    { name: 'Lower Jabovo', type: 'village', position: [1284, 799], strategicValue: 4, description: 'Southern village' },
    { name: 'Upper Jabovo', type: 'village', position: [1640, 1195], strategicValue: 4, description: 'Elevated village position' },
    { name: 'Katamov', type: 'village', position: [6820, 5642], strategicValue: 5, description: 'Central village - crossroads' },
    { name: 'Dolsko', type: 'village', position: [7745, 5285], strategicValue: 5, description: 'Eastern village' },
  ]
};

// Map registry - expanded
const MAP_DATABASE: Record<string, MapData> = {
  // Middle East
  'fallujah': FALLUJAH_MAP,
  'fallujah_2': FALLUJAH_MAP,
  'fallujah_iraq': FALLUJAH_MAP,
  'takistan': TAKISTAN_MAP,

  // Afghanistan
  'lythium': LYTHIUM_MAP,

  // Europe
  'chernarus': CHERNARUS_MAP,
  'chernarus_summer': CHERNARUS_MAP,
  'chernarusredux': CHERNARUS_MAP,
  'livonia': LIVONIA_MAP,
  'enoch': LIVONIA_MAP,  // Internal name for Livonia

  // Mediterranean
  'altis': ALTIS_MAP,
  'stratis': STRATIS_MAP,
  'malden': MALDEN_MAP,
  'malden2035': MALDEN_MAP,

  // Pacific
  'tanoa': TANOA_MAP,

  // Cold War
  'sahrani': SAHRANI_MAP,
  'sara': SAHRANI_MAP,  // Internal name

  // Arctic
  'vidda': VIDDA_MAP,

  // Eastern Europe (Community)
  'fapovo': FAPOVO_MAP,
};

/**
 * Get map data by name
 */
export function getMapData(mapName: string): MapData | null {
  const normalized = mapName.toLowerCase().replace(/[^a-z0-9_]/g, '');
  return MAP_DATABASE[normalized] || null;
}

/**
 * Find locations near a position
 */
export function getLocationsNear(
  mapName: string,
  position: [number, number],
  radius: number = 2000
): MapLocation[] {
  const mapData = getMapData(mapName);
  if (!mapData) return [];

  return mapData.locations
    .filter(loc => {
      const dx = loc.position[0] - position[0];
      const dy = loc.position[1] - position[1];
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= radius;
    })
    .sort((a, b) => {
      const distA = Math.sqrt(
        Math.pow(a.position[0] - position[0], 2) +
        Math.pow(a.position[1] - position[1], 2)
      );
      const distB = Math.sqrt(
        Math.pow(b.position[0] - position[0], 2) +
        Math.pow(b.position[1] - position[1], 2)
      );
      return distA - distB;
    });
}

/**
 * Get nearest location to a position
 */
export function getNearestLocation(
  mapName: string,
  position: [number, number]
): { location: MapLocation; distance: number } | null {
  const mapData = getMapData(mapName);
  if (!mapData || mapData.locations.length === 0) return null;

  let nearest = mapData.locations[0];
  let minDist = Infinity;

  for (const loc of mapData.locations) {
    const dx = loc.position[0] - position[0];
    const dy = loc.position[1] - position[1];
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < minDist) {
      minDist = distance;
      nearest = loc;
    }
  }

  return { location: nearest, distance: minDist };
}

/**
 * Get map intelligence summary for AI prompt
 */
export function getMapIntelligenceSummary(
  mapName: string,
  playerPosition: [number, number]
): string {
  const mapData = getMapData(mapName);
  if (!mapData) {
    return `Map "${mapName}" not in database. No location data available.`;
  }

  const nearestResult = getNearestLocation(mapName, playerPosition);
  const nearbyLocations = getLocationsNear(mapName, playerPosition, 3000);

  let summary = `## MAP INTELLIGENCE: ${mapData.displayName}\n`;
  summary += `Terrain: ${mapData.terrain} | Setting: ${mapData.setting}\n\n`;

  if (nearestResult) {
    const { location, distance } = nearestResult;
    summary += `**PLAYER VICINITY:**\n`;
    summary += `- Nearest: ${location.name} (${(distance / 1000).toFixed(1)}km ${getDirection(playerPosition, location.position)})\n`;
    summary += `- Type: ${location.type} | Strategic Value: ${location.strategicValue}/10\n`;
    summary += `- Intel: ${location.description}\n\n`;
  }

  if (nearbyLocations.length > 0) {
    summary += `**NEARBY LOCATIONS (within 3km):**\n`;
    for (const loc of nearbyLocations.slice(0, 5)) {
      const dx = loc.position[0] - playerPosition[0];
      const dy = loc.position[1] - playerPosition[1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      summary += `- ${loc.name}: ${(dist / 1000).toFixed(1)}km ${getDirection(playerPosition, loc.position)} (${loc.type})\n`;
    }
    summary += '\n';
  }

  // Strategic advice
  summary += `**TACTICAL CONSIDERATIONS:**\n`;
  const highValueNearby = nearbyLocations.filter(l => l.strategicValue >= 7);
  if (highValueNearby.length > 0) {
    summary += `- High-value objectives nearby: ${highValueNearby.map(l => l.name).join(', ')}\n`;
  }

  const urbanNearby = nearbyLocations.filter(l => l.type === 'city' || l.type === 'district');
  if (urbanNearby.length > 0) {
    summary += `- Urban terrain: Consider CQB, building clearing, sniper overwatch\n`;
  }

  const militaryNearby = nearbyLocations.filter(l => l.type === 'military');
  if (militaryNearby.length > 0) {
    summary += `- Military installations: Expect fortified positions, heavy weapons\n`;
  }

  return summary;
}

/**
 * Get cardinal direction from source to target
 */
function getDirection(source: [number, number], target: [number, number]): string {
  const dx = target[0] - source[0];
  const dy = target[1] - source[1];
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  // Convert to compass bearing (0 = North, 90 = East)
  if (angle >= -22.5 && angle < 22.5) return 'E';
  if (angle >= 22.5 && angle < 67.5) return 'NE';
  if (angle >= 67.5 && angle < 112.5) return 'N';
  if (angle >= 112.5 && angle < 157.5) return 'NW';
  if (angle >= 157.5 || angle < -157.5) return 'W';
  if (angle >= -157.5 && angle < -112.5) return 'SW';
  if (angle >= -112.5 && angle < -67.5) return 'S';
  return 'SE';
}

/**
 * Get all strategic locations for a map
 */
export function getAllMapLocations(mapName: string): MapLocation[] {
  const mapData = getMapData(mapName);
  return mapData?.locations || [];
}
