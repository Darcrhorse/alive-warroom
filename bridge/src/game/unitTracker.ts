/**
 * Unit Tracker - Tracks all spawned units for each side
 * Enables AI to command existing units instead of always spawning new ones
 */

export interface TrackedUnit {
  id: string;
  classname: string;
  type: 'infantry' | 'vehicle' | 'air' | 'static';
  alive: boolean;
  health: number;
  position: [number, number, number];
  lastSeen: number; // timestamp
}

export interface TrackedGroup {
  id: number;
  side: 'EAST' | 'WEST';
  name: string;
  units: TrackedUnit[];
  task: string;
  taskPosition?: [number, number, number];
  status: 'idle' | 'moving' | 'combat' | 'retreating' | 'destroyed';
  spawnTime: number;
  combatReports: CombatReport[];
}

export interface CombatReport {
  timestamp: number;
  type: 'contact' | 'casualty' | 'kill' | 'under_fire' | 'objective_reached';
  position: [number, number, number];
  details: string;
}

export interface Objective {
  id: string;
  name: string;
  position: [number, number, number];
  type: 'capture' | 'destroy' | 'defend';
  controller: 'EAST' | 'WEST' | 'NEUTRAL' | 'CONTESTED';
  value: number; // budget bonus for controlling
  radius: number;
}

export class UnitTracker {
  private eastGroups: Map<number, TrackedGroup> = new Map();
  private westGroups: Map<number, TrackedGroup> = new Map();
  private nextGroupId: number = 1;
  private objectives: Map<string, Objective> = new Map();
  private combatLog: CombatReport[] = [];

  constructor() {
    console.log('[UnitTracker] Initialized');
  }

  /**
   * Register a newly spawned group
   */
  registerGroup(side: 'EAST' | 'WEST', name: string, units: Partial<TrackedUnit>[], task: string = 'patrol', taskPosition?: [number, number, number]): number {
    const groupId = this.nextGroupId++;

    const trackedUnits: TrackedUnit[] = units.map((u, i) => ({
      id: `${groupId}_${i}`,
      classname: u.classname || 'Unknown',
      type: u.type || 'infantry',
      alive: true,
      health: 1.0,
      position: u.position || [0, 0, 0],
      lastSeen: Date.now()
    }));

    const group: TrackedGroup = {
      id: groupId,
      side,
      name,
      units: trackedUnits,
      task,
      taskPosition,
      status: 'idle',
      spawnTime: Date.now(),
      combatReports: []
    };

    if (side === 'EAST') {
      this.eastGroups.set(groupId, group);
    } else {
      this.westGroups.set(groupId, group);
    }

    console.log(`[UnitTracker] Registered ${side} group ${groupId}: "${name}" with ${units.length} units, task: ${task}`);
    return groupId;
  }

  /**
   * Update group status from game state
   */
  updateGroup(groupId: number, updates: Partial<TrackedGroup>): void {
    const group = this.eastGroups.get(groupId) || this.westGroups.get(groupId);
    if (group) {
      Object.assign(group, updates);
      console.log(`[UnitTracker] Updated group ${groupId}: status=${group.status}, task=${group.task}`);
    }
  }

  /**
   * Report a combat event
   */
  reportCombat(groupId: number, report: CombatReport): void {
    const group = this.eastGroups.get(groupId) || this.westGroups.get(groupId);
    if (group) {
      group.combatReports.push(report);
      group.status = 'combat';
      this.combatLog.push(report);
      console.log(`[UnitTracker] Combat report for group ${groupId}: ${report.type} - ${report.details}`);
    }
  }

  /**
   * Report unit casualty
   */
  reportCasualty(groupId: number, unitId: string, position: [number, number, number]): void {
    const group = this.eastGroups.get(groupId) || this.westGroups.get(groupId);
    if (group) {
      const unit = group.units.find(u => u.id === unitId);
      if (unit) {
        unit.alive = false;
        unit.health = 0;
      }

      const aliveCount = group.units.filter(u => u.alive).length;
      if (aliveCount === 0) {
        group.status = 'destroyed';
      }

      this.reportCombat(groupId, {
        timestamp: Date.now(),
        type: 'casualty',
        position,
        details: `Unit KIA. ${aliveCount}/${group.units.length} remaining.`
      });
    }
  }

  /**
   * Get all groups for a side
   */
  getGroups(side: 'EAST' | 'WEST'): TrackedGroup[] {
    const groups = side === 'EAST' ? this.eastGroups : this.westGroups;
    return Array.from(groups.values());
  }

  /**
   * Get active (not destroyed) groups for a side
   */
  getActiveGroups(side: 'EAST' | 'WEST'): TrackedGroup[] {
    return this.getGroups(side).filter(g => g.status !== 'destroyed');
  }

  /**
   * Get force summary for AI decision making
   */
  getForceSummary(side: 'EAST' | 'WEST'): {
    totalGroups: number;
    activeGroups: number;
    totalUnits: number;
    aliveUnits: number;
    inCombat: number;
    idle: number;
    groupDetails: { id: number; name: string; alive: number; total: number; task: string; status: string }[];
  } {
    const groups = this.getGroups(side);
    const activeGroups = groups.filter(g => g.status !== 'destroyed');

    let totalUnits = 0;
    let aliveUnits = 0;
    let inCombat = 0;
    let idle = 0;

    const groupDetails = groups.map(g => {
      const alive = g.units.filter(u => u.alive).length;
      totalUnits += g.units.length;
      aliveUnits += alive;
      if (g.status === 'combat') inCombat++;
      if (g.status === 'idle') idle++;

      return {
        id: g.id,
        name: g.name,
        alive,
        total: g.units.length,
        task: g.task,
        status: g.status
      };
    });

    return {
      totalGroups: groups.length,
      activeGroups: activeGroups.length,
      totalUnits,
      aliveUnits,
      inCombat,
      idle,
      groupDetails
    };
  }

  /**
   * Get recent combat reports for AI awareness
   */
  getRecentCombatReports(side: 'EAST' | 'WEST', maxAge: number = 300000): CombatReport[] {
    const now = Date.now();
    const groups = this.getGroups(side);
    const reports: CombatReport[] = [];

    for (const group of groups) {
      for (const report of group.combatReports) {
        if (now - report.timestamp < maxAge) {
          reports.push(report);
        }
      }
    }

    return reports.sort((a, b) => b.timestamp - a.timestamp);
  }

  // ========== OBJECTIVES ==========

  /**
   * Register an objective
   */
  registerObjective(objective: Objective): void {
    this.objectives.set(objective.id, objective);
    console.log(`[UnitTracker] Registered objective: ${objective.name} (${objective.type}) at ${objective.position}`);
  }

  /**
   * Update objective controller
   */
  updateObjectiveControl(objectiveId: string, controller: Objective['controller']): void {
    const obj = this.objectives.get(objectiveId);
    if (obj) {
      const oldController = obj.controller;
      obj.controller = controller;
      console.log(`[UnitTracker] Objective "${obj.name}" control: ${oldController} -> ${controller}`);
    }
  }

  /**
   * Get all objectives
   */
  getObjectives(): Objective[] {
    return Array.from(this.objectives.values());
  }

  /**
   * Get objectives controlled by a side
   */
  getControlledObjectives(side: 'EAST' | 'WEST'): Objective[] {
    return this.getObjectives().filter(o => o.controller === side);
  }

  /**
   * Calculate budget bonus from controlled objectives
   */
  getObjectiveBudgetBonus(side: 'EAST' | 'WEST'): number {
    return this.getControlledObjectives(side).reduce((sum, o) => sum + o.value, 0);
  }

  /**
   * Generate state summary for AI prompt
   */
  generateAIStateSummary(side: 'EAST' | 'WEST'): string {
    const forces = this.getForceSummary(side);
    const enemySide = side === 'EAST' ? 'WEST' : 'EAST';
    const enemyForces = this.getForceSummary(enemySide);
    const recentReports = this.getRecentCombatReports(side, 120000); // Last 2 min
    const objectives = this.getObjectives();

    let summary = `\n=== YOUR FORCES (${side}) ===\n`;
    summary += `Active Groups: ${forces.activeGroups}/${forces.totalGroups}\n`;
    summary += `Personnel: ${forces.aliveUnits}/${forces.totalUnits} alive\n`;
    summary += `Status: ${forces.inCombat} in combat, ${forces.idle} idle\n\n`;

    if (forces.groupDetails.length > 0) {
      summary += `YOUR UNITS:\n`;
      for (const g of forces.groupDetails) {
        summary += `  - Group ${g.id} "${g.name}": ${g.alive}/${g.total} alive, ${g.status}, task: ${g.task}\n`;
      }
      summary += `\n`;
    }

    summary += `=== KNOWN ENEMY FORCES (${enemySide}) ===\n`;
    summary += `Estimated Groups: ${enemyForces.activeGroups}\n`;
    summary += `Estimated Personnel: ${enemyForces.aliveUnits}\n\n`;

    if (objectives.length > 0) {
      summary += `=== OBJECTIVES ===\n`;
      for (const obj of objectives) {
        summary += `  - ${obj.name}: ${obj.controller} (value: ${obj.value})\n`;
      }
      summary += `\n`;
    }

    if (recentReports.length > 0) {
      summary += `=== RECENT COMBAT REPORTS ===\n`;
      for (const r of recentReports.slice(0, 5)) {
        const age = Math.round((Date.now() - r.timestamp) / 1000);
        summary += `  - [${age}s ago] ${r.type.toUpperCase()}: ${r.details}\n`;
      }
    }

    return summary;
  }

  /**
   * Reset tracker (for new mission)
   */
  reset(): void {
    this.eastGroups.clear();
    this.westGroups.clear();
    this.objectives.clear();
    this.combatLog = [];
    this.nextGroupId = 1;
    console.log('[UnitTracker] Reset');
  }
}

// Singleton instance
export const unitTracker = new UnitTracker();
