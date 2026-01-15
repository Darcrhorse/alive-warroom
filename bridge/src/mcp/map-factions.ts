/**
 * Map-to-Faction Recommendations
 * Provides thematically appropriate factions based on loaded map
 */

export interface MapFactionProfile {
  mapPatterns: string[];  // Regex patterns to match map names
  region: string;
  description: string;
  blufor: FactionRecommendation[];
  opfor: FactionRecommendation[];
  independent: FactionRecommendation[];
  civilians: FactionRecommendation[];
}

export interface FactionRecommendation {
  classname: string;
  displayName: string;
  priority: number;  // 1 = best fit, 2 = good fit, 3 = acceptable
  notes?: string;
}

export const mapFactionProfiles: MapFactionProfile[] = [
  // ==================== MIDDLE EAST / CENTRAL ASIA ====================
  {
    mapPatterns: ['takistan', 'zargabad', 'reshmaan', 'lythium', 'tem_anizay'],
    region: 'Central Asia / Afghanistan',
    description: 'Desert/mountain terrain, insurgency warfare',
    blufor: [
      { classname: 'rhs_faction_usarmy_d', displayName: 'USA (Army - Desert)', priority: 1 },
      { classname: 'rhs_faction_usmc_d', displayName: 'USA (USMC - Desert)', priority: 1 },
      { classname: 'UK3CB_BAF_Faction_Army_Desert', displayName: 'BAF Desert', priority: 1 },
      { classname: 'CUP_B_US_Army', displayName: 'US Army (CUP)', priority: 2 },
      { classname: 'UK3CB_ANA_B', displayName: 'Afghan National Army', priority: 2, notes: 'Local forces' },
    ],
    opfor: [
      { classname: 'UK3CB_TKM_O', displayName: 'Takistan Insurgents', priority: 1 },
      { classname: 'UK3CB_MEI_O', displayName: 'Middle East Insurgents', priority: 1 },
      { classname: 'UK3CB_MEE_O', displayName: 'Middle East Extremists', priority: 1 },
      { classname: 'CUP_O_TK_MILITIA', displayName: 'Takistani Militia', priority: 1 },
      { classname: 'CUP_O_TK', displayName: 'Takistani Army', priority: 2 },
      { classname: 'rhs_faction_insurgents', displayName: 'Eastern Militia (RHS)', priority: 2 },
    ],
    independent: [
      { classname: 'UK3CB_TKM_I', displayName: 'Takistan Tribal Fighters', priority: 1 },
      { classname: 'CUP_I_TK_GUE', displayName: 'Takistani Locals', priority: 1 },
      { classname: 'UK3CB_ANP_B', displayName: 'Afghan National Police', priority: 2 },
    ],
    civilians: [
      { classname: 'UK3CB_TKC_C', displayName: 'Takistan Civilians', priority: 1 },
      { classname: 'UK3CB_MEC_C', displayName: 'Middle East Civilians', priority: 1 },
      { classname: 'CUP_C_TK', displayName: 'Civilians (Takistan)', priority: 2 },
    ],
  },

  // ==================== EASTERN EUROPE / CHERNARUS ====================
  {
    mapPatterns: ['chernarus', 'utes', 'bukovina', 'bystrica', 'rosche'],
    region: 'Eastern Europe / Chernarus',
    description: 'Post-Soviet conflict zone, woodland/farmland',
    blufor: [
      { classname: 'rhs_faction_usarmy_wd', displayName: 'USA (Army - Woodland)', priority: 1 },
      { classname: 'rhs_faction_usmc_wd', displayName: 'USA (USMC - Woodland)', priority: 1 },
      { classname: 'UK3CB_BAF_Faction_Army_MTP', displayName: 'BAF MTP', priority: 1 },
      { classname: 'rhsgref_faction_cdf_ground_b', displayName: 'CDF (Ground Forces)', priority: 1, notes: 'Local forces' },
      { classname: 'CUP_B_CDF', displayName: 'Chernarus Defense Forces', priority: 2 },
    ],
    opfor: [
      { classname: 'rhs_faction_msv', displayName: 'Russia (MSV)', priority: 1 },
      { classname: 'rhs_faction_vdv', displayName: 'Russia (VDV)', priority: 1 },
      { classname: 'UK3CB_CHD_O', displayName: 'ChDKZ (Red Star)', priority: 1, notes: 'Insurgents' },
      { classname: 'rhsgref_faction_chdkz', displayName: 'ChDKZ (RHS)', priority: 1 },
      { classname: 'CUP_O_RU', displayName: 'Russian Federation (CUP)', priority: 2 },
      { classname: 'CUP_O_ChDKZ', displayName: 'ChDKZ (CUP)', priority: 2 },
    ],
    independent: [
      { classname: 'UK3CB_CCM_I', displayName: 'Chernarus Nationalist Militia', priority: 1 },
      { classname: 'rhsgref_faction_nationalist', displayName: 'NAPA', priority: 1 },
      { classname: 'CUP_I_NAPA', displayName: 'NAPA (CUP)', priority: 2 },
    ],
    civilians: [
      { classname: 'UK3CB_CHC_C', displayName: 'Chernarus Civilians', priority: 1 },
      { classname: 'CUP_C_CHERNARUS', displayName: 'Civilians (Chernarus)', priority: 2 },
      { classname: 'CUP_C_RU', displayName: 'Civilians (Russian)', priority: 2 },
    ],
  },

  // ==================== MEDITERRANEAN / ALTIS-STRATIS ====================
  {
    mapPatterns: ['altis', 'stratis', 'malden'],
    region: 'Mediterranean',
    description: 'Greek islands, conventional/guerrilla warfare',
    blufor: [
      { classname: 'rhs_faction_usarmy', displayName: 'USA (Army)', priority: 1 },
      { classname: 'rhs_faction_usmc', displayName: 'USA (USMC)', priority: 1 },
      { classname: 'UK3CB_BAF_Faction_Army_MTP', displayName: 'BAF MTP', priority: 1 },
      { classname: 'CUP_B_US_Army', displayName: 'US Army (CUP)', priority: 2 },
      { classname: 'UK3CB_MDF_B', displayName: 'Malden Defence Force', priority: 2 },
    ],
    opfor: [
      { classname: 'UK3CB_CSAT_M_O', displayName: 'CSAT Mediterranean', priority: 1 },
      { classname: 'rhs_faction_msv', displayName: 'Russia (MSV)', priority: 1 },
      { classname: 'rhs_faction_vdv', displayName: 'Russia (VDV)', priority: 1 },
      { classname: 'UK3CB_AAF_O', displayName: '3CB AAF', priority: 2 },
    ],
    independent: [
      { classname: 'UK3CB_AAF_I', displayName: '3CB AAF', priority: 1 },
      { classname: 'UK3CB_FIA_I', displayName: '3CB FIA', priority: 1, notes: 'Guerrillas' },
      { classname: 'UK3CB_MDF_I', displayName: 'Malden Defence Force', priority: 2 },
    ],
    civilians: [
      { classname: 'CIV_F_EUROPE', displayName: 'Civilians (European)', priority: 1 },
      { classname: 'UK3CB_CHC_C', displayName: 'Chernarus Civilians', priority: 2 },
    ],
  },

  // ==================== PACIFIC / TANOA ====================
  {
    mapPatterns: ['tanoa', 'lingor', 'pantelleria', 'isladuala'],
    region: 'Pacific / Tropical',
    description: 'Jungle/island terrain, criminal syndicates',
    blufor: [
      { classname: 'rhs_faction_usmc', displayName: 'USMC', priority: 1 },
      { classname: 'UK3CB_BAF_Faction_Army_Tropical', displayName: 'BAF Tropical', priority: 1 },
      { classname: 'rhs_faction_usarmy', displayName: 'USA (Army)', priority: 2 },
      { classname: 'rhsgref_faction_hidf', displayName: 'Horizon Islands Defence Force', priority: 2 },
    ],
    opfor: [
      { classname: 'UK3CB_CSAT_G_O', displayName: 'CSAT Pacific', priority: 1 },
      { classname: 'rhsgref_faction_tla', displayName: 'Tanoan Liberation Army', priority: 1 },
      { classname: 'UK3CB_TNM_O', displayName: 'Tanoa Nationalist Militia', priority: 1 },
    ],
    independent: [
      { classname: 'UK3CB_TNM_I', displayName: 'Tanoa Nationalist Militia', priority: 1 },
      { classname: 'rhsgref_faction_tla_g', displayName: 'TLA (Independent)', priority: 1 },
      { classname: 'UK3CB_PLM_I', displayName: "People's Liberation Movement", priority: 2 },
    ],
    civilians: [
      { classname: 'CIV_F_TANOA', displayName: 'Civilians (Tanoan)', priority: 1 },
      { classname: 'CIV_F_ASIA', displayName: 'Civilians (Asian)', priority: 2 },
    ],
  },

  // ==================== LIVONIA / BALTIC ====================
  {
    mapPatterns: ['livonia', 'enoch', 'weferlingen', 'beketov'],
    region: 'Baltic / Eastern Europe',
    description: 'Forests, conventional/hybrid warfare',
    blufor: [
      { classname: 'UK3CB_LDF_B', displayName: 'Livonia Defence Force', priority: 1, notes: 'Local forces' },
      { classname: 'rhs_faction_usarmy_wd', displayName: 'USA (Army - Woodland)', priority: 1 },
      { classname: 'UK3CB_BAF_Faction_Army_Woodland', displayName: 'BAF Woodland', priority: 1 },
      { classname: 'BWA3_Faction_Fleck', displayName: 'Bundeswehr (Flecktarn)', priority: 2 },
    ],
    opfor: [
      { classname: 'rhs_faction_vdv', displayName: 'Russia (VDV)', priority: 1 },
      { classname: 'rhs_faction_msv', displayName: 'Russia (MSV)', priority: 1 },
      { classname: 'UK3CB_CSAT_W_O', displayName: 'CSAT Europe', priority: 1 },
      { classname: 'UK3CB_LSM_O', displayName: 'Livonia Separatist Militia', priority: 2 },
    ],
    independent: [
      { classname: 'UK3CB_LDF_I', displayName: 'Livonia Defence Force', priority: 1 },
      { classname: 'UK3CB_LNM_I', displayName: 'Livonian Nationalist Militia', priority: 1 },
      { classname: 'UK3CB_LFR_I', displayName: 'Livonia Forest Rangers', priority: 2 },
    ],
    civilians: [
      { classname: 'CIV_F_EUROPE', displayName: 'Civilians (European)', priority: 1 },
    ],
  },

  // ==================== AFRICA ====================
  {
    mapPatterns: ['porto', 'djibouti', 'somalia', 'africa', 'sahel', 'nam', 'prei'],
    region: 'Africa',
    description: 'Desert/savanna, asymmetric warfare',
    blufor: [
      { classname: 'rhs_faction_usarmy_d', displayName: 'USA (Army - Desert)', priority: 1 },
      { classname: 'UK3CB_BAF_Faction_Army_Desert', displayName: 'BAF Desert', priority: 1 },
      { classname: 'UK3CB_ADA_B', displayName: 'African Desert Army', priority: 2, notes: 'Local forces' },
    ],
    opfor: [
      { classname: 'UK3CB_ADE_O', displayName: 'African Desert Extremists', priority: 1 },
      { classname: 'UK3CB_ADM_O', displayName: 'African Desert Militia', priority: 1 },
      { classname: 'UK3CB_CSAT_A_O', displayName: 'CSAT Africa', priority: 2 },
    ],
    independent: [
      { classname: 'UK3CB_ADM_I', displayName: 'African Desert Militia', priority: 1 },
      { classname: 'UK3CB_ADG_I', displayName: 'African Desert Civilian Militia', priority: 2 },
    ],
    civilians: [
      { classname: 'UK3CB_ADC_C', displayName: 'African Desert Civilians', priority: 1 },
      { classname: 'CIV_F_AFRICA', displayName: 'Civilians (African)', priority: 2 },
    ],
  },

  // ==================== COLD WAR ====================
  {
    mapPatterns: ['coldwar', 'weferlingen', 'fulda', 'germany'],
    region: 'Cold War Europe',
    description: 'Historical Cold War scenario',
    blufor: [
      { classname: 'UK3CB_CW_US_B_LATE', displayName: 'Cold War US - Late', priority: 1 },
      { classname: 'UK3CB_CW_US_B_EARLY', displayName: 'Cold War US - Early', priority: 1 },
      { classname: 'BWA3_Faction_Fleck', displayName: 'Bundeswehr (Flecktarn)', priority: 2 },
    ],
    opfor: [
      { classname: 'UK3CB_CW_SOV_O_LATE', displayName: 'Cold War USSR - Late', priority: 1 },
      { classname: 'UK3CB_CW_SOV_O_EARLY', displayName: 'Cold War USSR - Early', priority: 1 },
    ],
    independent: [
      { classname: 'rhsgref_faction_cdf_ground', displayName: 'CDF (Ground Forces)', priority: 2 },
    ],
    civilians: [
      { classname: 'CIV_F_EUROPE', displayName: 'Civilians (European)', priority: 1 },
    ],
  },

  // ==================== DEFAULT (NO VANILLA!) ====================
  {
    mapPatterns: ['.*'],  // Catch-all
    region: 'Generic',
    description: 'Default modded factions for unknown maps',
    blufor: [
      { classname: 'rhs_faction_usarmy_wd', displayName: 'USA (Army - Woodland)', priority: 1 },
      { classname: 'rhs_faction_usmc_wd', displayName: 'USA (USMC - Woodland)', priority: 1 },
      { classname: 'UK3CB_BAF_Faction_Army_MTP', displayName: 'BAF MTP', priority: 2 },
      { classname: 'CUP_B_US_Army', displayName: 'US Army (CUP)', priority: 2 },
      { classname: 'BWA3_Faction_Fleck', displayName: 'Bundeswehr (Flecktarn)', priority: 3 },
    ],
    opfor: [
      { classname: 'rhs_faction_msv', displayName: 'Russia (MSV)', priority: 1 },
      { classname: 'rhs_faction_vdv', displayName: 'Russia (VDV)', priority: 1 },
      { classname: 'CUP_O_RU', displayName: 'Russian Federation (CUP)', priority: 2 },
      { classname: 'UK3CB_CHD_O', displayName: 'ChDKZ (Red Star)', priority: 2 },
      { classname: 'rhs_faction_insurgents', displayName: 'Eastern Militia (RHS)', priority: 3 },
    ],
    independent: [
      { classname: 'rhsgref_faction_cdf_ground', displayName: 'CDF (Ground Forces)', priority: 1 },
      { classname: 'rhsgref_faction_nationalist', displayName: 'NAPA', priority: 2 },
      { classname: 'UK3CB_FIA_I', displayName: '3CB FIA', priority: 2 },
    ],
    civilians: [
      { classname: 'UK3CB_CHC_C', displayName: 'Chernarus Civilians', priority: 1 },
      { classname: 'CUP_C_CHERNARUS', displayName: 'Civilians (Chernarus)', priority: 2 },
      { classname: 'CIV_F_EUROPE', displayName: 'Civilians (European)', priority: 3 },
    ],
  },
];

/**
 * Get faction recommendations for a given map name
 */
export function getFactionsForMap(mapName: string): MapFactionProfile | null {
  const lowerMap = mapName.toLowerCase();

  for (const profile of mapFactionProfiles) {
    // Skip the catch-all unless nothing else matches
    if (profile.mapPatterns.includes('.*')) continue;

    for (const pattern of profile.mapPatterns) {
      if (lowerMap.includes(pattern) || new RegExp(pattern, 'i').test(lowerMap)) {
        return profile;
      }
    }
  }

  // Return the catch-all default
  return mapFactionProfiles[mapFactionProfiles.length - 1];
}

/**
 * Get a simple summary for Claude's context
 */
export function getMapFactionSummary(mapName: string): string {
  const profile = getFactionsForMap(mapName);
  if (!profile) return 'Unknown map - use vanilla NATO vs CSAT';

  const bluforTop = profile.blufor.filter(f => f.priority === 1).map(f => f.displayName).join(', ');
  const opforTop = profile.opfor.filter(f => f.priority === 1).map(f => f.displayName).join(', ');
  const indepTop = profile.independent.filter(f => f.priority === 1).map(f => f.displayName).join(', ');

  return `Region: ${profile.region}
Theme: ${profile.description}
Recommended BLUFOR: ${bluforTop}
Recommended OPFOR: ${opforTop}
Recommended Independent: ${indepTop}`;
}

/**
 * Get classnames for a specific side (for SQF generation)
 */
export function getRecommendedClassnames(mapName: string, side: 'blufor' | 'opfor' | 'independent' | 'civilians'): string[] {
  const profile = getFactionsForMap(mapName);
  if (!profile) return [];

  const factions = profile[side];
  return factions
    .sort((a, b) => a.priority - b.priority)
    .map(f => f.classname);
}
