import { SeededRandom } from "../utils/random";
import type { CivilizationMetricKey } from "../simulation/types";
import type {
  PuzzleBoardState,
  PuzzleMove,
  PuzzleReward,
  PuzzleTileState,
  TileKind,
} from "./types";

const TILE_KINDS: TileKind[] = [
  "energy",
  "culture",
  "knowledge",
  "harmony",
  "industry",
];

const TILE_TO_METRIC: Record<TileKind, { metric: CivilizationMetricKey; magnitude: number }> =
  {
    energy: { metric: "infrastructure", magnitude: 1.3 },
    culture: { metric: "culture", magnitude: 1.2 },
    knowledge: { metric: "knowledge", magnitude: 1.4 },
    harmony: { metric: "morale", magnitude: 1.1 },
    industry: { metric: "sustainability", magnitude: 1.2 },
    wild: { metric: "stability", magnitude: 1.0 },
  };

interface TileInstance {
  id: string;
  kind: TileKind;
}

type TileSlot = TileInstance | null;

export class Match3Board {
  private rows: number;
  private cols: number;
  private rng: SeededRandom;
  private grid: TileSlot[][];
  private cascades = 0;
  private rewardBuffer: PuzzleReward[] = [];
  private nextTileId = 0;

  constructor(rows: number, cols: number, seed: number | string) {
    this.rows = rows;
    this.cols = cols;
    this.rng = new SeededRandom(seed);
    this.grid = Array.from({ length: rows }, () => Array<TileSlot>(cols).fill(null));
    this.seedInitialGrid();
  }

  getState(): PuzzleBoardState {
    return {
      grid: this.grid.map((row) =>
        row.map((tile): PuzzleTileState =>
          tile ? { id: tile.id, kind: tile.kind } : { kind: "empty" }
        )
      ),
      pendingRewards: [...this.rewardBuffer],
      cascades: this.cascades,
    };
  }

  performMove(
    a: { row: number; col: number },
    b: { row: number; col: number }
  ): PuzzleMove | null {
    if (!this.areAdjacent(a, b)) {
      return null;
    }
    this.swapTiles(a, b);
    let matches = this.findAllMatches();
    if (matches.length === 0) {
      this.swapTiles(a, b);
      return null;
    }

    let totalCleared = 0;
    let comboMultiplier = 1;
    this.cascades = 0;
    this.rewardBuffer = [];

    const selections = [a, b];

    do {
      const clearedThisCascade = this.clearMatches(matches);
      totalCleared += clearedThisCascade;
      comboMultiplier = Math.max(comboMultiplier, 1 + this.cascades * 0.25);
      this.applyGravity();
      this.refill();
      this.cascades += 1;
      matches = this.findAllMatches();
    } while (matches.length > 0);

    const rewards = this.generateRewards(totalCleared, comboMultiplier);
    this.rewardBuffer.push(...rewards);

    return {
      selections,
      clearedTiles: totalCleared,
      comboMultiplier,
      reward: rewards,
    };
  }

  collectRewards(): PuzzleReward[] {
    const rewards = [...this.rewardBuffer];
    this.rewardBuffer.length = 0;
    return rewards;
  }

  private seedInitialGrid() {
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        this.grid[row][col] = this.spawnTile(this.randomTileKind());
      }
    }
    // Re-roll tiles that start with a simple match to keep the opening engaging.
    let cleanup = this.findAllMatches();
    let safety = 0;
    while (cleanup.length > 0 && safety < 20) {
      cleanup.forEach(({ row, col }) => {
        this.grid[row][col] = this.spawnTile(this.randomTileKind());
      });
      cleanup = this.findAllMatches();
      safety += 1;
    }
  }

  private randomTileKind(): TileKind {
    const roll = this.rng.next();
    if (roll > 0.94) {
      return "wild";
    }
    return TILE_KINDS[Math.floor(roll * TILE_KINDS.length)];
  }

  private spawnTile(kind: TileKind): TileInstance {
    const id = `t${this.nextTileId.toString(36)}`;
    this.nextTileId += 1;
    return { id, kind };
  }

  private findAllMatches(): Array<{ row: number; col: number }> {
    const matched = new Set<string>();

    const processRun = (run: Array<{ row: number; col: number }>) => {
      if (run.length === 0) {
        return;
      }
      const baseKind = this.resolveRunKind(run);
      if (!baseKind) {
        return;
      }
      const cluster = this.expandCluster(run, baseKind);
      cluster.forEach(({ row, col }) => {
        matched.add(`${row}:${col}`);
      });
    };

    // Horizontal runs.
    for (let row = 0; row < this.rows; row += 1) {
      let streak = 1;
      for (let col = 1; col < this.cols; col += 1) {
        if (this.isSame(this.grid[row][col], this.grid[row][col - 1])) {
          streak += 1;
        } else {
          if (streak >= 3) {
            const run: Array<{ row: number; col: number }> = [];
            for (let k = 0; k < streak; k += 1) {
              run.push({ row, col: col - 1 - k });
            }
            processRun(run);
          }
          streak = 1;
        }
      }
      if (streak >= 3) {
        const run: Array<{ row: number; col: number }> = [];
        for (let k = 0; k < streak; k += 1) {
          run.push({ row, col: this.cols - 1 - k });
        }
        processRun(run);
      }
    }

    // Vertical runs.
    for (let col = 0; col < this.cols; col += 1) {
      let streak = 1;
      for (let row = 1; row < this.rows; row += 1) {
        if (this.isSame(this.grid[row][col], this.grid[row - 1][col])) {
          streak += 1;
        } else {
          if (streak >= 3) {
            const run: Array<{ row: number; col: number }> = [];
            for (let k = 0; k < streak; k += 1) {
              run.push({ row: row - 1 - k, col });
            }
            processRun(run);
          }
          streak = 1;
        }
      }
      if (streak >= 3) {
        const run: Array<{ row: number; col: number }> = [];
        for (let k = 0; k < streak; k += 1) {
          run.push({ row: this.rows - 1 - k, col });
        }
        processRun(run);
      }
    }

    return Array.from(matched).map((key) => {
      const [row, col] = key.split(":").map(Number);
      return { row, col };
    });
  }

  private clearMatches(matches: Array<{ row: number; col: number }>): number {
    const unique = new Set(matches.map((m) => `${m.row}:${m.col}`));
    unique.forEach((key) => {
      const [row, col] = key.split(":").map(Number);
      this.grid[row][col] = null;
    });
    return unique.size;
  }

  private applyGravity() {
    for (let col = 0; col < this.cols; col += 1) {
      let writeRow = this.rows - 1;
      for (let row = this.rows - 1; row >= 0; row -= 1) {
        const tile = this.grid[row][col];
        if (tile !== null) {
          this.grid[writeRow][col] = tile;
          if (writeRow !== row) {
            this.grid[row][col] = null;
          }
          writeRow -= 1;
        }
      }
    }
  }

  private refill() {
    for (let col = 0; col < this.cols; col += 1) {
      for (let row = 0; row < this.rows; row += 1) {
        if (this.grid[row][col] === null) {
          this.grid[row][col] = this.spawnTile(this.randomTileKind());
        }
      }
    }
  }

  private generateRewards(
    clearedTiles: number,
    comboMultiplier: number
  ): PuzzleReward[] {
    const base = Math.max(1, Math.floor(clearedTiles / 3));
    const rewards: PuzzleReward[] = [];
    for (let i = 0; i < base; i += 1) {
      const tile = TILE_KINDS[this.rng.intBetween(0, TILE_KINDS.length - 1)];
      const mapping = TILE_TO_METRIC[tile];
      rewards.push({
        metric: mapping.metric,
        delta: Number((mapping.magnitude * comboMultiplier).toFixed(2)),
        description: `Puzzle surge boosts ${mapping.metric}`,
      });
    }
    if (comboMultiplier > 1.5) {
      rewards.push({
        metric: "stability",
        delta: Number((comboMultiplier * 0.8).toFixed(2)),
        description: "Cascading insight steadies governance.",
      });
    }
    return rewards;
  }

  private areAdjacent(
    a: { row: number; col: number },
    b: { row: number; col: number }
  ): boolean {
    const dr = Math.abs(a.row - b.row);
    const dc = Math.abs(a.col - b.col);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
  }

  private swapTiles(
    a: { row: number; col: number },
    b: { row: number; col: number }
  ) {
    const tmp = this.grid[a.row][a.col];
    this.grid[a.row][a.col] = this.grid[b.row][b.col];
    this.grid[b.row][b.col] = tmp;
  }

  private resolveRunKind(run: Array<{ row: number; col: number }>): TileKind | null {
    for (const { row, col } of run) {
      const tile = this.grid[row][col];
      if (tile && tile.kind !== "wild") {
        return tile.kind;
      }
    }
    const fallback = run.length > 0 ? this.grid[run[0].row][run[0].col] : null;
    return fallback ? fallback.kind : null;
  }

  private expandCluster(
    seeds: Array<{ row: number; col: number }>,
    baseKind: TileKind
  ): Array<{ row: number; col: number }> {
    const visited = new Set<string>();
    const queue: Array<{ row: number; col: number }> = [];

    const acceptTile = (tile: TileSlot): boolean => {
      if (tile === null) {
        return false;
      }
      if (tile.kind === "wild") {
        return true;
      }
      return tile.kind === baseKind;
    };

    const enqueue = (row: number, col: number) => {
      const key = `${row}:${col}`;
      if (visited.has(key)) {
        return;
      }
      visited.add(key);
      queue.push({ row, col });
    };

    seeds.forEach(({ row, col }) => enqueue(row, col));

    const result: Array<{ row: number; col: number }> = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      const { row, col } = current;
      result.push({ row, col });
      const neighbors = [
        { row: row - 1, col },
        { row: row + 1, col },
        { row, col: col - 1 },
        { row, col: col + 1 },
      ];
      neighbors.forEach(({ row: nRow, col: nCol }) => {
        if (nRow < 0 || nRow >= this.rows || nCol < 0 || nCol >= this.cols) {
          return;
        }
        const tile = this.grid[nRow][nCol];
        if (acceptTile(tile)) {
          enqueue(nRow, nCol);
        }
      });
    }

    return result;
  }

  private isSame(a: TileSlot, b: TileSlot): boolean {
    if (a === null || b === null) {
      return false;
    }
    if (a.kind === "wild" || b.kind === "wild") {
      return true;
    }
    return a.kind === b.kind;
  }
}
