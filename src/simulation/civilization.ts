import { DEFAULT_AGENTS } from "../data/defaultAgents";
import { DEFAULT_RESOURCES } from "../data/defaultResources";
import { DEFAULT_TECH_BLUEPRINTS } from "../data/defaultTech";
import type { PuzzleReward } from "../puzzle/types";
import type {
  AgentState,
  CivilizationMetricKey,
  CivilizationSnapshot,
  ResourceDescriptor,
  SimulationEvent,
  TechNode,
} from "./types";
import { AgentController } from "./agents";
import { ResourceSystem } from "./resourceSystem";
import { TechTree, type TechBlueprint } from "./techTree";

const METRIC_KEYS: CivilizationMetricKey[] = [
  "population",
  "knowledge",
  "culture",
  "infrastructure",
  "sustainability",
  "morale",
  "stability",
];

const RESOURCE_IMPACTS: Record<
  string,
  Partial<Record<CivilizationMetricKey, number>>
> = {
  "fresh-water": { population: 0.5, morale: 0.3 },
  "fertile-soil": { population: 0.4, morale: 0.2 },
  "solar-winds": { infrastructure: 0.6, sustainability: 0.5 },
  "geothermal-vents": { infrastructure: 0.7, knowledge: 0.2 },
  "rare-elements": { knowledge: 0.6, infrastructure: 0.4 },
};

export interface CivilizationOptions {
  seed?: number | string;
  agents?: AgentState[];
  resources?: ResourceDescriptor[];
  techs?: TechBlueprint[];
  initialMetrics?: Partial<Record<CivilizationMetricKey, number>>;
}

export class Civilization {
  private tickCount = 0;
  private metrics: Record<CivilizationMetricKey, number>;
  private resourceSystem: ResourceSystem;
  private agentController: AgentController;
  private techTree: TechTree;
  private resourceEfficiencyMultiplier = new Map<string, number>();
  private pendingPuzzleRewards: PuzzleReward[] = [];
  private pendingEvents: SimulationEvent[] = [];

  constructor(options: CivilizationOptions = {}) {
    const seed = options.seed ?? Date.now();
    this.metrics = {
      population: 25,
      knowledge: 12,
      culture: 18,
      infrastructure: 15,
      sustainability: 16,
      morale: 22,
      stability: 20,
      ...options.initialMetrics,
    };
    const resources = options.resources ?? DEFAULT_RESOURCES;
    const agents = options.agents ?? DEFAULT_AGENTS;
    const techs = options.techs ?? DEFAULT_TECH_BLUEPRINTS;
    this.resourceSystem = new ResourceSystem(resources);
    this.agentController = new AgentController(seed, agents);
    this.techTree = new TechTree(seed, techs);
  }

  applyPuzzleRewards(rewards: PuzzleReward[]) {
    this.pendingPuzzleRewards.push(...rewards);
  }

  tick(): CivilizationSnapshot {
    this.tickCount += 1;
    const events: SimulationEvent[] = [];

    // Expose resources once requirements are satisfied.
    const newlyExposed = this.resourceSystem.evaluateExposure(this.metrics);
    newlyExposed.forEach((res) =>
      events.push({
        type: "resourceChange",
        resourceId: res.id,
        delta: 0,
        cause: `${res.name} is now exploitable.`,
      })
    );

    // Agents act autonomously.
    const { contributions, events: agentEvents } = this.agentController.tick(this.metrics);
    events.push(...agentEvents);
    this.applyAgentContributions(contributions, events);

    // Consume queued puzzle rewards.
    this.flushPuzzleRewards(events);

    // Harvest exposed resources.
    this.harvestResources(events);

    // Natural drift: keep metrics within believable bounds.
    this.applyMetricDrift(events);

    // Evaluate tech unlocks and apply their effects.
    const unlockedTechs = this.techTree.evaluate(this.metrics);
    unlockedTechs.forEach((tech) => {
      this.applyTechEffects(tech, events);
      events.push({
        type: "techUnlocked",
        techId: tech.id,
        cause: `${tech.name} breakthroughs reach the public.`,
      });
    });

    // Persist events so external systems can consume narrative log.
    events.push(...this.pendingEvents);
    this.pendingEvents = [];

    return {
      tick: this.tickCount,
      metrics: { ...this.metrics },
      resources: Object.fromEntries(
        this.resourceSystem.list().map((res) => [res.id, { ...res }])
      ),
      agents: this.agentController.list(),
      visibleTech: this.techTree.list(),
      pendingEvents: events,
    };
  }

  private applyAgentContributions(
    contributions: Record<CivilizationMetricKey, number>,
    events: SimulationEvent[]
  ) {
    METRIC_KEYS.forEach((metric) => {
      const boost = contributions[metric] * 4.5;
      if (!boost) {
        return;
      }
      this.metrics[metric] = clamp(this.metrics[metric] + boost, 0, 150);
      events.push({
        type: "metricChange",
        metric,
        delta: Number(boost.toFixed(2)),
        cause: "Agent initiatives",
      });
    });
  }

  private flushPuzzleRewards(events: SimulationEvent[]) {
    if (this.pendingPuzzleRewards.length === 0) {
      return;
    }
    this.pendingPuzzleRewards.forEach((reward) => {
      const current = this.metrics[reward.metric];
      this.metrics[reward.metric] = clamp(current + reward.delta, 0, 160);
      events.push({
        type: "metricChange",
        metric: reward.metric,
        delta: reward.delta,
        cause: reward.description,
      });
    });
    this.pendingPuzzleRewards = [];
  }

  private harvestResources(events: SimulationEvent[]) {
    this.resourceSystem.list().forEach((resource) => {
      if (!resource.exposed) {
        return;
      }
      const efficiency = this.resourceEfficiencyMultiplier.get(resource.id) ?? 1;
      const effort =
        (this.metrics.infrastructure * 0.05 + this.metrics.population * 0.03) * efficiency;
      const { amount, exhausted } = this.resourceSystem.harvest(resource.id, effort);
      const impacts = RESOURCE_IMPACTS[resource.id];
      if (impacts) {
        Object.entries(impacts).forEach(([metric, weight]) => {
          const scaled = Number((amount * (weight ?? 0)).toFixed(2));
          if (scaled === 0) {
            return;
          }
          this.metrics[metric as CivilizationMetricKey] = clamp(
            this.metrics[metric as CivilizationMetricKey] + scaled,
            0,
            180
          );
          events.push({
            type: "metricChange",
            metric: metric as CivilizationMetricKey,
            delta: scaled,
            cause: `${resource.name} output`,
          });
        });
      }
      if (exhausted) {
        events.push({
          type: "resourceChange",
          resourceId: resource.id,
          delta: -1,
          cause: `${resource.name} nears depletion.`,
        });
        this.metrics.sustainability = clamp(this.metrics.sustainability - 1.5, 0, 180);
      }
    });
  }

  private applyMetricDrift(events: SimulationEvent[]) {
    METRIC_KEYS.forEach((metric) => {
      const current = this.metrics[metric];
      const drift = -0.25 - current * 0.002;
      const next = clamp(current + drift, 0, 180);
      this.metrics[metric] = next;
      events.push({
        type: "metricChange",
        metric,
        delta: Number(drift.toFixed(2)),
        cause: "Systemic drift",
      });
    });
  }

  private applyTechEffects(tech: TechNode, events: SimulationEvent[]) {
    tech.effects.forEach((effect) => {
      switch (effect.type) {
        case "metricBoost": {
          this.metrics[effect.metric] = clamp(
            this.metrics[effect.metric] + effect.value,
            0,
            200
          );
          events.push({
            type: "metricChange",
            metric: effect.metric,
            delta: effect.value,
            cause: `${tech.name} breakthrough`,
          });
          break;
        }
        case "resourceEfficiency": {
          const current = this.resourceEfficiencyMultiplier.get(effect.resourceId) ?? 1;
          this.resourceEfficiencyMultiplier.set(effect.resourceId, current * effect.multiplier);
          events.push({
            type: "resourceChange",
            resourceId: effect.resourceId,
            delta: effect.multiplier,
            cause: `${tech.name} improves throughput`,
          });
          break;
        }
        case "exposeResource": {
          // Queue a narrative event; actual exposure occurs once requirements are met.
          this.pendingEvents.push({
            type: "resourceChange",
            resourceId: effect.resourceId,
            delta: 0,
            cause: `${tech.name} hints at ${effect.resourceId} deposits.`,
          });
          break;
        }
        default:
          break;
      }
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
