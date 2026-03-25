/**
 * procedural/engine.ts — Procedural Generation Engine
 * Generates procedural content: terrain, textures, worlds.
 * Pipeline: Noise Foundation → Erosion/Weathering → Biome Assignment → Feature Placement → Detail Pass
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
// GENE SCHEMA FOR PROCEDURAL GENERATION
// ============================================================================

const PROCEDURAL_GENES = {
  // Terrain
  terrainType: categorical('mountain', [
    'mountain',
    'valley',
    'island',
    'plateau',
    'fractal',
  ]),
  scale: scalar(100, 10, 500),
  octaves: scalar(6, 1, 12),
  persistence: scalar(0.5, 0.1, 0.9),
  lacunarity: scalar(2, 1.5, 4),

  // Erosion
  erosionStrength: scalar(0.3, 0, 1),
  waterLevel: scalar(0.4, 0, 1),
  temperatureVariance: scalar(0.5, 0, 1),

  // Biome
  biomeCount: scalar(4, 1, 8),
  biomeComplexity: scalar(0.5, 0, 1),

  // Features
  featureDensity: scalar(0.3, 0, 1),
  featureType: categorical('mixed', [
    'mixed',
    'trees',
    'rocks',
    'structures',
  ]),

  // Detail
  detailScale: scalar(0.5, 0.1, 2),
  randomVariation: scalar(0.5, 0, 1),
};

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface HeightMap {
  width: number;
  height: number;
  data: Float32Array;
}

interface BiomeMap {
  width: number;
  height: number;
  data: Uint8Array;
}

interface Feature {
  x: number;
  y: number;
  type: string;
  size: number;
  rotation: number;
  properties: Record<string, number>;
}

// ============================================================================
// PROCEDURAL ENGINE IMPLEMENTATION
// ============================================================================

export class ProceduralEngine extends DomainEngine {
  readonly domain: SeedDomain = 'procedural';
  readonly name = 'Procedural Engine';
  readonly version = '1.0.0';

  defaultGenes(): GeneMap {
    return PROCEDURAL_GENES;
  }

  /**
   * Safely extract gene value with fallback to defaults
   * Handles both proper Gene objects and raw scalar values
   */
  protected getGeneValue(key: string, genes: GeneMap, defaultValue?: any): any {
    const gene = genes[key];
    if (!gene) {
      const defaultGene = this.defaultGenes()[key];
      return defaultGene ? (defaultGene as any).value : defaultValue;
    }
    // Handle both Gene objects with .value property and raw values
    const val = (gene as any).value !== undefined ? (gene as any).value : (gene as any);
    return val !== null && val !== undefined ? val : defaultValue;
  }

  stages(): DevelopmentalStage[] {
    return [
      {
        name: 'Noise Foundation',
        description: 'Generate base noise maps (Perlin, Simplex, Worley)',
        execute: this.stageNoiseFoundation.bind(this),
      },
      {
        name: 'Erosion/Weathering',
        description: 'Simulate natural processes',
        execute: this.stageErosion.bind(this),
      },
      {
        name: 'Biome Assignment',
        description: 'Map elevation/moisture to biomes',
        execute: this.stageBiomeAssignment.bind(this),
      },
      {
        name: 'Feature Placement',
        description: 'Place landmarks, structures, resources',
        execute: this.stageFeaturePlacement.bind(this),
      },
      {
        name: 'Detail Pass',
        description: 'Add small-scale variation',
        execute: this.stageDetailPass.bind(this),
      },
    ];
  }

  evaluate(seed: UniversalSeed): FitnessVector {
    const octaves = (seed.genes.octaves as any).value ?? 0;
    const featureDensity = (seed.genes.featureDensity as any).value ?? 0;

    const scores = {
      complexity: Math.min(octaves / 12, 1) * 0.6,
      richness: featureDensity * 0.4,
    };

    return {
      scores,
      aggregate: scores.complexity + scores.richness,
      evaluatedAt: Date.now(),
    };
  }

  // ========================================================================
  // DEVELOPMENTAL STAGES
  // ========================================================================

  private stageNoiseFoundation(
    context: DevelopmentalContext
  ): DevelopmentalContext {
    const genes = context.seed.genes;
    const scale = Math.round(this.getGeneValue('scale', genes, 100));
    const octaves = Math.round(this.getGeneValue('octaves', genes, 6));
    const persistence = this.getGeneValue('persistence', genes, 0.5);
    const lacunarity = this.getGeneValue('lacunarity', genes, 2);
    const terrainType = this.getGeneValue('terrainType', genes, 'mountain');

    // Generate heightmap using Perlin-like noise
    const heightMap: HeightMap = {
      width: scale,
      height: scale,
      data: new Float32Array(scale * scale),
    };

    for (let y = 0; y < scale; y++) {
      for (let x = 0; x < scale; x++) {
        const value = this.perlinNoise(
          x,
          y,
          octaves,
          persistence,
          lacunarity,
          context.rng
        );
        let height = value;

        // Apply terrain type modulation
        if (terrainType === 'mountain') {
          height = Math.pow(Math.abs(height), 0.8) * Math.sign(height);
        } else if (terrainType === 'valley') {
          height = -Math.pow(Math.abs(height), 0.8) * Math.sign(height);
        } else if (terrainType === 'island') {
          height = Math.max(
            0,
            height - Math.sqrt(x * x + y * y) / scale * 0.5
          );
        }

        heightMap.data[y * scale + x] = height;
      }
    }

    context.artifacts.set('heightMap', heightMap);
    return context;
  }

  private stageErosion(context: DevelopmentalContext): DevelopmentalContext {
    const genes = context.seed.genes;
    const erosionStrength = this.getGeneValue('erosionStrength', genes, 0.3);
    const heightMap = context.artifacts.get('heightMap') as HeightMap;

    // Simple hydraulic erosion simulation
    const eroded = this.applyHydraulicErosion(
      heightMap,
      erosionStrength,
      context
    );

    context.artifacts.set('heightMap', eroded);
    return context;
  }

  private stageBiomeAssignment(
    context: DevelopmentalContext
  ): DevelopmentalContext {
    const genes = context.seed.genes;
    const heightMap = context.artifacts.get('heightMap') as HeightMap;
    const waterLevel = this.getGeneValue('waterLevel', genes, 0.4);
    const tempVariance = this.getGeneValue('temperatureVariance', genes, 0.5);
    const biomeCount = Math.round(this.getGeneValue('biomeCount', genes, 4));

    const biomeMap: BiomeMap = {
      width: heightMap.width,
      height: heightMap.height,
      data: new Uint8Array(heightMap.width * heightMap.height),
    };

    for (let i = 0; i < heightMap.data.length; i++) {
      const height = heightMap.data[i];
      const moisture = context.rng.nextFloat(0, 1);
      const temperature =
        (1 - Math.abs(height)) * (1 - tempVariance) +
        context.rng.nextFloat(0, tempVariance);

      let biome = 0; // ocean

      if (height > waterLevel) {
        // Land biomes
        if (height < waterLevel + 0.1) {
          biome = 1; // beach
        } else if (height < 0.3) {
          if (moisture > 0.6) {
            biome = 2; // forest
          } else {
            biome = 3; // grassland
          }
        } else if (height < 0.6) {
          if (temperature > 0.7) {
            biome = 4; // desert
          } else {
            biome = 5; // plains
          }
        } else {
          biome = 6; // mountain
        }

        if (height > 0.8) {
          biome = 7; // snow
        }
      }

      biomeMap.data[i] = Math.min(biome, biomeCount - 1);
    }

    context.artifacts.set('biomeMap', biomeMap);
    return context;
  }

  private stageFeaturePlacement(
    context: DevelopmentalContext
  ): DevelopmentalContext {
    const genes = context.seed.genes;
    const featureDensity = this.getGeneValue('featureDensity', genes, 0.3);
    const featureType = this.getGeneValue('featureType', genes, 'mixed');
    const heightMap = context.artifacts.get('heightMap') as HeightMap;
    const biomeMap = context.artifacts.get('biomeMap') as BiomeMap;

    const features: Feature[] = [];
    const featureCount = Math.round(
      heightMap.width * heightMap.height * featureDensity * 0.01
    );

    for (let i = 0; i < featureCount; i++) {
      const x = context.rng.nextInt(0, heightMap.width - 1);
      const y = context.rng.nextInt(0, heightMap.height - 1);
      const idx = y * heightMap.width + x;
      const height = heightMap.data[idx];
      const biome = biomeMap.data[idx];

      if (height > -0.5 && height < 0.9) {
        let fType = 'generic';
        if (featureType === 'trees' || featureType === 'mixed') {
          if (biome === 2) fType = 'tree';
        }
        if (featureType === 'rocks' || featureType === 'mixed') {
          if (biome === 6) fType = 'rock';
        }
        if (featureType === 'structures' || featureType === 'mixed') {
          if (biome === 3 || biome === 5) fType = 'structure';
        }

        features.push({
          x,
          y,
          type: fType,
          size: context.rng.nextFloat(0.5, 2),
          rotation: context.rng.nextFloat(0, 360),
          properties: {
            density: height,
            moisture: context.rng.nextFloat(0, 1),
          },
        });
      }
    }

    context.artifacts.set('features', features);
    return context;
  }

  private stageDetailPass(context: DevelopmentalContext): DevelopmentalContext {
    const genes = context.seed.genes;
    const detailScale = this.getGeneValue('detailScale', genes, 0.5);
    const heightMap = context.artifacts.get('heightMap') as HeightMap;

    // Add detail variation using higher-frequency noise
    for (let i = 0; i < heightMap.data.length; i++) {
      const noise = context.rng.nextGaussian(0, detailScale * 0.05);
      heightMap.data[i] += noise;
    }

    // Compute statistics
    let minHeight = heightMap.data[0];
    let maxHeight = heightMap.data[0];
    let avgHeight = 0;

    for (let i = 0; i < heightMap.data.length; i++) {
      minHeight = Math.min(minHeight, heightMap.data[i]);
      maxHeight = Math.max(maxHeight, heightMap.data[i]);
      avgHeight += heightMap.data[i];
    }

    avgHeight /= heightMap.data.length;

    const statistics = {
      minHeight,
      maxHeight,
      avgHeight,
      range: maxHeight - minHeight,
    };

    context.artifacts.set('statistics', statistics);
    return context;
  }

  // ========================================================================
  // NOISE & EROSION FUNCTIONS
  // ========================================================================

  /**
   * Perlin-like noise using improved gradients
   */
  private perlinNoise(
    x: number,
    y: number,
    octaves: number,
    persistence: number,
    lacunarity: number,
    rng: any
  ): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      const sampleX = x * frequency;
      const sampleY = y * frequency;

      const value = this.improvedPerlinNoise(
        Math.floor(sampleX),
        Math.floor(sampleY),
        sampleX - Math.floor(sampleX),
        sampleY - Math.floor(sampleY)
      );

      total += value * amplitude;
      maxValue += amplitude;

      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  /**
   * Improved Perlin noise with smooth interpolation
   */
  private improvedPerlinNoise(
    xi: number,
    yi: number,
    xf: number,
    yf: number
  ): number {
    // Hash the grid coordinates
    const n00 = this.perlinGradient(xi, yi);
    const n10 = this.perlinGradient(xi + 1, yi);
    const n01 = this.perlinGradient(xi, yi + 1);
    const n11 = this.perlinGradient(xi + 1, yi + 1);

    // Compute dot products with distance vectors
    const g00 = n00 * xf + n00 * yf;
    const g10 = n10 * (xf - 1) + n10 * yf;
    const g01 = n01 * xf + n01 * (yf - 1);
    const g11 = n11 * (xf - 1) + n11 * (yf - 1);

    // Smooth interpolation
    const u = this.smootherstep(xf);
    const v = this.smootherstep(yf);

    const nx0 = this.lerp(g00, g10, u);
    const nx1 = this.lerp(g01, g11, u);
    return this.lerp(nx0, nx1, v);
  }

  private perlinGradient(xi: number, yi: number): number {
    // Pseudo-random gradient
    const h = ((xi * 73856093) ^ (yi * 19349663)) % 256;
    return (h % 2 === 0 ? 1 : -1) * 0.5 + 0.5;
  }

  private smootherstep(t: number): number {
    // Smootherstep interpolation (5th order)
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Simple hydraulic erosion simulation
   */
  private applyHydraulicErosion(
    heightMap: HeightMap,
    strength: number,
    context: DevelopmentalContext
  ): HeightMap {
    const result: HeightMap = {
      width: heightMap.width,
      height: heightMap.height,
      data: new Float32Array(heightMap.data),
    };

    const iterations = Math.max(1, Math.round(strength * 5));

    for (let iter = 0; iter < iterations; iter++) {
      // Random drops of water
      for (let drop = 0; drop < result.width * result.height * 0.01; drop++) {
        let x = context.rng.nextInt(
          1,
          result.width - 2
        );
        let y = context.rng.nextInt(1, result.height - 2);

        // Water flows downhill
        for (let step = 0; step < 50; step++) {
          const idx = y * result.width + x;
          const height = result.data[idx];

          // Find lowest neighbor
          let lowest = height;
          let lowestX = x;
          let lowestY = y;

          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx > 0 && nx < result.width - 1 && ny > 0 && ny < result.height - 1) {
                const nidx = ny * result.width + nx;
                if (result.data[nidx] < lowest) {
                  lowest = result.data[nidx];
                  lowestX = nx;
                  lowestY = ny;
                }
              }
            }
          }

          if (lowestX === x && lowestY === y) {
            // Reached a local minimum
            break;
          }

          // Erode along the path
          result.data[idx] -= strength * 0.001;
          x = lowestX;
          y = lowestY;
        }
      }
    }

    return result;
  }
}
