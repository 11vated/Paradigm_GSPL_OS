/**
 * population.ts — Population Management
 * Genetic algorithm with tournament selection, elite preservation, and novelty tracking.
 */

import type { GeneMap, UniversalSeed, FitnessVector } from '../kernel/index.js';
import { DeterministicRNG } from '../kernel/rng.js';
import { mutate, crossover, computeGeneticDistance } from '../kernel/operators.js';

/**
 * Population configuration
 */
export interface PopulationConfig {
  /**
   * Total population size
   */
  size: number;

  /**
   * Number of best seeds to preserve each generation
   */
  eliteCount: number;

  /**
   * Tournament size for selection (number of candidates to pick from)
   */
  tournamentSize: number;

  /**
   * Probability of mutation occurring (0-1)
   */
  mutationRate: number;

  /**
   * Mutation intensity (0-1), how much to mutate
   */
  mutationIntensity: number;

  /**
   * Weight for novelty in combined score (0=pure fitness, 1=pure novelty)
   */
  noveltyWeight: number;

  /**
   * Maximum number of generations
   */
  maxGenerations: number;
}

/**
 * Population statistics
 */
export interface PopulationStats {
  /**
   * Current generation number
   */
  generation: number;

  /**
   * Best fitness value (aggregate) in population
   */
  bestFitness: number;

  /**
   * Average fitness in population
   */
  averageFitness: number;

  /**
   * Worst fitness in population
   */
  worstFitness: number;

  /**
   * Average genetic diversity (pairwise distance)
   */
  diversity: number;

  /**
   * Number of non-dominated solutions (Pareto frontier size)
   */
  frontierSize: number;
}

/**
 * A population of seeds undergoing evolution
 */
export class Population<T extends GeneMap = GeneMap> {
  seeds: UniversalSeed<T>[];
  generation: number;
  noveltyArchive: UniversalSeed<T>[];
  stats: PopulationStats;

  constructor(initialSeeds: UniversalSeed<T>[]) {
    if (initialSeeds.length === 0) {
      throw new Error('Population requires at least one initial seed');
    }

    this.seeds = initialSeeds.map(s => ({ ...s }));
    this.generation = 0;
    this.noveltyArchive = [];
    this.stats = this.computeStats();
  }

  /**
   * Tournament selection: pick tournamentSize random individuals, return the best
   */
  selectParent(config: PopulationConfig, rng: DeterministicRNG): UniversalSeed<T> {
    if (this.seeds.length === 0) {
      throw new Error('Cannot select from empty population');
    }

    const tournamentSize = Math.min(config.tournamentSize, this.seeds.length);
    let best = this.seeds[rng.nextInt(0, this.seeds.length - 1)];

    for (let i = 1; i < tournamentSize; i++) {
      const candidate = this.seeds[rng.nextInt(0, this.seeds.length - 1)];
      const bestFit = best.$fitness?.aggregate ?? 0;
      const candFit = candidate.$fitness?.aggregate ?? 0;

      if (candFit > bestFit) {
        best = candidate;
      }
    }

    return best;
  }

  /**
   * Evolve one generation: evaluate, select, mutate, and create new population
   */
  evolve(
    fitness: (seed: UniversalSeed<T>) => FitnessVector,
    config: PopulationConfig,
    rng: DeterministicRNG
  ): Population<T> {
    // Step 1: Evaluate all seeds
    const evaluatedSeeds = this.seeds.map(seed => {
      if (!seed.$fitness) {
        const fitnessVector = fitness(seed);
        return { ...seed, $fitness: fitnessVector };
      }
      return seed;
    });

    // Step 2: Compute novelty scores
    const noveltyScores = evaluatedSeeds.map(seed => this.noveltyScore(seed, 15));

    // Step 3: Compute combined fitness + novelty scores
    const combinedScores = evaluatedSeeds.map((seed, i) => {
      const fitScore = seed.$fitness?.aggregate ?? 0;
      const novelty = noveltyScores[i];
      return (1 - config.noveltyWeight) * fitScore + config.noveltyWeight * novelty;
    });

    // Step 4: Elite preservation - keep best N seeds
    const sortedIndices = combinedScores
      .map((score, idx) => ({ score, idx }))
      .sort((a, b) => b.score - a.score)
      .slice(0, config.eliteCount)
      .map(item => item.idx);

    const newSeeds: UniversalSeed<T>[] = sortedIndices.map(i => evaluatedSeeds[i]);

    // Step 5: Generate offspring via crossover + mutation to fill rest of population
    while (newSeeds.length < config.size) {
      const parentA = this.selectParent(config, rng);
      let child: UniversalSeed<T>;

      // Crossover with ~80% probability when we have enough seeds
      if (rng.next() < 0.8 && evaluatedSeeds.length >= 2) {
        const parentB = this.selectParent(config, rng);
        child = crossover(parentA, parentB, {
          strategy: 'blend',
          dominance: 0.5,
        }, rng) as UniversalSeed<T>;
      } else {
        child = { ...parentA, $fitness: undefined };
      }

      // Mutate with configured rate
      if (rng.next() < config.mutationRate) {
        child = mutate(child, {
          rate: config.mutationRate,
          intensity: config.mutationIntensity,
        }, rng) as UniversalSeed<T>;
      }

      child = { ...child, $fitness: undefined };
      newSeeds.push(child);
    }

    // Trim to exact size
    newSeeds.length = config.size;

    // Step 6: Update novelty archive — add seeds that are sufficiently novel
    const updatedArchive = [...this.noveltyArchive];
    for (const seed of newSeeds) {
      if (updatedArchive.length < 100) {
        // Check minimum distance to existing archive members
        const isNovel = updatedArchive.length === 0 || updatedArchive.every(
          archived => computeGeneticDistance(seed.genes, archived.genes) > 0.05
        );
        if (isNovel) {
          updatedArchive.push(seed);
        }
      }
    }

    // Create new population
    const newPop = new Population(newSeeds);
    newPop.noveltyArchive = updatedArchive;
    newPop.generation = this.generation + 1;
    newPop.stats = newPop.computeStats();

    return newPop;
  }

  /**
   * Get the N best seeds by fitness
   */
  best(n: number = 1): UniversalSeed<T>[] {
    return this.seeds
      .filter(s => s.$fitness !== undefined)
      .sort((a, b) => (b.$fitness?.aggregate ?? 0) - (a.$fitness?.aggregate ?? 0))
      .slice(0, n);
  }

  /**
   * Compute population statistics
   */
  computeStats(): PopulationStats {
    const evaluatedSeeds = this.seeds.filter(s => s.$fitness !== undefined);

    let bestFitness = -Infinity;
    let worstFitness = Infinity;
    let fitnessSum = 0;

    for (const seed of evaluatedSeeds) {
      const fit = seed.$fitness?.aggregate ?? 0;
      bestFitness = Math.max(bestFitness, fit);
      worstFitness = Math.min(worstFitness, fit);
      fitnessSum += fit;
    }

    const averageFitness =
      evaluatedSeeds.length > 0 ? fitnessSum / evaluatedSeeds.length : 0;

    if (!isFinite(bestFitness)) bestFitness = 0;
    if (!isFinite(worstFitness)) worstFitness = 0;

    // Compute diversity via sampled pairwise genetic distances
    let diversity = 0;
    const sampleSize = Math.min(50, this.seeds.length);

    if (sampleSize > 1) {
      let totalDist = 0;
      let pairCount = 0;
      for (let i = 0; i < sampleSize; i++) {
        for (let j = i + 1; j < sampleSize; j++) {
          totalDist += computeGeneticDistance(this.seeds[i].genes, this.seeds[j].genes);
          pairCount++;
        }
      }
      diversity = pairCount > 0 ? totalDist / pairCount : 0;
    }

    // Count Pareto frontier
    const frontierSize = this.countParetoFrontier();

    return {
      generation: this.generation,
      bestFitness,
      averageFitness,
      worstFitness,
      diversity,
      frontierSize,
    };
  }

  /**
   * Novelty score: average distance to k-nearest neighbors in population + archive
   */
  noveltyScore(seed: UniversalSeed<T>, k: number = 15): number {
    const combined = [...this.seeds, ...this.noveltyArchive];

    if (combined.length === 0) return 0;

    // Compute distance to all other seeds
    const distances: number[] = [];
    for (const other of combined) {
      if (other.$hash === seed.$hash) continue;
      distances.push(computeGeneticDistance(seed.genes, other.genes));
    }

    if (distances.length === 0) return 0;

    // Sort ascending, take k nearest
    distances.sort((a, b) => a - b);
    const kNearest = distances.slice(0, Math.min(k, distances.length));

    // Average distance to k-nearest neighbors
    return kNearest.reduce((sum, d) => sum + d, 0) / kNearest.length;
  }

  /**
   * Count non-dominated solutions
   */
  private countParetoFrontier(): number {
    const evaluatedSeeds = this.seeds.filter(s => s.$fitness !== undefined);

    if (evaluatedSeeds.length === 0) return 0;

    let frontierCount = 0;

    for (const candidate of evaluatedSeeds) {
      let isDominated = false;

      for (const other of evaluatedSeeds) {
        if (other === candidate) continue;

        // Check if other dominates candidate
        const candFit = candidate.$fitness;
        const otherFit = other.$fitness;

        if (!candFit || !otherFit) continue;

        // Simple dominance check: other better on aggregate
        if (otherFit.aggregate > candFit.aggregate) {
          isDominated = true;
          break;
        }
      }

      if (!isDominated) {
        frontierCount++;
      }
    }

    return frontierCount;
  }
}
