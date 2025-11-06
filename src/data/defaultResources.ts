import type { ResourceDescriptor } from "../simulation/types";

export const DEFAULT_RESOURCES: ResourceDescriptor[] = [
  {
    id: "fresh-water",
    name: "Fresh Water Basins",
    kind: "finite",
    abundance: 100,
    discoveryDifficulty: 10,
    prerequisites: [
      { metric: "population", threshold: 25 },
      { metric: "infrastructure", threshold: 20 },
    ],
  },
  {
    id: "fertile-soil",
    name: "Fertile Soil",
    kind: "finite",
    abundance: 140,
    discoveryDifficulty: 5,
    prerequisites: [{ metric: "population", threshold: 10 }],
  },
  {
    id: "solar-winds",
    name: "Solar Winds",
    kind: "infinite",
    abundance: 1.2,
    discoveryDifficulty: 40,
    prerequisites: [
      { metric: "knowledge", threshold: 45 },
      { metric: "infrastructure", threshold: 35 },
    ],
  },
  {
    id: "geothermal-vents",
    name: "Geothermal Vents",
    kind: "infinite",
    abundance: 0.9,
    discoveryDifficulty: 60,
    prerequisites: [
      { metric: "knowledge", threshold: 55 },
      { metric: "sustainability", threshold: 50 },
    ],
  },
  {
    id: "rare-elements",
    name: "Rare Elements",
    kind: "finite",
    abundance: 60,
    discoveryDifficulty: 70,
    prerequisites: [
      { metric: "knowledge", threshold: 60 },
      { metric: "stability", threshold: 45 },
    ],
  },
];
