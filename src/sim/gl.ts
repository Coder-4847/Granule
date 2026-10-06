export const vertex = `#version 300 es
void main(){ vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position=vec4(p*2.0-1.0,0,1); }`;
export function program(
  gl: WebGL2RenderingContext,
  fragment: string,
  vertexSource = vertex,
): WebGLProgram {
  const shaders: WebGLShader[] = [];
  let p: WebGLProgram | null = null;
  try {
    shaders.push(compile(gl, gl.VERTEX_SHADER, vertexSource));
    shaders.push(compile(gl, gl.FRAGMENT_SHADER, fragment));
    p = gl.createProgram();
    if (!p) throw new Error('Unable to create a GPU program.');
    for (const s of shaders) gl.attachShader(p, s);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(`GPU linking: ${gl.getProgramInfoLog(p)}`);
    return p;
  } catch (error) {
    if (p) gl.deleteProgram(p);
    throw error;
  } finally {
    for (const s of shaders) gl.deleteShader(s);
  }
}
function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error('Unable to create a GPU shader.');
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`GPU shader: ${message}`);
  }
  return s;
}
export interface Target {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
}
export function target(gl: WebGL2RenderingContext, w: number, h: number, float = true): Target {
  const texture = gl.createTexture(),
    framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) {
    gl.deleteTexture(texture);
    gl.deleteFramebuffer(framebuffer);
    throw new Error('GPU allocation failed.');
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    float ? gl.RGBA32F : gl.RGBA8,
    w,
    h,
    0,
    gl.RGBA,
    float ? gl.FLOAT : gl.UNSIGNED_BYTE,
    null,
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteTexture(texture);
    gl.deleteFramebuffer(framebuffer);
    throw new Error('This GPU cannot render to the required texture format.');
  }
  return { texture, framebuffer };
}
export function destroyTarget(gl: WebGL2RenderingContext, t: Target) {
  gl.deleteTexture(t.texture);
  gl.deleteFramebuffer(t.framebuffer);
}
export function bindTexture(
  gl: WebGL2RenderingContext,
  p: WebGLProgram,
  name: string,
  texture: WebGLTexture,
  unit = 0,
) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(gl.getUniformLocation(p, name), unit);
}
export const header = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uState;
uniform ivec2 uSize;
layout(location=0) out vec4 outState;
uint hash(uint n){ n^=n>>16; n*=0x7feb352du; n^=n>>15; n*=0x846ca68bu; return n^(n>>16); }
float random(uint n){ return float(hash(n)&0xffffffu)/16777216.0; }
vec4 cell(ivec2 p){return texelFetch(uState,clamp(p,ivec2(0),uSize-1),0);}
`;
