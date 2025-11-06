import type { CivilizationMetricKey } from "../simulation/types";

export interface PuzzleMove {
  selections: Array<{ row: number; col: number }>;
  clearedTiles: number;
  comboMultiplier: number;
  reward: PuzzleReward[];
}

export interface PuzzleReward {
  metric: CivilizationMetricKey;
  delta: number;
  description: string;
}

export interface PuzzleTile {
  id: string;
  kind: TileKind;
}

export interface EmptyPuzzleTile {
  kind: "empty";
}

export type PuzzleTileState = PuzzleTile | EmptyPuzzleTile;

export interface PuzzleBoardState {
  grid: PuzzleTileState[][];
  pendingRewards: PuzzleReward[];
  cascades: number;
}

export type TileKind =
  | "energy"
  | "culture"
  | "knowledge"
  | "harmony"
  | "industry"
  | "wild";
