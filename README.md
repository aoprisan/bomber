# Night Raid — WW2 Bomber Arcade

A mobile-first, one-input WW2 bomber arcade game. Portrait, vertical scroller,
Archero-style: your bomber auto-flies and the world scrolls past it. Your only
control is **thumb-drag anywhere to steer laterally** (with a slight speed nudge
on vertical drag). Positioning _is_ bombing — targets sit inside flak corridors,
so lining up over a target means flying into danger.

Built as a **TypeScript PWA** with plain **Canvas 2D** (no game framework),
Vite, and a hand-rolled service worker. Deploys to GitHub Pages.

## Status

Milestones:

1. ✅ Scaffold + moving bomber with drag input
2. ✅ Scrolling ground, flak bursts w/ telegraphs, HP/damage, game over
3. ✅ Targets + bombsight auto-bombing + combo scoring
4. ✅ Tracers, searchlights + night fighters, barrage balloons
5. ✅ Upgrade system + roguelite segments
6. Audio, particles, polish, difficulty curve

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run preview    # serve the built app
npm run typecheck  # tsc --noEmit
```

## Architecture

```
src/
  engine/   loop (fixed timestep + interpolation), input (relative drag),
            pool (object pool), audio (procedural WebAudio, gesture-gated)
  game/     tuning.ts  <-- ALL gameplay constants, iterate here
            entities, render, game (simulation orchestrator)
  ui/       DOM overlay HUD / menus + global styles
public/     manifest, service worker, procedurally-generated icons
scripts/    gen-icons.mjs  (renders PWA PNGs with zlib only, no deps)
```

- Fixed-timestep simulation (60 Hz) with interpolated rendering.
- Single canvas, `requestAnimationFrame`, world units scaled to any viewport.
- All art is procedural / vector-drawn — no image assets.

## Tuning

Every gameplay number (speeds, telegraph delays, spawn rates, damage) lives in
[`src/game/tuning.ts`](src/game/tuning.ts). Change values there to retune game
feel without touching logic.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds with base
path `/bomber/` and publishes `dist/` to GitHub Pages. Enable Pages → "GitHub
Actions" in repo settings once.
