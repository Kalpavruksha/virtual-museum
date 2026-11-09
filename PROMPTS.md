# Phase prompts for Antigravity (use Planning mode; send ONE at a time, verify, git commit)

The starter already runs: `npm install && npm run dev`. These prompts upgrade it. Always end with:
"Run the dev server, screenshot every room, check the console, fix problems, then report."

## Phase 0 — Get it running
"Read AGENTS.md and the whole src/ folder. Run npm install, npm run validate, npm run assets, npm run dev. Open the app, screenshot each of the 4 rooms, and list anything broken or ugly. Do not change code yet — give me a plan."

## Phase 1 — Real assets
"Replace placeholders with real files. Download CC0 PBR textures from Poly Haven (marble, parquet/wood floor, plaster) into public/assets/textures/<name>/{diff,nor,rough}.jpg using the names in materials.js. Find a public-domain Beethoven 9 recording (Musopen / Wikimedia Commons) → public/assets/audio/beethoven9.mp3, a short NASA Apollo 11 landing clip → public/assets/video/apollo11.mp4 (compressed H.264, <30 MB), and a CC0/CC-BY Eiffel Tower .glb → public/assets/models/eiffel.glb (DRACO-compressed). Update exhibits.json licenses, run npm run assets to regenerate CREDITS.md, and use my own fujara/ondes_martenot photos if I have placed them in public/assets/images."

## Phase 2 — Realistic lighting & floors
"Make the floor truly reflective using three/addons Reflector (or SSR) with a roughness-blurred look on marble; keep parquet semi-gloss. Replace RoomEnvironment with a Poly Haven indoor HDRI (RGBELoader + PMREM). Tune spotlights so each painting has a soft warm cone with a gentle falloff on the wall (no blown-out whites, no pitch-black corners). Add real skylight light shafts (subtle volumetric cone meshes). Add ?q=low|medium|high switching that disables reflection/bloom on low."

## Phase 3 — Presentation detail
"Upgrade frames to profiled mouldings (extruded cross-section), add canvas normal map for painted brush texture on paintings, slim brass rails on pedestals, and real glass cases (MeshPhysicalMaterial with low-cost transmission) around instruments. Add benches in the middle of the paintings gallery with colliders. Add a large painted museum name sign in the entrance hall."

## Phase 4 — Interaction & audio
"Improve the E panel: show the image large, audio play/pause + progress for the audio exhibit, and video controls. Add positional (THREE.PositionalAudio) sound for the Beethoven station and the Apollo video with smooth fade by distance. Add subtle room-tone per room and keep the synthesized footsteps. Make the outline highlight a proper post-process outline (OutlinePass) instead of the box."

## Phase 5 — Post-processing, UI, mobile, performance
"Add SSAO (or GTAO) at medium+, keep bloom subtle, add a vignette + film-grain pass. Build a proper loading screen with real progress (LoadingManager). Add virtual joystick + look-drag touch controls for mobile. Profile: merge static wall/trim meshes, add light culling by room, and verify 60 fps at ?q=medium. Report FPS numbers."

## Phase 6 — Audit
"Audit the whole project: console errors, 404 assets, z-fighting, objects floating off walls, collision gaps (try walking into every corner/doorway/pedestal), low-FPS spots. Fix everything, run npm run validate and npm run build, and summarise."

## Tips
- Be specific in feedback: "floor looks flat, no reflections, art too bright" beats "make it better".
- If it drifts, say: "Revert to the last git commit and redo only X."
- Add more rooms/exhibits by editing the two JSON files, then `npm run validate`.
