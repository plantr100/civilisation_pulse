import { GameSession } from "./game/gameSession";
import type { CivilizationSnapshot } from "./simulation/types";

const session = new GameSession({ seed: "demo-seed" });

logSnapshot("Initial state", session.getCivilizationSnapshot());

const cycles = 5;
for (let i = 0; i < cycles; i += 1) {
  const board = session.getBoardState();
  const rows = board.grid.length;
  const cols = board.grid[0]?.length ?? 0;
  let move = null;
  let attempts = 0;

  while (!move && attempts < 30) {
    const row = Math.floor(Math.random() * rows);
    const col = Math.floor(Math.random() * cols);
    const dir = Math.random() > 0.5 ? { dr: 0, dc: 1 } : { dr: 1, dc: 0 };
    const target = { row: row + dir.dr, col: col + dir.dc };
    if (target.row >= rows || target.col >= cols) {
      attempts += 1;
      continue;
    }
    move = session.playPuzzleMove({ row, col }, target);
    attempts += 1;
  }

  if (move) {
    console.log(
      `Cycle ${i + 1}: cleared ${move.clearedTiles} tiles (x${move.comboMultiplier.toFixed(
        2
      )}).`
    );
    move.reward.forEach((reward) =>
      console.log(`  Reward -> ${reward.metric} +${reward.delta.toFixed(2)}`)
    );
  } else {
    console.log(`Cycle ${i + 1}: no valid puzzle move located.`);
  }

  const snapshot = session.stepCivilization();
  logSnapshot(`Post-cycle ${i + 1}`, snapshot);
}

function logSnapshot(label: string, snapshot: CivilizationSnapshot) {
  console.log(`\n=== ${label} (tick ${snapshot.tick}) ===`);
  console.log(
    Object.entries(snapshot.metrics)
      .map(([metric, value]) => `${metric}: ${value.toFixed(1)}`)
      .join(" | ")
  );
  const topEvents = snapshot.pendingEvents.slice(0, 3);
  topEvents.forEach((event) => {
    switch (event.type) {
      case "metricChange":
        console.log(
          ` - ${event.cause} (${event.metric} ${event.delta > 0 ? "+" : ""}${event.delta.toFixed(
            2
          )})`
        );
        break;
      case "resourceChange":
        console.log(` - ${event.cause}`);
        break;
      case "agentStory":
        console.log(` - ${event.summary}`);
        break;
      case "techUnlocked":
        console.log(` - ${event.cause}`);
        break;
      default:
        break;
    }
  });
}
