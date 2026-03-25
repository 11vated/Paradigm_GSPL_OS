/**
 * three-renderer.ts — 3D Mesh Renderer
 * Takes Geometry3D engine output (vertices, faces, normals from marching cubes)
 * and renders it using WebGL via raw Three.js-compatible data.
 * Uses pure WebGL — no Three.js dependency required for basic rendering.
 * Can optionally integrate with Three.js if available.
 */

import { UniversalSeed } from '../kernel/seed.js';
import { registry } from '../engines/engine.js';

// ============================================================================
// TYPES
// ============================================================================

export interface MeshData {
  vertices: Float32Array;
  faces: Uint32Array;
  normals: Float32Array;
  vertexCount: number;
  faceCount: number;
  material: {
    color: { r: number; g: number; b: number };
    roughness: number;
    metallic: number;
  };
}

export interface ThreeRendererOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
  background?: string;
  autoRotate?: boolean;
  rotateSpeed?: number;
}

// ============================================================================
// WEBGL SHADERS
// ============================================================================

const VERTEX_SHADER = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  uniform mat4 uProjection;
  uniform mat4 uModelView;
  uniform mat3 uNormalMatrix;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(uNormalMatrix * aNormal);
    vec4 mvPosition = uModelView * vec4(aPosition, 1.0);
    vPosition = mvPosition.xyz;
    gl_Position = uProjection * mvPosition;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform vec3 uColor;
  uniform float uRoughness;
  uniform float uMetallic;
  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform vec3 uAmbient;
  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(-vPosition);
    vec3 H = normalize(L + V);

    float NdotL = max(dot(N, L), 0.0);
    float NdotH = max(dot(N, H), 0.0);

    // Diffuse
    vec3 diffuse = uColor * NdotL * uLightColor;

    // Specular (Blinn-Phong approximation of PBR)
    float shininess = mix(8.0, 128.0, 1.0 - uRoughness);
    float spec = pow(NdotH, shininess);
    vec3 specColor = mix(vec3(0.04), uColor, uMetallic);
    vec3 specular = specColor * spec * uLightColor;

    // Ambient
    vec3 ambient = uAmbient * uColor;

    // Rim light for depth
    float rim = 1.0 - max(dot(N, V), 0.0);
    rim = pow(rim, 3.0) * 0.15;

    vec3 finalColor = ambient + diffuse + specular + vec3(rim);
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// ============================================================================
// MATRIX MATH (minimal, no dependency)
// ============================================================================

function mat4Perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1.0 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function mat4LookAt(eye: number[], center: number[], up: number[]): Float32Array {
  const z = normalize3(sub3(eye, center));
  const x = normalize3(cross3(up, z));
  const y = cross3(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot3(x, eye), -dot3(y, eye), -dot3(z, eye), 1,
  ]);
}

function mat4Multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[i * 4 + j] = a[0 * 4 + j] * b[i * 4 + 0] + a[1 * 4 + j] * b[i * 4 + 1] +
        a[2 * 4 + j] * b[i * 4 + 2] + a[3 * 4 + j] * b[i * 4 + 3];
    }
  }
  return out;
}

function mat4RotateY(angle: number): Float32Array {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Float32Array([c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1]);
}

function mat3NormalFromMat4(m: Float32Array): Float32Array {
  const a00 = m[0], a01 = m[1], a02 = m[2];
  const a10 = m[4], a11 = m[5], a12 = m[6];
  const a20 = m[8], a21 = m[9], a22 = m[10];
  const det = a00 * (a11 * a22 - a12 * a21) - a01 * (a10 * a22 - a12 * a20) + a02 * (a10 * a21 - a11 * a20);
  const id = 1 / det;
  return new Float32Array([
    (a11 * a22 - a12 * a21) * id, (a02 * a21 - a01 * a22) * id, (a01 * a12 - a02 * a11) * id,
    (a12 * a20 - a10 * a22) * id, (a00 * a22 - a02 * a20) * id, (a02 * a10 - a00 * a12) * id,
    (a10 * a21 - a11 * a20) * id, (a01 * a20 - a00 * a21) * id, (a00 * a11 - a01 * a10) * id,
  ]);
}

function sub3(a: number[], b: number[]): number[] { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross3(a: number[], b: number[]): number[] { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot3(a: number[], b: number[]): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function normalize3(v: number[]): number[] { const l = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

// ============================================================================
// 3D RENDERER
// ============================================================================

export class ThreeRenderer {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private width: number;
  private height: number;
  private autoRotate: boolean;
  private rotateSpeed: number;
  private angle: number = 0;
  private frameId: number = 0;
  private running: boolean = false;
  private meshData: MeshData | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private normalBuffer: WebGLBuffer | null = null;
  private indexBuffer: WebGLBuffer | null = null;
  private indexCount: number = 0;

  constructor(options: ThreeRendererOptions) {
    this.container = options.container;
    this.width = options.width ?? 512;
    this.height = options.height ?? 512;
    this.autoRotate = options.autoRotate ?? true;
    this.rotateSpeed = options.rotateSpeed ?? 0.01;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.display = 'block';
    this.canvas.style.borderRadius = '8px';
    this.container.appendChild(this.canvas);

    this.initGL(options.background ?? '#111');
  }

  private initGL(bg: string): void {
    this.gl = this.canvas.getContext('webgl');
    if (!this.gl) return;

    const gl = this.gl;

    // Parse background color
    const r = parseInt(bg.slice(1, 3), 16) / 255;
    const g = parseInt(bg.slice(3, 5), 16) / 255;
    const b = parseInt(bg.slice(5, 7), 16) / 255;
    gl.clearColor(r, g, b, 1);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.viewport(0, 0, this.width, this.height);

    // Compile shaders
    const vs = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Shader link error:', gl.getProgramInfoLog(this.program));
    }
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;
    const shader = this.gl.createShader(type);
    if (!shader) return null;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  /**
   * Load mesh from a seed.
   */
  loadSeed(seed: UniversalSeed): boolean {
    const engine = registry.get('geometry3d');
    if (!engine) return false;

    const result = engine.generate(seed);
    if (!result.success) return false;

    const vertices = result.artifacts.get('vertices') as Float32Array | undefined;
    const faces = result.artifacts.get('faces') as Uint32Array | undefined;
    const normals = result.artifacts.get('normals') as Float32Array | undefined;
    const vertexCount = result.artifacts.get('vertexCount') as number | undefined;
    const faceCount = result.artifacts.get('faceCount') as number | undefined;
    const material = result.artifacts.get('material') as MeshData['material'] | undefined;

    if (vertices && faces && normals && vertexCount && faceCount) {
      this.loadMesh({
        vertices, faces, normals, vertexCount, faceCount,
        material: material ?? { color: { r: 0.6, g: 0.7, b: 0.9 }, roughness: 0.5, metallic: 0.1 },
      });
      return true;
    }
    return false;
  }

  /**
   * Load mesh data directly.
   */
  loadMesh(data: MeshData): void {
    if (!this.gl || !this.program) return;
    this.meshData = data;
    const gl = this.gl;

    // Upload vertex positions
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.STATIC_DRAW);

    // Upload normals
    this.normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.normals, gl.STATIC_DRAW);

    // Upload indices
    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    // Convert Uint32 to Uint16 if possible (WebGL 1 limitation)
    const maxIndex = Math.max(...Array.from(data.faces));
    if (maxIndex < 65536) {
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.faces), gl.STATIC_DRAW);
    } else {
      const ext = gl.getExtension('OES_element_index_uint');
      if (ext) {
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.faces, gl.STATIC_DRAW);
      }
    }
    this.indexCount = data.faceCount * 3;

    if (!this.running) this.start();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.renderLoop();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
  }

  private renderLoop(): void {
    if (!this.running) return;

    if (this.autoRotate) {
      this.angle += this.rotateSpeed;
    }
    this.renderFrame();

    this.frameId = requestAnimationFrame(() => this.renderLoop());
  }

  private renderFrame(): void {
    if (!this.gl || !this.program || !this.meshData) return;
    const gl = this.gl;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);

    // Camera
    const projection = mat4Perspective(Math.PI / 4, this.width / this.height, 0.1, 100);
    const dist = 3;
    const eye = [Math.sin(this.angle) * dist, 1.5, Math.cos(this.angle) * dist];
    const view = mat4LookAt(eye, [0, 0, 0], [0, 1, 0]);
    const modelView = view;
    const normalMatrix = mat3NormalFromMat4(modelView);

    // Set uniforms
    gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uProjection'), false, projection);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uModelView'), false, modelView);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.program, 'uNormalMatrix'), false, normalMatrix);

    const mat = this.meshData.material;
    gl.uniform3f(gl.getUniformLocation(this.program, 'uColor'), mat.color.r, mat.color.g, mat.color.b);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uRoughness'), mat.roughness);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uMetallic'), mat.metallic);
    gl.uniform3f(gl.getUniformLocation(this.program, 'uLightDir'), 1, 2, 1.5);
    gl.uniform3f(gl.getUniformLocation(this.program, 'uLightColor'), 1, 0.95, 0.9);
    gl.uniform3f(gl.getUniformLocation(this.program, 'uAmbient'), 0.15, 0.15, 0.2);

    // Bind vertex positions
    const aPosition = gl.getAttribLocation(this.program, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

    // Bind normals
    const aNormal = gl.getAttribLocation(this.program, 'aNormal');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
    gl.enableVertexAttribArray(aNormal);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);

    // Draw
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  /**
   * Export mesh data in OBJ format.
   */
  exportOBJ(): string {
    if (!this.meshData) return '';
    const { vertices, faces, normals, vertexCount, faceCount } = this.meshData;
    const lines: string[] = ['# Paradigm Engine — Geometry3D Export'];

    for (let i = 0; i < vertexCount; i++) {
      lines.push(`v ${vertices[i * 3]} ${vertices[i * 3 + 1]} ${vertices[i * 3 + 2]}`);
    }
    for (let i = 0; i < vertexCount; i++) {
      lines.push(`vn ${normals[i * 3]} ${normals[i * 3 + 1]} ${normals[i * 3 + 2]}`);
    }
    for (let i = 0; i < faceCount; i++) {
      const a = faces[i * 3] + 1, b = faces[i * 3 + 1] + 1, c = faces[i * 3 + 2] + 1;
      lines.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
    }

    return lines.join('\n');
  }

  destroy(): void {
    this.stop();
    this.canvas.remove();
  }
}
