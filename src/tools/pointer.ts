export interface Point {
  x: number;
  y: number;
}
export class PointerBrush {
  down = false;
  point: Point | null = null;
  previous: Point | null = null;
  erase = false;
  private pointer: number | null = null;
  private abort = new AbortController();
  onStart: (() => void) | null = null;
  onEnd: (() => void) | null = null;
  constructor(
    canvas: HTMLCanvasElement,
    private width: number,
    private height: number,
  ) {
    const options = { signal: this.abort.signal };
    const position = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(width, ((e.clientX - r.left) / r.width) * width)),
        y: Math.max(0, Math.min(height, ((r.bottom - e.clientY) / r.height) * height)),
      };
    };
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (this.pointer !== null) return;
        e.preventDefault();
        canvas.focus({ preventScroll: true });
        this.pointer = e.pointerId;
        this.down = true;
        this.point = position(e);
        this.previous = this.point;
        this.erase = e.button === 2;
        canvas.setPointerCapture(e.pointerId);
        this.onStart?.();
      },
      options,
    );
    canvas.addEventListener(
      'pointermove',
      (e) => {
        if (this.pointer === null || e.pointerId === this.pointer) this.point = position(e);
      },
      options,
    );
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.pointer) return;
      if (e.type === 'pointerup') {
        this.point = position(e);
        this.onEnd?.();
      }
      this.down = false;
      this.previous = null;
      this.pointer = null;
    };
    canvas.addEventListener('pointerup', end, options);
    canvas.addEventListener('pointercancel', end, options);
    canvas.addEventListener('lostpointercapture', end, options);
    canvas.addEventListener(
      'pointerleave',
      () => {
        if (!this.down) this.point = null;
      },
      options,
    );
    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), options);
    window.addEventListener(
      'blur',
      () => {
        this.down = false;
        this.previous = null;
        this.pointer = null;
      },
      options,
    );
  }
  normalized() {
    return this.point ? { x: this.point.x / this.width, y: 1 - this.point.y / this.height } : null;
  }
  dispose() {
    this.abort.abort();
  }
}
