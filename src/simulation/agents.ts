import { SeededRandom } from "../utils/random";
import type {
  AgentRole,
  AgentState,
  CivilizationMetricKey,
  SimulationEvent,
} from "./types";

export interface AgentDecision {
  focus: CivilizationMetricKey;
  effort: number;
  narrative: string;
}

const ROLE_FOCUS: Record<AgentRole, CivilizationMetricKey[]> = {
  science: ["knowledge", "infrastructure"],
  industry: ["infrastructure", "sustainability"],
  culture: ["culture", "morale"],
  policy: ["stability", "morale"],
  exploration: ["knowledge", "sustainability"],
};

export class AgentController {
  private agents: AgentState[];
  private rng: SeededRandom;

  constructor(seed: number | string, initialAgents: AgentState[]) {
    this.agents = initialAgents;
    this.rng = new SeededRandom(seed);
  }

  list(): AgentState[] {
    return this.agents.map((agent) => ({ ...agent }));
  }

  tick(
    metrics: Record<CivilizationMetricKey, number>
  ): { contributions: Record<CivilizationMetricKey, number>; events: SimulationEvent[] } {
    const contributions: Record<CivilizationMetricKey, number> = {
      population: 0,
      knowledge: 0,
      culture: 0,
      infrastructure: 0,
      sustainability: 0,
      morale: 0,
      stability: 0,
    };
    const events: SimulationEvent[] = [];

    this.agents.forEach((agent) => {
      const decision = this.decide(agent, metrics);
      contributions[decision.focus] += decision.effort;
      agent.focus = decision.focus;
      agent.fatigue = Math.min(1, agent.fatigue + decision.effort * 0.02);
      agent.morale = clamp01(
        agent.morale +
          decision.effort * 0.01 -
          agent.fatigue * 0.02 +
          agent.traits.empathy * 0.005
      );

      if (this.rng.next() < 0.15) {
        const summary = `${agent.name} (${agent.role}) ${decision.narrative}`;
        events.push({ type: "agentStory", agentId: agent.id, summary });
      }
    });

    return { contributions, events };
  }

  private decide(
    agent: AgentState,
    metrics: Record<CivilizationMetricKey, number>
  ): AgentDecision {
    const possible = ROLE_FOCUS[agent.role];
    let bestFocus = possible[0];
    let bestScore = -Infinity;
    const narratives: Partial<Record<CivilizationMetricKey, string>> = {};

    possible.forEach((metric) => {
      const scarcity = 1 - clamp01(metrics[metric] / 120);
      const novelty = agent.traits.curiosity * this.rng.next();
      const empathy = agent.traits.empathy * (metric === "morale" ? 1 : 0.4);
      const boldness = agent.traits.boldness * this.rng.next();
      const fatiguePenalty = agent.fatigue * 0.6;

      const score =
        scarcity * (0.6 + agent.traits.pragmatism * 0.25) +
        novelty * 0.2 +
        empathy +
        boldness * 0.3 -
        fatiguePenalty;

      if (score > bestScore) {
        bestScore = score;
        bestFocus = metric;
      }

      narratives[metric] = narrativeForMetric(metric, { novelty, empathy, boldness });
    });

    const effort = clamp01(
      0.5 +
        agent.traits.diligence * 0.3 +
        agent.morale * 0.2 -
        agent.fatigue * 0.4 +
        this.rng.next() * 0.1
    );

    return {
      focus: bestFocus,
      effort,
      narrative:
        narratives[bestFocus] ??
        "contributes steady effort toward communal goals.",
    };
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function narrativeForMetric(
  metric: CivilizationMetricKey,
  context: { novelty: number; empathy: number; boldness: number }
): string {
  switch (metric) {
    case "knowledge":
      return context.novelty > 0.5
        ? "unveils a radical hypothesis that sparks debate."
        : "publishes careful research that nudges understanding forward.";
    case "culture":
      return context.empathy > 0.5
        ? "curates a festival fostering unity."
        : "launches avant-garde art that challenges norms.";
    case "infrastructure":
      return context.boldness > 0.5
        ? "champions a daring infrastructural leap."
        : "optimises existing systems for steady gains.";
    case "sustainability":
      return context.boldness > 0.5
        ? "proposes bold ecological restoration efforts."
        : "refines conservation programs to reduce waste.";
    case "morale":
      return context.empathy > 0.5
        ? "hosts listening circles to heal social rifts."
        : "leads a spirited celebration to lift spirits.";
    case "stability":
      return context.boldness > 0.5
        ? "brokers a challenging but hopeful policy compromise."
        : "strengthens community councils for resilience.";
    case "population":
    default:
      return "coordinates social programs supporting population wellbeing.";
  }
}
