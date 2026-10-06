import type { Stroke } from '../sim/replay';
import type { Level } from './schema';
import type { Rect } from '../sim/sensors';
export function contains(r: Rect, x: number, y: number) {
  return x >= r[0] && y >= r[1] && x < r[0] + r[2] && y < r[1] + r[3];
}
/** Matches the fragment shader's cell-center footprint, including line caps. */
export function strokeCells(s: Stroke, visit?: (x: number, y: number) => void): number {
  const [ax, ay] = s.from,
    [bx, by] = s.to,
    dx = bx - ax,
    dy = by - ay;
  let count = 0;
  for (
    let y = Math.max(2, Math.floor(Math.min(ay, by) - s.radius));
    y < Math.min(538, Math.ceil(Math.max(ay, by) + s.radius));
    y++
  )
    for (
      let x = Math.max(2, Math.floor(Math.min(ax, bx) - s.radius));
      x < Math.min(958, Math.ceil(Math.max(ax, bx) + s.radius));
      x++
    ) {
      const t = Math.max(
        0,
        Math.min(
          1,
          ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / Math.max(dx * dx + dy * dy, 0.001),
        ),
      );
      const px = Math.abs(x + 0.5 - ax - dx * t),
        py = Math.abs(y + 0.5 - ay - dy * t);
      if (s.shape === 1 ? Math.max(px, py) <= s.radius : Math.hypot(px, py) <= s.radius) {
        count++;
        visit?.(x, y);
      }
    }
  return count;
}
export class Budget {
  used = 0;
  constructor(readonly level: Level) {}
  accept(stroke: Stroke): { accepted: boolean; reason: string; cost: number } {
    const s = stroke,
      t = this.level.toolkit;
    const tool = s.tool === 0 && s.material === 0 ? 3 : s.tool;
    let reason = '';
    if (!t.tools.includes(tool) || (tool === 0 && !t.materials.includes(s.material)))
      reason = 'That tool is not in this level’s toolkit.';
    if (s.overwrite || s.radius > t.radius)
      reason = `Use a brush of ${t.radius} cells or smaller. Replacement is disabled in puzzles.`;
    const cost = strokeCells(s, (x, y) => {
      if (!this.level.work.some((r) => contains(r, x, y)))
        reason = 'Keep the entire brush inside a marked work area.';
    });
    if (cost === 0) reason = 'The brush is outside the world.';
    if (this.used + cost > t.budget)
      reason = 'Material budget exhausted. Undo or restart to try another approach.';
    if (!reason) this.used += cost;
    return { accepted: !reason, reason, cost };
  }
}
