import { materialGLSL } from '../data/materials';
import { bindTexture, destroyTarget, header, program, target, type Target } from '../sim/gl';
import type { Engine } from '../sim/engine';
import { Particles } from '../particles/particles';
const lightFragment =
  header +
  materialGLSL() +
  `
void main(){
 ivec2 base=ivec2(gl_FragCoord.xy)*4;vec3 light=vec3(0);
 for(int y=0;y<4;y++)for(int x=0;x<4;x++){vec4 s=cell(base+ivec2(x,y));Property m=prop(int(s.x));light+=m.color*max(m.emissive,s.z<0.0?.8:clamp((s.y-450.0)/1200.0,0.0,.7));}
 outState=vec4(light/16.0,1);
}`;
const blurFragment =
  header +
  `
uniform ivec2 uDirection;
void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec3 c=cell(p).rgb*.2;
 for(int i=1;i<=4;i++){float w=float(5-i)*.04;c+=(cell(p+uDirection*i).rgb+cell(p-uDirection*i).rgb)*w;}
 outState=vec4(c,1);
}`;
const renderFragment =
  header +
  materialGLSL() +
  `
uniform sampler2D uLight; uniform sampler2D uField;uniform vec2 uView; uniform bool uTemperature; uniform bool uLighting;uniform bool uPatterns;uniform bool uMotion;uniform bool uFlash;uniform float uTick;
void main(){
 vec2 uv=gl_FragCoord.xy/uView;ivec2 p=ivec2(uv*vec2(uSize));vec4 s=cell(p);Property m=prop(int(s.x));
 vec3 glow=texture(uLight,uv).rgb;
 if(uMotion&&uLighting&&m.phase==0){uv.x+=sin(float(p.y)*.15+uTick*.12)*length(glow)*.0015;p=ivec2(uv*vec2(uSize));s=cell(p);m=prop(int(s.x));}
 float noise=random(uint(p.x)+uint(p.y)*uint(uSize.x));vec3 c=m.color*(m.phase==3?(.97+noise*.05):(.88+noise*.22));
 if(m.phase==0)c=mix(vec3(.043,.043,.059),vec3(.067,.067,.086),uv.y);
 if(m.phase==4)c=mix(vec3(.065,.075,.079),c,.48+noise*.18);
 if(m.phase==3&&cell(p+ivec2(0,1)).x==0.0)c+=vec3(.10,.13,.13);
 float pattern=texelFetch(uMaterials,ivec2(int(s.x),6),0).w;
 if(pattern==1.0)c*=.9+.1*sin(float(p.x)*1.7+sin(float(p.y)*.1));
 if(pattern==2.0)c+=vec3(.03,.055,.06)*step(.88,noise);
 if(pattern>=2.0){vec4 refracted=cell(p+ivec2(2,1));if(refracted.x!=s.x)c=mix(c,prop(int(refracted.x)).color,.25);c+=vec3(.04,.055,.055)*step(.96,noise);}
 if(m.emissive>0.0||s.z<0.0)c=mix(m.color,vec3(1,.65,.2),noise*.6+.25)*(uFlash?1.0:1.1);
 if(uLighting)c+=glow*(m.phase==0?1.5:.75)*(uFlash?.45:1.0);
 vec4 field=texelFetch(uField,p,0);if(field.z>.0)c=mix(c,vec3(.65,.86,1),min(.7,field.z)*(uFlash?.3:1.0));
 if(m.phase==0&&uMotion&&!uFlash)c+=vec3(.17,.10,.04)*smoothstep(1.0,4.0,abs(field.x));
 if(uPatterns&&m.phase!=0)c*=.75+.25*step(2.0,mod(float(p.x+p.y+int(s.x)),6.0));
 if(uTemperature){float t=clamp((s.y+30.0)/680.0,0.0,1.0);c=mix(vec3(.12,.27,.64),vec3(1,.26,.08),t);if(m.phase==0)c*=.35;}
 outState=vec4(c,1);
}`;
export class Renderer {
  private light: Target[];
  private lightProgram: WebGLProgram;
  private blurProgram: WebGLProgram;
  private renderProgram: WebGLProgram;
  lighting = true;
  temperature = false;
  patterns = false;
  particles: Particles;
  reducedMotion = false;
  reducedFlashing = false;
  private w: number;
  private h: number;
  constructor(
    private engine: Engine,
    private canvas: HTMLCanvasElement,
  ) {
    const gl = engine.gl;
    this.w = Math.ceil(engine.width / 4);
    this.h = Math.ceil(engine.height / 4);
    this.light = [target(gl, this.w, this.h, false), target(gl, this.w, this.h, false)];
    this.lightProgram = program(gl, lightFragment);
    this.blurProgram = program(gl, blurFragment);
    this.renderProgram = program(gl, renderFragment);
    this.particles = new Particles(engine);
    for (const t of this.light) {
      gl.bindTexture(gl.TEXTURE_2D, t.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
  }
  draw() {
    const gl = this.engine.gl;
    if (this.lighting) {
      gl.useProgram(this.lightProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.light[0].framebuffer);
      gl.viewport(0, 0, this.w, this.h);
      bindTexture(gl, this.lightProgram, 'uState', this.engine.texture);
      bindTexture(gl, this.lightProgram, 'uMaterials', this.engine.materialTexture, 3);
      gl.uniform2i(
        gl.getUniformLocation(this.lightProgram, 'uSize'),
        this.engine.width,
        this.engine.height,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.useProgram(this.blurProgram);
      gl.uniform2i(gl.getUniformLocation(this.blurProgram, 'uSize'), this.w, this.h);
      for (let i = 0; i < 2; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.light[1 - i].framebuffer);
        bindTexture(gl, this.blurProgram, 'uState', this.light[i].texture);
        gl.uniform2i(
          gl.getUniformLocation(this.blurProgram, 'uDirection'),
          i === 0 ? 1 : 0,
          i === 1 ? 1 : 0,
        );
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }
    const scale = Math.min(devicePixelRatio, 1.5),
      w = Math.round(this.canvas.clientWidth * scale),
      h = Math.round(this.canvas.clientHeight * scale);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = Math.max(1, w);
      this.canvas.height = Math.max(1, h);
    }
    const p = this.renderProgram;
    gl.useProgram(p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    bindTexture(gl, p, 'uState', this.engine.texture);
    bindTexture(gl, p, 'uMaterials', this.engine.materialTexture, 3);
    bindTexture(gl, p, 'uLight', this.light[0].texture, 1);
    bindTexture(gl, p, 'uField', this.engine.fieldTexture, 2);
    gl.uniform2i(gl.getUniformLocation(p, 'uSize'), this.engine.width, this.engine.height);
    gl.uniform2f(gl.getUniformLocation(p, 'uView'), this.canvas.width, this.canvas.height);
    gl.uniform1i(gl.getUniformLocation(p, 'uTemperature'), this.temperature ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(p, 'uLighting'), this.lighting ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(p, 'uPatterns'), this.patterns ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(p, 'uMotion'), this.reducedMotion ? 0 : 1);
    gl.uniform1i(gl.getUniformLocation(p, 'uFlash'), this.reducedFlashing ? 1 : 0);
    gl.uniform1f(gl.getUniformLocation(p, 'uTick'), this.engine.tick);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.particles.reducedMotion = this.reducedMotion;
    this.particles.reducedFlashing = this.reducedFlashing;
    this.particles.draw(this.canvas.width, this.canvas.height);
  }
  dispose() {
    this.particles.dispose();
    for (const t of this.light) destroyTarget(this.engine.gl, t);
    for (const p of [this.lightProgram, this.blurProgram, this.renderProgram])
      this.engine.gl.deleteProgram(p);
  }
}
