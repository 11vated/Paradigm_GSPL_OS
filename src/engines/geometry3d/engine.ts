/**
 * geometry3d/engine.ts — 3D Geometry Engine
 * Generates 3D meshes/models from seeds using SDF (Signed Distance Fields).
 * Pipeline: Skeleton → Sculpt → Surface → Topology
 */

import {
  DomainEngine,
  DevelopmentalStage,
  DevelopmentalContext,
} from '../engine.js';
import {
  UniversalSeed,
  SeedDomain,
  FitnessVector,
  GeneMap,
} from '../../kernel/seed.js';
import { scalar, categorical } from '../../kernel/genes.js';

// ============================================================================
// GENE SCHEMA FOR GEOMETRY3D
// ============================================================================

const GEOMETRY3D_GENES = {
  // Base primitive
  primitive: categorical('sphere', [
    'sphere',
    'cube',
    'cylinder',
    'torus',
    'cone',
  ]),
  scale: scalar(1, 0.1, 5),
  scaleX: scalar(1, 0.1, 5),
  scaleY: scalar(1, 0.1, 5),
  scaleZ: scalar(1, 0.1, 5),

  // CSG operations
  csgOperation: categorical('union', ['union', 'intersection', 'subtraction']),
  csgSecondary: categorical('none', [
    'none',
    'sphere',
    'cube',
    'cylinder',
  ]),

  // Deformation
  deformationStrength: scalar(0.2, 0, 1),
  deformationType: categorical('twist', ['twist', 'bend', 'wave', 'noise']),

  // Material properties
  roughness: scalar(0.5, 0, 1),
  metallic: scalar(0, 0, 1),
  colorR: scalar(0.8, 0, 1),
  colorG: scalar(0.8, 0, 1),
  colorB: scalar(0.8, 0, 1),

  // Mesh resolution
  resolution: scalar(32, 8, 128),
  detail: scalar(0.5, 0, 1),
};

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Face {
  a: number;
  b: number;
  c: number;
}

// ============================================================================
// GEOMETRY3D ENGINE IMPLEMENTATION
// ============================================================================

export class Geometry3DEngine extends DomainEngine {
  readonly domain: SeedDomain = 'geometry3d';
  readonly name = 'Geometry3D Engine';
  readonly version = '1.0.0';

  defaultGenes(): GeneMap {
    return GEOMETRY3D_GENES;
  }

  stages(): DevelopmentalStage[] {
    return [
      {
        name: 'Skeleton',
        description: 'Establish base form (primitive SDF combination)',
        execute: this.stageSkeleton.bind(this),
      },
      {
        name: 'Sculpt',
        description: 'Deform and detail the base form',
        execute: this.stageSculpt.bind(this),
      },
      {
        name: 'Surface',
        description: 'Material properties and UV mapping',
        execute: this.stageSurface.bind(this),
      },
      {
        name: 'Topology',
        description: 'Mesh generation from SDF (marching cubes conceptually)',
        execute: this.stageTopology.bind(this),
      },
    ];
  }

  evaluate(seed: UniversalSeed): FitnessVector {
    const detail = (seed.genes.detail as any).value ?? 0;
    const roughness = (seed.genes.roughness as any).value ?? 0.5;

    const scores = {
      detail: detail * 0.5,
      materiality: (1 - Math.abs(roughness - 0.5) * 2) * 0.5,
    };

    return {
      scores,
      aggregate: scores.detail + scores.materiality,
      evaluatedAt: Date.now(),
    };
  }

  // ========================================================================
  // DEVELOPMENTAL STAGES
  // ========================================================================

  private stageSkeleton(context: DevelopmentalContext): DevelopmentalContext {
    const genes = context.seed.genes;
    const primitive = (genes.primitive as any).value;
    const scale = (genes.scale as any).value;

    const sdfParams = {
      type: primitive,
      scale,
      scaleX: (genes.scaleX as any).value,
      scaleY: (genes.scaleY as any).value,
      scaleZ: (genes.scaleZ as any).value,
    };

    context.artifacts.set('baseSDF', sdfParams);
    return context;
  }

  private stageSculpt(context: DevelopmentalContext): DevelopmentalContext {
    const genes = context.seed.genes;
    const deformType = (genes.deformationType as any).value;
    const strength = (genes.deformationStrength as any).value;

    const deformation = {
      type: deformType,
      strength,
    };

    context.artifacts.set('deformation', deformation);
    return context;
  }

  private stageSurface(context: DevelopmentalContext): DevelopmentalContext {
    const genes = context.seed.genes;

    const material = {
      color: {
        r: (genes.colorR as any).value,
        g: (genes.colorG as any).value,
        b: (genes.colorB as any).value,
      },
      roughness: (genes.roughness as any).value,
      metallic: (genes.metallic as any).value,
    };

    context.artifacts.set('material', material);
    return context;
  }

  private stageTopology(context: DevelopmentalContext): DevelopmentalContext {
    const genes = context.seed.genes;
    const resolution = Math.round((genes.resolution as any).value);

    const baseSDF = context.artifacts.get('baseSDF') as any;
    const deformation = context.artifacts.get('deformation') as any;
    const material = context.artifacts.get('material') as any;

    // Evaluate SDF on a grid and extract mesh
    const { vertices, faces, normals } = this.marchCubes(
      baseSDF,
      deformation,
      resolution
    );

    context.artifacts.set('vertices', vertices);
    context.artifacts.set('faces', faces);
    context.artifacts.set('normals', normals);
    context.artifacts.set('vertexCount', vertices.length / 3);
    context.artifacts.set('faceCount', faces.length / 3);

    return context;
  }

  // ========================================================================
  // SDF EVALUATION & MESH GENERATION
  // ========================================================================

  /**
   * Evaluate signed distance field at a point
   */
  private evaluateSDF(
    p: Vec3,
    sdfParams: any,
    deformation: any
  ): number {
    let dist = this.evaluateBaseSDF(p, sdfParams);

    // Apply deformation
    if (deformation) {
      dist = this.applyDeformation(p, dist, deformation);
    }

    return dist;
  }

  private evaluateBaseSDF(p: Vec3, params: any): number {
    const type = params.type;
    const sx = params.scaleX ?? 1;
    const sy = params.scaleY ?? 1;
    const sz = params.scaleZ ?? 1;

    // Scale position
    const q = {
      x: p.x / sx,
      y: p.y / sy,
      z: p.z / sz,
    };

    let dist = 0;

    switch (type) {
      case 'sphere':
        dist =
          Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z) -
          (params.scale ?? 1);
        break;

      case 'cube':
        const bx = Math.abs(q.x) - (params.scale ?? 1);
        const by = Math.abs(q.y) - (params.scale ?? 1);
        const bz = Math.abs(q.z) - (params.scale ?? 1);
        const ox = Math.max(bx, 0);
        const oy = Math.max(by, 0);
        const oz = Math.max(bz, 0);
        dist =
          Math.sqrt(ox * ox + oy * oy + oz * oz) +
          Math.min(Math.max(bx, Math.max(by, bz)), 0);
        break;

      case 'cylinder':
        const dr =
          Math.sqrt(q.x * q.x + q.y * q.y) - (params.scale ?? 1);
        const dz = Math.abs(q.z) - (params.scale ?? 0.5);
        dist =
          Math.min(Math.max(dr, dz), 0) +
          Math.sqrt(Math.max(dr, 0) ** 2 + Math.max(dz, 0) ** 2);
        break;

      case 'torus': {
        const r = params.scale ?? 1;
        const r2 = r * 0.4;
        const t = Math.sqrt(q.x * q.x + q.y * q.y) - r;
        dist = Math.sqrt(t * t + q.z * q.z) - r2;
        break;
      }

      case 'cone':
        const h = params.scale ?? 1;
        const angle = 0.5;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const y = q.z;
        const d = Math.sqrt(q.x * q.x + q.y * q.y);
        const q1 = d * c - Math.abs(y) * s;
        const q2 = Math.abs(y + h) - h;
        dist = Math.max(q1, q2);
        break;

      default:
        dist = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z) - 1;
    }

    return dist;
  }

  private applyDeformation(p: Vec3, dist: number, deformation: any): number {
    const strength = deformation.strength ?? 0.2;
    const type = deformation.type ?? 'twist';

    let totalDist = dist;

    switch (type) {
      case 'twist':
        const angle = (p.z * Math.PI * 2 * strength) % (Math.PI * 2);
        const cos_a = Math.cos(angle);
        const sin_a = Math.sin(angle);
        const px = p.x * cos_a - p.y * sin_a;
        const py = p.x * sin_a + p.y * cos_a;
        totalDist =
          Math.sqrt(px * px + py * py + p.z * p.z) - 0.5 * strength;
        break;

      case 'bend':
        const bend = strength * Math.PI;
        const cos_b = Math.cos(bend * p.z);
        const sin_b = Math.sin(bend * p.z);
        const px2 = p.x * cos_b - bend * sin_b;
        const py2 = p.x * sin_b + bend * cos_b;
        totalDist += py2 * strength * 0.1;
        break;

      case 'wave':
        const wave = Math.sin(p.x * 5 + p.y * 5) * strength * 0.2;
        totalDist += wave;
        break;

      case 'noise':
        const noise = (Math.random() - 0.5) * strength * 0.2;
        totalDist += noise;
        break;
    }

    return totalDist;
  }

  /**
   * Marching Cubes-like algorithm to extract mesh from SDF
   */
  private marchCubes(
    sdfParams: any,
    deformation: any,
    resolution: number
  ): {
    vertices: Float32Array;
    faces: Uint32Array;
    normals: Float32Array;
  } {
    const scale = sdfParams.scale ?? 1;
    const boundsSize = scale * 3;
    const cellSize = (boundsSize * 2) / resolution;

    const vertices: Vec3[] = [];
    const faces: Face[] = [];
    const vertexMap = new Map<string, number>();

    // Evaluate SDF on a grid and extract surface
    for (let ix = 0; ix < resolution - 1; ix++) {
      for (let iy = 0; iy < resolution - 1; iy++) {
        for (let iz = 0; iz < resolution - 1; iz++) {
          const x = -boundsSize + ix * cellSize;
          const y = -boundsSize + iy * cellSize;
          const z = -boundsSize + iz * cellSize;

          // Evaluate SDF at 8 corners of cube
          const corners = [
            { p: { x, y, z }, i: 0 },
            { p: { x: x + cellSize, y, z }, i: 1 },
            { p: { x: x + cellSize, y: y + cellSize, z }, i: 2 },
            { p: { x, y: y + cellSize, z }, i: 3 },
            { p: { x, y, z: z + cellSize }, i: 4 },
            { p: { x: x + cellSize, y, z: z + cellSize }, i: 5 },
            {
              p: { x: x + cellSize, y: y + cellSize, z: z + cellSize },
              i: 6,
            },
            { p: { x, y: y + cellSize, z: z + cellSize }, i: 7 },
          ];

          const distances = corners.map((c) =>
            this.evaluateSDF(c.p, sdfParams, deformation)
          );

          // Check if surface crosses this cube
          const cubeSign = distances.map((d) => (d < 0 ? 1 : 0));
          let cubeIndex = 0;
          for (let i = 0; i < cubeSign.length; i++) {
            cubeIndex |= (cubeSign[i] << i);
          }

          if (cubeIndex > 0 && cubeIndex < 255) {
            // Surface crosses this cube - generate triangles
            this.polygonizeCell(
              corners,
              distances,
              vertices,
              faces,
              vertexMap
            );
          }
        }
      }
    }

    // Compute normals
    const vertexArray = new Float32Array(vertices.length * 3);
    for (let i = 0; i < vertices.length; i++) {
      vertexArray[i * 3] = vertices[i].x;
      vertexArray[i * 3 + 1] = vertices[i].y;
      vertexArray[i * 3 + 2] = vertices[i].z;
    }

    const normals = this.computeNormals(vertexArray, faces);
    const faceArray = new Uint32Array(faces.length * 3);
    for (let i = 0; i < faces.length; i++) {
      faceArray[i * 3] = faces[i].a;
      faceArray[i * 3 + 1] = faces[i].b;
      faceArray[i * 3 + 2] = faces[i].c;
    }

    return {
      vertices: vertexArray,
      faces: faceArray,
      normals,
    };
  }

  private polygonizeCell(
    corners: Array<{ p: Vec3; i: number }>,
    distances: number[],
    vertices: Vec3[],
    faces: Face[],
    vertexMap: Map<string, number>
  ): void {
    // Simple polygonization: find edge midpoints where surface crosses
    const edgeVertices: (number | null)[] = new Array(12).fill(null);
    const edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ];

    for (let e = 0; e < edges.length; e++) {
      const [i1, i2] = edges[e];
      const d1 = distances[i1];
      const d2 = distances[i2];

      if ((d1 < 0) !== (d2 < 0)) {
        // Surface crosses this edge
        const t = -d1 / (d2 - d1);
        const p1 = corners[i1].p;
        const p2 = corners[i2].p;
        const intersect: Vec3 = {
          x: p1.x + t * (p2.x - p1.x),
          y: p1.y + t * (p2.y - p1.y),
          z: p1.z + t * (p2.z - p1.z),
        };

        const key = `${intersect.x.toFixed(3)},${intersect.y.toFixed(3)},${intersect.z.toFixed(3)}`;
        if (!vertexMap.has(key)) {
          edgeVertices[e] = vertices.length;
          vertexMap.set(key, vertices.length);
          vertices.push(intersect);
        } else {
          edgeVertices[e] = vertexMap.get(key)!;
        }
      }
    }

    // Create triangles from edge vertices
    const activeVertices = edgeVertices.filter(
      (v) => v !== null
    ) as number[];
    if (activeVertices.length >= 3) {
      for (let i = 1; i < activeVertices.length - 1; i++) {
        faces.push({
          a: activeVertices[0],
          b: activeVertices[i],
          c: activeVertices[i + 1],
        });
      }
    }
  }

  private computeNormals(
    vertices: Float32Array,
    faces: Face[]
  ): Float32Array {
    const normals = new Float32Array(vertices.length);

    for (const face of faces) {
      const v0 = {
        x: vertices[face.a * 3],
        y: vertices[face.a * 3 + 1],
        z: vertices[face.a * 3 + 2],
      };
      const v1 = {
        x: vertices[face.b * 3],
        y: vertices[face.b * 3 + 1],
        z: vertices[face.b * 3 + 2],
      };
      const v2 = {
        x: vertices[face.c * 3],
        y: vertices[face.c * 3 + 1],
        z: vertices[face.c * 3 + 2],
      };

      // Compute face normal
      const e1 = { x: v1.x - v0.x, y: v1.y - v0.y, z: v1.z - v0.z };
      const e2 = { x: v2.x - v0.x, y: v2.y - v0.y, z: v2.z - v0.z };

      const nx = e1.y * e2.z - e1.z * e2.y;
      const ny = e1.z * e2.x - e1.x * e2.z;
      const nz = e1.x * e2.y - e1.y * e2.x;

      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len > 0) {
        for (const vi of [face.a, face.b, face.c]) {
          normals[vi * 3] += nx / len;
          normals[vi * 3 + 1] += ny / len;
          normals[vi * 3 + 2] += nz / len;
        }
      }
    }

    // Normalize
    for (let i = 0; i < normals.length; i += 3) {
      const len = Math.sqrt(
        normals[i] * normals[i] +
          normals[i + 1] * normals[i + 1] +
          normals[i + 2] * normals[i + 2]
      );
      if (len > 0) {
        normals[i] /= len;
        normals[i + 1] /= len;
        normals[i + 2] /= len;
      }
    }

    return normals;
  }
}
