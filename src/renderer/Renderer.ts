import { buildViewProjection } from '../math/camera.js';
import type { View } from '../types.js';
import {
  FRAGMENT_SHADER_WEBGL1,
  FRAGMENT_SHADER_WEBGL2,
  VERTEX_SHADER_WEBGL1,
  VERTEX_SHADER_WEBGL2,
} from './shaders.js';
import { buildSphere, type SphereGeometry } from './sphere.js';

type AnyGL = WebGL2RenderingContext | WebGLRenderingContext;

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private readonly gl: AnyGL;
  private readonly isWebGL2: boolean;

  get glContext(): AnyGL {
    return this.gl;
  }
  private program: WebGLProgram | null = null;
  private positionVbo: WebGLBuffer | null = null;
  private uvVbo: WebGLBuffer | null = null;
  private ibo: WebGLBuffer | null = null;
  private texture: WebGLTexture | null = null;
  private uViewProjLoc: WebGLUniformLocation | null = null;
  private aPositionLoc = -1;
  private aUVLoc = -1;
  private geometry: SphereGeometry;
  private hasImage = false;
  private contextLost = false;

  constructor(canvas: HTMLCanvasElement) {
    const { gl, isWebGL2, canvas: usedCanvas } = createContext(canvas);
    this.gl = gl;
    this.canvas = usedCanvas;
    this.isWebGL2 = isWebGL2;
    this.geometry = buildSphere(16, 32);

    usedCanvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
    });
    usedCanvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      try {
        this.initProgram();
        this.initBuffers();
        this.initTexture();
      } catch {
        this.contextLost = true;
      }
    });

    this.initProgram();
    this.initBuffers();
    this.initTexture();

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 1);
  }

  private initProgram(): void {
    const gl = this.gl;
    const vsSource = this.isWebGL2 ? VERTEX_SHADER_WEBGL2 : VERTEX_SHADER_WEBGL1;
    const fsSource = this.isWebGL2 ? FRAGMENT_SHADER_WEBGL2 : FRAGMENT_SHADER_WEBGL1;
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    if (!program) throw new Error('panorama-player: failed to create program');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    if (!this.isWebGL2) {
      gl.bindAttribLocation(program, 0, 'aPosition');
      gl.bindAttribLocation(program, 1, 'aUV');
    }
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
    this.aPositionLoc = gl.getAttribLocation(program, 'aPosition');
    this.aUVLoc = gl.getAttribLocation(program, 'aUV');
    const uTex = gl.getUniformLocation(program, 'uTexture');
    gl.useProgram(program);
    gl.uniform1i(uTex, 0);
  }

  private initBuffers(): void {
    const gl = this.gl;
    this.positionVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.geometry.positions, gl.STATIC_DRAW);

    this.uvVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.geometry.uvs, gl.STATIC_DRAW);

    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.geometry.indices, gl.STATIC_DRAW);
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
    if (gl.isContextLost()) {
      this.contextLost = true;
      throw new Error('panorama-player: WebGL context lost during texture upload');
    }
    try {
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image as TexImageSource);
      this.hasImage = true;
    } catch (e) {
      this.contextLost = true;
      throw e;
    }
  }

  clearTexture(): void {
    const gl = this.gl;
    if (gl.isContextLost()) {
      this.contextLost = true;
      return;
    }
    try {
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 0]),
      );
      this.hasImage = false;
    } catch (e) {
      this.contextLost = true;
      throw e;
    }
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
    if (this.contextLost || gl.isContextLost()) {
      this.contextLost = true;
      return;
    }
    const canvas = gl.canvas as HTMLCanvasElement;
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!this.hasImage || !this.program) return;
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionVbo);
    gl.enableVertexAttribArray(this.aPositionLoc);
    gl.vertexAttribPointer(this.aPositionLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvVbo);
    gl.enableVertexAttribArray(this.aUVLoc);
    gl.vertexAttribPointer(this.aUVLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    const aspect = canvas.width / Math.max(canvas.height, 1);
    const m = buildViewProjection(view, aspect);
    gl.uniformMatrix4fv(this.uViewProjLoc, false, m);

    gl.drawElements(gl.TRIANGLES, this.geometry.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl.isContextLost()) {
      if (this.positionVbo) gl.deleteBuffer(this.positionVbo);
      if (this.uvVbo) gl.deleteBuffer(this.uvVbo);
      if (this.ibo) gl.deleteBuffer(this.ibo);
      if (this.texture) gl.deleteTexture(this.texture);
      if (this.program) gl.deleteProgram(this.program);
    }
    this.positionVbo = null;
    this.uvVbo = null;
    this.ibo = null;
    this.texture = null;
    this.program = null;
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }
}

const MINIMAL_ATTRS: WebGLContextAttributes = {
  alpha: false,
  depth: false,
  stencil: false,
  antialias: false,
  premultipliedAlpha: false,
  preserveDrawingBuffer: false,
  failIfMajorPerformanceCaveat: false,
};

function createContext(canvas: HTMLCanvasElement): {
  gl: AnyGL;
  isWebGL2: boolean;
  canvas: HTMLCanvasElement;
} {
  // Set explicit small dimensions before context creation - some iOS versions
  // have issues creating WebGL contexts on canvases with default dimensions.
  if (canvas.width === 300 && canvas.height === 150) {
    canvas.width = 1;
    canvas.height = 1;
  }
  const gl2 = canvas.getContext('webgl2', MINIMAL_ATTRS);
  const gl2Lost = gl2 ? gl2.isContextLost() : 'null';
  if (gl2 && !gl2.isContextLost()) {
    return { gl: gl2, isWebGL2: true, canvas };
  }
  // Once getContext('webgl2') is called on a canvas, subsequent getContext('webgl')
  // calls on the same canvas return null. Replace with a fresh canvas for WebGL1.
  const freshCanvas = canvas.ownerDocument.createElement('canvas');
  freshCanvas.className = canvas.className;
  freshCanvas.width = 1;
  freshCanvas.height = 1;
  if (canvas.parentElement) {
    canvas.parentElement.replaceChild(freshCanvas, canvas);
  }
  const gl1 =
    freshCanvas.getContext('webgl', MINIMAL_ATTRS) ||
    freshCanvas.getContext('experimental-webgl', MINIMAL_ATTRS);
  const gl1Lost = gl1 ? (gl1 as WebGLRenderingContext).isContextLost() : 'null';
  if (gl1 && !(gl1 as WebGLRenderingContext).isContextLost()) {
    return { gl: gl1 as WebGLRenderingContext, isWebGL2: false, canvas: freshCanvas };
  }
  const rect = freshCanvas.getBoundingClientRect();
  throw new Error(
    `panorama-player: WebGL unavailable (gl2=${gl2Lost}, gl1=${gl1Lost}, canvas=${freshCanvas.width}x${freshCanvas.height}, rect=${rect.width}x${rect.height})`,
  );
}

function compileShader(gl: AnyGL, type: number, source: string): WebGLShader {
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
