# Virtual Museum — project brief (always-on rules for Antigravity)

**Goal:** a realistic, game-quality first-person walk through a modern art museum (Vite + Three.js, ES modules). Not a tech demo.

## How the project works (read before editing)
- `data/layout.json` — rooms stacked along -Z (hall → paintings → music → history). Rooms share walls; widths must match. Doors are declared on a room's **south** wall.
- `data/exhibits.json` — single source of truth. Wall exhibits use `room` + `wall` + `at` (metres from wall centre, left→right as seen from inside). Freestanding use `pos:[x,z]`. **Never write raw x/y/z for wall art.**
- `src/geometry.js` — pure maths (no three.js): wall frames, door cut-outs, colliders. Shared by the game and `scripts/validate.mjs`.
- `src/materials.js` — procedural fallback textures; auto-upgrades to PBR maps if `public/assets/textures/<name>/{diff,nor,rough}.jpg` exist (names: marble, parquet, plasterWarm, plasterDark, plasterCool, trim, ceiling).
- `src/architecture.js` walls/floors/ceilings/trim/columns · `src/exhibits.js` frames, plaques, spotlights, video, audio, model pedestal · `src/player.js` movement + collision · `src/interaction.js` raycast + E panel · `src/main.js` renderer, post-processing, loop.

## Hard rules
1. Run `npm run validate` after ANY change to data or geometry. It must report 0 errors (asset warnings are OK).
2. Types: `image` (jpg/png), `audio`, `video`, `model` (.glb only). Never mark a photo as `model`.
3. Local assets only under `public/assets/`; reference as `/assets/...`. No hotlinking (CORS). Every asset credited in `CREDITS.md` (`npm run assets` regenerates it).
4. Serve over http (`npm run dev`), never `file://`.
5. Keep 60 fps on a mid laptop: ≤ 10 spotlights with shadows OFF, quality presets via `?q=low|medium|high`.
6. After each phase: run dev server, open the browser, **take screenshots from each room**, read the console, fix errors, then tell me what changed. Commit to git per phase.
7. Do not rewrite working modules wholesale — extend them. Ignore stale docs (old SUMMARY.md / README skeleton).

## Visual target
Louvre "Salle des États" / Tate Modern: warm pools of spotlight on dark walls, polished reflective floors, deep gold frames, soft ceiling skylights, subtle bloom + vignette, elegant dark/gold UI.
