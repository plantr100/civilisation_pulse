import type { Requirement, TechNode, TechEffect, CivilizationMetricKey } from "./types";
import { SeededRandom } from "../utils/random";

const METRIC_KEYS: CivilizationMetricKey[] = [
  "population",
  "knowledge",
  "culture",
  "infrastructure",
  "sustainability",
  "morale",
  "stability",
];

export class TechTree {
  private nodes: Map<string, TechNode>;
  private rng: SeededRandom;

  constructor(seed: number | string, blueprint: TechBlueprint[]) {
    this.rng = new SeededRandom(seed);
    this.nodes = new Map(
      blueprint.map((node) => {
        const requirements = generateRequirements(
          node.requirementIntensity,
          this.rng
        );
        const effects = node.effects ?? [randomEffect(this.rng)];
        const techNode: TechNode = {
          id: node.id,
          name: node.name,
          requires: requirements,
          effects,
          unlocked: false,
        };
        return [techNode.id, techNode];
      })
    );
  }

  list(): TechNode[] {
    return Array.from(this.nodes.values()).map((node) => ({ ...node }));
  }

  evaluate(metrics: Record<CivilizationMetricKey, number>): TechNode[] {
    const newlyUnlocked: TechNode[] = [];
    this.nodes.forEach((node) => {
      if (node.unlocked) {
        return;
      }
      const meets = node.requires.every((req) => metrics[req.metric] >= req.threshold);
      if (meets) {
        node.unlocked = true;
        newlyUnlocked.push({ ...node });
      }
    });
    return newlyUnlocked;
  }
}

export interface TechBlueprint {
  id: string;
  name: string;
  requirementIntensity: number;
  effects?: TechEffect[];
}

function generateRequirements(intensity: number, rng: SeededRandom): Requirement[] {
  const requirementCount = Math.max(1, Math.round(intensity * 2 + rng.next() * 2));
  const requirements: Requirement[] = [];
  for (let i = 0; i < requirementCount; i += 1) {
    const metric = METRIC_KEYS[rng.intBetween(0, METRIC_KEYS.length - 1)];
    const threshold = 30 + rng.next() * 70 + intensity * 10;
    requirements.push({ metric, threshold: Math.round(threshold) });
  }
  return requirements;
}

function randomEffect(rng: SeededRandom): TechEffect {
  const metric = METRIC_KEYS[rng.intBetween(0, METRIC_KEYS.length - 1)];
  const roll = rng.next();
  if (roll < 0.4) {
    return {
      type: "metricBoost",
      metric,
      value: Math.round(10 + rng.next() * 20),
    };
  }
  if (roll < 0.75) {
    return {
      type: "exposeResource",
      resourceId: `mystery-${rng.intBetween(1, 9999)}`,
    };
  }
  return {
    type: "resourceEfficiency",
    resourceId: `resource-${rng.intBetween(1, 9999)}`,
    multiplier: Number((1.1 + rng.next() * 0.5).toFixed(2)),
  };
}
