export type ResourceKind = "finite" | "infinite";

export interface ResourceDescriptor {
  id: string;
  name: string;
  kind: ResourceKind;
  abundance: number;
  discoveryDifficulty: number;
  prerequisites: Requirement[];
}

export interface Requirement {
  metric: CivilizationMetricKey;
  threshold: number;
}

export type CivilizationMetricKey =
  | "population"
  | "knowledge"
  | "culture"
  | "infrastructure"
  | "sustainability"
  | "morale"
  | "stability";

export interface ResourceState extends ResourceDescriptor {
  amount: number;
  exposed: boolean;
  exhaustionRate: number;
}

export interface AgentTraits {
  curiosity: number;
  diligence: number;
  empathy: number;
  boldness: number;
  pragmatism: number;
}

export type AgentRole = "science" | "industry" | "culture" | "policy" | "exploration";

export interface AgentState {
  id: string;
  name: string;
  role: AgentRole;
  traits: AgentTraits;
  fatigue: number;
  focus: CivilizationMetricKey;
  morale: number;
}

export interface TechNode {
  id: string;
  name: string;
  requires: Requirement[];
  unlocked: boolean;
  effects: Array<TechEffect>;
}

export type TechEffect =
  | {
      type: "metricBoost";
      metric: CivilizationMetricKey;
      value: number;
    }
  | {
      type: "resourceEfficiency";
      resourceId: string;
      multiplier: number;
    }
  | {
      type: "exposeResource";
      resourceId: string;
    };

export interface CivilizationSnapshot {
  tick: number;
  metrics: Record<CivilizationMetricKey, number>;
  resources: Record<string, ResourceState>;
  agents: AgentState[];
  visibleTech: TechNode[];
  pendingEvents: SimulationEvent[];
}

export type SimulationEvent =
  | {
      type: "resourceChange";
      resourceId: string;
      delta: number;
      cause: string;
    }
  | {
      type: "metricChange";
      metric: CivilizationMetricKey;
      delta: number;
      cause: string;
    }
  | {
      type: "techUnlocked";
      techId: string;
      cause: string;
    }
  | {
      type: "agentStory";
      agentId: string;
      summary: string;
    };
