import type { TechBlueprint } from "../simulation/techTree";

export const DEFAULT_TECH_BLUEPRINTS: TechBlueprint[] = [
  {
    id: "agro-automation",
    name: "Agro Automation",
    requirementIntensity: 0.6,
  },
  {
    id: "civic-harmony",
    name: "Civic Harmony Protocols",
    requirementIntensity: 0.5,
  },
  {
    id: "deepcore-extraction",
    name: "Deepcore Extraction",
    requirementIntensity: 0.8,
  },
  {
    id: "solar-sails",
    name: "Solar Sails",
    requirementIntensity: 0.9,
  },
  {
    id: "cultural-renaissance",
    name: "Cultural Renaissance",
    requirementIntensity: 0.7,
  },
  {
    id: "adaptive-governance",
    name: "Adaptive Governance",
    requirementIntensity: 0.65,
  },
];
