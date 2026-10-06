# Granule

A WebGL2 falling-sand puzzle game built with strict TypeScript and Vite. The game includes **100 core levels and 10 bonus Master levels**, plus an unrestricted sandbox. See [STATUS.md](STATUS.md) for verification and known limits.

## Run locally

Use Node.js 22.12+ (or a supported newer LTS release).

```sh
npm ci
npm run dev
```

Open the address printed by Vite. Hardware-accelerated WebGL2 and `EXT_color_buffer_float` are required. The sandbox starts empty. The default grid is **960 × 540 = 518,400 cells**. Assets and sounds are local and procedural; audio starts only after a user gesture.

```sh
npm run build
npm run preview
```

Production files are written to `dist/` with relative asset paths. Menus, world selection, results, settings, offline caching, and a Pages workflow are included. Nothing has been pushed or published.

## Play and experiment

Choose **Play campaign** in the opening menu, then pick a discovery in the world atlas. **Menu**, **Worlds**, and **Settings** remain available in the header. Early levels teach the materials through brief lessons, constrained work areas, and escalating hints. Objectives show live measurements; the budget counts brush cells, including heating, freezing, and erasing. Earn stars for solving, efficiency, and the bonus constraint. Hints forfeit the bonus star. Core levels unlock sequentially; Master levels unlock at 110–200 total stars.

The ten Synthesis levels connect machinery and reactions into multistage contraptions. Master levels require their objectives to register together. Every level includes a recorded reference solution in its JSON data file.

**Sandbox** unlocks all 34 placeable materials, tools, and machinery. Use the searchable palette, machine workshop, three local world slots, and world file import/export. Paused placements support four steps of undo/redo while the simulation tick is unchanged. Browser storage is limited; export important worlds as files.

| Control           | Action                          |
| ----------------- | ------------------------------- |
| Drag / touch drag | Apply selected material or tool |
| Right drag        | Erase where permitted           |
| Space             | Pause / resume                  |
| `.`               | Pause and advance one tick      |
| `[` / `]`         | Change brush radius             |
| `T`               | Toggle temperature view         |
| `E`               | Toggle eraser                   |
| `1`–`9`           | Select the first nine materials |
| `?`               | Show controls                   |

Circle, square, and line brushes are available. Lines apply on release. The inspector also provides speed controls, patterns, reduced motion/flashing, effects scaling, and master/music/SFX volume. Campaigns lock their authored resolution; sandbox resolution changes restart the scene.

Open **Lab instruments → Physics test bench** for eight reaction stations. Lab instruments also provide input replay verification and GPU benchmarking. Input replays reconstruct supported starting scenes; imported worlds and custom machinery use full world export instead. Determinism is scoped to the same browser and GPU backend.

The development build includes a sandbox level editor for terrain capture, machinery, objectives, toolkits, budgets, JSON validation, playtesting, and export. The editor and diagnostic JavaScript API are absent from production.

## Verification

```sh
npx playwright install chromium
npm run verify
```

This runs lint, nine unit tests, the production build, and 33 browser tests, including all 110 solutions and 289 negative controls. The negative controls cover inactivity and a defined budget-limited uniform single-material distribution; they are not exhaustive strategy search. Software rendering can make these tests slow.

To use installed Chrome on Windows:

```powershell
$env:GRANULE_BROWSER = 'chrome'
npm run verify
npm run test:production
```

The production check serves `/granule/`, verifies replay identity, solves the first level through the UI, exercises a world slot, and reloads successfully with the network disabled. With the development server running, `node tools/check-game-ui.mjs` captures desktop and phone layouts.

`npm run benchmark` runs 7,200 frames of an explosive workload and writes `verification/phase2-benchmark.json`. It measures one fixed tick per rendered frame; normal play targets 60 simulation ticks per second. `GRANULE_BENCH_FRAMES` overrides its duration. Available hardware is an NVIDIA RTX 5080 Laptop GPU; mid-range hardware performance and cross-GPU floating-point identity remain unverified.

## Architecture

- `src/sim`: floating-point matter/field textures, transport, heat, exact zone reductions, asynchronous PBO/fence readback, and replay validation.
- `src/data`: material properties, table-defined reactions, campaign loader, and 110 validated JSON level files.
- `src/game`: fixed-step session, objectives, budgets, machinery, progression, compressed saves, and placement history.
- `src/render`, `src/particles`, `src/audio`: lighting, instanced effects, and procedural sounds.
- `src/tools`, `src/ui`: pointer/touch input, game controls, sandbox workshop, and dev editor.
- `tests`, `verification`: automated checks and durable evidence.

Transport uses conflict-free 2 × 2 Margolus blocks and seeded integer RNG. The pressure/charge/hydraulic field and matter field both participate in replay hashes. Exact gameplay sensors run every six ticks; decorative effects use separate sampled telemetry. Machinery crushes movable matter at its leading edge, preserves static walls, and clears only cells it owns. This is a cellular game simulation, not an engineering fluid or chemistry solver.

## Deployment and offline play

The production build registers a scoped service worker. After the first successful visit, it works offline, including all levels. Close all Granule tabs and reopen to activate an available update. Browser storage may be cleared or evicted; exported world files remain the portable backup.

To deploy when you are ready:

1. Create your GitHub repository and push this project to `main` yourself.
2. In repository **Settings → Pages**, choose **GitHub Actions** as the source.
3. Run the included **Build and deploy Granule** workflow, or push to `main`. It uses `npm ci`, lint, unit tests, and the production build before uploading `dist/`.
4. Visit the Pages URL from the deployment. The same files support a `/repository-name/` subpath or a custom domain.

Pull requests build without deploying. The workflow follows [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). Hosting has not been exercised against a real repository; no remote, push, or publication was performed.

`LICENSE` is an explicit placeholder. Replace it with your preferred license before inviting reuse.

For a ten-minute resource/heap check, run `npm run test:soak` while the development server is running. `GRANULE_SOAK_MS` can shorten diagnostics; only the recorded full-duration run supports the soak claim. The evidence is in `verification/phase4-soak.json`.

Human difficulty review and representative hardware testing remain necessary before release. Canvas interactions are spatial; the menus and controls are keyboard accessible, but the simulation is not a screen-reader-equivalent experience. Cross-GPU bit-for-bit determinism is unverified.

Five discoveries to try: **Chisel** (1.7), **Load-bearing ice** (4.5), **Press fit** (5.2), **River foundry** (10.1), and **Granule** (10.10).
