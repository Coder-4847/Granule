import type { Engine } from '../sim/engine';
import type { Reading, Rect } from '../sim/sensors';
import type { Machine } from './schema';

export interface MachineState {
  active: boolean;
  position: number;
  turns: number;
}
export class Machinery {
  states: Record<string, MachineState> = {};
  private footprint: Rect[] = [];
  constructor(readonly objects: Machine[]) {
    for (const m of objects) this.states[m.id] = { active: false, position: 0, turns: 0 };
  }
  sense(readings: Record<string, Reading>, engine: Engine) {
    for (const m of this.objects) {
      const state = this.states[m.id];
      const value = m.sensor ? (readings[m.sensor]?.[m.channel ?? 'count'] ?? 0) : 0;
      const wasActive = state.active;
      const triggered =
        m.comparison === 'at-most' ? value <= (m.threshold ?? 1) : value >= (m.threshold ?? 1);
      state.active = (m.latch === true && state.active) || triggered;
      if (state.active && ['wheel', 'turbine'].includes(m.kind)) state.turns++;
      // Mechanically driven generators and electrical relays emit a fresh pulse on activation.
      if (state.active && !wasActive && m.output)
        engine.stroke({
          tick: engine.tick,
          from: m.output,
          to: m.output,
          radius: 1,
          shape: 1,
          material: 31,
          tool: 0,
          overwrite: true,
        });
    }
  }
  raster(engine: Engine) {
    const next: Rect[] = [];
    for (const m of this.objects) {
      const s = this.states[m.id];
      if (['collector', 'wire', 'relay', 'plate'].includes(m.kind)) continue;
      if (m.kind === 'gate' && s.active) continue;
      const destination = s.active ? 1 : 0;
      s.position +=
        Math.sign(destination - s.position) * Math.min(Math.abs(destination - s.position), 1 / 30);
      const travel = m.travel ?? [0, 0];
      next.push([
        m.rect[0] + Math.round(travel[0] * s.position),
        m.rect[1] + Math.round(travel[1] * s.position),
        m.rect[2],
        m.rect[3],
      ]);
    }
    // Moving parts crush cells at the leading edge and leave air behind. No material duplication.
    engine.rasterMachines(this.footprint, next);
    this.footprint = next;
  }
  checkpoint() {
    return structuredClone({ states: this.states, footprint: this.footprint });
  }
  restore(value: ReturnType<Machinery['checkpoint']>) {
    this.states = structuredClone(value.states);
    this.footprint = structuredClone(value.footprint);
  }
}
