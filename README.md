# Grand Virtual Art Museum (Vite + Three.js)

A game-quality, first-person virtual museum experience built with Three.js (ES modules) and Vite. Features data-driven architecture, procedural PBR materials, planar floor reflections, 3D spatial audio, realistic exhibits with gold frames, glass showcases, and an interactive 3D model viewer.

---

## Quick Start

```powershell
# Navigate into the museum directory
cd "d:\virtual museum old\virtual museum\museum"

# Install dependencies (if not already installed)
npm install

# Validate layout, doorway clearances, and walkability
npm run validate

# Run the local development server
npm run dev

# Build production bundle
npm run build
```

Then open the local URL (usually `http://localhost:5173/`) in Google Chrome, Microsoft Edge, or any modern WebGL2 browser.

---

## Gallery Map (4 Connected Halls)

1. **Grand Entrance Hall (`hall`):**
   - High ceilings with classical museum inscription tablet.
   - High-gloss polished marble floor with real planar reflections (`Reflector.js`).
   - Volumetric sunbeams streaming down from atmospheric skylights.
   - Exhibits: *The Last Supper* (Da Vinci), *Vitruvian Man* (Da Vinci).

2. **Paintings Gallery (`paintings`):**
   - Warm herringbone oak parquet floor with procedural normal and roughness maps.
   - Central museum viewing benches with leather upholstery and brass fittings.
   - Classical multi-tier gold cove moulding frames with dark walnut liners and canvas linen weave normal maps.
   - Warm 3200K gallery spotlights with feathered penumbras and contact shadows.
   - Exhibits: *The Starry Night* (Van Gogh), *Mona Lisa* (Da Vinci), *Girl with a Pearl Earring* (Vermeer), *The Great Wave off Kanagawa* (Hokusai), *The Persistence of Memory* (Dalí).

3. **Music & Instruments Hall (`music`):**
   - Acoustically tailored gallery with dark pedestal listening stations and glass showcases.
   - Proximity 3D audio listening station with Beethoven's *Symphony No. 9 / Passacaglia*.
   - Exhibits: *Neanderthal Flute* (c. 40,000 BC), *Fujara*, *Ondes Martenot*, *Dizi Flute*, *Hammond B-3 Organ*, *Passacaglia / Symphony No. 9* listening station.

4. **History & Science Room (`history`):**
   - Large archival cinema screen showing the Apollo 11 Moon Landing video with spatial audio.
   - Freestanding pedestal with precision 3D scale model of the *Eiffel Tower*.
   - Central glass vitrine showcasing **The One Ring**:
     - Modeled from the master Blender source with both outer and inner Tengwar inscriptions.
     - Incandescent fiery Mordor runes burning with emissive glow over polished 24K gold.
     - Hovering and rotating in 3D with intimate spatial violin proximity audio.

---

## Interactive 3D Model Viewer

Pressing **E** or **clicking** any 3D model monument (The One Ring or Eiffel Tower) opens the Inspection Modal:
- **Left Column:** A dedicated live 3D WebGL viewer rendering the actual model under studio lighting.
  - **Drag to Rotate:** Click and drag to inspect the model in 360° (viewing the outer and inner inscriptions).
  - **Scroll to Zoom:** Mouse wheel zoom for close-up inspection.
  - **Auto-Spin:** Smooth rotation when idle.
- **Right Column:** Full curatorial metadata, era, badges, and dedicated dual-inscription banner with translation.

---

## Controls & Navigation

### Desktop
- **Click to Enter:** Locks the pointer and begins gallery audio.
- **W / A / S / D** or **Arrow Keys:** Walk forward, backward, strafe left/right.
- **Shift:** Sprint through the galleries.
- **Mouse Look:** First-person camera look with smooth head-bobbing.
- **E** or **Left Click:** Inspect focused artwork/monument.
- **Esc:** Pause the museum (or close modal), immediately muting background audio.

### Mobile & Touch
- **Left Side of Screen:** Virtual touch joystick with visual indicator for walking.
- **Right Side of Screen:** Drag to look and pitch camera.
- **Tap:** Inspect exhibit or interact.

---

## Audio & Acoustics

- **Surface-Aware Footsteps:** Synthesized acoustic clacks on polished marble vs warm wooden thuds on oak parquet.
- **Gallery Room Tone:** Filtered Brownian/pink noise simulating real museum acoustics.
- **Spatial Proximity Audio:**
  - *The One Ring:* Haunting violin theme with 5.8m radius.
  - *Beethoven Listening Station:* Symphony playback with 3.4m radius.
  - *Apollo 11 Video Screen:* Historic NASA footage with 4.8m radius.
- **Instant Silence on Pause:** Pressing **Esc** or releasing pointer lock immediately pauses all audio.

---

## Performance & Quality Settings

Switch quality anytime using the on-screen pill in the top-right corner (`[ LOW | MED | HIGH ]`) or via URL parameter `?q=low|medium|high`:
- **Low:** 1x DPR, shadows disabled, floor reflection disabled, maximum FPS on integrated GPUs.
- **Medium:** 1.5x DPR, soft shadow maps, 512px planar floor reflections.
- **High:** 2x DPR, PCF soft shadows, 1024px planar reflections, UnrealBloom pass, and cinematic vignette.

---

## License & Credits

All images, audio recordings, video footage, and 3D models are public domain or legally licensed Creative Commons media stored locally in `public/assets/`. See [`CREDITS.md`](CREDITS.md) for individual source attributions.
