import { levels, worlds } from '../data/campaign';
import type { Session } from '../game/session';
import type { GameUI } from './game';
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const close = (id: string) => el<HTMLDialogElement>(id).close();
export class Shell {
  private resultKey = '';
  private dismissedLesson = '';
  constructor(
    private session: () => Session,
    private game: GameUI,
  ) {
    document
      .querySelector('.masthead')!
      .insertAdjacentHTML(
        'beforeend',
        '<nav aria-label="Main navigation"><button id="menu">Menu</button><button id="world-map">Worlds</button><button id="settings-open">Settings</button></nav>',
      );
    document.body.insertAdjacentHTML(
      'beforeend',
      `
      <dialog id="home-dialog" class="home-dialog" aria-labelledby="home-title"><div class="home-mast"><span>granule<span class="home-dot">.</span></span><span class="home-edition">THE PARTICLE PLAYGROUND / 01</span></div><div class="home-body"><div class="home-copy"><span class="eyebrow">A FEW GRAINS. A LOT OF POSSIBILITIES.</span><h1 id="home-title">Make a little<br><em>chaos.</em></h1><p>Pour it. Burn it. Freeze it.<br>A world of tiny reactions, entirely in your hands.</p><button id="home-return" class="home-return">Enter workspace ↗</button></div><div class="menu-actions"><button id="home-play" class="home-choice"><span class="choice-number">01 / CAMPAIGN</span><strong>Find a way.<span>↗</span></strong><span>110 puzzles of matter, motion, and chain reactions.</span></button><button id="home-sandbox" class="home-choice"><span class="choice-number">02 / SANDBOX</span><strong>Start from nothing.<span>↗</span></strong><span>An empty canvas. Every material. Your rules.</span></button></div></div><div class="home-bottom"><span>34 MATERIALS · ZERO LIMITS ON CURIOSITY</span><div><button id="home-settings">Settings</button><button id="home-about">About</button></div></div></dialog>
      <dialog id="map-dialog" class="map-dialog" aria-labelledby="map-title"><div class="dialog-heading"><div><span class="eyebrow">THE ATLAS</span><h2 id="map-title">A world of small discoveries.</h2><p id="map-progress"></p></div><button data-close="map-dialog">Close</button></div><div id="map-worlds" role="group" aria-label="Worlds"></div><h3 id="map-world-title"></h3><div id="map-levels"></div><p id="map-note"></p></dialog>
      <dialog id="settings-dialog" aria-labelledby="settings-title"><div class="dialog-heading"><h2 id="settings-title">Make yourself comfortable.</h2><button data-close="settings-dialog">Close</button></div><div id="settings-fields"></div><label class="setting-row">Interface size<select id="ui-scale"><option value="14">Standard</option><option value="16">Large</option><option value="18">Extra large</option></select></label><button id="settings-keys">Keyboard controls</button><hr><p>Resetting progress clears stars and unlocks. Your world slots and settings remain.</p><button id="reset-progress">Reset campaign progress</button></dialog>
      <dialog id="reset-dialog" aria-labelledby="reset-title"><h2 id="reset-title">Start the campaign again?</h2><p>This removes all earned stars and locks later levels. This cannot be undone.</p><button id="reset-cancel">Keep progress</button><button id="reset-confirm">Reset progress</button></dialog>
      <dialog id="about-dialog" aria-labelledby="about-title"><h2 id="about-title">Every grain has a place.</h2><p>Granule is a cellular puzzle laboratory: powders fall, liquids find their level, heat travels, and tiny reactions become machines.</p><p>All visuals and audio are procedural. Progress and worlds stay in this browser. Export world files to keep a backup.</p><p>Requires WebGL2. Physics is a playful approximation. Keyboard, mouse, touch, and trackpad input are supported.</p><p id="offline-status">Offline play is available after the production build is cached.</p><button data-close="about-dialog">Back</button></dialog>`,
    );
    document
      .querySelector('.game-panel')!
      .insertAdjacentHTML(
        'afterend',
        '<section id="result-panel" class="result-panel" hidden aria-labelledby="result-title" role="region"><span id="result-stars" aria-label="Stars"></span><h2 id="result-title"></h2><p id="result-detail"></p><button id="result-next" class="primary">Next discovery</button><button id="result-retry">Try again</button><button id="result-map">World map</button></section>',
      );
    el('lesson').insertAdjacentHTML(
      'afterend',
      '<button id="dismiss-lesson" class="quiet">Got it · hide tip</button>',
    );
    document
      .querySelector('.workspace')!
      .insertAdjacentHTML(
        'beforebegin',
        '<button id="toggle-tools" aria-expanded="true">Hide tools</button>',
      );
    el('toggle-tools').onclick = () => {
      const hidden = document.body.classList.toggle('tools-collapsed');
      el('toggle-tools').textContent = hidden ? 'Show tools' : 'Hide tools';
      el('toggle-tools').setAttribute('aria-expanded', String(!hidden));
    };
    document
      .querySelectorAll<HTMLButtonElement>('[data-close]')
      .forEach((b) => (b.onclick = () => close(b.dataset.close!)));
    el('menu').onclick = () => this.home();
    document.querySelector<HTMLAnchorElement>('.brand')!.onclick = (e) => {
      e.preventDefault();
      this.home();
    };
    el('home-return').onclick = () => close('home-dialog');
    el('home-play').onclick = () => {
      close('home-dialog');
      this.map();
    };
    el('home-sandbox').onclick = () => {
      close('home-dialog');
      el('sandbox-mode').click();
      document.querySelector('.workspace')!.scrollIntoView({ block: 'start' });
    };
    el('world-map').onclick = () => this.map();
    for (const id of ['settings-open', 'home-settings'])
      el(id).onclick = () => {
        close('home-dialog');
        this.settings();
      };
    el('home-about').onclick = () => {
      close('home-dialog');
      el<HTMLDialogElement>('about-dialog').showModal();
    };
    el('settings-keys').onclick = () => {
      close('settings-dialog');
      el('help').click();
    };
    el('reset-progress').onclick = () => el<HTMLDialogElement>('reset-dialog').showModal();
    el('reset-cancel').onclick = () => close('reset-dialog');
    el('reset-confirm').onclick = () => {
      const old = this.game.store.data.stars;
      this.game.store.data.stars = {};
      try {
        this.game.store.commit();
        close('reset-dialog');
        close('settings-dialog');
        el('sandbox-mode').click();
        this.map();
      } catch (error) {
        this.game.store.data.stars = old;
        el('notice').textContent = String(error);
      }
    };
    el('dismiss-lesson').onclick = () => {
      this.dismissedLesson = this.session().puzzle?.level.id ?? '';
      this.update();
    };
    el('result-next').onclick = () => el('next-level').click();
    el('result-retry').onclick = () => el('restart-level').click();
    el('result-map').onclick = () => this.map();
    const scale = this.game.store.data.settings['ui-scale'];
    if (typeof scale === 'string' && ['14', '16', '18'].includes(scale))
      el<HTMLSelectElement>('ui-scale').value = scale;
    const applyScale = () =>
      (document.documentElement.style.fontSize = `${el<HTMLSelectElement>('ui-scale').value}px`);
    applyScale();
    el('ui-scale').onchange = () => {
      applyScale();
      this.persist('ui-scale', el<HTMLSelectElement>('ui-scale').value);
    };
    document.addEventListener('granule-change', () => this.update());
    document.addEventListener('keydown', (e) => {
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        document.querySelector('dialog[open]') ||
        /INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement).tagName)
      )
        return;
      if (e.key.toLowerCase() === 'r') el('restart-level').click();
      if (e.key.toLowerCase() === 'h') el('level-hint').click();
      if (e.key.toLowerCase() === 'u') el('undo-placement').click();
    });
    this.update();
    el('quality').addEventListener('change', () =>
      this.persist('quality', el<HTMLSelectElement>('quality').value),
    );
    const savedQuality = this.game.store.data.settings.quality;
    if (typeof savedQuality === 'string' && ['480', '720', '960'].includes(savedQuality)) {
      el<HTMLSelectElement>('quality').value = savedQuality;
      el('quality').dispatchEvent(new Event('change'));
    }
    const motion = el<HTMLInputElement>('reduced-motion');
    if (
      this.game.store.data.settings['reduced-motion'] === undefined &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      motion.checked = true;
      motion.dispatchEvent(new Event('change'));
    }
    document.documentElement.classList.toggle('reduce-motion', motion.checked);
    if (!(import.meta.env.DEV && new URLSearchParams(location.search).has('lab'))) this.home();
  }
  private persist(id: string, value: string) {
    try {
      this.game.store.data.settings[id] = value;
      this.game.store.commit();
    } catch (error) {
      el('notice').textContent = String(error);
      el('notice').classList.add('visible');
    }
  }
  private home() {
    if (this.session().puzzle) {
      this.session().paused = true;
      this.session().onGameChange?.();
    }
    if (!el<HTMLDialogElement>('home-dialog').open)
      el<HTMLDialogElement>('home-dialog').showModal();
  }
  private settings() {
    this.session().paused = true;
    this.session().onGameChange?.();
    const fields = el('settings-fields');
    fields.replaceChildren();
    for (const id of [
      'quality',
      'sound',
      'master-volume',
      'music-volume',
      'sfx-volume',
      'reduced-motion',
      'reduced-flashing',
      'patterns',
      'lighting',
      'particles',
    ]) {
      const source = el<HTMLInputElement | HTMLSelectElement>(id),
        label = document.createElement('label');
      label.className = 'setting-row';
      label.textContent = (
        {
          quality: 'Quality · restarts sandbox',
          sound: 'Enable audio',
          'master-volume': 'Master volume',
          'music-volume': 'Music volume',
          'sfx-volume': 'Effects volume',
          'reduced-motion': 'Reduced motion',
          'reduced-flashing': 'Reduced flashing',
          patterns: 'Material patterns',
          lighting: 'Soft lighting',
          particles: 'Particle effects',
        } as Record<string, string>
      )[id];
      const copy = source.cloneNode(true) as HTMLInputElement | HTMLSelectElement;
      copy.id = `setting-${id}`;
      copy.value = source.value;
      if (copy instanceof HTMLInputElement && source instanceof HTMLInputElement)
        copy.checked = source.checked;
      const sync = () => {
        source.value = copy.value;
        if (copy instanceof HTMLInputElement && source instanceof HTMLInputElement)
          source.checked = copy.checked;
        source.dispatchEvent(new Event('input'));
      };
      copy.oninput = sync;
      copy.onchange = () => {
        sync();
        source.dispatchEvent(new Event('change'));
        if (id === 'quality') this.persist('quality', copy.value);
      };
      label.append(copy);
      fields.append(label);
    }
    el<HTMLDialogElement>('settings-dialog').showModal();
  }
  private map(world = Number(el<HTMLSelectElement>('campaign-world').value)) {
    const s = this.session();
    s.paused = true;
    s.onGameChange?.();
    el('map-progress').textContent =
      `${Object.keys(this.game.store.data.stars).length} / 110 discoveries · ${this.game.store.totalStars} / 330 stars`;
    el('map-worlds').replaceChildren();
    worlds.forEach((name, i) => {
      const b = document.createElement('button');
      b.textContent = `${i + 1}. ${name}`;
      b.setAttribute('aria-pressed', String(world === i + 1));
      b.onclick = () => this.map(i + 1);
      el('map-worlds').append(b);
    });
    el('map-world-title').textContent = worlds[world - 1];
    el('map-levels').replaceChildren();
    for (const level of levels.filter((l) => l.world === world)) {
      const index = levels.indexOf(level),
        unlocked = this.game.store.unlocked(world, level.order, levels[index - 1]?.id),
        b = document.createElement('button');
      b.disabled = !unlocked;
      b.dataset.level = level.id;
      b.className = 'level-card';
      const stars = this.game.store.data.stars[level.id] ?? 0;
      b.textContent = `${String(level.order).padStart(2, '0')} · ${level.title}\n${unlocked ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : world === 11 ? `${100 + level.order * 10} stars required` : 'Complete the previous level'}`;
      b.onclick = () => {
        close('map-dialog');
        el<HTMLSelectElement>('campaign-world').value = String(world);
        el('campaign-world').dispatchEvent(new Event('change'));
        el<HTMLSelectElement>('campaign-level').value = level.id;
        el('campaign-level').dispatchEvent(new Event('change'));
        el('play-level').click();
        document.querySelector('.game-panel')!.scrollIntoView({ block: 'start' });
      };
      el('map-levels').append(b);
    }
    el('map-note').textContent =
      world === 11
        ? 'Master challenges unlock with total stars. All targets must register together.'
        : 'Solve each discovery to open the next. Return anytime to improve your stars.';
    if (!el<HTMLDialogElement>('map-dialog').open) el<HTMLDialogElement>('map-dialog').showModal();
  }
  private update() {
    const g = this.session().puzzle;
    el('lesson').hidden = !!g && this.dismissedLesson === g.level.id;
    el('dismiss-lesson').hidden = !g || el('lesson').hidden;
    el('result-panel').hidden = !(g?.solved || g?.failed);
    const key = g ? `${g.level.id}:${g.solved}:${g.failed}:${this.session().engine.tick}` : '';
    if (g && (g.solved || g.failed) && this.resultKey !== key) {
      this.resultKey = key;
      el('result-title').textContent = g.solved
        ? 'A small discovery.'
        : 'Time for another approach.';
      el('result-stars').textContent = g.solved
        ? '★'.repeat(g.stars) + '☆'.repeat(3 - g.stars)
        : '↻';
      el('result-detail').textContent =
        `${g.level.title} · ${g.budget.used} brush cells · ${(this.session().engine.tick / 60).toFixed(1)} seconds · ${g.hints} hints`;
      const i = levels.findIndex((l) => l.id === g.level.id),
        next = levels[i + 1];
      el('result-next').hidden =
        !g.solved || !next || !this.game.store.unlocked(next.world, next.order, g.level.id);
    }
  }
}
