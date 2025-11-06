## Civilisation Emulator Prototype

This workspace holds the core logic for a civilisation simulation that is steered by an asynchronous tile-matching puzzle. It is written in TypeScript so the code can be shared between an Ionic/Angular client and any supporting services.

### Structure
- `src/simulation` – resource economy, semi-autonomous agent behaviours, technology progression, and event log types.
- `src/puzzle` – deterministic match-3 board with cascading clears and reward hooks.
- `src/game` – glue layer that feeds puzzle rewards into the civilisation before each tick.
- `src/index.ts` – lightweight CLI demo that runs the simulation for a handful of cycles.

### Running the demo
```bash
npm install
npm run demo
```
The CLI prints civilisation metrics, agent stories, and how puzzle rewards influence stability after each cycle.

### Suggested next steps for the mobile app
1. **Ionic bootstrapping** – Scaffold a Capacitor-enabled Ionic Angular project and drop this `src` directory into a shared workspace (e.g., `apps/mobile/src/civilisation`).
2. **State integration** – Expose the `GameSession` class through an Angular service so components can subscribe to snapshots via RxJS.
3. **Low-fidelity world view** – Render the civilisation board with canvas or WebGL sprites; map `SimulationEvent`s to character animations.
4. **High-res puzzle view** – Build a dedicated Ionic page that wraps the match-3 logic, translating touch gestures into `playPuzzleMove` calls.
5. **Persistence** – Store snapshot deltas in IndexedDB (Capacitor Storage) so the civilisation can continue evolving between user sessions.
6. **Background ticking** – Leverage Capacitor background tasks or push-driven timers to advance the civilisation even when the app is idle, respecting platform limits.
7. **Balancing & Sentience flavour** – Iterate on agent trait distributions, introduce narrative templates, and surface decision rationales to emphasise pseudo-free-will.

### Ionic/Angular shell
The `mobile-app/` directory now contains an Ionic Angular workspace wired to the shared simulation:

```bash
cd mobile-app
npm install       # already run once, keeps deps in sync
npm run build     # Angular production build (uses shared core)
npx ionic serve   # Live-reload dev server
```

`CivilizationService` (under `mobile-app/src/app/services`) bridges the match-3 rewards into the Angular UI so that the dashboard cards reflect the civilisation’s evolution in near-real time.

With these pieces connected, the simulation can run on both iOS and Android, while the puzzle remains a high-fidelity engagement surface.
