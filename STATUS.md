# Granule status

## UI redesign — 6 October 2026

Replaced the green theme with ink, ivory, and coral; redesigned the launch screen and tightened the workspace layout. Removed the prefilled startup demonstration, including after resolution changes and GPU recovery. Initial interior is verified empty; desktop and phone screenshots are in verification/redesign-*.png. This supersedes the earlier live-background menu design. Build, lint, 22 targeted browser tests (including the full 110-level progression run), and production/offline checks pass.

## Phase 4 — completed 5 October 2026

Implemented the opening menu over the live simulation, world atlas with locks and stars, result panels, dismissible lessons, settings with persistent quality/interface size, reduced-motion preferences, collapsible tools, About, and confirmed progress reset. Added production offline caching, a GitHub Pages workflow, and an explicit license placeholder. No publication or Git operations have been performed.

Final verification:

- All 110 levels pass through the actual game controller: sequential unlocking, star awards, persistence, and reload. No browser console errors or warnings. See `verification/phase4-playthrough.json`.
- Production `/granule/` passes replay identity, a three-star solve through mouse controls, world save/load, and network-disabled reload. See `verification/production-check.json`.
- New shell tests cover menus, locked levels, next-level results, lessons, reset cancellation/confirmation, settings reload, phone layout, time-limit recovery, storage denial, and 80 rapid restarts. See `verification/phase4-recovery.json` and `verification/phase4-*.png`.
- The 601-second soak passed 590 iterations. Retained JS heap changed from 5,079,780 to 5,356,360 bytes after collection; final sandbox resource counts were 11 textures, 11 framebuffers, 11 programs, one buffer, and zero fences/shaders. No retained GPU resource growth or console warnings/errors. See `verification/phase4-soak.json`.
- Clean `npm ci`, lint, nine unit tests, strict typecheck, production build, and production offline checks pass. The initial Windows file lock was resolved by stopping the Vite server. All 33 browser tests pass in the final fresh-install run, including 289 negative controls, all reference solutions, and all 110 controller-driven progression checks.

Limitations: available hardware is an RTX 5080 Laptop GPU; representative mid-range performance is unverified. Automated campaign playthroughs do not substitute for human difficulty review or establish multiple-solution quality. The spatial simulation is not screen-reader equivalent. No real GitHub deployment has been performed; the workflow is prepared for the owner's repository. LICENSE remains a placeholder by request.

## Phase 3 — completed 5 October 2026

Phase 3 implements the game layer, 110 individually validated level files, exact GPU sensors, machinery, budgets, stars, hints, progression, compressed world slots, undo/redo, and a development editor. The ten Synthesis levels connect mechanisms into multistage contraptions; Master objectives must register simultaneously. Phase 4 was authorized on 5 October 2026; see its report above. Nothing has been pushed, published, or configured as a Git remote.

### Phase 3 verification

| Check                                      | Result                                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint, strict typecheck, production build | Pass                                                                                                                                  |
| Unit tests                                 | 9 pass                                                                                                                                |
| Browser tests                              | 29 pass: 28 regression/reference checks plus the separately run negative-control check                                                |
| Campaign solutions                         | All 110 recorded solutions solve within their budgets                                                                                 |
| Negative controls                          | All 289 inactivity and budget-limited uniform single-material controls fail to solve                                                  |
| Exact sensors                              | 32-zone GPU count and field reductions match independently inspected state                                                            |
| Save/load                                  | Compressed matter/field data, persistent slots, and moving machinery checkpoints round-trip exactly                                   |
| Gameplay                                   | Toolkit bounds, hints/star penalties, next-level unlocking, replay identity, live Master goals, and physical ice support pass         |
| Input and recovery                         | Click/touch, line release, paused undo/redo, malformed imports, corrupt saves, and context loss/recovery pass                         |
| Production                                 | `/granule/` passes UI-only replay verification, a three-star first-level solve, and world-slot save/load; dev API absent              |
| Layout and console                         | Reviewed desktop and 390 px phone captures; no horizontal overflow or browser console errors/warnings in the production/layout checks |

Evidence is in `verification/phase3-solutions.json`, `verification/phase3-negative-controls.json`, `verification/phase3-ice-controls.json`, `verification/phase3-ui.json`, `verification/production-check.json`, and the browser suite. The negative-control distribution is deliberately defined and reproducible; it does not prove that every conceivable shortcut is impossible. Corrections made during verification include spill containment, timing requirements, wire repair, asynchronous click/history handling, preventing focus scroll from shifting brush coordinates, and waiting for a pending placement before world export/save.

The campaign combines reusable introductory chambers with connected late-game machinery. Automated solvability does not establish subjective difficulty, multiple-solution quality, or the absence of repetitive content; human playtesting remains an explicit release limitation. Available hardware is a high-end NVIDIA RTX 5080 Laptop GPU, not representative mid-range hardware. Cross-GPU floating-point identity is unverified.

## What is working

- Strict TypeScript/Vite, lint, unit tests, real Chromium GPU tests, and production builds with relative asset paths.
- 960 × 540 (518,400) WebGL2 cells by default, fixed 60 Hz simulation, eight conflict-free transport substeps, seeded RNG, and asynchronous PBO/fence readback.
- 34 placeable materials, with table-defined density, viscosity, heat properties, phase transitions, combustion duration/residue, corrosion, electrical conductivity, blast strength, hardness, and growth.
- Water/steam/ice/snow transitions; metal/glass melting and solidifying; lava quenching; oil flotation; salt/brine; acid consumption and distinct corrosion rates; rust; fuel burning, spreading, and extinguishing; growing/burning plants.
- Propagating pressure waves, outward displacement, debris, wall protection, chain explosions, electrical pulse/refractory behavior, and remote electrical ignition.
- Conservative liquid transport with communicating-column pressure and short upward impulses. The fixture retains all 840 water cells and settles within four cells after 1,500 fixed ticks.
- A persistent 8,192-slot GPU particle layer with instanced sparks/trails, mist, splashes, bubbles, debris, rings, and crystals; emissive lighting/blur glow, heat shimmer, water highlights, and glass/ice edge refraction hints.
- Procedural material/UI sounds and an ambient music bed, enabled by user gesture, with master/music/SFX controls and compressor routing. Sampled GPU event reduction drives sounds at 10 Hz without synchronous CPU readback.
- Reduced motion/flashing, effects scaling, touch/mouse input, material search, temperature/pattern views, quality selection, replay import/export, and context-loss/fallback handling.
- An eight-station physics test bench under **Lab instruments → Physics test bench**.

## Verification — 4 October 2026

| Check                                      | Result                                                                                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint, strict typecheck, production build | Pass                                                                                                                                                |
| Unit tests                                 | 5 pass                                                                                                                                              |
| Browser checks                             | 18 pass (17-test suite plus the new direct-fire-placement regression, with its combustion companions rerun)                                         |
| Table-driven GPU coverage                  | All 37 contact, phase-transition, and lifetime-decay cases pass                                                                                     |
| Combustion                                 | All declared fuels leave their residues; cold fuel ignites; water extinguishes; painted fire contacts wood before rising                            |
| Pressure/electricity                       | Chain explosions, damage falloff behavior, preserved walls, traveling pulses, and remote explosive ignition pass                                    |
| Fluids                                     | Sand conservation, oil flotation, boiling/condensation behavior, and exact water-count preservation in communicating columns pass                   |
| Replay                                     | Live-state and two replay hashes match, including matter and pressure/charge/head fields                                                            |
| Accessibility/input                        | Reduced-effect settings, audio opt-in, phone touch, tablet layout, malformed inputs, and GPU recovery pass                                          |
| Production                                 | `/granule/` subpath smoke check passes, including interactive replay verification                                                                   |
| Extended stress benchmark                  | See `verification/phase2-benchmark.json`: 7,200 frames with repeated explosions, eight transport substeps, lighting, particles, and audio telemetry |
| Available hardware                         | NVIDIA RTX 5080 Laptop GPU, Chrome/D3D11; representative mid-range hardware remains unverified                                                      |

Browser tests generate screenshots and reports in `test-results/` and `playwright-report/`. Durable evidence is in:

- `verification/phase2-benchmark.json`
- `verification/phase2-reactions.json`
- `verification/phase2-hydraulics.json`
- `verification/phase2-replay.json`
- `verification/phase2-physics.png`
- `verification/production-check.json`

The benchmark uses one fixed simulation tick per rendered frame to measure throughput; normal play runs at 60 simulation ticks per second. Its explosive scene is refreshed every 240 frames to keep effects active. The test runner's environment-level `NO_COLOR`/`FORCE_COLOR` notice is distinct from browser console warnings.

## Limitations and next phase

This is a cellular game simulation, not an engineering fluid or chemistry solver. Dense communicating vessels are verified; narrow conduits and siphon-like puzzle geometries still need level-specific tuning. Particle placement and audio telemetry are sampled decorative effects, not exact gameplay sensors. No screen shake is applied. Cross-GPU floating-point identity and mid-range laptop performance are unverified.

Phase 3 is complete. Phase 2 measurements above remain historical where explicitly dated.

Phase 4 implementation and its separate evidence are recorded above. Historical Phase 2/3 measurements are retained for traceability.


## GitHub Pages publication — 6 October 2026

Publication authorized to Coder-4847/Granule. Release lint, nine unit tests, and production build pass. Initial push and Pages deployment are being performed; earlier no-publication statements above describe the historical phase gates.
