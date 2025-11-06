import { Injectable } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { GameSession } from 'civilisation-core/game/gameSession';
import type { CivilizationSnapshot } from 'civilisation-core/simulation/types';
import type { PuzzleBoardState, PuzzleMove, PuzzleReward } from 'civilisation-core/puzzle/types';

@Injectable({
  providedIn: 'root',
})
export class CivilizationService {
  private readonly session = new GameSession({ seed: 'ionic-demo' });
  private readonly snapshotSubject = new BehaviorSubject<CivilizationSnapshot>(
    this.session.getCivilizationSnapshot()
  );
  private readonly boardSubject = new BehaviorSubject<PuzzleBoardState>(
    this.session.getBoardState()
  );
  private tickSub?: Subscription;
  private autoTickIntervalMs = 4000;
  private autoTickPaused = false;

  readonly snapshot$ = this.snapshotSubject.asObservable();
  readonly board$ = this.boardSubject.asObservable();

  startAutoTick(intervalMs = 4000) {
    this.autoTickIntervalMs = intervalMs;
    this.autoTickPaused = false;
    this.scheduleAutoTick();
  }

  stopAutoTick() {
    this.tickSub?.unsubscribe();
    this.tickSub = undefined;
    this.autoTickPaused = false;
  }

  advanceCivilization(preserveBoard = false) {
    const snapshot = this.session.stepCivilization();
    this.snapshotSubject.next(snapshot);
    if (!preserveBoard) {
      this.pushBoardState();
    }
  }

  triggerPuzzlePulse() {
    const boardState = this.session.getBoardState();
    const { grid } = boardState;
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    if (!rows || !cols) {
      this.advanceCivilization();
      return;
    }
    let attempts = 0;
    let movePerformed = false;
    while (attempts < 25 && !movePerformed) {
      const baseRow = Math.floor(Math.random() * rows);
      const baseCol = Math.floor(Math.random() * cols);
      if (grid[baseRow]?.[baseCol]?.kind === 'empty') {
        attempts += 1;
        continue;
      }
      const dir = Math.random() > 0.5 ? { dr: 1, dc: 0 } : { dr: 0, dc: 1 };
      const targetRow = baseRow + dir.dr;
      const targetCol = baseCol + dir.dc;
      if (targetRow >= rows || targetCol >= cols) {
        attempts += 1;
        continue;
      }
      if (grid[targetRow]?.[targetCol]?.kind === 'empty') {
        attempts += 1;
        continue;
      }
      const move = this.session.playPuzzleMove(
        { row: baseRow, col: baseCol },
        { row: targetRow, col: targetCol }
      );
      movePerformed = !!move;
      if (move) {
        this.pushBoardState(move.reward);
      }
    }
    this.advanceCivilization(movePerformed);
  }

  playDirectMove(
    a: { row: number; col: number },
    b: { row: number; col: number }
  ): PuzzleMove | null {
    const move = this.session.playPuzzleMove(a, b);
    if (move) {
      this.pushBoardState(move.reward);
    } else {
      this.pushBoardState();
    }
    return move;
  }

  clearPendingRewards() {
    this.pushBoardState();
  }

  pauseAutoTick() {
    if (!this.tickSub) {
      return;
    }
    this.tickSub.unsubscribe();
    this.tickSub = undefined;
    this.autoTickPaused = true;
  }

  resumeAutoTick() {
    if (!this.autoTickPaused) {
      return;
    }
    this.autoTickPaused = false;
    this.scheduleAutoTick();
  }

  private pushBoardState(pendingRewards?: PuzzleReward[]) {
    const state = this.session.getBoardState();
    if (pendingRewards?.length) {
      this.boardSubject.next({ ...state, pendingRewards });
      return;
    }
    this.boardSubject.next(state);
  }

  private scheduleAutoTick() {
    this.tickSub?.unsubscribe();
    this.tickSub = interval(this.autoTickIntervalMs).subscribe(() => this.advanceCivilization());
  }
}
