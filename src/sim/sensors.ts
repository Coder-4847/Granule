import type { Engine } from './engine';
import { bindTexture, destroyTarget, program, target } from './gl';

export type Rect = [number, number, number, number];
export interface Sensor {
  id: string;
  rect: Rect;
  material: number; // -1 counts all occupied cells, including terrain.
}
export interface Reading {
  count: number;
  temperature: number;
  charge: number;
  pressure: number;
}
const head = `#version 300 es
precision highp float;precision highp int;
layout(location=0) out vec4 result;
`;

/** Exact, bounded reductions. Each cell in a zone contributes exactly once. */
export class Sensors {
  private tiles;
  private result;
  private tileProgram;
  private sumProgram;
  private disposed = false;
  private pending = false;
  private readonly columns: number;
  private readonly rows: number;
  constructor(private engine: Engine) {
    const gl = engine.gl;
    this.columns = Math.ceil(engine.width / 16);
    this.rows = Math.ceil(engine.height / 16);
    this.tiles = target(gl, this.columns * this.rows, 32);
    this.result = target(gl, 1, 32);
    this.tileProgram = program(
      gl,
      head +
        `
uniform sampler2D uState;uniform sampler2D uField;
uniform ivec4 uZones[32];uniform int uMaterial[32];uniform int uColumns;
void main(){
 int tile=int(gl_FragCoord.x),zone=int(gl_FragCoord.y);ivec4 box=uZones[zone];
 ivec2 origin=box.xy+ivec2(tile%uColumns,tile/uColumns)*16;
 vec4 total=vec4(0,-10000,0,0);
 for(int y=0;y<16;y++)for(int x=0;x<16;x++){
  ivec2 p=origin+ivec2(x,y);
  if(p.x>=box.x+box.z||p.y>=box.y+box.w)continue;
  vec4 s=texelFetch(uState,p,0),f=texelFetch(uField,p,0);
  bool match=uMaterial[zone]<0?s.x>0.0:int(s.x)==uMaterial[zone];
  total.x+=match?1.0:0.0;
  total.y=max(total.y,s.y);total.z=max(total.z,f.z);total.w=max(total.w,abs(f.x));
 }
 result=total;
}`,
    );
    this.sumProgram = program(
      gl,
      head +
        `
uniform sampler2D uTiles;uniform int uCount;
void main(){vec4 total=vec4(0,-10000,0,0);int y=int(gl_FragCoord.y);
 for(int x=0;x<2040;x++){if(x>=uCount)break;vec4 v=texelFetch(uTiles,ivec2(x,y),0);total.x+=v.x;total.yzw=max(total.yzw,v.yzw);}
 result=total;}`,
    );
  }
  async sample(zones: readonly Sensor[]): Promise<Record<string, Reading>> {
    if (this.pending || this.disposed) throw new Error('Sensor readback is unavailable.');
    if (!zones.length) return {};
    if (
      zones.length > 32 ||
      zones.some(
        (z) =>
          z.rect.some((v) => !Number.isInteger(v)) ||
          z.rect[0] < 0 ||
          z.rect[1] < 0 ||
          z.rect[2] < 1 ||
          z.rect[3] < 1 ||
          z.rect[0] + z.rect[2] > this.engine.width ||
          z.rect[1] + z.rect[3] > this.engine.height,
      )
    )
      throw new Error('Sensor zone is outside the simulation.');
    this.pending = true;
    const gl = this.engine.gl,
      buffer = gl.createBuffer();
    let fence: WebGLSync | null = null;
    try {
      if (!buffer) throw new Error('Sensor buffer allocation failed.');
      gl.disable(gl.BLEND);
      gl.useProgram(this.tileProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.tiles.framebuffer);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
      gl.viewport(0, 0, this.columns * this.rows, zones.length);
      bindTexture(gl, this.tileProgram, 'uState', this.engine.texture);
      bindTexture(gl, this.tileProgram, 'uField', this.engine.fieldTexture, 1);
      gl.uniform4iv(
        gl.getUniformLocation(this.tileProgram, 'uZones[0]'),
        zones.flatMap((z) => z.rect),
      );
      gl.uniform1iv(
        gl.getUniformLocation(this.tileProgram, 'uMaterial[0]'),
        zones.map((z) => z.material),
      );
      gl.uniform1i(gl.getUniformLocation(this.tileProgram, 'uColumns'), this.columns);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.useProgram(this.sumProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.result.framebuffer);
      gl.viewport(0, 0, 1, zones.length);
      bindTexture(gl, this.sumProgram, 'uTiles', this.tiles.texture);
      gl.uniform1i(gl.getUniformLocation(this.sumProgram, 'uCount'), this.columns * this.rows);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.readBuffer(gl.COLOR_ATTACHMENT0);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
      gl.bufferData(gl.PIXEL_PACK_BUFFER, zones.length * 16, gl.STREAM_READ);
      gl.readPixels(0, 0, 1, zones.length, gl.RGBA, gl.FLOAT, 0);
      fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      gl.flush();
      if (!fence) throw new Error('Sensor fence allocation failed.');
      const start = performance.now();
      while (true) {
        if (this.disposed || gl.isContextLost()) throw new Error('Sensor context closed.');
        const status = gl.clientWaitSync(fence, 0, 0);
        if (status === gl.WAIT_FAILED || performance.now() - start > 30000)
          throw new Error('Sensor readback failed.');
        if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) break;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      const values = new Float32Array(zones.length * 4);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, values);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      return Object.fromEntries(
        zones.map((z, i) => [
          z.id,
          {
            count: values[i * 4],
            temperature: values[i * 4 + 1],
            charge: values[i * 4 + 2],
            pressure: values[i * 4 + 3],
          },
        ]),
      );
    } finally {
      if (fence) gl.deleteSync(fence);
      if (buffer) gl.deleteBuffer(buffer);
      this.pending = false;
    }
  }
  dispose() {
    this.disposed = true;
    const gl = this.engine.gl;
    destroyTarget(gl, this.tiles);
    destroyTarget(gl, this.result);
    gl.deleteProgram(this.tileProgram);
    gl.deleteProgram(this.sumProgram);
  }
}
