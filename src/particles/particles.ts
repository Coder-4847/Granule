import { bindTexture, destroyTarget, header, program, target, type Target } from '../sim/gl';
import type { Engine } from '../sim/engine';
const update =
  header +
  `
uniform sampler2D uEvents;uniform int uTick;uniform sampler2D uParticles;
void main(){ivec2 p=ivec2(gl_FragCoord.xy);int id=p.x+p.y*128;vec4 old=texelFetch(uParticles,p,0);
 if(old.w>0.0&&float(uTick)-old.z<65.0){outState=old;return;}
 vec4 spawn=vec4(0);
 for(int i=0;i<4;i++){uint key=hash(uint(id*4+i)+uint(uTick)*747796405u);ivec2 q=ivec2(int(key%uint(uSize.x)),int(hash(key)%uint(uSize.y)));vec4 e=texelFetch(uEvents,q,0);
 if(e.x>0.0){spawn=vec4(vec2(q),float(uTick),e.x);break;}}
 outState=spawn;
}`;
const vertex = `#version 300 es
precision highp float;precision highp int;
uniform sampler2D uParticles;uniform vec2 uSize;uniform float uTick;uniform float uMotion;
out vec2 vLocal;out float vAge;flat out int vKind;
uint hash(uint n){n^=n>>16;n*=0x7feb352du;n^=n>>15;n*=0x846ca68bu;return n^(n>>16);}
void main(){int id=gl_InstanceID;vec4 s=texelFetch(uParticles,ivec2(id%128,id/128),0);vKind=int(s.w);vAge=(uTick-s.z)/65.0;
 vec2 quad=vec2((gl_VertexID==1||gl_VertexID==2||gl_VertexID==4)?1.0:-1.0,(gl_VertexID==2||gl_VertexID==4||gl_VertexID==5)?1.0:-1.0);
 float r=float(hash(uint(id))&65535u)/65535.0;float age=max(0.0,uTick-s.z);
 bool mist=vKind==2||vKind==3||vKind==8;bool ring=vKind==4||vKind==5;
 vec2 velocity=vec2((r-.5)*1.7,mist?.30:.7+r*.6);if(vKind==9)velocity.y=.3+r;
 vec2 offset=velocity*age;offset.x+=sin(age*.08+r*6.28)*(mist?5.0:1.0);if(!mist)offset.y-=age*age*.022;
 float radius=ring?age*.45+1.0:(mist?2.0+age*.10:1.2);
 if(ring)offset=vec2(0);vec2 extent=vec2(radius);if(vKind==1||vKind==7)extent.y*=2.8;
 vLocal=quad;vec2 position=s.xy+offset*uMotion+quad*extent;
 if(vKind==0||vAge<0.0||vAge>=1.0)position=vec2(-10000);
 gl_Position=vec4(position/uSize*2.0-1.0,0,1);
}`;
const fragment = `#version 300 es
precision highp float;in vec2 vLocal;in float vAge;flat in int vKind;out vec4 color;uniform float uFlash;
void main(){float d=length(vLocal);if(d>1.0)discard;float a=(1.0-vAge)*.5;vec3 c=vec3(1,.47,.13);
 if(vKind==2||vKind==8){c=vec3(.65,.75,.77);a*=.18*(1.0-d);}
 else if(vKind==3){c=vec3(.63,.8,.25);a*=smoothstep(.6,.8,d);}
 else if(vKind==4){c=vec3(1,.55,.2);a*=smoothstep(.72,.85,d)*(1.0-smoothstep(.87,1.0,d));}
 else if(vKind==5){c=vec3(.55,.84,.95);float rays=min(min(abs(vLocal.x),abs(vLocal.y)),abs(abs(vLocal.x)-abs(vLocal.y)));a*=1.0-smoothstep(.03,.13,rays);}
 else if(vKind==6)c=vec3(.40,.66,.82);
 else if(vKind==9)c=vec3(.46,.42,.35);
 else if(vKind==10)c=vec3(.75,.63,.39);
 else a*=1.0-d;
 color=vec4(c,a*uFlash);
}`;
export class Particles {
  enabled = true;
  reducedMotion = false;
  reducedFlashing = false;
  quality = 1;
  private slots: Target[];
  private index = 0;
  private lastTick = -1;
  private updateProgram: WebGLProgram;
  private drawProgram: WebGLProgram;
  constructor(private engine: Engine) {
    const gl = engine.gl;
    this.slots = [target(gl, 128, 64), target(gl, 128, 64)];
    this.updateProgram = program(gl, update);
    this.drawProgram = program(gl, fragment, vertex);
    this.reset();
  }
  reset() {
    const gl = this.engine.gl;
    for (const t of this.slots) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.framebuffer);
      gl.clearBufferfv(gl.COLOR, 0, new Float32Array(4));
    }
    this.lastTick = -1;
  }
  draw(width: number, height: number) {
    if (!this.enabled || this.reducedMotion) return;
    const gl = this.engine.gl;
    if (this.engine.tick < this.lastTick) this.reset();
    if (this.engine.tick !== this.lastTick) {
      const p = this.updateProgram;
      gl.useProgram(p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.slots[1 - this.index].framebuffer);
      gl.viewport(0, 0, 128, 64);
      bindTexture(gl, p, 'uParticles', this.slots[this.index].texture);
      bindTexture(gl, p, 'uEvents', this.engine.eventTexture, 1);
      gl.uniform2i(gl.getUniformLocation(p, 'uSize'), this.engine.width, this.engine.height);
      gl.uniform1i(gl.getUniformLocation(p, 'uTick'), this.engine.tick);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.index = 1 - this.index;
      this.lastTick = this.engine.tick;
    }
    const p = this.drawProgram;
    gl.useProgram(p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    bindTexture(gl, p, 'uParticles', this.slots[this.index].texture);
    gl.uniform2f(gl.getUniformLocation(p, 'uSize'), this.engine.width, this.engine.height);
    gl.uniform1f(gl.getUniformLocation(p, 'uTick'), this.engine.tick);
    gl.uniform1f(gl.getUniformLocation(p, 'uMotion'), 1);
    gl.uniform1f(gl.getUniformLocation(p, 'uFlash'), this.reducedFlashing ? 0.3 : 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, Math.floor(8192 * this.quality));
    gl.disable(gl.BLEND);
  }
  dispose() {
    for (const t of this.slots) destroyTarget(this.engine.gl, t);
    this.engine.gl.deleteProgram(this.updateProgram);
    this.engine.gl.deleteProgram(this.drawProgram);
  }
}
