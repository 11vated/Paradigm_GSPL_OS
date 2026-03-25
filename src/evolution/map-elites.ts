/**
 * map-elites.ts — MAP-Elites Quality-Diversity Algorithm
 * Illuminates a solution space by maintaining a grid of behavioral niches.
 * Each cell contains the best solution found for that behavior descriptor.
 */

import type { GeneMap, UniversalSeed, FitnessVector } from '../kernel/index.js';
import { DeterministicRNG } from '../kernel/rng.js';
import { mutate } from '../kernel/operators.js';

/**
 * A single behavior dimension in the feature space
 */
export interface BehaviorDimension {
  /**
   * Human-readable name
   */
  name: string;

  /**
   * Minimum value for this dimension
   */
  min: number;

  /**
   * Maximum value for this dimension
   */
  max: number;

  /**
   * Number of bins/cells along this dimension
   */
  resolution: number;

  /**
   * Function to extract behavior value from a seed
   */
  extract: (seed: UniversalSeed) => number;
}

/**
 * Configuration for MAP-Elites
 */
export interface MapElitesConfig {
  /**
   * Behavior dimensions that define the grid
   */
  dimensions: BehaviorDimension[];

  /**
   * Number of seeds to generate per iteration
   */
  batchSize: number;

  /**
   * Mutation rate for generating variants
   */
  mutationRate: number;

  /**
   * Mutation intensity (0-1)
   */
  mutationIntensity: number;

  /**
   * Maximum number of iterations
   */
  maxIterations: number;
}

/**
 * Information about a cell in the grid
 */
export interface CellInfo {
  /**
   * The best seed found for this cell
   */
  seed: UniversalSeed;

  /**
   * Its fitness (aggregate score)
   */
  fitness: number;

  /**
   * Grid coordinates of this cell
   */
  coordinates: number[];

  /**
   * Raw behavior values that mapped to this cell
   */
  behaviorValues: number[];

  /**
   * Iteration when this cell was first filled
   */
  addedAt: number;
}

/**
 * Result of MAP-Elites run
 */
export interface MapElitesResult {
  /**
   * Total iterations completed
   */
  totalIterations: number;

  /**
   * Fraction of grid cells filled (0-1)
   */
  coverage: number;

  /**
   * Quality-Diversity score: sum of fitness across all cells
   */
  qdScore: number;

  /**
   * Best fitness value found
   */
  bestFitness: number;

  /**
   * Number of occupied cells
   */
  cellCount: number;
}

/**
 * MAP-Elites algorithm implementation
 */
export class MapElites<T extends GeneMap = GeneMap> {
  private grid: Map<string, CellInfo>;
  private dimensions: BehaviorDimension[];
  private iteration: number;
  private config: MapElitesConfig;

  constructor(config: MapElitesConfig) {
    if (config.dimensions.length === 0) {
      throw new Error('MAP-Elites requires at least one behavior dimension');
    }

    this.config = config;
    this.dimensions = config.dimensions;
    this.grid = new Map();
    this.iteration = 0;
  }

  /**
   * Initialize the map with a seed population
   */
  initialize(seeds: UniversalSeed<T>[], fitness: (seed: UniversalSeed<T>) => FitnessVector): void {
    for (const seed of seeds) {
      const fitnessVector = fitness(seed);
      const seedWithFitness = { ...seed, $fitness: fitnessVector };

      const behaviorValues = this.dimensions.map(dim => dim.extract(seedWithFitness));
      const coords = this.behaviorToCoords(behaviorValues);
      const key = this.coordsToKey(coords);

      const cellInfo: CellInfo = {
        seed: seedWithFitness,
        fitness: fitnessVector.aggregate ?? 0,
        coordinates: coords,
        behaviorValues,
        addedAt: 0,
      };

      this.grid.set(key, cellInfo);
    }
  }

  /**
   * Run one iteration: select random cell, mutate, evaluate, place if better
   */
  step(fitness: (seed: UniversalSeed<T>) => FitnessVector, rng: DeterministicRNG): {
    placed: boolean;
    cell: string;
  } {
    // If grid is empty, return false
    if (this.grid.size === 0) {
      return { placed: false, cell: '' };
    }

    // Select random occupied cell
    const occupiedCells = Array.from(this.grid.keys());
    const selectedKey = occupiedCells[rng.nextInt(0, occupiedCells.length - 1)];
    const selectedCell = this.grid.get(selectedKey)!;

    // Mutate the seed using kernel operators
    const mutated = mutate(selectedCell.seed, { rate: 0.3, intensity: 0.2 }, rng) as UniversalSeed<T>;

    // Evaluate
    const fitnessVector = fitness(mutated);
    const mutatedWithFitness: UniversalSeed<T> = { ...mutated, $fitness: fitnessVector } as UniversalSeed<T>;

    // Get behavior and map to cell
    const behaviorValues = this.dimensions.map(dim => dim.extract(mutatedWithFitness));
    const coords = this.behaviorToCoords(behaviorValues);
    const cellKey = this.coordsToKey(coords);

    // Check if this seed improves the cell
    let placed = false;
    const existingCell = this.grid.get(cellKey);

    if (!existingCell || (fitnessVector.aggregate ?? 0) > existingCell.fitness) {
      const cellInfo: CellInfo = {
        seed: mutatedWithFitness,
        fitness: fitnessVector.aggregate ?? 0,
        coordinates: coords,
        behaviorValues,
        addedAt: this.iteration,
      };

      this.grid.set(cellKey, cellInfo);
      placed = true;
    }

    this.iteration++;

    return { placed, cell: cellKey };
  }

  /**
   * Run multiple iterations
   */
  run(
    fitness: (seed: UniversalSeed<T>) => FitnessVector,
    iterations: number,
    rng: DeterministicRNG
  ): MapElitesResult {
    for (let i = 0; i < iterations; i++) {
      this.step(fitness, rng);
    }

    return this.getResult();
  }

  /**
   * Get the seed at a specific behavior coordinate
   */
  getCell(coordinates: number[]): CellInfo | undefined {
    const key = this.coordsToKey(coordinates);
    return this.grid.get(key);
  }

  /**
   * Get all occupied cells
   */
  allCells(): CellInfo[] {
    return Array.from(this.grid.values());
  }

  /**
   * Coverage: fraction of cells that are occupied
   */
  coverage(): number {
    const totalCells = this.dimensions.reduce((prod, dim) => prod * dim.resolution, 1);
    return this.grid.size / totalCells;
  }

  /**
   * QD-Score: sum of fitness values across all occupied cells
   */
  qdScore(): number {
    let sum = 0;
    for (const cell of this.grid.values()) {
      sum += cell.fitness;
    }
    return sum;
  }

  /**
   * Get the best seed in the entire map
   */
  best(): CellInfo | undefined {
    let bestCell: CellInfo | undefined = undefined;

    for (const cell of this.grid.values()) {
      if (!bestCell || cell.fitness > bestCell.fitness) {
        bestCell = cell;
      }
    }

    return bestCell;
  }

  /**
   * Get result statistics
   */
  private getResult(): MapElitesResult {
    const cells = Array.from(this.grid.values());
    const bestFitness = cells.length > 0 ? Math.max(...cells.map(c => c.fitness)) : 0;

    return {
      totalIterations: this.iteration,
      coverage: this.coverage(),
      qdScore: this.qdScore(),
      bestFitness,
      cellCount: this.grid.size,
    };
  }

  /**
   * Convert behavior values to grid coordinates
   */
  private behaviorToCoords(values: number[]): number[] {
    if (values.length !== this.dimensions.length) {
      throw new Error(
        `Behavior dimension mismatch: got ${values.length}, expected ${this.dimensions.length}`
      );
    }

    const coords: number[] = [];

    for (let i = 0; i < values.length; i++) {
      const dim = this.dimensions[i];
      const value = Math.max(dim.min, Math.min(dim.max, values[i]));
      const normalized = (value - dim.min) / (dim.max - dim.min);
      const binIndex = Math.floor(normalized * dim.resolution);
      const clampedBin = Math.max(0, Math.min(dim.resolution - 1, binIndex));

      coords.push(clampedBin);
    }

    return coords;
  }

  /**
   * Serialize coordinates to map key
   */
  private coordsToKey(coords: number[]): string {
    return coords.join(',');
  }
}

/**
 * Convenient factory function to create and run MAP-Elites
 */
export function runMapElites<T extends GeneMap = GeneMap>(
  config: MapElitesConfig,
  initialSeeds: UniversalSeed<T>[],
  fitness: (seed: UniversalSeed<T>) => FitnessVector,
  rng: DeterministicRNG
): MapElitesResult {
  const mapElites = new MapElites<T>(config);
  mapElites.initialize(initialSeeds, fitness);
  return mapElites.run(fitness, config.maxIterations, rng);
}
