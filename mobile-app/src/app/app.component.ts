import { Component, OnDestroy, OnInit } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import type { CivilizationSnapshot, SimulationEvent } from 'civilisation-core/simulation/types';
import type { PuzzleBoardState, PuzzleTileState, TileKind } from 'civilisation-core/puzzle/types';
import { CivilizationService } from './services/civilization.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  snapshot$!: Observable<CivilizationSnapshot>;
  board$!: Observable<PuzzleBoardState>;
  private boardSub?: Subscription;
  private rewardTimer?: ReturnType<typeof setTimeout>;
  private interactionResumeTimer?: ReturnType<typeof setTimeout>;
  private fallResetTimer?: ReturnType<typeof setTimeout>;
  private currentBoard?: PuzzleBoardState;
  private tileDropDistances = new Map<string, number>();
  private dragStart?: { row: number; col: number };
  private dragTarget?: { row: number; col: number };
  private hoverCandidate?: { row: number; col: number };
  private dragPointerId?: number;
  private dragMoved = false;
  private suppressNextClick = false;
  private selectionBackup?: { row: number; col: number };
  private readonly tileLabels: Record<TileKind, string> = {
    energy: 'Infrastructure catalyst',
    culture: 'Culture beacon',
    knowledge: 'Knowledge prism',
    harmony: 'Morale harmony node',
    industry: 'Sustainability gear',
    wild: 'Wildcard stabiliser',
  };
  private readonly emptyTileLabel = 'Empty slot';
  selectedTile?: { row: number; col: number };
  swappingTiles: Array<{ row: number; col: number }> = [];
  invalidTiles: Array<{ row: number; col: number }> = [];

  constructor(private readonly civilization: CivilizationService) {}

  ngOnInit(): void {
    this.snapshot$ = this.civilization.snapshot$;
    this.board$ = this.civilization.board$;
    this.civilization.startAutoTick(6000);
    this.boardSub = this.board$.subscribe((board) => {
      const previousBoard = this.currentBoard;
      this.currentBoard = board;
      this.updateDropDistances(previousBoard, board);
      this.handleRewardTimer(board);
    });
  }

  ngOnDestroy(): void {
    this.civilization.stopAutoTick();
    this.boardSub?.unsubscribe();
    clearTimeout(this.rewardTimer);
    clearTimeout(this.interactionResumeTimer);
    clearTimeout(this.fallResetTimer);
  }

  pulsePuzzle() {
    this.civilization.triggerPuzzlePulse();
  }

  advanceOnce() {
    this.civilization.advanceCivilization();
  }

  handleClickSelection(row: number, col: number) {
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }
    this.selectTile(row, col);
  }

  private handleRewardTimer(board: PuzzleBoardState) {
    if (board.pendingRewards.length > 0) {
      clearTimeout(this.rewardTimer);
      this.rewardTimer = setTimeout(() => this.civilization.clearPendingRewards(), 2000);
    } else if (this.rewardTimer) {
      clearTimeout(this.rewardTimer);
      this.rewardTimer = undefined;
    }
  }

  private updateDropDistances(
    previous: PuzzleBoardState | undefined,
    next: PuzzleBoardState
  ) {
    const previousPositions = new Map<string, number>();
    if (previous) {
      previous.grid.forEach((row, rowIndex) => {
        row.forEach((tile) => {
          if (tile.kind !== 'empty') {
            previousPositions.set(tile.id, rowIndex);
          }
        });
      });
    }

    const distances = new Map<string, number>();
    let maxDistance = 0;
    next.grid.forEach((row, rowIndex) => {
      row.forEach((tile) => {
        if (tile.kind === 'empty') {
          return;
        }
        const previousRow = previousPositions.get(tile.id);
        if (previousRow !== undefined) {
          const drop = rowIndex - previousRow;
          if (drop > 0) {
            distances.set(tile.id, drop);
            if (drop > maxDistance) {
              maxDistance = drop;
            }
          }
        } else {
          const drop = rowIndex + 1;
          distances.set(tile.id, drop);
          if (drop > maxDistance) {
            maxDistance = drop;
          }
        }
      });
    });

    this.tileDropDistances = distances;
    if (this.fallResetTimer) {
      clearTimeout(this.fallResetTimer);
      this.fallResetTimer = undefined;
    }
    if (distances.size > 0 && maxDistance > 0) {
      const durationMs = 120 + maxDistance * 70;
      this.fallResetTimer = setTimeout(() => {
        this.tileDropDistances = new Map<string, number>();
        this.fallResetTimer = undefined;
      }, durationMs + 120);
    }
  }

  selectTile(row: number, col: number) {
    if (this.swappingTiles.length) {
      return;
    }
    const tile = this.currentBoard?.grid[row]?.[col];
    if (!tile || tile.kind === 'empty') {
      this.selectedTile = undefined;
      this.hoverCandidate = undefined;
      return;
    }
    const target = { row, col };
    if (!this.selectedTile) {
      this.selectedTile = target;
      this.hoverCandidate = undefined;
      return;
    }
    if (this.selectedTile.row === row && this.selectedTile.col === col) {
      this.selectedTile = undefined;
      this.resumeAutoTickAfterInteraction();
      return;
    }
    const sourceTile = this.currentBoard?.grid[this.selectedTile.row]?.[this.selectedTile.col];
    if (!sourceTile || sourceTile.kind === 'empty') {
      this.selectedTile = target;
      this.hoverCandidate = undefined;
      return;
    }
    if (!this.areAdjacent(this.selectedTile, target)) {
      this.selectedTile = target;
      this.hoverCandidate = undefined;
      return;
    }
    this.performSwap(this.selectedTile, target);
    this.selectedTile = undefined;
    this.hoverCandidate = undefined;
  }

  isSelected(row: number, col: number): boolean {
    if (!this.selectedTile || this.selectedTile.row !== row || this.selectedTile.col !== col) {
      return false;
    }
    const tile = this.currentBoard?.grid[row]?.[col];
    return !!tile && tile.kind !== 'empty';
  }

  isSwapping(row: number, col: number): boolean {
    return this.swappingTiles.some((tile) => tile.row === row && tile.col === col);
  }

  isInvalid(row: number, col: number): boolean {
    return this.invalidTiles.some((tile) => tile.row === row && tile.col === col);
  }

  beginManualInteraction(tile: PuzzleTileState) {
    if (tile.kind === 'empty') {
      return;
    }
    this.pauseAutoTickForInteraction();
  }

  onPointerDown(
    event: PointerEvent,
    row: number,
    col: number,
    tile: PuzzleTileState
  ) {
    if (this.swappingTiles.length || tile.kind === 'empty') {
      return;
    }
    this.beginManualInteraction(tile);
    this.dragStart = { row, col };
    this.dragTarget = undefined;
    this.hoverCandidate = undefined;
    this.dragPointerId = event.pointerId;
    this.dragMoved = false;
    this.suppressNextClick = false;
    this.selectionBackup = this.selectedTile ? { ...this.selectedTile } : undefined;
    this.selectedTile = { row, col };
  }

  onPointerEnter(event: PointerEvent, row: number, col: number) {
    const tile = this.currentBoard?.grid[row]?.[col];
    if (!tile || tile.kind === 'empty') {
      if (!this.dragPointerId) {
        this.hoverCandidate = undefined;
      }
      return;
    }

    if (this.dragPointerId !== undefined && event.pointerId === this.dragPointerId && this.dragStart) {
      if (row === this.dragStart.row && col === this.dragStart.col) {
        this.dragTarget = undefined;
        this.hoverCandidate = undefined;
        return;
      }
      if (this.areAdjacent(this.dragStart, { row, col })) {
        this.dragTarget = { row, col };
        this.dragMoved = true;
        this.hoverCandidate = undefined;
      } else {
        this.dragTarget = undefined;
      }
      return;
    }

    if (this.selectedTile && this.areAdjacent(this.selectedTile, { row, col })) {
      this.hoverCandidate = { row, col };
    } else if (!this.dragPointerId) {
      this.hoverCandidate = undefined;
    }
  }

  onPointerLeave(row: number, col: number) {
    if (this.dragPointerId) {
      if (this.dragTarget && this.dragTarget.row === row && this.dragTarget.col === col) {
        this.dragTarget = undefined;
      }
      return;
    }
    if (this.hoverCandidate && this.hoverCandidate.row === row && this.hoverCandidate.col === col) {
      this.hoverCandidate = undefined;
    }
  }

  onPointerUp(event: PointerEvent, row: number, col: number) {
    const start = this.dragStart;
    const dragged = this.dragMoved;
    const pointerMatches = this.dragPointerId !== undefined && event.pointerId === this.dragPointerId;

    if (pointerMatches && start) {
      const potentialTarget =
        this.dragTarget ??
        (this.areAdjacent(start, { row, col }) ? { row, col } : undefined);

      if (dragged && potentialTarget) {
        this.suppressNextClick = true;
        this.dragPointerId = undefined;
        this.dragStart = undefined;
        this.dragTarget = undefined;
        this.dragMoved = false;
        this.hoverCandidate = undefined;
        this.selectedTile = undefined;
        this.selectionBackup = undefined;
        this.performSwap(start, potentialTarget);
        return;
      }
    }

    if (pointerMatches) {
      this.dragPointerId = undefined;
    }
    if (!dragged && this.selectionBackup) {
      this.selectedTile = this.selectionBackup;
    }
    this.selectionBackup = undefined;
    this.dragStart = undefined;
    this.dragTarget = undefined;
    this.dragMoved = false;
  }

  onPointerCancel(event: PointerEvent) {
    if (this.dragPointerId !== undefined && event.pointerId !== this.dragPointerId) {
      return;
    }
    this.dragPointerId = undefined;
    this.dragStart = undefined;
    this.dragTarget = undefined;
    this.dragMoved = false;
    this.hoverCandidate = undefined;
    if (this.selectionBackup) {
      this.selectedTile = this.selectionBackup;
    }
    this.selectionBackup = undefined;
  }

  isCandidate(row: number, col: number): boolean {
    if (this.dragTarget && this.dragTarget.row === row && this.dragTarget.col === col) {
      return true;
    }
    if (this.hoverCandidate && this.hoverCandidate.row === row && this.hoverCandidate.col === col) {
      return true;
    }
    return false;
  }


  isFalling(tile: PuzzleTileState): boolean {
    if (tile.kind === 'empty') {
      return false;
    }
    return this.tileDropDistances.has(tile.id);
  }

  fallDistance(tile: PuzzleTileState): string | null {
    if (tile.kind === 'empty') {
      return null;
    }
    const distance = this.tileDropDistances.get(tile.id);
    if (!distance || distance <= 0) {
      return null;
    }
    return String(distance);
  }

  fallDuration(tile: PuzzleTileState): string | null {
    if (tile.kind === 'empty') {
      return null;
    }
    const distance = this.tileDropDistances.get(tile.id);
    if (!distance || distance <= 0) {
      return null;
    }
    const durationMs = 120 + distance * 70;
    return `${durationMs}ms`;
  }

  tileLabel(tile: PuzzleTileState): string {
    if (tile.kind === 'empty') {
      return this.emptyTileLabel;
    }
    return this.tileLabels[tile.kind];
  }

  private performSwap(a: { row: number; col: number }, b: { row: number; col: number }) {
    this.pauseAutoTickForInteraction();
    this.swappingTiles = [a, b];
    const move = this.civilization.playDirectMove(a, b);
    if (!move) {
      this.triggerErrorHaptic();
      this.invalidTiles = [a, b];
      setTimeout(() => {
        this.invalidTiles = [];
      }, 350);
    } else {
      this.triggerSuccessHaptic();
    }
    setTimeout(() => {
      this.swappingTiles = [];
      this.resumeAutoTickAfterInteraction();
    }, 350);
  }

  private areAdjacent(
    a: { row: number; col: number },
    b: { row: number; col: number }
  ): boolean {
    const dr = Math.abs(a.row - b.row);
    const dc = Math.abs(a.col - b.col);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
  }

  private pauseAutoTickForInteraction(holdMs = 2500) {
    this.civilization.pauseAutoTick();
    clearTimeout(this.interactionResumeTimer);
    this.interactionResumeTimer = setTimeout(() => {
      this.civilization.resumeAutoTick();
      this.interactionResumeTimer = undefined;
    }, holdMs);
  }

  private resumeAutoTickAfterInteraction(delay = 150) {
    clearTimeout(this.interactionResumeTimer);
    this.interactionResumeTimer = setTimeout(() => {
      this.civilization.resumeAutoTick();
      this.interactionResumeTimer = undefined;
    }, delay);
  }

  private triggerSuccessHaptic() {
    this.triggerHaptic([10, 20, 10]);
  }

  private triggerErrorHaptic() {
    this.triggerHaptic(35);
  }

  private triggerHaptic(pattern: number | number[]) {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  }

  describeEvent(event: SimulationEvent): string {
    switch (event.type) {
      case 'metricChange':
        return `${event.cause} (${event.metric} ${event.delta > 0 ? '+' : ''}${event.delta.toFixed(2)})`;
      case 'agentStory':
        return event.summary;
      case 'resourceChange':
        return event.cause;
      case 'techUnlocked':
        return event.cause;
      default:
        return '';
    }
  }
}
