/**
 * Arma 3 Classname Database
 * Contains common units, vehicles, and assets for the AI Game Master
 */

export interface ArmaAsset {
  classname: string;
  displayName: string;
  side: 'EAST' | 'WEST' | 'GUER' | 'CIV';
  category: 'infantry' | 'ground_vehicle' | 'air_vehicle' | 'static_weapon' | 'support';
  subcategory?: string;
  faction?: string;
}

// OPFOR/CSAT Infantry
const eastInfantry: ArmaAsset[] = [
  { classname: 'O_Soldier_F', displayName: 'Rifleman', side: 'EAST', category: 'infantry', subcategory: 'rifleman', faction: 'OPF_F' },
  { classname: 'O_Soldier_GL_F', displayName: 'Grenadier', side: 'EAST', category: 'infantry', subcategory: 'grenadier', faction: 'OPF_F' },
  { classname: 'O_Soldier_AR_F', displayName: 'Autorifleman', side: 'EAST', category: 'infantry', subcategory: 'machinegunner', faction: 'OPF_F' },
  { classname: 'O_Soldier_LAT_F', displayName: 'Rifleman (AT)', side: 'EAST', category: 'infantry', subcategory: 'at', faction: 'OPF_F' },
  { classname: 'O_Soldier_AT_F', displayName: 'AT Specialist', side: 'EAST', category: 'infantry', subcategory: 'at', faction: 'OPF_F' },
  { classname: 'O_Soldier_AA_F', displayName: 'AA Specialist', side: 'EAST', category: 'infantry', subcategory: 'aa', faction: 'OPF_F' },
  { classname: 'O_Soldier_M_F', displayName: 'Marksman', side: 'EAST', category: 'infantry', subcategory: 'marksman', faction: 'OPF_F' },
  { classname: 'O_sniper_F', displayName: 'Sniper', side: 'EAST', category: 'infantry', subcategory: 'sniper', faction: 'OPF_F' },
  { classname: 'O_spotter_F', displayName: 'Spotter', side: 'EAST', category: 'infantry', subcategory: 'sniper', faction: 'OPF_F' },
  { classname: 'O_Soldier_TL_F', displayName: 'Team Leader', side: 'EAST', category: 'infantry', subcategory: 'leader', faction: 'OPF_F' },
  { classname: 'O_Soldier_SL_F', displayName: 'Squad Leader', side: 'EAST', category: 'infantry', subcategory: 'leader', faction: 'OPF_F' },
  { classname: 'O_officer_F', displayName: 'Officer', side: 'EAST', category: 'infantry', subcategory: 'leader', faction: 'OPF_F' },
  { classname: 'O_medic_F', displayName: 'Combat Medic', side: 'EAST', category: 'infantry', subcategory: 'medic', faction: 'OPF_F' },
  { classname: 'O_engineer_F', displayName: 'Engineer', side: 'EAST', category: 'infantry', subcategory: 'engineer', faction: 'OPF_F' },
  { classname: 'O_soldier_exp_F', displayName: 'Explosives Specialist', side: 'EAST', category: 'infantry', subcategory: 'engineer', faction: 'OPF_F' },
  { classname: 'O_soldier_repair_F', displayName: 'Repair Specialist', side: 'EAST', category: 'infantry', subcategory: 'engineer', faction: 'OPF_F' },
  { classname: 'O_recon_F', displayName: 'Recon Scout', side: 'EAST', category: 'infantry', subcategory: 'recon', faction: 'OPF_F' },
  { classname: 'O_recon_TL_F', displayName: 'Recon Team Leader', side: 'EAST', category: 'infantry', subcategory: 'recon', faction: 'OPF_F' },
  { classname: 'O_recon_M_F', displayName: 'Recon Marksman', side: 'EAST', category: 'infantry', subcategory: 'recon', faction: 'OPF_F' },
  { classname: 'O_recon_LAT_F', displayName: 'Recon AT', side: 'EAST', category: 'infantry', subcategory: 'recon', faction: 'OPF_F' },
  { classname: 'O_recon_medic_F', displayName: 'Recon Medic', side: 'EAST', category: 'infantry', subcategory: 'recon', faction: 'OPF_F' },
  { classname: 'O_crew_F', displayName: 'Crew', side: 'EAST', category: 'infantry', subcategory: 'crew', faction: 'OPF_F' },
  { classname: 'O_helicrew_F', displayName: 'Helicopter Crew', side: 'EAST', category: 'infantry', subcategory: 'crew', faction: 'OPF_F' },
  { classname: 'O_helipilot_F', displayName: 'Helicopter Pilot', side: 'EAST', category: 'infantry', subcategory: 'pilot', faction: 'OPF_F' },
  { classname: 'O_Pilot_F', displayName: 'Pilot', side: 'EAST', category: 'infantry', subcategory: 'pilot', faction: 'OPF_F' },
];

// BLUFOR/NATO Infantry
const westInfantry: ArmaAsset[] = [
  { classname: 'B_Soldier_F', displayName: 'Rifleman', side: 'WEST', category: 'infantry', subcategory: 'rifleman', faction: 'BLU_F' },
  { classname: 'B_Soldier_GL_F', displayName: 'Grenadier', side: 'WEST', category: 'infantry', subcategory: 'grenadier', faction: 'BLU_F' },
  { classname: 'B_Soldier_AR_F', displayName: 'Autorifleman', side: 'WEST', category: 'infantry', subcategory: 'machinegunner', faction: 'BLU_F' },
  { classname: 'B_Soldier_LAT_F', displayName: 'Rifleman (AT)', side: 'WEST', category: 'infantry', subcategory: 'at', faction: 'BLU_F' },
  { classname: 'B_Soldier_AT_F', displayName: 'AT Specialist', side: 'WEST', category: 'infantry', subcategory: 'at', faction: 'BLU_F' },
  { classname: 'B_Soldier_AA_F', displayName: 'AA Specialist', side: 'WEST', category: 'infantry', subcategory: 'aa', faction: 'BLU_F' },
  { classname: 'B_Soldier_M_F', displayName: 'Marksman', side: 'WEST', category: 'infantry', subcategory: 'marksman', faction: 'BLU_F' },
  { classname: 'B_sniper_F', displayName: 'Sniper', side: 'WEST', category: 'infantry', subcategory: 'sniper', faction: 'BLU_F' },
  { classname: 'B_spotter_F', displayName: 'Spotter', side: 'WEST', category: 'infantry', subcategory: 'sniper', faction: 'BLU_F' },
  { classname: 'B_Soldier_TL_F', displayName: 'Team Leader', side: 'WEST', category: 'infantry', subcategory: 'leader', faction: 'BLU_F' },
  { classname: 'B_Soldier_SL_F', displayName: 'Squad Leader', side: 'WEST', category: 'infantry', subcategory: 'leader', faction: 'BLU_F' },
  { classname: 'B_officer_F', displayName: 'Officer', side: 'WEST', category: 'infantry', subcategory: 'leader', faction: 'BLU_F' },
  { classname: 'B_medic_F', displayName: 'Combat Medic', side: 'WEST', category: 'infantry', subcategory: 'medic', faction: 'BLU_F' },
  { classname: 'B_engineer_F', displayName: 'Engineer', side: 'WEST', category: 'infantry', subcategory: 'engineer', faction: 'BLU_F' },
  { classname: 'B_soldier_exp_F', displayName: 'Explosives Specialist', side: 'WEST', category: 'infantry', subcategory: 'engineer', faction: 'BLU_F' },
  { classname: 'B_soldier_repair_F', displayName: 'Repair Specialist', side: 'WEST', category: 'infantry', subcategory: 'engineer', faction: 'BLU_F' },
  { classname: 'B_recon_F', displayName: 'Recon Scout', side: 'WEST', category: 'infantry', subcategory: 'recon', faction: 'BLU_F' },
  { classname: 'B_recon_TL_F', displayName: 'Recon Team Leader', side: 'WEST', category: 'infantry', subcategory: 'recon', faction: 'BLU_F' },
  { classname: 'B_recon_M_F', displayName: 'Recon Marksman', side: 'WEST', category: 'infantry', subcategory: 'recon', faction: 'BLU_F' },
  { classname: 'B_recon_LAT_F', displayName: 'Recon AT', side: 'WEST', category: 'infantry', subcategory: 'recon', faction: 'BLU_F' },
  { classname: 'B_recon_medic_F', displayName: 'Recon Medic', side: 'WEST', category: 'infantry', subcategory: 'recon', faction: 'BLU_F' },
  { classname: 'B_crew_F', displayName: 'Crew', side: 'WEST', category: 'infantry', subcategory: 'crew', faction: 'BLU_F' },
  { classname: 'B_helicrew_F', displayName: 'Helicopter Crew', side: 'WEST', category: 'infantry', subcategory: 'crew', faction: 'BLU_F' },
  { classname: 'B_helipilot_F', displayName: 'Helicopter Pilot', side: 'WEST', category: 'infantry', subcategory: 'pilot', faction: 'BLU_F' },
  { classname: 'B_Pilot_F', displayName: 'Pilot', side: 'WEST', category: 'infantry', subcategory: 'pilot', faction: 'BLU_F' },
];

// OPFOR Vehicles
const eastVehicles: ArmaAsset[] = [
  // Ground - Light
  { classname: 'O_MRAP_02_F', displayName: 'Ifrit', side: 'EAST', category: 'ground_vehicle', subcategory: 'mrap', faction: 'OPF_F' },
  { classname: 'O_MRAP_02_hmg_F', displayName: 'Ifrit (HMG)', side: 'EAST', category: 'ground_vehicle', subcategory: 'mrap', faction: 'OPF_F' },
  { classname: 'O_MRAP_02_gmg_F', displayName: 'Ifrit (GMG)', side: 'EAST', category: 'ground_vehicle', subcategory: 'mrap', faction: 'OPF_F' },
  { classname: 'O_LSV_02_armed_F', displayName: 'Qilin (Armed)', side: 'EAST', category: 'ground_vehicle', subcategory: 'lsv', faction: 'OPF_F' },
  { classname: 'O_LSV_02_unarmed_F', displayName: 'Qilin', side: 'EAST', category: 'ground_vehicle', subcategory: 'lsv', faction: 'OPF_F' },
  // Ground - APCs
  { classname: 'O_APC_Wheeled_02_rcws_v2_F', displayName: 'MSE-3 Marid', side: 'EAST', category: 'ground_vehicle', subcategory: 'apc', faction: 'OPF_F' },
  { classname: 'O_APC_Tracked_02_cannon_F', displayName: 'BTR-K Kamysh', side: 'EAST', category: 'ground_vehicle', subcategory: 'apc', faction: 'OPF_F' },
  { classname: 'O_APC_Tracked_02_AA_F', displayName: 'ZSU-39 Tigris', side: 'EAST', category: 'ground_vehicle', subcategory: 'aa', faction: 'OPF_F' },
  // Ground - Tanks
  { classname: 'O_MBT_02_cannon_F', displayName: 'T-100 Varsuk', side: 'EAST', category: 'ground_vehicle', subcategory: 'tank', faction: 'OPF_F' },
  { classname: 'O_MBT_04_cannon_F', displayName: 'T-140 Angara', side: 'EAST', category: 'ground_vehicle', subcategory: 'tank', faction: 'OPF_F' },
  { classname: 'O_MBT_04_command_F', displayName: 'T-140K Angara', side: 'EAST', category: 'ground_vehicle', subcategory: 'tank', faction: 'OPF_F' },
  // Trucks
  { classname: 'O_Truck_02_covered_F', displayName: 'Zamak (Covered)', side: 'EAST', category: 'ground_vehicle', subcategory: 'truck', faction: 'OPF_F' },
  { classname: 'O_Truck_02_transport_F', displayName: 'Zamak (Transport)', side: 'EAST', category: 'ground_vehicle', subcategory: 'truck', faction: 'OPF_F' },
  { classname: 'O_Truck_03_covered_F', displayName: 'Tempest (Covered)', side: 'EAST', category: 'ground_vehicle', subcategory: 'truck', faction: 'OPF_F' },
];

// BLUFOR Vehicles
const westVehicles: ArmaAsset[] = [
  // Ground - Light
  { classname: 'B_MRAP_01_F', displayName: 'Hunter', side: 'WEST', category: 'ground_vehicle', subcategory: 'mrap', faction: 'BLU_F' },
  { classname: 'B_MRAP_01_hmg_F', displayName: 'Hunter (HMG)', side: 'WEST', category: 'ground_vehicle', subcategory: 'mrap', faction: 'BLU_F' },
  { classname: 'B_MRAP_01_gmg_F', displayName: 'Hunter (GMG)', side: 'WEST', category: 'ground_vehicle', subcategory: 'mrap', faction: 'BLU_F' },
  { classname: 'B_LSV_01_armed_F', displayName: 'Prowler (Armed)', side: 'WEST', category: 'ground_vehicle', subcategory: 'lsv', faction: 'BLU_F' },
  { classname: 'B_LSV_01_unarmed_F', displayName: 'Prowler', side: 'WEST', category: 'ground_vehicle', subcategory: 'lsv', faction: 'BLU_F' },
  // Ground - APCs
  { classname: 'B_APC_Wheeled_01_cannon_F', displayName: 'AMV-7 Marshall', side: 'WEST', category: 'ground_vehicle', subcategory: 'apc', faction: 'BLU_F' },
  { classname: 'B_APC_Tracked_01_rcws_F', displayName: 'IFV-6c Panther', side: 'WEST', category: 'ground_vehicle', subcategory: 'apc', faction: 'BLU_F' },
  { classname: 'B_APC_Tracked_01_AA_F', displayName: 'IFV-6a Cheetah', side: 'WEST', category: 'ground_vehicle', subcategory: 'aa', faction: 'BLU_F' },
  // Ground - Tanks
  { classname: 'B_MBT_01_cannon_F', displayName: 'M2A4 Slammer', side: 'WEST', category: 'ground_vehicle', subcategory: 'tank', faction: 'BLU_F' },
  { classname: 'B_MBT_01_TUSK_F', displayName: 'M2A4 Slammer UP', side: 'WEST', category: 'ground_vehicle', subcategory: 'tank', faction: 'BLU_F' },
  { classname: 'B_AFV_Wheeled_01_cannon_F', displayName: 'Rhino MGS', side: 'WEST', category: 'ground_vehicle', subcategory: 'tank', faction: 'BLU_F' },
  { classname: 'B_AFV_Wheeled_01_up_cannon_F', displayName: 'Rhino MGS UP', side: 'WEST', category: 'ground_vehicle', subcategory: 'tank', faction: 'BLU_F' },
  // Trucks
  { classname: 'B_Truck_01_covered_F', displayName: 'HEMTT (Covered)', side: 'WEST', category: 'ground_vehicle', subcategory: 'truck', faction: 'BLU_F' },
  { classname: 'B_Truck_01_transport_F', displayName: 'HEMTT (Transport)', side: 'WEST', category: 'ground_vehicle', subcategory: 'truck', faction: 'BLU_F' },
];

// OPFOR Aircraft
const eastAircraft: ArmaAsset[] = [
  // Helicopters - Transport
  { classname: 'O_Heli_Light_02_F', displayName: 'PO-30 Orca', side: 'EAST', category: 'air_vehicle', subcategory: 'transport_heli', faction: 'OPF_F' },
  { classname: 'O_Heli_Light_02_unarmed_F', displayName: 'PO-30 Orca (Unarmed)', side: 'EAST', category: 'air_vehicle', subcategory: 'transport_heli', faction: 'OPF_F' },
  { classname: 'O_Heli_Transport_04_F', displayName: 'Mi-290 Taru', side: 'EAST', category: 'air_vehicle', subcategory: 'transport_heli', faction: 'OPF_F' },
  { classname: 'O_Heli_Transport_04_bench_F', displayName: 'Mi-290 Taru (Bench)', side: 'EAST', category: 'air_vehicle', subcategory: 'transport_heli', faction: 'OPF_F' },
  // Helicopters - Attack
  { classname: 'O_Heli_Attack_02_dynamicLoadout_F', displayName: 'Mi-48 Kajman', side: 'EAST', category: 'air_vehicle', subcategory: 'attack_heli', faction: 'OPF_F' },
  { classname: 'O_Heli_Attack_02_F', displayName: 'Mi-48 Kajman', side: 'EAST', category: 'air_vehicle', subcategory: 'attack_heli', faction: 'OPF_F' },
  // Fixed Wing
  { classname: 'O_Plane_CAS_02_dynamicLoadout_F', displayName: 'To-199 Neophron', side: 'EAST', category: 'air_vehicle', subcategory: 'cas', faction: 'OPF_F' },
  { classname: 'O_Plane_Fighter_02_F', displayName: 'To-201 Shikra', side: 'EAST', category: 'air_vehicle', subcategory: 'fighter', faction: 'OPF_F' },
  { classname: 'O_Plane_Fighter_02_Stealth_F', displayName: 'To-201 Shikra (Stealth)', side: 'EAST', category: 'air_vehicle', subcategory: 'fighter', faction: 'OPF_F' },
  // UAVs
  { classname: 'O_UAV_02_dynamicLoadout_F', displayName: 'K40 Ababil-3', side: 'EAST', category: 'air_vehicle', subcategory: 'uav', faction: 'OPF_F' },
  { classname: 'O_UAV_01_F', displayName: 'AR-2 Darter', side: 'EAST', category: 'air_vehicle', subcategory: 'uav', faction: 'OPF_F' },
];

// BLUFOR Aircraft
const westAircraft: ArmaAsset[] = [
  // Helicopters - Transport
  { classname: 'B_Heli_Light_01_F', displayName: 'MH-9 Hummingbird', side: 'WEST', category: 'air_vehicle', subcategory: 'transport_heli', faction: 'BLU_F' },
  { classname: 'B_Heli_Light_01_armed_F', displayName: 'AH-9 Pawnee', side: 'WEST', category: 'air_vehicle', subcategory: 'light_attack_heli', faction: 'BLU_F' },
  { classname: 'B_Heli_Transport_01_F', displayName: 'UH-80 Ghost Hawk', side: 'WEST', category: 'air_vehicle', subcategory: 'transport_heli', faction: 'BLU_F' },
  { classname: 'B_Heli_Transport_03_F', displayName: 'CH-67 Huron', side: 'WEST', category: 'air_vehicle', subcategory: 'transport_heli', faction: 'BLU_F' },
  // Helicopters - Attack
  { classname: 'B_Heli_Attack_01_dynamicLoadout_F', displayName: 'AH-99 Blackfoot', side: 'WEST', category: 'air_vehicle', subcategory: 'attack_heli', faction: 'BLU_F' },
  { classname: 'B_Heli_Attack_01_F', displayName: 'AH-99 Blackfoot', side: 'WEST', category: 'air_vehicle', subcategory: 'attack_heli', faction: 'BLU_F' },
  // Fixed Wing
  { classname: 'B_Plane_CAS_01_dynamicLoadout_F', displayName: 'A-164 Wipeout', side: 'WEST', category: 'air_vehicle', subcategory: 'cas', faction: 'BLU_F' },
  { classname: 'B_Plane_Fighter_01_F', displayName: 'F/A-181 Black Wasp II', side: 'WEST', category: 'air_vehicle', subcategory: 'fighter', faction: 'BLU_F' },
  { classname: 'B_Plane_Fighter_01_Stealth_F', displayName: 'F/A-181 Black Wasp II (Stealth)', side: 'WEST', category: 'air_vehicle', subcategory: 'fighter', faction: 'BLU_F' },
  // UAVs
  { classname: 'B_UAV_02_dynamicLoadout_F', displayName: 'MQ-4A Greyhawk', side: 'WEST', category: 'air_vehicle', subcategory: 'uav', faction: 'BLU_F' },
  { classname: 'B_UAV_01_F', displayName: 'AR-2 Darter', side: 'WEST', category: 'air_vehicle', subcategory: 'uav', faction: 'BLU_F' },
  { classname: 'B_UAV_05_F', displayName: 'UCAV Sentinel', side: 'WEST', category: 'air_vehicle', subcategory: 'ucav', faction: 'BLU_F' },
];

// Static Weapons
const staticWeapons: ArmaAsset[] = [
  // EAST
  { classname: 'O_HMG_01_high_F', displayName: 'HMG (High)', side: 'EAST', category: 'static_weapon', subcategory: 'hmg', faction: 'OPF_F' },
  { classname: 'O_HMG_01_F', displayName: 'HMG (Low)', side: 'EAST', category: 'static_weapon', subcategory: 'hmg', faction: 'OPF_F' },
  { classname: 'O_GMG_01_high_F', displayName: 'GMG (High)', side: 'EAST', category: 'static_weapon', subcategory: 'gmg', faction: 'OPF_F' },
  { classname: 'O_GMG_01_F', displayName: 'GMG (Low)', side: 'EAST', category: 'static_weapon', subcategory: 'gmg', faction: 'OPF_F' },
  { classname: 'O_static_AT_F', displayName: 'Static Titan AT', side: 'EAST', category: 'static_weapon', subcategory: 'at', faction: 'OPF_F' },
  { classname: 'O_static_AA_F', displayName: 'Static Titan AA', side: 'EAST', category: 'static_weapon', subcategory: 'aa', faction: 'OPF_F' },
  { classname: 'O_Mortar_01_F', displayName: 'Mk6 Mortar', side: 'EAST', category: 'static_weapon', subcategory: 'mortar', faction: 'OPF_F' },
  // WEST
  { classname: 'B_HMG_01_high_F', displayName: 'HMG (High)', side: 'WEST', category: 'static_weapon', subcategory: 'hmg', faction: 'BLU_F' },
  { classname: 'B_HMG_01_F', displayName: 'HMG (Low)', side: 'WEST', category: 'static_weapon', subcategory: 'hmg', faction: 'BLU_F' },
  { classname: 'B_GMG_01_high_F', displayName: 'GMG (High)', side: 'WEST', category: 'static_weapon', subcategory: 'gmg', faction: 'BLU_F' },
  { classname: 'B_GMG_01_F', displayName: 'GMG (Low)', side: 'WEST', category: 'static_weapon', subcategory: 'gmg', faction: 'BLU_F' },
  { classname: 'B_static_AT_F', displayName: 'Static Titan AT', side: 'WEST', category: 'static_weapon', subcategory: 'at', faction: 'BLU_F' },
  { classname: 'B_static_AA_F', displayName: 'Static Titan AA', side: 'WEST', category: 'static_weapon', subcategory: 'aa', faction: 'BLU_F' },
  { classname: 'B_Mortar_01_F', displayName: 'Mk6 Mortar', side: 'WEST', category: 'static_weapon', subcategory: 'mortar', faction: 'BLU_F' },
];

// Combine all assets
export const armaDatabase: ArmaAsset[] = [
  ...eastInfantry,
  ...westInfantry,
  ...eastVehicles,
  ...westVehicles,
  ...eastAircraft,
  ...westAircraft,
  ...staticWeapons,
];

// Export categorized data
export const armaAssets = {
  infantry: {
    east: eastInfantry,
    west: westInfantry,
  },
  vehicles: {
    east: eastVehicles,
    west: westVehicles,
  },
  aircraft: {
    east: eastAircraft,
    west: westAircraft,
  },
  static: staticWeapons,
};
