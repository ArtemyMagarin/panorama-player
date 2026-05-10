import { buildViewProjection } from '../math/camera.js';
import type { View } from '../types.js';
import { FRAGMENT_SHADER, VERTEX_SHADER } from './shaders.js';
import { buildSphere, type SphereGeometry } from './sphere.js';

export class Renderer {
  private readonly gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private positionVbo: WebGLBuffer | null = null;
  private uvVbo: WebGLBuffer | null = null;
  private ibo: WebGLBuffer | null = null;
  private texture: WebGLTexture | null = null;
  private uViewProjLoc: WebGLUniformLocation | null = null;
  private geometry: SphereGeometry;
  private hasImage = false;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('panorama-player: WebGL2 is not supported');
    this.gl = gl;
    this.geometry = buildSphere(32, 64);
    this.initProgram();
    this.initBuffers();
    this.initTexture();

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 1);
  }

  private initProgram(): void {
    const gl = this.gl;
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) throw new Error('panorama-player: failed to create program');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) ?? '';
      gl.deleteProgram(program);
      throw new Error(`panorama-player: program link failed: ${log}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.program = program;
    this.uViewProjLoc = gl.getUniformLocation(program, 'uViewProjection');
    const uTex = gl.getUniformLocation(program, 'uTexture');
    gl.useProgram(program);
    gl.uniform1i(uTex, 0);
  }

  private initBuffers(): void {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('panorama-player: failed to create VAO');
    gl.bindVertexArray(vao);

    this.positionVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.geometry.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    this.uvVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.geometry.uvs, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.geometry.indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
    this.vao = vao;
  }

  private initTexture(): void {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255]),
    );
    this.texture = tex;
  }

  uploadImage(image: HTMLImageElement | ImageBitmap): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image as TexImageSource);
    this.hasImage = true;
  }

  resize(width: number, height: number): void {
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
  }

  draw(view: View): void {
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!this.hasImage || !this.program || !this.vao) return;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    const aspect = canvas.width / Math.max(canvas.height, 1);
    const m = buildViewProjection(view, aspect);
    gl.uniformMatrix4fv(this.uViewProjLoc, false, m);

    gl.drawElements(gl.TRIANGLES, this.geometry.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.positionVbo) gl.deleteBuffer(this.positionVbo);
    if (this.uvVbo) gl.deleteBuffer(this.uvVbo);
    if (this.ibo) gl.deleteBuffer(this.ibo);
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.program) gl.deleteProgram(this.program);
    this.vao = null;
    this.positionVbo = null;
    this.uvVbo = null;
    this.ibo = null;
    this.texture = null;
    this.program = null;
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('panorama-player: failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? '';
    gl.deleteShader(shader);
    throw new Error(`panorama-player: shader compile failed: ${log}`);
  }
  return shader;
}
