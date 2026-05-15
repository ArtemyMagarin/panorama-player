import type { CachedTile } from '../tiles/types.js';
import { TileCoordinateSystem } from '../tiles/TileCoordinateSystem.js';
import { buildZoomAwareSphere, type SphereGeometry } from './sphere.js';

/**
 * Renders tiles using per-tile textures with smooth transitions
 */
export class TileRenderer {
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private isWebGL2: boolean;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private uvBuffer: WebGLBuffer | null = null;
  private indexBuffer: WebGLBuffer | null = null;
  private geometry: SphereGeometry | null = null;
  private currentZoom: number = 0;

  // Uniform locations
  private uViewProjection: WebGLUniformLocation | null = null;
  private uTexture: WebGLUniformLocation | null = null;
  private uTileOrigin: WebGLUniformLocation | null = null;
  private uTilesPerAxis: WebGLUniformLocation | null = null;
  private uAlpha: WebGLUniformLocation | null = null;

  constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.gl = gl;
    this.isWebGL2 = gl instanceof WebGL2RenderingContext;
  }

  /**
   * Initialize the renderer
   */
  initialize(): void {
    this.createShaders();
    this.createBuffers();
  }

  /**
   * Create shaders for tile rendering
   */
  private createShaders(): void {
    const vertexShader = this.compileShader(
      this.gl.VERTEX_SHADER,
      this.isWebGL2 ? this.getVertexShaderWebGL2() : this.getVertexShaderWebGL1(),
    );
    const fragmentShader = this.compileShader(
      this.gl.FRAGMENT_SHADER,
      this.isWebGL2 ? this.getFragmentShaderWebGL2() : this.getFragmentShaderWebGL1(),
    );

    this.program = this.gl.createProgram()!;
    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);

    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(this.program);
      throw new Error(`Failed to link shader program: ${error}`);
    }

    // Get uniform locations
    this.uViewProjection = this.gl.getUniformLocation(this.program, 'uViewProjection');
    this.uTexture = this.gl.getUniformLocation(this.program, 'uTexture');
    this.uTileOrigin = this.gl.getUniformLocation(this.program, 'uTileOrigin');
    this.uTilesPerAxis = this.gl.getUniformLocation(this.program, 'uTilesPerAxis');
    this.uAlpha = this.gl.getUniformLocation(this.program, 'uAlpha');

    // Clean up shaders
    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);
  }

  /**
   * Compile a shader
   */
  private compileShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Failed to compile shader: ${error}`);
    }

    return shader;
  }

  /**
   * Create buffers for geometry
   */
  private createBuffers(): void {
    this.positionBuffer = this.gl.createBuffer();
    this.uvBuffer = this.gl.createBuffer();
    this.indexBuffer = this.gl.createBuffer();
  }

  /**
   * Update geometry for a new zoom level
   */
  updateGeometry(zoom: number): void {
    if (zoom === this.currentZoom) return;

    this.currentZoom = zoom;
    this.geometry = buildZoomAwareSphere(zoom);

    // Upload geometry to buffers
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.geometry.positions, this.gl.STATIC_DRAW);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.uvBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.geometry.uvs, this.gl.STATIC_DRAW);

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.geometry.indices, this.gl.STATIC_DRAW);
  }

  /**
   * Render tiles
   */
  render(viewProjection: Float32Array, tiles: CachedTile[], alpha: number = 1.0): void {
    if (!this.program || !this.geometry) return;

    this.gl.useProgram(this.program);

    // Set uniforms
    this.gl.uniformMatrix4fv(this.uViewProjection, false, viewProjection);
    this.gl.uniform1f(this.uAlpha, alpha);

    // Set up vertex attributes
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    const positionLoc = this.gl.getAttribLocation(this.program, 'aPosition');
    this.gl.enableVertexAttribArray(positionLoc);
    this.gl.vertexAttribPointer(positionLoc, 3, this.gl.FLOAT, false, 0, 0);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.uvBuffer);
    const uvLoc = this.gl.getAttribLocation(this.program, 'aUV');
    this.gl.enableVertexAttribArray(uvLoc);
    this.gl.vertexAttribPointer(uvLoc, 2, this.gl.FLOAT, false, 0, 0);

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

    // Render each tile
    const tilesX = TileCoordinateSystem.getTilesX(this.currentZoom);
    const tilesY = TileCoordinateSystem.getTilesY(this.currentZoom);

    this.gl.uniform2f(this.uTilesPerAxis, tilesX, tilesY);

    for (const cachedTile of tiles) {
      if (cachedTile.state !== 'loaded' || !cachedTile.texture) continue;

      const { z, x, y } = cachedTile.tile;
      const uv = TileCoordinateSystem.tileToUV(z, x, y);

      // Set tile origin uniform
      this.gl.uniform2f(this.uTileOrigin, uv.u, uv.v);

      // Bind tile texture
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_2D, cachedTile.texture);
      this.gl.uniform1i(this.uTexture, 0);

      // Draw tile
      this.gl.drawElements(this.gl.TRIANGLES, this.geometry.indexCount, this.gl.UNSIGNED_SHORT, 0);
    }
  }

  /**
   * Get vertex shader for WebGL2
   */
  private getVertexShaderWebGL2(): string {
    return `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec2 aUV;

uniform mat4 uViewProjection;
uniform vec2 uTileOrigin;
uniform vec2 uTilesPerAxis;

out vec2 vUV;

void main() {
  vUV = aUV;
  gl_Position = uViewProjection * vec4(aPosition, 1.0);
}
`;
  }

  /**
   * Get fragment shader for WebGL2
   */
  private getFragmentShaderWebGL2(): string {
    return `#version 300 es
precision highp float;

in vec2 vUV;

uniform sampler2D uTexture;
uniform vec2 uTileOrigin;
uniform vec2 uTilesPerAxis;
uniform float uAlpha;

out vec4 outColor;

void main() {
  // Remap world UV to tile-local UV
  vec2 tileUV = (vUV - uTileOrigin) * uTilesPerAxis;
  
  // Discard fragments outside tile boundaries
  if (tileUV.x < 0.0 || tileUV.x > 1.0 || tileUV.y < 0.0 || tileUV.y > 1.0) {
    discard;
  }
  
  vec4 color = texture(uTexture, tileUV);
  outColor = vec4(color.rgb, color.a * uAlpha);
}
`;
  }

  /**
   * Get vertex shader for WebGL1
   */
  private getVertexShaderWebGL1(): string {
    return `precision highp float;

attribute vec3 aPosition;
attribute vec2 aUV;

uniform mat4 uViewProjection;
uniform vec2 uTileOrigin;
uniform vec2 uTilesPerAxis;

varying vec2 vUV;

void main() {
  vUV = aUV;
  gl_Position = uViewProjection * vec4(aPosition, 1.0);
}
`;
  }

  /**
   * Get fragment shader for WebGL1
   */
  private getFragmentShaderWebGL1(): string {
    return `precision highp float;

varying vec2 vUV;

uniform sampler2D uTexture;
uniform vec2 uTileOrigin;
uniform vec2 uTilesPerAxis;
uniform float uAlpha;

void main() {
  // Remap world UV to tile-local UV
  vec2 tileUV = (vUV - uTileOrigin) * uTilesPerAxis;
  
  // Discard fragments outside tile boundaries
  if (tileUV.x < 0.0 || tileUV.x > 1.0 || tileUV.y < 0.0 || tileUV.y > 1.0) {
    discard;
  }
  
  vec4 color = texture2D(uTexture, tileUV);
  gl_FragColor = vec4(color.rgb, color.a * uAlpha);
}
`;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.program) {
      this.gl.deleteProgram(this.program);
      this.program = null;
    }
    if (this.positionBuffer) {
      this.gl.deleteBuffer(this.positionBuffer);
      this.positionBuffer = null;
    }
    if (this.uvBuffer) {
      this.gl.deleteBuffer(this.uvBuffer);
      this.uvBuffer = null;
    }
    if (this.indexBuffer) {
      this.gl.deleteBuffer(this.indexBuffer);
      this.indexBuffer = null;
    }
  }
}
