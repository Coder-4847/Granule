import { levels, worlds } from '../data/campaign';
import { materials } from '../data/materials';
import type { Session } from '../game/session';
import { SaveStore, unpackWorld } from '../game/saves';
import { machineKinds, validateLevel, type Level, type Stamp } from '../game/schema';
import { levelData } from '../game/runtime';
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function blankBlueprint(): Level {
  return {
    ...structuredClone(levels[0]),
    id: 'custom',
    title: 'Untitled workshop',
    lesson: 'An original sandbox construction.',
    terrain: [],
    machines: [],
    sensors: [],
    goals: [
      { id: 'target', label: 'Deliver sand', material: 3, target: 50, rect: [400, 40, 80, 40] },
    ],
    work: [[2, 2, 956, 536]],
    toolkit: {
      materials: materials.filter((m) => m.id > 0).map((m) => m.id),
      tools: [0, 1, 2, 3],
      budget: 100000,
      efficient: 50000,
      radius: 60,
    },
    solution: { ticks: 900, events: [] },
  };
}
export class GameUI {
  store = new SaveStore();
  private awarded = '';
  private placement = false;
  private shownLevel = '';
  constructor(
    private session: () => Session,
    private resize: (width: number) => void,
    private selectMaterial: (id: number) => void,
    private notice: (text: string) => void,
    private pauseUI: () => void,
  ) {
    document.querySelector('.workspace')!.insertAdjacentHTML(
      'beforebegin',
      `
      <section class="game-panel" aria-label="Campaign and sandbox">
        <div class="game-navigation"><label>World <select id="campaign-world">${worlds.map((w, i) => `<option value="${i + 1}">${i + 1}. ${w}</option>`).join('')}</select></label><label>Level <select id="campaign-level"></select></label><button id="play-level" class="primary">Play level</button><button id="sandbox-mode">Sandbox</button><span id="stars-total"></span></div>
        <div class="game-heading"><div><span id="mode-label" class="eyebrow">SANDBOX · ALL MATERIALS UNLOCKED</span><h2 id="level-title">Your laboratory</h2><p id="lesson">Experiment freely, or choose a campaign level above.</p></div><div class="game-actions"><button id="restart-level" hidden>Restart</button><button id="level-hint" hidden>Hint</button><button id="record-attempt" hidden>Export attempt</button><button id="next-level" hidden>Next level</button></div></div>
        <div id="objectives" aria-live="polite"></div><p id="budget-status"></p><p id="hint-text" hidden></p>
      </section>`,
    );
    document
      .querySelector('.canvas-wrap')!
      .insertAdjacentHTML('beforeend', '<div id="zones" aria-hidden="true"></div>');
    document.querySelector('.lab-footer')!.insertAdjacentHTML(
      'afterend',
      `
      <section class="sandbox-tools" id="sandbox-tools" aria-label="World tools"><div class="save-toolbar"><button id="undo-world">Undo</button><button id="redo-world">Redo</button><span class="muted">Paused placements · before time advances</span><label>World slot <select id="world-slot"><option>1</option><option>2</option><option>3</option></select></label><button id="save-world">Save</button><button id="load-world">Load</button><button id="export-world">Export world</button><button id="import-world">Import world</button><button id="level-template">Use selected level terrain</button></div>
      <details><summary>Machinery workshop</summary><p>Choose an object, then place it on the canvas. Its marked sensor activates at the chosen threshold. Moving parts crush matter at their leading edge. Generators and relays emit a spark on activation.</p><div class="save-toolbar"><label>Object <select id="machine-kind">${machineKinds.map((k) => `<option>${k}</option>`).join('')}</select></label><label>Sense <select id="machine-material">${materials.map((m) => `<option value="${m.id}" ${m.id === 4 ? 'selected' : ''}>${m.name}</option>`).join('')}</select></label><label>Signal <select id="machine-channel"><option value="count">Material count</option><option value="charge">Electrical pulse</option><option value="pressure">Pressure</option><option value="temperature">Temperature</option></select></label><label>Threshold <input id="machine-threshold" type="number" min="0" max="100000" step=".1" value="20"></label><button id="place-machine">Place object</button><button id="remove-machine">Remove last object</button>${import.meta.env.DEV ? '<button id="editor-open">Level editor</button>' : ''}</div></details></section>
      <input id="world-file" type="file" accept=".json,application/json" hidden>`,
    );
    if (import.meta.env.DEV)
      document.body.insertAdjacentHTML(
        'beforeend',
        `
      <dialog id="editor-dialog" class="editor-dialog"><h2>Level authoring</h2><p>Paint terrain in the paused sandbox, then capture it here. Coordinates start at the bottom left of the 960 × 540 grid. Edit goal rectangles, sensors, links, work areas, toolkit, hints, and reference inputs in the validated JSON.</p><div class="save-toolbar"><button id="editor-capture">Capture painted terrain</button><button id="editor-goal">Add goal at canvas center</button><label>Budget <input id="editor-budget" type="number" min="1" max="1000000" value="100000"></label></div><label for="editor-json">Level JSON</label><textarea id="editor-json" rows="18" spellcheck="false"></textarea><p id="editor-status" role="status"></p><div class="save-toolbar"><button id="editor-apply">Apply to sandbox</button><button id="editor-test">Playtest level</button><button id="editor-export">Export level JSON</button><button id="editor-close">Close</button></div></dialog>`,
      );
    el<HTMLSelectElement>('shape').insertAdjacentHTML(
      'beforeend',
      '<option value="2">Line · drag and release</option>',
    );
    el('search').insertAdjacentHTML('afterend', '');
    document
      .querySelector('.palette .search')!
      .insertAdjacentHTML(
        'afterend',
        '<label class="category-label">Category <select id="category"><option value="all">All matter</option><option value="powder">Powders</option><option value="liquid">Liquids</option><option value="gas">Gases & flame</option><option value="solid">Solids</option></select></label>',
      );
    el('campaign-world').onchange = () => this.listLevels();
    el('campaign-level').onchange = () => this.updateSelection();
    el('play-level').onclick = () => this.playSelected();
    el('sandbox-mode').onclick = () => {
      this.session().reset('empty');
      this.session().paused = true;
      this.connect();
    };
    el('restart-level').onclick = () => {
      const level = this.session().puzzle?.level;
      if (level) {
        this.awarded = '';
        this.session().loadLevel(level);
        this.syncTools();
      }
    };
    el('level-hint').onclick = () => {
      const game = this.session().puzzle;
      if (!game || game.solved) return;
      el('hint-text').hidden = false;
      el('hint-text').textContent = game.hint() + ' Using hints forfeits the bonus star.';
      this.render();
    };
    el('record-attempt').onclick = () => {
      const g = this.session().puzzle;
      if (!g || this.session().engine.tick < 6) {
        this.notice('Advance at least six ticks before recording an attempt.');
        return;
      }
      download(`${g.level.id}-attempt.json`, {
        ...g.level,
        solution: { ticks: this.session().engine.tick, events: g.events },
      });
    };
    el('next-level').onclick = () => {
      const game = this.session().puzzle;
      if (!game) return;
      const next = levels[levels.findIndex((l) => l.id === game.level.id) + 1];
      if (next) {
        el<HTMLSelectElement>('campaign-world').value = String(next.world);
        this.listLevels();
        el<HTMLSelectElement>('campaign-level').value = next.id;
        this.playSelected();
      }
    };
    el('undo-world').onclick = () => void this.session().undo();
    el('redo-world').onclick = () => void this.session().undo(true);
    // Undo is also available while playing a paused puzzle.
    document
      .querySelector('.transport-left')!
      .insertAdjacentHTML(
        'beforeend',
        '<button id="undo-placement" title="Undo paused placement">↶</button>',
      );
    el('undo-placement').onclick = () => void this.session().undo();
    el('save-world').onclick = () =>
      void this.action(async () => {
        const world = await this.session().saveWorld();
        this.store.data.slots[el<HTMLSelectElement>('world-slot').value] = world;
        this.store.commit();
        this.notice('World saved in this browser.');
      });
    el('load-world').onclick = () =>
      void this.action(async () => {
        const world = this.store.data.slots[el<HTMLSelectElement>('world-slot').value];
        if (!world) throw new Error('This slot is empty.');
        await this.loadWorld(world);
      });
    el('export-world').onclick = () =>
      void this.action(async () =>
        download('granule-world.json', await this.session().saveWorld()),
      );
    el('import-world').onclick = () => el<HTMLInputElement>('world-file').click();
    el('world-file').onchange = () =>
      void this.action(async () => {
        const input = el<HTMLInputElement>('world-file'),
          file = input.files?.[0];
        if (!file) return;
        try {
          if (file.size > 26000000) throw new Error('World file exceeds 26 MB.');
          await this.loadWorld(JSON.parse(await file.text()));
        } finally {
          input.value = '';
        }
      });
    el('level-template').onclick = () => {
      if (this.session().engine.width !== 960) this.resize(960);
      const level = levels.find((l) => l.id === el<HTMLSelectElement>('campaign-level').value)!;
      this.session().reset('empty');
      this.session().engine.upload(levelData(level));
      this.session().setSandboxBlueprint(level);
      this.session().paused = true;
      this.render();
    };
    el('place-machine').onclick = () => {
      if (this.session().puzzle) return;
      this.placement = true;
      this.session().paused = true;
      this.notice('Click the canvas to place the object and its sensor.');
    };
    el('machine-kind').onchange = () => {
      const relay = el<HTMLSelectElement>('machine-kind').value === 'relay';
      el<HTMLSelectElement>('machine-channel').value = relay ? 'charge' : 'count';
      el<HTMLInputElement>('machine-threshold').value = relay ? '.3' : '20';
      el<HTMLSelectElement>('machine-material').value = relay ? '19' : '4';
    };
    el('machine-channel').onchange = () => {
      const channel = el<HTMLSelectElement>('machine-channel').value;
      el<HTMLInputElement>('machine-threshold').value =
        channel === 'charge'
          ? '.3'
          : channel === 'pressure'
            ? '2'
            : channel === 'temperature'
              ? '100'
              : '20';
    };
    el('remove-machine').onclick = () =>
      void this.action(async () => {
        const s = this.session(),
          b = structuredClone(s.sandboxBlueprint);
        if (!b || !b.machines.length) return;
        const object = b.machines.pop()!;
        b.sensors = b.sensors.filter((z) => z.id !== object.sensor);
        s.setSandboxBlueprint(b);
        if (object.kind === 'wire')
          s.engine.stroke({
            tick: s.engine.tick,
            from: [object.rect[0] + 4, object.rect[1] + 4],
            to: [object.rect[0] + object.rect[2] - 4, object.rect[1] + 4],
            radius: 4,
            shape: 1,
            tool: 0,
            material: 0,
            overwrite: false,
          });
        this.render();
      });
    el('world').addEventListener(
      'pointerdown',
      (event) => {
        if (!this.placement) return;
        event.stopImmediatePropagation();
        event.preventDefault();
        this.placement = false;
        const p = event as PointerEvent,
          box = el('world').getBoundingClientRect();
        if (this.session().engine.width !== 960) {
          this.notice('Choose High resolution for the machinery workshop.');
          return;
        }
        const x = Math.round(
            Math.max(20, Math.min(880, ((p.clientX - box.left) / box.width) * 960)),
          ),
          y = Math.round(
            Math.max(20, Math.min(460, ((box.bottom - p.clientY) / box.height) * 540)),
          );
        const s = this.session(),
          b = structuredClone(s.sandboxBlueprint ?? blankBlueprint()),
          id = `object-${Date.now()}`;
        const kind = el<HTMLSelectElement>('machine-kind').value as (typeof machineKinds)[number];
        b.sensors.push({
          id: `${id}-sense`,
          rect: [x, y + 20, 24, 24],
          material: Number(el<HTMLSelectElement>('machine-material').value),
        });
        b.machines.push({
          id,
          kind,
          rect: [x, y, 24, 8],
          sensor: `${id}-sense`,
          channel: el<HTMLSelectElement>('machine-channel').value as
            'count' | 'charge' | 'pressure' | 'temperature',
          threshold: Number(el<HTMLInputElement>('machine-threshold').value),
          latch: true,
          ...(kind === 'piston' || kind === 'float' || kind === 'lever'
            ? { travel: [30, 20] as [number, number] }
            : {}),
          ...(['wheel', 'turbine', 'relay'].includes(kind)
            ? { output: [x + 30, y + 4] as [number, number] }
            : {}),
        });
        void this.action(async () => {
          s.setSandboxBlueprint(b);
          if (kind === 'wire')
            s.engine.stroke({
              tick: s.engine.tick,
              from: [x + 2, y + 4],
              to: [x + 22, y + 4],
              radius: 2,
              material: 19,
              shape: 1,
              tool: 0,
              overwrite: true,
            });
          this.render();
        });
      },
      { capture: true },
    );
    el('category').onchange = () => this.filterMaterials();
    el('search').addEventListener('input', () => this.filterMaterials());
    if (import.meta.env.DEV) this.editor();
    this.settings();
    this.listLevels();
    if (this.store.warning) this.notice(this.store.warning);
  }
  connect() {
    this.session().onGameChange = () => this.render();
    this.awarded = '';
    this.syncTools();
    this.listLevels();
    this.render();
  }
  private async action(fn: () => Promise<void>) {
    try {
      await fn();
      this.render();
    } catch (error) {
      this.notice(error instanceof Error ? error.message : String(error));
    }
  }
  private async loadWorld(value: unknown) {
    const { world } = await unpackWorld(value);
    if (world.width !== this.session().engine.width) this.resize(world.width);
    await this.session().loadWorld(world);
    this.connect();
    this.notice('World restored and paused.');
  }
  private unlocked(level: Level) {
    const i = levels.findIndex((l) => l.id === level.id);
    return this.store.unlocked(level.world, level.order, levels[i - 1]?.id);
  }
  private listLevels() {
    const world = Number(el<HTMLSelectElement>('campaign-world').value),
      chosen = el<HTMLSelectElement>('campaign-level').value;
    el('campaign-level').innerHTML = levels
      .filter((l) => l.world === world)
      .map(
        (l) =>
          `<option value="${l.id}">${l.order}. ${escape(l.title)} ${'★'.repeat(this.store.data.stars[l.id] ?? 0)}${this.unlocked(l) ? '' : l.world === 11 ? ` · ${100 + l.order * 10} stars` : ' · Locked'}</option>`,
      )
      .join('');
    if (levels.some((l) => l.world === world && l.id === chosen))
      el<HTMLSelectElement>('campaign-level').value = chosen;
    this.updateSelection();
  }
  private updateSelection() {
    const level = levels.find((l) => l.id === el<HTMLSelectElement>('campaign-level').value)!;
    el<HTMLButtonElement>('play-level').disabled = !this.unlocked(level);
    el('stars-total').textContent = `${this.store.totalStars} / 330 ★`;
  }
  private playSelected() {
    const level = levels.find((l) => l.id === el<HTMLSelectElement>('campaign-level').value)!;
    if (!this.unlocked(level)) return;
    if (this.session().engine.width !== 960) {
      el<HTMLSelectElement>('quality').value = '960';
      this.resize(960);
    }
    this.awarded = '';
    el('hint-text').hidden = true;
    this.session().loadLevel(level);
    this.syncTools();
    this.render();
  }
  private syncTools() {
    const s = this.session(),
      g = s.puzzle;
    el<HTMLInputElement>('overwrite').checked = s.overwrite;
    el<HTMLInputElement>('radius').max = String(g?.level.toolkit.radius ?? 60);
    el<HTMLInputElement>('radius').value = String(s.radius);
    el('radius-label').textContent = `${s.radius} px`;
    const tool = s.tool,
      erasing = s.material === 0 && tool === 0;
    this.selectMaterial(s.material);
    s.tool = tool;
    el<HTMLSelectElement>('tool').value = erasing ? '3' : String(tool);
    el<HTMLSelectElement>('quality').value = String(s.engine.width);
  }
  private filterMaterials() {
    const query = el<HTMLInputElement>('search').value.toLowerCase(),
      category = el<HTMLSelectElement>('category').value;
    document.querySelectorAll<HTMLButtonElement>('[data-material]').forEach((b) => {
      const m = materials[Number(b.dataset.material)];
      b.hidden =
        !m.name.toLowerCase().includes(query) || (category !== 'all' && m.phase !== category);
    });
  }
  render() {
    const s = this.session(),
      g = s.puzzle;
    if (!el('objectives')) return;
    const identity = g?.level.id ?? 'sandbox';
    if (identity !== this.shownLevel) {
      this.shownLevel = identity;
      this.syncTools();
      if (g && levels.some((l) => l.id === g.level.id)) {
        el<HTMLSelectElement>('campaign-world').value = String(g.level.world);
        this.listLevels();
        el<HTMLSelectElement>('campaign-level').value = g.level.id;
        this.updateSelection();
      }
    }
    if (g?.solved && !s.puzzleReplay && this.awarded !== g.level.id) {
      this.awarded = g.level.id;
      try {
        this.store.award(g.level.id, g.stars);
        this.listLevels();
      } catch (error) {
        this.notice(String(error));
      }
    }
    el('mode-label').textContent = g
      ? `${worlds[g.level.world - 1].toUpperCase()} · ${g.level.order} / 10`
      : 'SANDBOX · ALL MATERIALS UNLOCKED';
    el('level-title').textContent = g ? g.level.title : 'Your laboratory';
    el('lesson').textContent = g
      ? g.level.lesson
      : 'Experiment freely. Pause before placing matter to enable undo and redo.';
    el('sandbox-tools').hidden = !!g;
    el('restart-level').hidden = !g;
    el('level-hint').hidden = !g;
    el<HTMLButtonElement>('level-hint').disabled = !!g?.solved;
    el('record-attempt').hidden = !g;
    const nextLevel = g
      ? levels[levels.findIndex((level) => level.id === g.level.id) + 1]
      : undefined;
    el('next-level').hidden = !g?.solved || !nextLevel || !this.unlocked(nextLevel);
    el('budget-status').textContent = g
      ? `${g.budget.used.toLocaleString()} / ${g.level.toolkit.budget.toLocaleString()} brush cells · Efficiency star ≤ ${g.level.toolkit.efficient.toLocaleString()} · ${(s.engine.tick / 60).toFixed(1)} / ${(g.level.timeLimit / 60).toFixed(0)} s${g.solved ? ` · Complete ${'★'.repeat(g.stars)}${'☆'.repeat(3 - g.stars)}` : g.failed ? ' · Time ended. Restart for another try.' : ''}`
      : '';
    el('objectives').innerHTML = g
      ? g.level.goals
          .filter((goal) => !goal.guard)
          .map((goal, i) => {
            const value = g.readings[goal.id]?.[goal.channel ?? 'count'] ?? 0,
              reached =
                g.reached.has(goal.id) ||
                (!goal.latch &&
                  !!g.readings[goal.id] &&
                  (goal.comparison === 'at-most' ? value <= goal.target : value >= goal.target));
            return `<div class="objective ${reached ? 'reached' : ''}"><span>${reached ? '✓' : `${i + 1}.`} ${escape(goal.label)}</span><span>${g.readings[goal.id] ? value.toFixed(goal.channel && goal.channel !== 'count' ? 1 : 0) : '—'} / ${goal.target}</span></div>`;
          })
          .join('')
      : '';
    if (g) {
      const guards = g.level.goals.filter((goal) => goal.guard),
        failed = guards.filter(
          (goal) =>
            g.readings[goal.id] && g.readings[goal.id][goal.channel ?? 'count'] > goal.target,
        );
      if (guards.length)
        el('objectives').insertAdjacentHTML(
          'beforeend',
          `<div class="objective ${failed.length ? '' : 'reached'}"><span>Spill guards · at most 8 cells in each shaded area</span><span>${guards.length - failed.length} / ${guards.length} clear</span></div>`,
        );
    }
    for (const id of [
      'overwrite',
      'quality',
      'clear',
      'demo',
      'physics-bench',
      'export',
      'import',
      'benchmark',
    ])
      el<HTMLButtonElement>(id).disabled = !!g;
    for (const id of ['export', 'verify'])
      el<HTMLButtonElement>(id).disabled = !!g || !s.replaySupported;
    for (const id of ['export', 'verify'])
      el(id).title = !s.replaySupported
        ? 'This world has a custom starting state. Use Export world to preserve it.'
        : '';
    for (const option of el<HTMLSelectElement>('tool').options)
      option.disabled =
        !!g && !g.level.toolkit.tools.includes(Number(option.value) as 0 | 1 | 2 | 3);
    document.querySelectorAll<HTMLButtonElement>('[data-material]').forEach((b) => {
      b.disabled = !!g && !g.level.toolkit.materials.includes(Number(b.dataset.material));
    });
    const blueprint = g?.level ?? s.sandboxBlueprint;
    const mechanics = g?.machinery ?? s.sandboxMachines;
    const rectangles = blueprint
      ? [
          ...(g
            ? blueprint.work.map((rect, i) => ({ rect, label: `Work ${i + 1}`, kind: 'work' }))
            : []),
          ...blueprint.goals
            .filter((z) => !!g && !z.guard)
            .map((z, i) => ({ rect: z.rect, label: `Target ${i + 1}`, kind: 'goal' })),
          ...blueprint.goals
            .filter((z) => !!g && z.guard)
            .map((z) => ({ rect: z.rect, label: '', kind: 'guard' })),
          ...blueprint.sensors.map((z) => ({
            rect: z.rect,
            label: `${materials[z.material]?.name ?? 'Matter'} sensor`,
            kind: 'sensor',
          })),
          ...blueprint.machines.map((m) => {
            const position = mechanics?.states[m.id]?.position ?? 0;
            return {
              rect: [
                m.rect[0] + Math.round((m.travel?.[0] ?? 0) * position),
                m.rect[1] + Math.round((m.travel?.[1] ?? 0) * position),
                m.rect[2],
                m.rect[3],
              ],
              label: `${m.kind}${mechanics?.states[m.id]?.active ? ' · on' : ''}`,
              kind: 'machine',
            };
          }),
        ]
      : [];
    const links =
      blueprint?.machines
        .map((m) => {
          const sensor = [...blueprint.sensors, ...blueprint.goals].find((z) => z.id === m.sensor);
          if (!sensor) return '';
          const a = sensor.rect,
            b = m.rect;
          return `<path d="M ${a[0] + a[2] / 2} ${540 - a[1] - a[3] / 2} H ${b[0] + b[2] / 2} V ${540 - b[1] - b[3] / 2}"/>`;
        })
        .join('') ?? '';
    el('zones').innerHTML =
      `<svg class="machine-links" viewBox="0 0 960 540" preserveAspectRatio="none" aria-hidden="true">${links}</svg>` +
      rectangles
        .map(
          (z) =>
            `<div class="zone ${z.kind}" style="left:${z.rect[0] / 9.6}%;bottom:${z.rect[1] / 5.4}%;width:${z.rect[2] / 9.6}%;height:${z.rect[3] / 5.4}%">${z.label ? `<span>${escape(z.label)}</span>` : ''}</div>`,
        )
        .join('');
    document.querySelector<HTMLElement>('.canvas-caption')!.textContent = g
      ? 'PLACE INSIDE A WORK AREA · SPACE TO RESUME'
      : 'DRAW SOMETHING. LET IT BECOME SOMETHING ELSE.';
    this.pauseUI();
    document.dispatchEvent(new Event('granule-change'));
  }
  private settings() {
    const ids = [
      'lighting',
      'temperature',
      'patterns',
      'particles',
      'reduced-motion',
      'reduced-flashing',
      'master-volume',
      'music-volume',
      'sfx-volume',
    ];
    for (const id of ids) {
      const input = el<HTMLInputElement>(id),
        saved = this.store.data.settings[id];
      if (saved !== undefined) {
        if (input.type === 'checkbox' && typeof saved === 'boolean') input.checked = saved;
        else if (
          input.type === 'range' &&
          typeof saved === 'string' &&
          Number(saved) >= 0 &&
          Number(saved) <= 1
        )
          input.value = saved;
        input.dispatchEvent(new Event(input.type === 'range' ? 'input' : 'change'));
      }
      input.addEventListener('change', () => {
        if (id === 'reduced-motion')
          document.documentElement.classList.toggle('reduce-motion', input.checked);
        this.store.data.settings[id] = input.type === 'checkbox' ? input.checked : input.value;
        try {
          this.store.commit();
        } catch (error) {
          this.notice(String(error));
        }
      });
    }
  }
  private editor() {
    const status = (message: string) => (el('editor-status').textContent = message);
    const read = () => validateLevel(JSON.parse(el<HTMLTextAreaElement>('editor-json').value));
    const write = (level: Level) => {
      el<HTMLTextAreaElement>('editor-json').value = JSON.stringify(level, null, 2);
      el<HTMLInputElement>('editor-budget').value = String(level.toolkit.budget);
    };
    el('editor-open').onclick = () => {
      this.session().paused = true;
      write(this.session().sandboxBlueprint ?? blankBlueprint());
      status('Ready. Editing JSON does not change the canvas until Apply.');
      el<HTMLDialogElement>('editor-dialog').showModal();
    };
    el('editor-close').onclick = () => el<HTMLDialogElement>('editor-dialog').close();
    el('editor-budget').onchange = () => {
      try {
        const level = read();
        level.toolkit.budget = Number(el<HTMLInputElement>('editor-budget').value);
        level.toolkit.efficient = Math.min(level.toolkit.efficient, level.toolkit.budget);
        write(validateLevel(level));
      } catch (error) {
        status(String(error));
      }
    };
    el('editor-goal').onclick = () => {
      try {
        const level = read();
        level.goals.push({
          id: `goal-${Date.now()}`,
          label: 'New collector',
          rect: [420, 80, 80, 40],
          material: 3,
          target: 50,
          latch: true,
        });
        write(validateLevel(level));
      } catch (error) {
        status(String(error));
      }
    };
    el('editor-capture').onclick = () =>
      void this.action(async () => {
        const s = this.session();
        if (s.engine.width !== 960) throw new Error('Use High resolution for level authoring.');
        s.paused = true;
        s.busy = true;
        try {
          const data = await s.engine.read(),
            level = read();
          const stamps: Stamp[] = [];
          let prior = new Map<string, Stamp>();
          for (let y = 2; y < 538; y++) {
            const next = new Map<string, Stamp>();
            for (let x = 2; x < 958;) {
              const id = data[(y * 960 + x) * 4],
                temp = Math.round(data[(y * 960 + x) * 4 + 1]);
              let end = x + 1;
              while (
                end < 958 &&
                data[(y * 960 + end) * 4] === id &&
                Math.round(data[(y * 960 + end) * 4 + 1]) === temp
              )
                end++;
              if (id) {
                const key = `${x}-${end}-${id}-${temp}`,
                  previous = prior.get(key);
                if (previous) {
                  previous.rect[3]++;
                  next.set(key, previous);
                } else {
                  const stamp: Stamp = {
                    rect: [x, y, end - x, 1],
                    material: id,
                    temperature: temp,
                  };
                  stamps.push(stamp);
                  next.set(key, stamp);
                }
              }
              x = end;
            }
            prior = next;
          }
          level.terrain = stamps;
          level.solution.events = [];
          write(validateLevel(level));
          status(
            `${stamps.length} terrain rectangles captured. Author a reference replay during playtest.`,
          );
        } finally {
          s.busy = false;
        }
      });
    el('editor-apply').onclick = () => {
      try {
        const level = read();
        this.session().reset('empty');
        this.session().engine.upload(levelData(level));
        this.session().setSandboxBlueprint(level);
        status('Validated and applied.');
        this.render();
      } catch (error) {
        status(String(error));
      }
    };
    el('editor-test').onclick = () => {
      try {
        const level = read();
        this.session().loadLevel(level);
        el<HTMLDialogElement>('editor-dialog').close();
        this.syncTools();
        this.render();
      } catch (error) {
        status(String(error));
      }
    };
    el('editor-export').onclick = () => {
      try {
        download('granule-level.json', read());
        status('Validated level exported.');
      } catch (error) {
        status(String(error));
      }
    };
  }
}
