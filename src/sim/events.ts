import { bindTexture, destroyTarget, header, program, target, type Target } from './gl';
import type { Engine } from './engine';
const fragment =
  header +
  `
uniform sampler2D uEvents;uniform sampler2D uField;
void main(){ivec2 tile=ivec2(gl_FragCoord.xy);vec4 sum=vec4(0);
 for(int y=0;y<8;y++)for(int x=0;x<8;x++){ivec2 p=(tile*8+ivec2(x,y))*uSize/128;vec4 e=texelFetch(uEvents,p,0),s=cell(p);float pressure=abs(texelFetch(uField,p,0).x);
 sum.x+=e.x==1.0?1.0:0.0;sum.y+=e.x==2.0||e.x==6.0?1.0:0.0;sum.z+=pressure>2.0?1.0:0.0;sum.w+=e.x==3.0||e.x==9.0||e.x==10.0?1.0:0.0;}
 outState=sum/64.0;
}`;
// Audio telemetry only: a stratified GPU reduction, 4 KB PBO readback at 10 Hz.
// Future gameplay objectives must use exact zone reductions, not this sampled signal.
export class EventMeter {
  private target: Target;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private fence: WebGLSync | null = null;
  private last = 0;
  constructor(private engine: Engine) {
    const gl = engine.gl;
    this.target = target(gl, 16, 16);
    this.program = program(gl, fragment);
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('Event buffer allocation failed');
    this.buffer = buffer;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, 4096, gl.STREAM_READ);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  }
  poll(now: number): number[] | null {
    const gl = this.engine.gl;
    let result: number[] | null = null;
    if (this.fence) {
      const status = gl.clientWaitSync(this.fence, 0, 0);
      if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
        const data = new Float32Array(1024);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.buffer);
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, data);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        result = [0, 0, 0, 0];
        data.forEach((v, i) => (result![i % 4] += v));
        gl.deleteSync(this.fence);
        this.fence = null;
      } else if (status === gl.WAIT_FAILED) {
        gl.deleteSync(this.fence);
        this.fence = null;
      }
    }
    if (!this.fence && now - this.last >= 100) {
      const p = this.program;
      gl.useProgram(p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.target.framebuffer);
      gl.viewport(0, 0, 16, 16);
      bindTexture(gl, p, 'uState', this.engine.texture);
      bindTexture(gl, p, 'uEvents', this.engine.eventTexture, 1);
      bindTexture(gl, p, 'uField', this.engine.fieldTexture, 2);
      gl.uniform2i(gl.getUniformLocation(p, 'uSize'), this.engine.width, this.engine.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.buffer);
      gl.bufferData(gl.PIXEL_PACK_BUFFER, 4096, gl.STREAM_READ);
      gl.readPixels(0, 0, 16, 16, gl.RGBA, gl.FLOAT, 0);
      this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      gl.flush();
      this.last = now;
    }
    return result;
  }
  dispose() {
    const gl = this.engine.gl;
    if (this.fence) gl.deleteSync(this.fence);
    gl.deleteBuffer(this.buffer);
    gl.deleteProgram(this.program);
    destroyTarget(gl, this.target);
  }
}
