import { materials } from '../data/materials';
import type { Replay } from './replay';
export function sceneData(w: number, h: number, scene: Replay['scene']): Float32Array {
  const data = new Float32Array(w * h * 4);
  const set = (x: number, y: number, id: number) => {
    const i = (y * w + x) * 4;
    data[i] = id;
    data[i + 1] = materials[id].temperature;
    data[i + 2] = materials[id].lifetime ?? 0;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) set(x, y, x < 2 || y < 2 || x >= w - 2 || y >= h - 2 ? 1 : 0);
  const rect = (x0: number, y0: number, x1: number, y1: number, id: number) => {
    for (let y = Math.floor(y0 * h); y < y1 * h; y++)
      for (let x = Math.floor(x0 * w); x < x1 * w; x++) set(x, y, id);
  };
  if (scene === 'demo') {
    rect(0.07, 0.12, 0.93, 0.135, 2);
    rect(0.07, 0.12, 0.085, 0.4, 2);
    rect(0.915, 0.12, 0.93, 0.4, 2);
    rect(0.085, 0.135, 0.915, 0.25, 4);
    rect(0.085, 0.25, 0.28, 0.28, 5);
    rect(0.42, 0.135, 0.58, 0.41, 2);
    rect(0.4, 0.4, 0.6, 0.415, 2);
    for (let y = Math.floor(h * 0.415); y < h * 0.64; y++)
      for (let x = Math.floor(w * 0.3); x < w * 0.7; x++)
        if (Math.abs(x / w - 0.5) < (0.64 - y / h) * 0.5) set(x, y, 3);
    rect(0.16, 0.53, 0.34, 0.54, 8);
    rect(0.25, 0.54, 0.29, 0.6, 6);
    rect(0.7, 0.55, 0.85, 0.565, 2);
    rect(0.72, 0.565, 0.83, 0.64, 10);
  }
  if (scene === 'benchmark') {
    rect(0.04, 0.04, 0.96, 0.3, 4);
    rect(0.05, 0.3, 0.95, 0.36, 5);
    rect(0.1, 0.55, 0.9, 0.68, 3);
    for (let i = 0; i < 8; i++) {
      rect(0.05 + i * 0.12, 0.4, 0.1 + i * 0.12, 0.42, 8);
      rect(0.06 + i * 0.12, 0.42, 0.09 + i * 0.12, 0.47, 6);
      rect(0.055 + i * 0.12, 0.72, 0.085 + i * 0.12, 0.75, 27);
      rect(0.055 + i * 0.12, 0.75, 0.085 + i * 0.12, 0.76, 31);
    }
    rect(0.1, 0.82, 0.45, 0.86, 23);
    rect(0.55, 0.82, 0.9, 0.86, 22);
  }
  if (scene === 'physics') {
    // Eight deliberately separated stations; no objective or hidden scripted outcomes.
    const station = (
      column: number,
      row: number,
      draw: (box: (x: number, y: number, w: number, h: number, id: number) => void) => void,
    ) => {
      const left = 0.02 + column * 0.245,
        bottom = 0.03 + row * 0.48;
      const box = (x: number, y: number, width: number, height: number, id: number) =>
        rect(
          left + x * 0.225,
          bottom + y * 0.43,
          left + (x + width) * 0.225,
          bottom + (y + height) * 0.43,
          id,
        );
      box(0, 0, 1, 0.025, 1);
      box(0, 0, 0.015, 1, 1);
      box(0.985, 0, 0.015, 1, 1);
      draw(box);
    };
    station(0, 1, (b) => {
      b(0.05, 0.03, 0.9, 0.2, 4);
      b(0.08, 0.23, 0.4, 0.12, 5);
      b(0.5, 0.7, 0.3, 0.1, 3);
    });
    station(1, 1, (b) => {
      b(0.1, 0.03, 0.8, 0.05, 8);
      b(0.13, 0.08, 0.08, 0.18, 6);
      b(0.3, 0.08, 0.1, 0.35, 16);
      b(0.5, 0.08, 0.1, 0.35, 28);
      b(0.72, 0.6, 0.13, 0.1, 5);
    });
    station(2, 1, (b) => {
      b(0.1, 0.03, 0.5, 0.13, 10);
      b(0.12, 0.65, 0.12, 0.04, 6);
      b(0.7, 0.3, 0.2, 0.03, 2);
      b(0.7, 0.33, 0.15, 0.15, 21);
    });
    station(3, 1, (b) => {
      b(0.1, 0.03, 0.8, 0.14, 2);
      b(0.3, 0.17, 0.4, 0.1, 19);
      b(0.3, 0.27, 0.4, 0.14, 22);
      b(0.1, 0.65, 0.15, 0.08, 15);
      b(0.05, 0.17, 0.2, 0.13, 10);
    });
    station(0, 0, (b) => {
      b(0.1, 0.03, 0.1, 0.04, 31);
      b(0.15, 0.055, 0.7, 0.025, 19);
      b(0.8, 0.08, 0.04, 0.6, 19);
      b(0.7, 0.68, 0.2, 0.07, 26);
    });
    station(1, 0, (b) => {
      b(0.1, 0.03, 0.12, 0.08, 27);
      b(0.26, 0.03, 0.12, 0.08, 27);
      b(0.43, 0.03, 0.12, 0.08, 27);
      b(0.1, 0.11, 0.12, 0.02, 31);
      b(0.7, 0.03, 0.08, 0.6, 20);
    });
    station(2, 0, (b) => {
      b(0.05, 0.03, 0.9, 0.14, 4);
      b(0.45, 0.6, 0.3, 0.12, 23);
      b(0.1, 0.3, 0.15, 0.1, 33);
    });
    station(3, 0, (b) => {
      b(0.1, 0.03, 0.8, 0.1, 4);
      b(0.45, 0.13, 0.05, 0.25, 18);
      b(0.1, 0.6, 0.2, 0.07, 13);
      b(0.7, 0.6, 0.15, 0.06, 30);
    });
  }
  return data;
}
