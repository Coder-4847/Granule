import { bindTexture, destroyTarget, program, target, type Target, header } from './gl';
import type { Rect } from './sensors';
import { brush, thermal, transport, dynamics } from './shaders';
import { sceneData } from './scenes';
import type { Replay, Stroke } from './replay';
import { materials, materialData } from '../data/materials';
export class Engine {
  readonly gl: WebGL2RenderingContext;
  readonly width: number;
  readonly height: number;
  tick = 0;
  seed = 12345;
  private targets: Target[];
  private fields: Target[];
  private fieldIndex = 0;
  private events: Target;
  private table: Target;
  private dynamics: WebGLProgram;
  private index = 0;
  private move: WebGLProgram;
  private heat: WebGLProgram;
  private paint: WebGLProgram;
  private machinery: WebGLProgram;
  private disposed = false;
  constructor(canvas: HTMLCanvasElement, width = 960, height = 540) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl)
      throw new Error(
        'Granule needs WebGL2. Enable hardware acceleration in your browser and reload.',
      );
    if (!gl.getExtension('EXT_color_buffer_float'))
      throw new Error(
        'This GPU does not support the floating-point textures Granule needs. Try a browser with hardware acceleration enabled.',
      );
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.targets = [target(gl, width, height), target(gl, width, height)];
    this.fields = [target(gl, width, height), target(gl, width, height)];
    this.events = target(gl, width, height);
    this.table = target(gl, materials.length, 7);
    gl.bindTexture(gl.TEXTURE_2D, this.table.texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      materials.length,
      7,
      gl.RGBA,
      gl.FLOAT,
      materialData(),
    );
    for (const t of this.targets) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT1,
        gl.TEXTURE_2D,
        this.events.texture,
        0,
      );
    }
    this.dynamics = program(gl, dynamics);
    this.move = program(gl, transport);
    this.heat = program(gl, thermal);
    this.paint = program(gl, brush);
    this.machinery = program(
      gl,
      header +
        `
uniform ivec4 uOld[32];uniform ivec4 uNew[32];uniform int uOldCount;uniform int uNewCount;
bool contains(ivec4 r,ivec2 p){return all(greaterThanEqual(p,r.xy))&&all(lessThan(p,r.xy+r.zw));}
void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec4 s=cell(p);
for(int i=0;i<32;i++){if(i>=uOldCount)break;if(s.x==1.0&&s.z==-500000.0&&contains(uOld[i],p))s=vec4(0,20,0,0);}
for(int i=0;i<32;i++){if(i>=uNewCount)break;if(contains(uNew[i],p)&&(s.x!=1.0||s.z==-500000.0))s=vec4(1,20,-500000,0);}
outState=s;}`,
    );
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    this.reset('empty');
  }
  get texture() {
    return this.targets[this.index].texture;
  }
  get fieldTexture() {
    return this.fields[this.fieldIndex].texture;
  }
  get materialTexture() {
    return this.table.texture;
  }
  get eventTexture() {
    return this.events.texture;
  }
  reset(scene: Replay['scene'], seed = 12345) {
    this.seed = seed;
    this.tick = 0;
    this.upload(sceneData(this.width, this.height, scene));
    const gl = this.gl;
    for (const t of [...this.fields, this.events]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.framebuffer);
      gl.clearBufferfv(gl.COLOR, 0, new Float32Array(4));
    }
  }
  upload(data: Float32Array) {
    if (data.length !== this.width * this.height * 4)
      throw new Error('Snapshot dimensions do not match.');
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, data);
  }
  private pass(p: WebGLProgram, setup?: () => void) {
    const gl = this.gl;
    gl.useProgram(p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[1 - this.index].framebuffer);
    gl.viewport(0, 0, this.width, this.height);
    bindTexture(gl, p, 'uState', this.texture);
    bindTexture(gl, p, 'uField', this.fieldTexture, 1);
    bindTexture(gl, p, 'uMaterials', this.materialTexture, 2);
    gl.drawBuffers(
      p === this.heat ? [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1] : [gl.COLOR_ATTACHMENT0],
    );
    gl.uniform2i(gl.getUniformLocation(p, 'uSize'), this.width, this.height);
    setup?.();
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.index = 1 - this.index;
  }
  step() {
    const gl = this.gl;
    gl.useProgram(this.dynamics);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fields[1 - this.fieldIndex].framebuffer);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.viewport(0, 0, this.width, this.height);
    bindTexture(gl, this.dynamics, 'uState', this.texture);
    bindTexture(gl, this.dynamics, 'uField', this.fieldTexture, 1);
    bindTexture(gl, this.dynamics, 'uMaterials', this.materialTexture, 2);
    gl.uniform2i(gl.getUniformLocation(this.dynamics, 'uSize'), this.width, this.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.fieldIndex = 1 - this.fieldIndex;
    // Resolve contact while newly painted heat sources still touch their neighbors.
    this.pass(this.heat, () => {
      gl.uniform1ui(gl.getUniformLocation(this.heat, 'uTick'), this.tick);
      gl.uniform1ui(gl.getUniformLocation(this.heat, 'uSeed'), this.seed);
    });
    for (let sub = 0; sub < 8; sub++)
      this.pass(this.move, () => {
        gl.uniform1ui(gl.getUniformLocation(this.move, 'uTick'), this.tick * 8 + sub);
        gl.uniform1ui(gl.getUniformLocation(this.move, 'uSeed'), this.seed);
        gl.uniform1i(gl.getUniformLocation(this.move, 'uOffset'), sub % 2);
      });
    this.tick++;
  }
  stroke(s: Stroke) {
    const gl = this.gl,
      p = this.paint;
    this.pass(p, () => {
      gl.uniform2f(gl.getUniformLocation(p, 'uFrom'), ...s.from);
      gl.uniform2f(gl.getUniformLocation(p, 'uTo'), ...s.to);
      gl.uniform1f(gl.getUniformLocation(p, 'uRadius'), s.radius);
      gl.uniform1i(gl.getUniformLocation(p, 'uMaterial'), s.material);
      gl.uniform1i(gl.getUniformLocation(p, 'uShape'), s.shape);
      gl.uniform1i(gl.getUniformLocation(p, 'uTool'), s.tool);
      gl.uniform1i(gl.getUniformLocation(p, 'uOverwrite'), s.overwrite ? 1 : 0);
    });
  }
  rasterMachines(previous: Rect[], next: Rect[]) {
    if (!previous.length && !next.length) return;
    if (previous.length > 32 || next.length > 32) throw new Error('Too many moving parts.');
    const gl = this.gl,
      p = this.machinery;
    this.pass(p, () => {
      gl.uniform1i(gl.getUniformLocation(p, 'uOldCount'), previous.length);
      gl.uniform1i(gl.getUniformLocation(p, 'uNewCount'), next.length);
      if (previous.length) gl.uniform4iv(gl.getUniformLocation(p, 'uOld[0]'), previous.flat());
      if (next.length) gl.uniform4iv(gl.getUniformLocation(p, 'uNew[0]'), next.flat());
    });
  }
  async read(kind: 'state' | 'field' = 'state'): Promise<Float32Array> {
    const gl = this.gl,
      buffer = gl.createBuffer();
    if (!buffer) throw new Error('Readback allocation failed.');
    gl.bindFramebuffer(
      gl.FRAMEBUFFER,
      kind === 'state'
        ? this.targets[this.index].framebuffer
        : this.fields[this.fieldIndex].framebuffer,
    );
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, this.width * this.height * 16, gl.STREAM_READ);
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, 0);
    const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.flush();
    if (!fence) {
      gl.deleteBuffer(buffer);
      throw new Error('GPU fence unavailable.');
    }
    const start = performance.now();
    try {
      await new Promise<void>((resolve, reject) => {
        const poll = () => {
          if (this.disposed || gl.isContextLost()) {
            reject(new Error('GPU context closed during readback.'));
            return;
          }
          const status = gl.clientWaitSync(fence, 0, 0);
          if (status === gl.WAIT_FAILED) {
            reject(new Error('GPU readback failed.'));
            return;
          }
          if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
            resolve();
            return;
          }
          if (performance.now() - start > 30000) {
            reject(new Error('GPU readback timed out.'));
            return;
          }
          setTimeout(poll, 4);
        };
        poll();
      });
      const data = new Float32Array(this.width * this.height * 4);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, data);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      return data;
    } finally {
      gl.deleteSync(fence);
      gl.deleteBuffer(buffer);
    }
  }
  async snapshot(): Promise<Float32Array> {
    const [state, field] = await Promise.all([this.read(), this.read('field')]);
    const result = new Float32Array(state.length + field.length);
    result.set(state);
    result.set(field, state.length);
    return result;
  }
  restore(data: Float32Array) {
    const length = this.width * this.height * 4;
    if (data.length !== length * 2) throw new Error('Invalid physics snapshot.');
    this.upload(data.subarray(0, length));
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.fieldTexture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      this.width,
      this.height,
      gl.RGBA,
      gl.FLOAT,
      data.subarray(length),
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.events.framebuffer);
    gl.clearBufferfv(gl.COLOR, 0, new Float32Array(4));
  }
  dispose() {
    this.disposed = true;
    for (const t of [...this.targets, ...this.fields, this.events, this.table])
      destroyTarget(this.gl, t);
    for (const p of [this.move, this.heat, this.paint, this.dynamics, this.machinery])
      this.gl.deleteProgram(p);
  }
}
