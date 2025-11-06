import type {
  CivilizationMetricKey,
  Requirement,
  ResourceDescriptor,
  ResourceState,
} from "./types";

export class ResourceSystem {
  private resources: Map<string, ResourceState>;

  constructor(descriptors: ResourceDescriptor[]) {
    this.resources = new Map(
      descriptors.map((desc) => [
        desc.id,
        {
          ...desc,
          amount: desc.kind === "finite" ? desc.abundance : desc.abundance * 0.1,
          exposed: false,
          exhaustionRate: desc.kind === "finite" ? 0.01 : 0,
        },
      ])
    );
  }

  list(): ResourceState[] {
    return Array.from(this.resources.values());
  }

  get(resourceId: string): ResourceState | undefined {
    return this.resources.get(resourceId);
  }

  evaluateExposure(
    metrics: Record<CivilizationMetricKey, number>
  ): ResourceState[] {
    const newlyExposed: ResourceState[] = [];
    this.resources.forEach((resource) => {
      if (resource.exposed) {
        return;
      }
      if (meetsRequirements(metrics, resource.prerequisites)) {
        resource.exposed = true;
        resource.amount =
          resource.kind === "finite" ? resource.abundance : resource.abundance;
        newlyExposed.push(JSON.parse(JSON.stringify(resource)));
      }
    });
    return newlyExposed;
  }

  harvest(
    resourceId: string,
    effort: number
  ): { amount: number; exhausted: boolean } {
    const resource = this.resources.get(resourceId);
    if (!resource || !resource.exposed) {
      return { amount: 0, exhausted: false };
    }
    const effectiveEffort =
      resource.kind === "finite"
        ? Math.min(resource.amount, effort)
        : effort * resource.abundance;

    resource.amount = Math.max(
      0,
      resource.amount -
        (resource.kind === "finite"
          ? effectiveEffort * resource.exhaustionRate
          : 0)
    );

    const exhausted =
      resource.kind === "finite" && resource.amount <= resource.abundance * 0.05;
    return { amount: effectiveEffort, exhausted };
  }
}

function meetsRequirements(
  metrics: Record<CivilizationMetricKey, number>,
  requirements: Requirement[]
): boolean {
  return requirements.every(
    (req) => metrics[req.metric] !== undefined && metrics[req.metric] >= req.threshold
  );
}
