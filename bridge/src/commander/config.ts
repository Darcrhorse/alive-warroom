/**
 * Commander Configuration - Staging Areas, Factions, and Strategic Settings
 *
 * Defines the configuration for each AI Commander including:
 * - Staging areas (where reinforcements spawn from)
 * - Faction classnames for units
 * - Strategic objectives and bonuses
 */

export interface StagingArea {
  name: string;
  position: [number, number, number];
  type: 'airfield' | 'base' | 'depot' | 'fob';
  /** Bonus ticket income per minute when controlled */
  ticketBonus: number;
  /** Additional unit pool when controlled */
  poolBonus?: {
    infantry?: number;
    lightVehicle?: number;
    heavyArmor?: number;
    helicopter?: number;
    fixedWing?: number;
  };
}

export interface FactionConfig {
  name: string;
  side: 'WEST' | 'EAST' | 'INDEPENDENT';
  /** Infantry classnames for this faction */
  infantry: string[];
  /** Light vehicle classnames */
  lightVehicles: string[];
  /** Heavy armor classnames (APCs, tanks) */
  heavyArmor: string[];
  /** Helicopter classnames */
  helicopters: string[];
  /** Fixed wing classnames */
  fixedWing: string[];
  /** Crew classnames for vehicles */
  crew: string[];
  /** Pilot classnames */
  pilots: string[];
}

export interface CommanderConfig {
  side: 'WEST' | 'EAST' | 'INDEPENDENT';
  faction: FactionConfig;
  stagingAreas: StagingArea[];
  /** Primary staging area for reinforcements */
  primaryStaging: string;
  /** Enable this commander */
  enabled: boolean;
}

// ==================== Default Faction Configurations ====================

export const RHS_USARMY_OCP: FactionConfig = {
  name: 'US Army (OCP)',
  side: 'WEST',
  infantry: [
    'rhsusf_army_ocp_squadleader',
    'rhsusf_army_ocp_teamleader',
    'rhsusf_army_ocp_rifleman',
    'rhsusf_army_ocp_autorifleman',
    'rhsusf_army_ocp_grenadier',
    'rhsusf_army_ocp_medic',
    'rhsusf_army_ocp_marksman',
    'rhsusf_army_ocp_javelin',
  ],
  lightVehicles: [
    'rhsusf_m1025_w_m2',
    'rhsusf_m1025_w_mk19',
    'rhsusf_m998_w_2dr',
    'rhsusf_M1220_usarmy_wd',
  ],
  heavyArmor: [
    'rhsusf_m113_usarmy_wd',
    'RHS_M2A3_BUSKIII_wd',
    'rhsusf_m1a1aim_tuski_wd',
    'rhsusf_m1a2sep1tuskiiwd_usarmy',
  ],
  helicopters: [
    'RHS_UH60M_d',
    'RHS_UH60M',
    'RHS_MELB_MH6M',
    'RHS_MELB_AH6M_L',
    'RHS_AH64D_wd',
  ],
  fixedWing: [
    'RHS_A10',
    'rhsusf_f22',
  ],
  crew: ['rhsusf_army_ocp_crewman'],
  pilots: ['rhsusf_army_ocp_helipilot'],
};

export const RHS_VDV: FactionConfig = {
  name: 'Russian VDV',
  side: 'EAST',
  infantry: [
    'rhs_vdv_sergeant',
    'rhs_vdv_junior_sergeant',
    'rhs_vdv_rifleman',
    'rhs_vdv_machinegunner',
    'rhs_vdv_grenadier',
    'rhs_vdv_medic',
    'rhs_vdv_marksman',
    'rhs_vdv_at',
  ],
  lightVehicles: [
    'rhs_tigr_m_vdv',
    'rhs_tigr_sts_vdv',
    'rhs_tigr_m_3camo_vdv',
  ],
  heavyArmor: [
    'rhs_btr80a_vdv',
    'rhs_bmp2d_vdv',
    'rhs_bmd4_vdv',
    'rhs_t80um',
  ],
  helicopters: [
    'RHS_Mi8mt_vdv',
    'RHS_Mi24V_vvsc',
    'RHS_Ka52_vvsc',
  ],
  fixedWing: [
    'RHS_Su25SM_vvsc',
  ],
  crew: ['rhs_driver_armored_msv'],
  pilots: ['rhs_pilot_transport_heli'],
};

export const VANILLA_GUER: FactionConfig = {
  name: 'FIA (Guerrilla)',
  side: 'INDEPENDENT',
  infantry: [
    'I_G_Soldier_SL_F',
    'I_G_Soldier_TL_F',
    'I_G_Soldier_F',
    'I_G_Soldier_AR_F',
    'I_G_Soldier_LAT_F',
    'I_G_medic_F',
    'I_G_Soldier_M_F',
    'I_G_Soldier_A_F',
  ],
  lightVehicles: [
    'I_G_Offroad_01_F',
    'I_G_Offroad_01_armed_F',
    'I_G_Van_01_transport_F',
  ],
  heavyArmor: [
    'I_APC_Wheeled_03_cannon_F',
    'I_APC_tracked_03_cannon_F',
  ],
  helicopters: [
    'I_Heli_light_03_unarmed_F',
  ],
  fixedWing: [],
  crew: ['I_G_Soldier_F'],
  pilots: ['I_G_Soldier_F'],
};

// ==================== Map-Specific Staging Areas ====================

export const SALMAN_PAK_STAGING: Record<string, StagingArea[]> = {
  WEST: [
    {
      name: 'Main Airfield',
      position: [8787, 9303, 0],
      type: 'airfield',
      ticketBonus: 3,
      poolBonus: { helicopter: 2, fixedWing: 1 },
    },
  ],
  EAST: [],
  INDEPENDENT: [
    {
      name: 'Guerrilla Village',
      position: [1999, 2886, 0],
      type: 'base',
      ticketBonus: 2,
      poolBonus: { infantry: 5, lightVehicle: 2 },
    },
  ],
};

export const ALTIS_STAGING: Record<string, StagingArea[]> = {
  WEST: [
    {
      name: 'Altis Airport',
      position: [14500, 16500, 0],
      type: 'airfield',
      ticketBonus: 3,
      poolBonus: { helicopter: 2, fixedWing: 1 },
    },
    {
      name: 'Camp Tempest',
      position: [12000, 14000, 0],
      type: 'fob',
      ticketBonus: 1,
    },
  ],
  EAST: [
    {
      name: 'Molos Airfield',
      position: [10500, 20000, 0],
      type: 'airfield',
      ticketBonus: 3,
      poolBonus: { helicopter: 2, fixedWing: 1 },
    },
  ],
  INDEPENDENT: [],
};

// ==================== Commander Configuration Factory ====================

/**
 * Create a commander configuration
 */
export function createCommanderConfig(
  side: 'WEST' | 'EAST' | 'INDEPENDENT',
  faction: FactionConfig,
  stagingAreas: StagingArea[],
  primaryStagingName?: string
): CommanderConfig {
  return {
    side,
    faction,
    stagingAreas,
    primaryStaging: primaryStagingName || stagingAreas[0]?.name || 'Unknown',
    enabled: true,
  };
}

/**
 * Default commander configurations
 */
// Generic staging areas for any map (will be near map edges)
const GENERIC_EAST_STAGING: StagingArea[] = [
  {
    name: 'EAST FOB',
    position: [2000, 2000, 0],
    type: 'fob',
    ticketBonus: 2,
    poolBonus: { infantry: 3, lightVehicle: 2 },
  },
];

const GENERIC_WEST_STAGING: StagingArea[] = [
  {
    name: 'WEST FOB',
    position: [8000, 8000, 0],
    type: 'fob',
    ticketBonus: 2,
    poolBonus: { infantry: 3, lightVehicle: 2 },
  },
];

export const DEFAULT_COMMANDERS: Record<string, CommanderConfig> = {
  WEST: createCommanderConfig('WEST', RHS_USARMY_OCP, SALMAN_PAK_STAGING.WEST.length > 0 ? SALMAN_PAK_STAGING.WEST : GENERIC_WEST_STAGING, 'Main Airfield'),
  EAST: createCommanderConfig('EAST', RHS_VDV, GENERIC_EAST_STAGING, 'EAST FOB'),
  INDEPENDENT: createCommanderConfig('INDEPENDENT', VANILLA_GUER, SALMAN_PAK_STAGING.INDEPENDENT, 'Guerrilla Village'),
};

/**
 * Get staging area by name for a side
 */
export function getStagingArea(side: 'WEST' | 'EAST' | 'INDEPENDENT', name: string): StagingArea | undefined {
  return DEFAULT_COMMANDERS[side]?.stagingAreas.find(s => s.name === name);
}

/**
 * Get primary staging position for a side
 */
export function getPrimaryStagingPosition(side: 'WEST' | 'EAST' | 'INDEPENDENT'): [number, number, number] | undefined {
  const config = DEFAULT_COMMANDERS[side];
  if (!config) return undefined;

  const staging = config.stagingAreas.find(s => s.name === config.primaryStaging);
  return staging?.position;
}

/**
 * Get random unit classname from faction
 */
export function getRandomUnit(
  faction: FactionConfig,
  type: 'infantry' | 'lightVehicle' | 'heavyArmor' | 'helicopter' | 'fixedWing'
): string | undefined {
  const pool = faction[type === 'lightVehicle' ? 'lightVehicles' : type === 'heavyArmor' ? 'heavyArmor' : type === 'helicopter' ? 'helicopters' : type === 'fixedWing' ? 'fixedWing' : 'infantry'];
  if (!pool || pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}
