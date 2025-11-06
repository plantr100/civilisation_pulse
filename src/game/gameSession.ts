import { Civilization, type CivilizationOptions } from "../simulation/civilization";
import type { CivilizationSnapshot } from "../simulation/types";
import { Match3Board } from "../puzzle/match3";
import type { PuzzleBoardState, PuzzleMove } from "../puzzle/types";

export interface GameSessionOptions extends CivilizationOptions {
  boardRows?: number;
  boardCols?: number;
}

export class GameSession {
  private civilization: Civilization;
  private board: Match3Board;
  private latestSnapshot: CivilizationSnapshot;

  constructor(options: GameSessionOptions = {}) {
    const seed = options.seed ?? Date.now();
    this.civilization = new Civilization(options);
    this.board = new Match3Board(options.boardRows ?? 8, options.boardCols ?? 8, seed);
    this.latestSnapshot = this.civilization.tick();
  }

  getCivilizationSnapshot(): CivilizationSnapshot {
    return this.latestSnapshot;
  }

  stepCivilization(): CivilizationSnapshot {
    this.latestSnapshot = this.civilization.tick();
    return this.latestSnapshot;
  }

  playPuzzleMove(
    a: { row: number; col: number },
    b: { row: number; col: number }
  ): PuzzleMove | null {
    const outcome = this.board.performMove(a, b);
    if (outcome) {
      const rewards = this.board.collectRewards();
      if (rewards.length > 0) {
        this.civilization.applyPuzzleRewards(rewards);
        // allow the snapshot to reflect new inputs on next tick
      }
    }
    return outcome;
  }

  getBoardState(): PuzzleBoardState {
    return this.board.getState();
  }

  fastForward(ticks: number): CivilizationSnapshot[] {
    const snapshots: CivilizationSnapshot[] = [];
    for (let i = 0; i < ticks; i += 1) {
      snapshots.push(this.stepCivilization());
    }
    return snapshots;
  }
}
