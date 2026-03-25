/**
 * game/engine.ts — Game World Generation Engine
 * Generates complete game world configurations, entity systems, and level data from seeds.
 * Supports multiple genres: platformer, RPG, puzzle, roguelike, sandbox, strategy.
 */

import {
  UniversalSeed,
  createSeed,
  type SeedDomain,
  type FitnessVector,
  type GeneMap,
} from '../../kernel/seed.js';
import {
  scalar,
  categorical,
  vector,
  struct,
  type Gene,
} from '../../kernel/genes.js';
import { DeterministicRNG } from '../../kernel/rng.js';
import {
  DomainEngine,
  type DevelopmentalStage,
  type DevelopmentalContext,
} from '../engine.js';

// ============================================================================
// GAME WORLD TYPES
// ============================================================================

export interface Tile {
  id: number;
  name: string;
  walkable: boolean;
  hazard?: boolean;
}

export interface GameEntity {
  type: string;
  x: number;
  y: number;
  properties: Record<string, unknown>;
}

export interface GameLayer {
  name: string;
  grid: number[][];
  tileset: Record<number, string>;
}

export interface GameWorldData {
  metadata: {
    genre: string;
    width: number;
    height: number;
    tileSize: number;
  };
  layers: GameLayer[];
  entities: GameEntity[];
  connections: Record<string, [number, number]>;
  physics: {
    gravity: number;
    friction: number;
  };
}

// ============================================================================
// GAME ENGINE CLASS
// ============================================================================

export class GameEngine extends DomainEngine {
  readonly domain: SeedDomain = 'game';
  readonly name = 'Game World Generation Engine';
  readonly version = '1.0.0';

  defaultGenes(): GeneMap {
    return {
      genre: categorical('platformer', [
        'platformer',
        'rpg',
        'puzzle',
        'roguelike',
        'sandbox',
        'strategy',
      ]),
      worldWidth: scalar(100, 20, 500, { mutable: true }),
      worldHeight: scalar(50, 20, 500, { mutable: true }),
      tileSize: scalar(16, 8, 64, { mutable: true }),
      biomeCount: scalar(2, 1, 8, { mutable: true }),
      entityDensity: scalar(0.3, 0, 1, { mutable: true }),
      difficulty: scalar(0.5, 0, 1, { mutable: true }),
      interactivity: scalar(0.5, 0, 1, { mutable: true }),
      verticalLayers: scalar(3, 1, 5, { mutable: true }),
      spawnRate: scalar(0.4, 0, 1, { mutable: true }),
      pathComplexity: scalar(0.5, 0, 1, { mutable: true }),
      resourceDistribution: categorical('clustered', [
        'uniform',
        'clustered',
        'gradient',
        'random',
      ]),
      palette: struct({
        ground: vector([100, 150, 80], { mutable: true }),
        wall: vector([80, 80, 80], { mutable: true }),
        sky: vector([135, 206, 235], { mutable: true }),
        accent: vector([255, 165, 0], { mutable: true }),
      }),
      gravity: scalar(1.0, 0, 2, { mutable: true }),
      friction: scalar(0.3, 0, 1, { mutable: true }),
    };
  }

  stages(): DevelopmentalStage[] {
    return [
      { name: 'Terrain', description: 'Generate base terrain grid', execute: (ctx) => this.stageTerrain(ctx) },
      { name: 'Biomes', description: 'Assign biome types to regions', execute: (ctx) => this.stageBiomes(ctx) },
      { name: 'Structures', description: 'Place structures and landmarks', execute: (ctx) => this.stageStructures(ctx) },
      { name: 'Entities', description: 'Spawn entities and NPCs', execute: (ctx) => this.stageEntities(ctx) },
      { name: 'Paths', description: 'Generate navigation paths and connectivity', execute: (ctx) => this.stagePaths(ctx) },
      { name: 'Export', description: 'Output complete level data', execute: (ctx) => this.stageExport(ctx) },
    ];
  }

  evaluate(seed: UniversalSeed): FitnessVector {
    return {
      scores: {
        dimension: (seed.genes.worldWidth as any).value * (seed.genes.worldHeight as any).value,
        complexity: (seed.genes.pathComplexity as any).value,
      },
      aggregate: 0.75,
      evaluatedAt: Date.now(),
    };
  }

  // ============================================================================
  // DEVELOPMENTAL STAGES
  // ============================================================================

  private stageTerrain(ctx: DevelopmentalContext): DevelopmentalContext {
    const width = Math.floor((ctx.seed.genes.worldWidth as any).value);
    const height = Math.floor((ctx.seed.genes.worldHeight as any).value);
    const genre = (ctx.seed.genes.genre as any).value;

    const grid: number[][] = [];

    if (genre === 'platformer') {
      // Generate platformer terrain with height variation
      for (let y = 0; y < height; y++) {
        const row: number[] = [];
        for (let x = 0; x < width; x++) {
          const groundLevel = Math.floor(height * 0.7);
          const noiseVal = this.perlinNoise(ctx.rng, x, y, 5);
          const variation = Math.sin(noiseVal * Math.PI) * 5;

          if (y > groundLevel + variation) {
            row.push(1); // Ground
          } else if (y > groundLevel + variation - 2) {
            row.push(1); // Dirt
          } else {
            row.push(0); // Air
          }
        }
        grid.push(row);
      }
    } else if (genre === 'rpg' || genre === 'roguelike') {
      // Room-based generation
      for (let y = 0; y < height; y++) {
        const row: number[] = [];
        for (let x = 0; x < width; x++) {
          row.push(1); // Start with solid
        }
        grid.push(row);
      }
      // Carve out rooms
      this.carveRooms(ctx.rng, grid, width, height);
    } else {
      // Default fill terrain
      for (let y = 0; y < height; y++) {
        const row: number[] = [];
        for (let x = 0; x < width; x++) {
          const groundLevel = Math.floor(height * 0.6);
          row.push(y >= groundLevel ? 1 : 0);
        }
        grid.push(row);
      }
    }

    ctx.artifacts.set('terrainGrid', grid);
    ctx.parameters.width = width;
    ctx.parameters.height = height;
    ctx.parameters.genre = genre;

    return ctx;
  }

  private stageBiomes(ctx: DevelopmentalContext): DevelopmentalContext {
    const width = ctx.parameters.width as number;
    const height = ctx.parameters.height as number;
    const biomeCount = Math.floor((ctx.seed.genes.biomeCount as any).value);

    // Simple biome assignment using Voronoi partitioning
    const biomeGrid: number[][] = [];
    const biomeCenters: Array<[number, number, number]> = [];

    for (let i = 0; i < biomeCount; i++) {
      biomeCenters.push([
        ctx.rng.nextInt(0, width - 1),
        ctx.rng.nextInt(0, height - 1),
        i,
      ]);
    }

    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        let closestBiome = 0;
        let minDist = Infinity;

        for (const [cx, cy, biomeId] of biomeCenters) {
          const dist = Math.hypot(x - cx, y - cy);
          if (dist < minDist) {
            minDist = dist;
            closestBiome = biomeId;
          }
        }

        row.push(closestBiome);
      }
      biomeGrid.push(row);
    }

    ctx.artifacts.set('biomeGrid', biomeGrid);
    ctx.parameters.biomeCenters = biomeCenters;

    return ctx;
  }

  private stageStructures(ctx: DevelopmentalContext): DevelopmentalContext {
    const terrainGrid = ctx.artifacts.get('terrainGrid') as number[][];
    const width = ctx.parameters.width as number;
    const height = ctx.parameters.height as number;
    const genre = ctx.parameters.genre as string;

    if (genre === 'platformer') {
      // Add platforms and gaps
      for (let i = 0; i < Math.floor(width / 10); i++) {
        const platformX = ctx.rng.nextInt(5, width - 15);
        const platformY = ctx.rng.nextInt(10, height - 20);
        const platformLength = ctx.rng.nextInt(5, 15);

        for (let j = 0; j < platformLength; j++) {
          if (platformX + j < width && platformY < height) {
            terrainGrid[platformY][platformX + j] = 1;
          }
        }
      }
    } else if (genre === 'rpg' || genre === 'roguelike') {
      // Add doors and decorative elements
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (
            terrainGrid[y][x] === 0 &&
            ctx.rng.nextBool(0.02)
          ) {
            terrainGrid[y][x] = 4; // Door placeholder
          }
        }
      }
    }

    ctx.artifacts.set('terrainGrid', terrainGrid);
    return ctx;
  }

  private stageEntities(ctx: DevelopmentalContext): DevelopmentalContext {
    const terrainGrid = ctx.artifacts.get('terrainGrid') as number[][];
    const width = ctx.parameters.width as number;
    const height = ctx.parameters.height as number;
    const entityDensity = (ctx.seed.genes.entityDensity as any).value;
    const difficulty = (ctx.seed.genes.difficulty as any).value;
    const spawnRate = (ctx.seed.genes.spawnRate as any).value;

    const entities: GameEntity[] = [];

    // Find valid spawn point
    let spawnX = 2,
      spawnY = height - 5;
    for (let y = height - 5; y < height; y++) {
      for (let x = 2; x < width - 2; x++) {
        if (terrainGrid[y][x] === 1 && (terrainGrid[y - 1]?.[x] ?? 0) === 0) {
          spawnX = x;
          spawnY = y - 1;
          break;
        }
      }
    }

    // Player spawn
    entities.push({
      type: 'player_spawn',
      x: spawnX,
      y: spawnY,
      properties: {},
    });

    // Spawn enemies
    const maxEnemies = Math.floor((width * height * entityDensity * spawnRate) / 100);
    for (let i = 0; i < maxEnemies; i++) {
      let x = ctx.rng.nextInt(5, width - 5);
      let y = ctx.rng.nextInt(5, height - 10);

      // Find walkable ground
      while (y > 0 && terrainGrid[y][x] === 0) {
        y++;
      }

      if (y < height) {
        const hp = Math.max(1, Math.floor(3 + difficulty * 4));
        entities.push({
          type: 'enemy',
          x,
          y: y - 1,
          properties: {
            hp,
            behavior: ctx.rng.pick(['patrol', 'chase']),
          },
        });
      }
    }

    // Spawn collectibles
    const maxItems = Math.floor(maxEnemies * 1.5);
    for (let i = 0; i < maxItems; i++) {
      let x = ctx.rng.nextInt(5, width - 5);
      let y = ctx.rng.nextInt(5, height - 5);

      while (y > 0 && terrainGrid[y][x] === 0) {
        y++;
      }

      if (y < height) {
        entities.push({
          type: 'collectible',
          x,
          y: y - 1,
          properties: {
            value: ctx.rng.nextInt(5, 25),
            kind: ctx.rng.pick(['coin', 'gem', 'key']),
          },
        });
      }
    }

    ctx.artifacts.set('entities', entities);
    ctx.parameters.spawnX = spawnX;
    ctx.parameters.spawnY = spawnY;

    return ctx;
  }

  private stagePaths(ctx: DevelopmentalContext): DevelopmentalContext {
    const terrainGrid = ctx.artifacts.get('terrainGrid') as number[][];
    const width = ctx.parameters.width as number;
    const height = ctx.parameters.height as number;

    // Find exit point (far from spawn)
    let exitX = width - 5,
      exitY = height - 5;
    for (let y = height - 5; y < height; y++) {
      for (let x = width - 5; x >= width - 15; x--) {
        if (terrainGrid[y][x] === 1 && (terrainGrid[y - 1]?.[x] ?? 0) === 0) {
          exitX = x;
          exitY = y - 1;
          break;
        }
      }
    }

    ctx.parameters.exitX = exitX;
    ctx.parameters.exitY = exitY;

    return ctx;
  }

  private stageExport(ctx: DevelopmentalContext): DevelopmentalContext {
    const terrainGrid = ctx.artifacts.get('terrainGrid') as number[][];
    const entities = ctx.artifacts.get('entities') as GameEntity[];
    const width = ctx.parameters.width as number;
    const height = ctx.parameters.height as number;
    const genre = ctx.parameters.genre as string;
    const tileSize = Math.floor((ctx.seed.genes.tileSize as any).value);
    const gravity = (ctx.seed.genes.gravity as any).value;
    const friction = (ctx.seed.genes.friction as any).value;

    const tileMap: Record<number, string> = {
      0: 'air',
      1: 'ground',
      2: 'wall',
      3: 'platform',
      4: 'water',
      5: 'hazard',
    };

    const gameWorld: GameWorldData = {
      metadata: {
        genre,
        width,
        height,
        tileSize,
      },
      layers: [
        {
          name: 'terrain',
          grid: terrainGrid,
          tileset: tileMap,
        },
      ],
      entities,
      connections: {
        entrance: [ctx.parameters.spawnX as number, ctx.parameters.spawnY as number],
        exit: [ctx.parameters.exitX as number, ctx.parameters.exitY as number],
      },
      physics: {
        gravity,
        friction,
      },
    };

    ctx.artifacts.set('gameWorldData', gameWorld);

    return ctx;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private perlinNoise(rng: DeterministicRNG, x: number, y: number, scale: number): number {
    // Simple noise using multiple sine waves
    return (
      Math.sin(x / scale) * Math.cos(y / scale) +
      0.5 * Math.sin(x / (scale * 2)) * Math.cos(y / (scale * 2))
    );
  }

  private carveRooms(rng: DeterministicRNG, grid: number[][], width: number, height: number): void {
    // Simple BSP room carving
    const roomCount = Math.max(3, Math.floor(width * height / 500));

    for (let i = 0; i < roomCount; i++) {
      const roomWidth = rng.nextInt(8, Math.floor(width / 3));
      const roomHeight = rng.nextInt(8, Math.floor(height / 3));
      const roomX = rng.nextInt(1, width - roomWidth - 1);
      const roomY = rng.nextInt(1, height - roomHeight - 1);

      // Carve out the room
      for (let y = roomY; y < roomY + roomHeight; y++) {
        for (let x = roomX; x < roomX + roomWidth; x++) {
          if (y < grid.length && x < grid[y].length) {
            grid[y][x] = 0; // Empty
          }
        }
      }
    }
  }
}
