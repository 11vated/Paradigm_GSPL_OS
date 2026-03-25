/**
 * fitness.ts — Fitness Evaluation Framework
 * Multi-objective fitness with Pareto dominance and hypervolume indicators.
 */

import type { GeneMap, UniversalSeed, FitnessVector } from '../kernel/index.js';

/**
 * Single fitness objective
 */
export interface FitnessObjective {
  /**
   * Human-readable name for this objective
   */
  name: string;

  /**
   * Relative importance (0 to 1). Weights are normalized.
   */
  weight: number;

  /**
   * Whether to maximize or minimize this objective
   */
  direction: 'maximize' | 'minimize';

  /**
   * Function to evaluate this objective for a seed
   */
  evaluate: (seed: UniversalSeed) => number;
}

/**
 * Composite fitness evaluator: combines multiple objectives
 */
export class CompositeFitness {
  private objectives: FitnessObjective[];
  private normalizedWeights: number[];

  constructor(objectives: FitnessObjective[]) {
    if (objectives.length === 0) {
      throw new Error('CompositeFitness requires at least one objective');
    }

    this.objectives = objectives;

    // Normalize weights
    const weightSum = objectives.reduce((sum, obj) => sum + obj.weight, 0);
    this.normalizedWeights = objectives.map(obj => obj.weight / weightSum);
  }

  /**
   * Evaluate all objectives and compute weighted aggregate
   */
  evaluate(seed: UniversalSeed): FitnessVector {
    const scores: Record<string, number> = {};
    let aggregate = 0;

    for (let i = 0; i < this.objectives.length; i++) {
      const obj = this.objectives[i];
      let value = obj.evaluate(seed);

      // Normalize direction: all scores should be higher = better
      if (obj.direction === 'minimize') {
        value = -value;
      }

      scores[obj.name] = value;
      aggregate += value * this.normalizedWeights[i];
    }

    // Return FitnessVector with scores and aggregate
    return {
      scores,
      aggregate,
      evaluatedAt: Date.now(),
    };
  }

  /**
   * Get objective info
   */
  getObjectives(): FitnessObjective[] {
    return [...this.objectives];
  }

  /**
   * Check Pareto dominance: does vector a dominate vector b?
   * a dominates b if a is better or equal on all objectives and strictly better on at least one
   */
  dominates(a: FitnessVector, b: FitnessVector): boolean {
    const aValues = Object.values(a.scores);
    const bValues = Object.values(b.scores);

    if (aValues.length === 0 || bValues.length === 0) {
      return false;
    }

    if (aValues.length !== bValues.length) {
      return false;
    }

    let atLeastOneStrictlyBetter = false;

    for (let i = 0; i < aValues.length; i++) {
      if (aValues[i] < bValues[i]) {
        // a is worse on this dimension
        return false;
      }
      if (aValues[i] > bValues[i]) {
        atLeastOneStrictlyBetter = true;
      }
    }

    return atLeastOneStrictlyBetter;
  }

  /**
   * Compute Pareto frontier: return non-dominated solutions
   */
  paretoFrontier(vectors: FitnessVector[]): FitnessVector[] {
    if (vectors.length === 0) return [];

    const frontier: FitnessVector[] = [];

    for (const candidate of vectors) {
      let isDominated = false;

      // Check if candidate is dominated by any frontier member
      for (const frontierMember of frontier) {
        if (this.dominates(frontierMember, candidate)) {
          isDominated = true;
          break;
        }
      }

      if (isDominated) continue;

      // Remove any frontier members dominated by candidate
      const stillInFrontier: FitnessVector[] = [];
      for (const frontierMember of frontier) {
        if (!this.dominates(candidate, frontierMember)) {
          stillInFrontier.push(frontierMember);
        }
      }

      stillInFrontier.push(candidate);
      frontier.length = 0;
      frontier.push(...stillInFrontier);
    }

    return frontier;
  }

  /**
   * Hypervolume indicator (2D/3D approximation)
   * Measures volume of space dominated by Pareto frontier
   */
  hypervolume(frontier: FitnessVector[], reference: Record<string, number> = {}): number {
    if (frontier.length === 0) return 0;

    const numObjectives = this.objectives.length;

    if (numObjectives === 1) {
      // 1D: sum of objective values above reference
      const objName = this.objectives[0].name;
      const refVal = reference[objName] ?? 0;
      return Math.max(...frontier.map(v => v.scores[objName] ?? 0)) - refVal;
    }

    if (numObjectives === 2) {
      // 2D WFG hypervolume algorithm (simplified)
      return this.hypervolume2D(frontier, reference);
    }

    // For 3+ dimensions, use Monte Carlo approximation
    return this.hypervolumeMonteCarloApprox(frontier, reference);
  }

  /**
   * 2D hypervolume using WFG algorithm
   */
  private hypervolume2D(frontier: FitnessVector[], reference: Record<string, number>): number {
    if (frontier.length === 0) return 0;

    const objNames = this.objectives.map(o => o.name).slice(0, 2);
    if (objNames.length < 2) return 0;

    const refX = reference[objNames[0]] ?? 0;
    const refY = reference[objNames[1]] ?? 0;

    const points = frontier
      .map(v => ({ x: v.scores[objNames[0]] ?? 0, y: v.scores[objNames[1]] ?? 0 }))
      .sort((a, b) => a.x - b.x);

    if (points.length === 0) return 0;

    let volume = 0;
    let prevY = refY;

    for (const point of points) {
      const width = Math.max(0, point.x - refX);
      const height = Math.max(0, point.y - prevY);
      volume += width * height;
      prevY = Math.max(prevY, point.y);
    }

    return volume;
  }

  /**
   * Monte Carlo approximation for hypervolume (3+ dimensions)
   */
  private hypervolumeMonteCarloApprox(
    frontier: FitnessVector[],
    reference: Record<string, number>,
    samples: number = 10000
  ): number {
    const objNames = this.objectives.map(o => o.name);

    // Find bounding box
    const minValues: Record<string, number> = {};
    const maxValues: Record<string, number> = {};

    for (const name of objNames) {
      minValues[name] = Infinity;
      maxValues[name] = -Infinity;
    }

    for (const point of frontier) {
      for (const name of objNames) {
        const value = point.scores[name] ?? 0;
        minValues[name] = Math.min(minValues[name], value);
        maxValues[name] = Math.max(maxValues[name], value);
      }
    }

    // Adjust to reference point
    for (const name of objNames) {
      const refVal = reference[name] ?? 0;
      maxValues[name] = Math.max(maxValues[name], refVal);
    }

    const ranges: Record<string, number> = {};
    let boxVolume = 1;
    for (const name of objNames) {
      const refVal = reference[name] ?? 0;
      ranges[name] = maxValues[name] - refVal;
      boxVolume *= ranges[name];
    }

    // Monte Carlo sampling
    let pointsInHypervolume = 0;

    for (let i = 0; i < samples; i++) {
      const randomPoint: Record<string, number> = {};
      for (const name of objNames) {
        const refVal = reference[name] ?? 0;
        randomPoint[name] = refVal + Math.random() * ranges[name];
      }

      // Check if point is dominated by any frontier member
      let dominated = false;
      for (const frontierPoint of frontier) {
        let dominates = true;
        for (const name of objNames) {
          if (randomPoint[name] > (frontierPoint.scores[name] ?? 0)) {
            dominates = false;
            break;
          }
        }
        if (dominates) {
          dominated = true;
          break;
        }
      }

      if (dominated) pointsInHypervolume++;
    }

    return (pointsInHypervolume / samples) * boxVolume;
  }
}

/**
 * Create a fitness function from objectives
 */
export function createCompositeFitness(objectives: FitnessObjective[]): (seed: UniversalSeed) => FitnessVector {
  const evaluator = new CompositeFitness(objectives);
  return (seed: UniversalSeed) => evaluator.evaluate(seed);
}

/**
 * Simple single-objective fitness evaluator
 */
export function createSingleObjectiveFitness(
  evaluate: (seed: UniversalSeed) => number,
  direction: 'maximize' | 'minimize' = 'maximize'
): (seed: UniversalSeed) => FitnessVector {
  const objective: FitnessObjective = {
    name: 'objective',
    weight: 1,
    direction,
    evaluate,
  };

  const evaluator = new CompositeFitness([objective]);
  return (seed: UniversalSeed) => evaluator.evaluate(seed);
}
