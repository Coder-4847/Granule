import './ui/style.css';
import { layout } from './ui/layout';
import { Session } from './game/session';
import { materials } from './data/materials';
import { validateReplay } from './sim/replay';
import { GameUI } from './ui/game';
import { Shell } from './ui/shell';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = layout();
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = el<HTMLCanvasElement>('world');
let session: Session;
let gameUI: GameUI | undefined;
let noticeTimer = 0;
let cursorFrame = 0;
const gpuControls =
  '.workspace button,.workspace input,.workspace select,.diagnostic-buttons button,#demo,.game-panel button,.game-panel select,.sandbox-tools button,.sandbox-tools input,.sandbox-tools select,#menu,#world-map,#home-play,#home-sandbox,#map-levels button';
function notice(message: string) {
  el('notice').textContent = message;
  el('notice').classList.add('visible');
  clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => el('notice').classList.remove('visible'), 4500);
}
function failure(error: unknown) {
  session?.halt();
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((dialog) => dialog.close());
  el('fallback').hidden = false;
  el('fallback').textContent = error instanceof Error ? error.message : String(error);
  document
    .querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>(gpuControls)
    .forEach((control) => (control.disabled = true));
}
function start(width = 960) {
  session?.dispose();
  try {
    session = new Session(canvas, width);
    el('fallback').hidden = true;
    document
      .querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>(gpuControls)
      .forEach((control) => (control.disabled = false));
    session.onStatus = (fps, tick) => {
      el('performance').textContent = `${fps.toFixed(0)} FPS · TICK ${tick.toLocaleString()}`;
    };
    session.onNotice = (message) => {
      el<HTMLInputElement>('lighting').checked = session.renderer.lighting;
      notice(message);
    };
    el('dimensions').textContent =
      `${width} × ${(width * 9) / 16} / ${((width * width * 9) / 16).toLocaleString()} CELLS`;
    selectMaterial(3);
    el<HTMLSelectElement>('tool').value = '0';
    el<HTMLSelectElement>('speed').value = '1';
    session.radius = Number(el<HTMLInputElement>('radius').value);
    session.shape = el<HTMLSelectElement>('shape').value === '1' ? 1 : 0;
    session.line = el<HTMLSelectElement>('shape').value === '2';
    session.overwrite = el<HTMLInputElement>('overwrite').checked;
    session.renderer.lighting = el<HTMLInputElement>('lighting').checked;
    session.renderer.temperature = el<HTMLInputElement>('temperature').checked;
    session.renderer.patterns = el<HTMLInputElement>('patterns').checked;
    session.renderer.particles.enabled = el<HTMLInputElement>('particles').checked;
    session.renderer.reducedMotion = el<HTMLInputElement>('reduced-motion').checked;
    session.renderer.reducedFlashing = el<HTMLInputElement>('reduced-flashing').checked;
    session.renderer.particles.quality = width === 960 ? 1 : width === 720 ? 0.5 : 0.25;
    session.audio.masterVolume = Number(el<HTMLInputElement>('master-volume').value);
    session.audio.musicVolume = Number(el<HTMLInputElement>('music-volume').value);
    session.audio.sfxVolume = Number(el<HTMLInputElement>('sfx-volume').value);
    if (el<HTMLInputElement>('sound').checked)
      void session.audio.start().catch(() => notice('Audio is unavailable in this browser.'));
    updatePause();
    if (import.meta.env.DEV) window.granule = session;
    gameUI?.connect();
  } catch (error) {
    failure(error);
  }
}
function updatePause() {
  el('pause').textContent = session.paused ? '▷' : 'Ⅱ';
  el('pause').setAttribute('aria-label', session.paused ? 'Resume simulation' : 'Pause simulation');
  el('state-label').textContent = session.paused ? 'SIMULATION PAUSED' : 'SIMULATION LIVE';
}
function selectMaterial(id: number) {
  if (session.puzzle && !session.puzzle.level.toolkit.materials.includes(id)) return;
  session.material = id;
  session.audio.click();
  session.tool = 0;
  el<HTMLSelectElement>('tool').value = '0';
  const m = materials[id];
  el('selected-name').textContent = m.name;
  el('selected-description').textContent = m.description;
  el('selected-swatch').style.setProperty(
    '--swatch',
    `rgb(${m.color.map((v) => Math.round(v * 255)).join(',')})`,
  );
  document.querySelectorAll<HTMLButtonElement>('[data-material]').forEach((button) => {
    const selected = Number(button.dataset.material) === id;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}
document
  .querySelectorAll<HTMLButtonElement>('[data-material]')
  .forEach((button) =>
    button.addEventListener('click', () => selectMaterial(Number(button.dataset.material))),
  );
el('search').addEventListener('input', () => {
  const query = el<HTMLInputElement>('search').value.toLowerCase();
  document
    .querySelectorAll<HTMLButtonElement>('[data-material]')
    .forEach(
      (button) =>
        (button.hidden = !materials[Number(button.dataset.material)].name
          .toLowerCase()
          .includes(query)),
    );
});
el('pause').onclick = () => {
  session.paused = !session.paused;
  updatePause();
};
el('step').onclick = () => {
  session.paused = true;
  session.step();
  updatePause();
};
el('speed').onchange = () => (session.speed = Number(el<HTMLSelectElement>('speed').value));
el('radius').oninput = () => {
  session.radius = Number(el<HTMLInputElement>('radius').value);
  el('radius-label').textContent = `${session.radius} px`;
};
el('shape').onchange = () => {
  session.shape = el<HTMLSelectElement>('shape').value === '1' ? 1 : 0;
  session.line = el<HTMLSelectElement>('shape').value === '2';
};
el('tool').onchange = () => {
  const tool = Number(el<HTMLSelectElement>('tool').value);
  session.tool = tool === 3 ? 0 : (tool as 0 | 1 | 2);
  session.material =
    tool === 3
      ? 0
      : Number(document.querySelector<HTMLElement>('.material.selected')?.dataset.material ?? 3);
};
el('overwrite').onchange = () => (session.overwrite = el<HTMLInputElement>('overwrite').checked);
el('temperature').onchange = () =>
  (session.renderer.temperature = el<HTMLInputElement>('temperature').checked);
el('lighting').onchange = () =>
  (session.renderer.lighting = el<HTMLInputElement>('lighting').checked);
el('patterns').onchange = () =>
  (session.renderer.patterns = el<HTMLInputElement>('patterns').checked);
el('particles').onchange = () =>
  (session.renderer.particles.enabled = el<HTMLInputElement>('particles').checked);
el('reduced-motion').onchange = () =>
  (session.renderer.reducedMotion = el<HTMLInputElement>('reduced-motion').checked);
el('reduced-flashing').onchange = () =>
  (session.renderer.reducedFlashing = el<HTMLInputElement>('reduced-flashing').checked);
el('sound').onchange = async () => {
  if (el<HTMLInputElement>('sound').checked) {
    try {
      await session.audio.start();
    } catch {
      notice('Audio is unavailable in this browser.');
      el<HTMLInputElement>('sound').checked = false;
    }
  } else session.audio.stop();
};
for (const [id, property] of [
  ['master-volume', 'masterVolume'],
  ['music-volume', 'musicVolume'],
  ['sfx-volume', 'sfxVolume'],
] as const)
  el(id).oninput = () => {
    session.audio[property] = Number(el<HTMLInputElement>(id).value);
    session.audio.updateVolumes();
  };
el<HTMLInputElement>('reduced-motion').checked = matchMedia(
  '(prefers-reduced-motion: reduce)',
).matches;
el('physics-bench').onclick = () => {
  session.reset('physics');
  session.paused = false;
  updatePause();
  el('report').textContent =
    'PHYSICS TEST BENCH\nTop row: density sorting · combustion & fuse · ice & steam · acid & salt\nBottom row: conduction · chain explosions · lava quenching · plant growth\nSelect heat or a spark to activate a station again. New canvas returns to an empty sandbox.';
};
el('quality').onchange = () => {
  if (session.busy) {
    el<HTMLSelectElement>('quality').value = String(session.engine.width);
    return;
  }
  start(Number(el<HTMLSelectElement>('quality').value));
  notice('Resolution changed. The sandbox has restarted with an empty canvas.');
};
el('clear').onclick = () => {
  session.reset('empty');
  notice('A clean canvas. Make something new.');
};
el('demo').onclick = () => session.reset('empty');
el('help').onclick = () => el<HTMLDialogElement>('help-dialog').showModal();
el('close-help').onclick = () => el<HTMLDialogElement>('help-dialog').close();
el('diagnostics-toggle').onclick = () => {
  el('diagnostics').hidden = !el('diagnostics').hidden;
};
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
el('export').onclick = () =>
  download('granule-replay.json', { ...session.replay, ticks: session.engine.tick });
el('import').onclick = () => el<HTMLInputElement>('replay-file').click();
async function diagnostic(label: string, run: () => Promise<unknown>) {
  if (session.busy) return;
  const buttons = document.querySelectorAll<HTMLButtonElement>('.diagnostic-buttons button');
  buttons.forEach((b) => (b.disabled = true));
  el('report').textContent = label;
  try {
    const result = await run();
    el('report').textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    el('report').textContent = error instanceof Error ? error.message : String(error);
  } finally {
    buttons.forEach((b) => (b.disabled = false));
    updatePause();
  }
}
el('replay-file').onchange = async () => {
  const input = el<HTMLInputElement>('replay-file'),
    file = input.files?.[0];
  if (!file) return;
  await diagnostic('Playing imported replay…', async () => {
    if (file.size > 20_000_000) throw new Error('Replay file exceeds 20 MB.');
    const replay = validateReplay(JSON.parse(await file.text()));
    return { hash: await session.play(replay), ticks: replay.ticks };
  });
  input.value = '';
};
el('verify').onclick = () =>
  void diagnostic('Replaying twice and comparing GPU state hashes…', () => session.verify());
el('benchmark').onclick = () =>
  void diagnostic('Measuring 240 frames at one simulation tick per frame…', () =>
    session.benchmark(),
  );
window.addEventListener('keydown', (event) => {
  if (
    event.target instanceof HTMLButtonElement &&
    (event.code === 'Space' || event.key === 'Enter')
  )
    return;
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement ||
    event.target instanceof HTMLTextAreaElement ||
    !!document.querySelector('dialog[open]') ||
    el<HTMLDialogElement>('help-dialog').open ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    !session ||
    session.busy ||
    session.engine.gl.isContextLost()
  )
    return;
  if (event.code === 'Space') {
    event.preventDefault();
    el('pause').click();
  }
  if (event.key === '.') el('step').click();
  if (event.key.toLowerCase() === 't') el<HTMLInputElement>('temperature').click();
  if (event.key.toLowerCase() === 'e') {
    const select = el<HTMLSelectElement>('tool');
    select.value = select.value === '3' ? '0' : '3';
    select.dispatchEvent(new Event('change'));
  }
  if (event.key === '[' || event.key === ']') {
    const input = el<HTMLInputElement>('radius');
    input.value = String(
      Math.max(1, Math.min(60, Number(input.value) + (event.key === '[' ? -2 : 2))),
    );
    input.dispatchEvent(new Event('input'));
  }
  if (/^[1-9]$/.test(event.key)) selectMaterial(Number(event.key));
  if (event.key === '?') el('help').click();
});
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  if (session) session.paused = true;
  failure(
    new Error('The GPU connection was interrupted. The scene will restart when it recovers.'),
  );
});
canvas.addEventListener('webglcontextrestored', () => {
  start(Number(el<HTMLSelectElement>('quality').value));
  notice('GPU restored. The sandbox has restarted with an empty canvas.');
});
function cursor() {
  cursorFrame = requestAnimationFrame(cursor);
  if (!session) return;
  const p = session.pointer.normalized(),
    ring = el('cursor');
  ring.style.display = p ? 'block' : 'none';
  if (p) {
    ring.style.left = `${p.x * 100}%`;
    ring.style.top = `${p.y * 100}%`;
    const size = ((session.radius * 2) / session.engine.width) * canvas.clientWidth;
    ring.style.width = `${size}px`;
    ring.style.height = `${size}px`;
    ring.style.borderRadius = session.shape === 1 ? '0' : '50%';
  }
}
window.addEventListener('pagehide', () => {
  cancelAnimationFrame(cursorFrame);
  session?.dispose();
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    start(Number(el<HTMLSelectElement>('quality').value));
    cursor();
  }
});
window.addEventListener('error', () => {
  if (session) session.paused = true;
  failure(
    new Error(
      'Something interrupted the laboratory. Reload this page to restart; saved worlds and progress are retained.',
    ),
  );
});
window.addEventListener('unhandledrejection', () => {
  if (session) session.paused = true;
  failure(
    new Error(
      'An operation could not finish. Reload to restart; saved worlds and progress are retained.',
    ),
  );
});
document.addEventListener('visibilitychange', () => {
  if (session) {
    session.audio.foreground = !document.hidden;
    session.audio.updateVolumes();
  }
});
start();
if (session!) {
  gameUI = new GameUI(() => session, start, selectMaterial, notice, updatePause);
  gameUI.connect();
  new Shell(() => session, gameUI);
}
cursor();
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker
    .register('./sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => {
      const status = document.getElementById('offline-status');
      if (status)
        status.textContent = 'Ready for offline play. Updates apply after all Granule tabs close.';
    })
    .catch(() => notice('Offline caching is unavailable. You can still play while connected.'));
}
