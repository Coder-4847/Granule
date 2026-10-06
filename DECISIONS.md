# Granule engineering decisions

## Phase 3 authorization and game rules — 5 October 2026

- The user's latest request authorizes Phase 3. Stop at its exit gate for approval before Phase 4; no push, remote, publishing, deployment workflow, or service worker is included here.
- Campaign physics uses the verified 960 × 540 grid. Resolution changes would change authored geometry, fluid volumes, and brush budgets, so the campaign locks resolution while the sandbox retains all three presets.
- Gameplay sensing uses exact 16 × 16 tile reductions followed by a final zone reduction, at most 32 zones. Only the small result is read through a PBO/fence. Sensors run every six simulation ticks. Simulation waits for the result at that boundary, rather than using a frame-dependent stale sample to drive machinery.
- Objective milestones may latch; spill guards remain live constraints. Machines use the same readings as the objective display. Mechanical output and collisions are deterministic; parts crush matter at the leading edge and leave air behind.
- Budgets count every cell in a brush footprint, even if a cell was already occupied. Heating, freezing, and erasing also cost brush cells. This keeps costs known before a GPU mutation and prevents free repeated heating. No brush may extend outside a level's work area.
- One star is awarded for completion, one for the efficiency threshold, and one for the level's bonus constraint. Any hint forfeits the bonus. Stored stars only improve; core levels unlock in sequence. Master levels require 110–200 total stars.
- Paused-placement history keeps at most four complete matter/field snapshots. Undo and redo require the same tick as the placement and cannot reverse a scored result. This provides a fair correction window without rewinding the simulation or consuming unbounded memory.
- Version 2 browser saves contain progress, settings, and three world slots. World files use lossless gzip over both Float32 fields, a checksum, dimensions, seed, tick, and machinery checkpoint. Decompression has an exact byte limit; malformed files are rejected before installation. Storage-quota errors offer file export instead of claiming a successful save.
- The authoring editor is dev-only; machinery placement and all other sandbox tools are available in production. JSON text is validated and rendered as text, never executed. Captured terrain is merged into rectangles and capped at 2,000 stamps.
- The campaign uses authored combinations of reusable physical components. Individual level files include terrain, objectives, toolkits, tutorials, three hints, and complete reference inputs. Automated controls cover no input and a deterministic, uniform single-material distribution within the legal budget; this is a defined exploit check, not exhaustive proof against every possible strategy.
- Gravity remains fixed. A gravity switch would affect hydraulic-head direction, buoyancy, replay identity, and existing physics gates; the original request made it optional only if cleanly supported.
- All ten Synthesis levels connect sensors, material reactions, and machinery through shared outputs. Their mechanisms are interdependent rather than independent objective checklists. Master goals are live and simultaneous; an early electrical pulse cannot be remembered until a later plant grows. The ice bridge level physically supports falling sand above the waterline.
- Static indestructible walls take precedence over moving machinery. Machine wall cells carry an ownership marker, so clearing an old footprint cannot delete terrain. Motion follows deterministic authored trajectories rather than rigid-body dynamics.
- The 110 individual JSON files are the canonical campaign data. Reference runs tune achievable thresholds; negative controls exposed shortcuts, including Spark spam bypassing a broken wire. Deep Quarry now explicitly requires its conductor to be repaired.
- Full world saves include active machinery position and ownership footprints. Input replay export is disabled for imported worlds and custom machinery because an input-only file cannot reconstruct those starting states; world export preserves them.

## Phase 2 authorization and architecture

- On 4 October 2026 the user requested continuing to the next phase. Proceed with Phase 2 while retaining the unverified mid-range hardware limitation.
- A separate RGBA32F field stores current/previous blast pressure, electrical pulse/refractory state, and hydraulic head. Damped finite-difference waves carry blast pressure outward. Transport uses its gradients to displace matter; generic hardness/debris properties govern damage.
- Material properties now live in a compact GPU lookup texture; contact rules are compiled from the material table. This avoids a 42-second cold shader compile caused by expanding branch lookups.
- Simulation events are emitted by the reaction pass into a separate texture. Persistent GPU particle slots sample that texture, and GPU-instanced quads render the effects. Decorative particles are excluded from gameplay state hashes.
- A sampled GPU reduction drives audio via a 4 KB PBO with a fence at 10 Hz. It is audio telemetry, not an exact gameplay sensor; Phase 3 sensors must use exact zone reductions.
- Phase 2 snapshot hashes include both matter and pressure/charge fields. Old input files remain importable as input recordings under the current rules; they do not promise Phase 1 outcomes. New recordings carry `physics: 2`.
- Hydraulic head is advected in the unused lifetime channel of non-burning, non-decaying liquids. Multiples of 5,000 encode a short upward-impulse duration; the remainder stores head below 1,000. This prevents gravity from immediately undoing a pressure displacement while keeping total liquid cell count exact. Burning/lifetime-bearing materials retain their original channel meaning.
- Eight transport substeps per fixed tick improve fluid responsiveness. Pressure-directed lateral flow and supported upward motion allow communicating columns to equalize. This remains a cellular approximation; narrow channels and siphon-like puzzle geometries require tuning in Phase 3.
- The latest user instruction requires stopping after Phase 2 and waiting for approval before Phase 3. No campaign or level-authoring work is started in this phase.

## Phase discipline

The repository began empty. The four phases are sequential. Later-phase features and content are not claimed complete until the preceding exit gate is measured and passes. No remotes, publication, or pushes are performed.

## Simulation

- WebGL2 is the baseline. Two RGBA32F textures store material, Celsius temperature, lifetime, and signed horizontal momentum. The default is 960 × 540 (518,400 cells).
- Alternating 2 × 2 Margolus blocks provide conflict-free transport. Every fragment in a block computes the identical permutation, so movement preserves material counts. Reaction updates run from a frozen input state.
- A fixed 60 Hz clock advances eight transport substeps per tick. Integer hash RNG depends only on cell/block coordinates, tick, substep, and seed. Replay events are applied before their numbered tick. Slow devices run slower rather than skipping simulation ticks.
- Material properties and local transformations are compiled from a single typed material table into GLSL. Shader transport and thermal rules use generic properties, not material-specific branches.
- Readback uses PIXEL_PACK_BUFFER and fence polling. Only completed buffers are copied to JavaScript. Full-state readback is a diagnostic/replay operation, never part of the render loop.
- Determinism is checked on the same browser/GPU backend. Floating-point results across different GPU vendors are not promised identical.

## Scope and evidence

- The Phase 1 sandbox is an engineering foundation, not the finished 110-level game.
- Benchmark reports identify resolution, renderer, simulation substeps, and measured frame times. Software rendering or a fast headless run cannot certify a mid-range laptop performance claim.
- Quality changes restart a scene explicitly; silently resampling an active deterministic replay would alter its outcome. Initial adaptive fallback reduces visual effects only.

## Verification environment

- Playwright's default headless shell used SwiftShader software rendering. Installed Chrome, selected through `GRANULE_BROWSER=chrome`, used the NVIDIA RTX 5080 Laptop GPU and sustained approximately 240 fps in the 7,200-frame diagnostic.
- The available GPU is high-end. Treating this measurement as proof of the requested mid-range-laptop performance would overstate the evidence. The target-hardware part of the Phase 1 gate remains open.
- A short smoke benchmark in the browser suite records measurements without claiming a hardware qualification. The separate extended benchmark saves the actual renderer, browser, frame count, timing distribution, and console diagnostics.
- Replay verification compares the live recorded state with two reconstructed states, not merely one replay against another. Benchmarking preserves the original seed as well as texture state and tick.

## Phase 4 — UI, resilience, offline and release preparation

- The user authorized Phase 4 on 5 October 2026. The game remains local: no Git remote, push, or publication is performed.
- Native modal dialogs provide focus trapping and Escape dismissal for the menu, world atlas, settings, About, and reset confirmation. Results remain an unobstructive inline panel. The existing GPU scene remains visible behind the menu.
- Engineering browser tests enter through the development-only `?lab` path. Production always opens the menu; dedicated shell tests cover the ordinary first-run route. The dev editor and Session API remain absent from production.
- All 110 levels are additionally exercised through the actual game controller, including unlock checks, star awards, local storage, and reload. Defined single-material negative controls remain separate from this progression proof.
- Settings use the same underlying controls as the inspector; interface size, quality, effects and volumes persist. Reduced motion respects the system preference on first use. Opening settings or the atlas pauses the scene. Reset requires confirmation and retains world slots.
- The offline worker is emitted at build time with a content-derived revision and scoped cache names. HTML, bundles, and the favicon are cached together; old caches are deleted only on activation. Updates wait for all existing tabs to close, preserving an active game. Development does not register a worker.
- The GitHub Pages workflow builds on pull requests and deploys only from `main` or a manual run on `main`. Relative asset paths support project subpaths. The workflow follows GitHub's official custom-workflow guidance: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- The license file is explicitly a placeholder, with package metadata remaining UNLICENSED. No license choice is made on the owner's behalf.
- Error paths release temporary shader/framebuffer allocations. Context loss closes obstructing dialogs and disables GPU actions; recovery restarts the scene with saved progress intact. A back-forward cache restore rebuilds disposed GPU resources.
- The soak harness instruments live GPU resource ownership, performs repeated campaign resets and compressed world round trips over ten minutes, and samples retained JS heap after garbage collection. It is a bounded regression check, not a guarantee of indefinite leak-free operation or mid-range hardware performance.

Final Phase 4 checks on 5 October 2026: clean npm ci, lint, nine unit tests, strict build, production subpath/offline check, and all 33 browser checks pass. The 601-second soak completed 590 iterations with no retained GPU resource growth; JS heap after collection increased by 276,580 bytes. Verification artifacts and remaining limitations are recorded in STATUS.md.

## Visual redesign — 6 October 2026

Replaced the sage/green interface with ink, warm ivory, and coral. The launch screen now uses a clear two-column composition with campaign and sandbox cards, a solid paper backdrop, and larger typography. The workspace header and controls are more compact; menus, world cards, sliders, selection states, favicon, and empty canvas now follow the new palette. Actual material colors retain their physical identities.

Removed the prefilled demonstration from startup. Engine state and replay metadata now both start from `empty`; New canvas, resolution changes, and GPU recovery also return to an empty sandbox. The legacy demo remains only for compatibility with recorded replays. Explicitly selected campaign terrain and the optional physics test bench remain available.

Verified desktop and 390 px phone layouts and zero occupied interior cells on initial launch. Screenshots and assertions: `verification/redesign-home.png`, `verification/redesign-workspace.png`, `verification/redesign-phone.png`, and `verification/redesign.json`.

## Publication authorization — 6 October 2026

The user explicitly authorized pushing this project to https://github.com/Coder-4847/Granule and deploying it with GitHub Pages. This supersedes the earlier no-push/no-publication restriction. The destination was confirmed empty, with admin access through the existing Git credential. Publish main using the included Actions workflow; keep generated build output and dependencies untracked.
