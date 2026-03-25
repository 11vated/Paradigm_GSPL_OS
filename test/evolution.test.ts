import { describe, it, expect } from 'vitest';
import { scalar, categorical } from '../src/kernel/genes.js';
import { createSeed } from '../src/kernel/seed.js';
import { DeterministicRNG } from '../src/kernel/rng.js';
import {
  CompositeFitness,
  FitnessObjective,
  createCompositeFitness,
  createSingleObjectiveFitness,
} from '../src/evolution/fitness.js';
import {
  Population,
  PopulationConfig,
} from '../src/evolution/population.js';
import {
  MapElites,
  BehaviorDimension,
  MapElitesConfig,
  runMapElites,
} from '../src/evolution/map-elites.js';
import { mutate } from '../src/kernel/operators.js';

// ============================================================================
// FITNESS EVALUATION
// ============================================================================

describe('CompositeFitness', () => {
  it('evaluates single objective', () => {
    const objectives: FitnessObjective[] = [
      {
        name: 'height',
        weight: 1,
        direction: 'maximize',
        evaluate: (seed) => (seed.genes.h as any).value,
      },
    ];

    const fitness = new CompositeFitness(objectives);
    const seed = createSeed('visual2d', 'test', {
      h: scalar(5, 0, 10),
    });

    const result = fitness.evaluate(seed);

    expect(result.scores.height).toBe(5);
    expect(result.aggregate).toBe(5);
  });

  it('evaluates multiple objectives with weights', () => {
    const objectives: FitnessObjective[] = [
      {
        name: 'beauty',
        weight: 2,
        direction: 'maximize',
        evaluate: (seed) => (seed.genes.b as any).value,
      },
      {
        name: 'complexity',
        weight: 1,
        direction: 'maximize',
        evaluate: (seed) => (seed.genes.c as any).value,
      },
    ];

    const fitness = new CompositeFitness(objectives);
    const seed = createSeed('visual2d', 'test', {
      b: scalar(10, 0, 10),
      c: scalar(5, 0, 10),
    });

    const result = fitness.evaluate(seed);

    expect(result.scores.beauty).toBe(10);
    expect(result.scores.complexity).toBe(5);
    // Normalized: beauty gets 2/3 weight, complexity gets 1/3
    expect(Math.abs(result.aggregate - (10 * (2/3) + 5 * (1/3)))).toBeLessThan(0.01);
  });

  it('handles minimize direction', () => {
    const objectives: FitnessObjective[] = [
      {
        name: 'error',
        weight: 1,
        direction: 'minimize',
        evaluate: (seed) => (seed.genes.e as any).value,
      },
    ];

    const fitness = new CompositeFitness(objectives);
    const seed = createSeed('visual2d', 'test', {
      e: scalar(2, 0, 10),
    });

    const result = fitness.evaluate(seed);

    // Minimize means we negate the value
    expect(result.scores.error).toBe(-2);
  });

  it('throws on empty objectives', () => {
    expect(() => new CompositeFitness([])).toThrow();
  });

  it('getObjectives returns objectives', () => {
    const objectives: FitnessObjective[] = [
      {
        name: 'test',
        weight: 1,
        direction: 'maximize',
        evaluate: () => 0.5,
      },
    ];

    const fitness = new CompositeFitness(objectives);
    const retrieved = fitness.getObjectives();

    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].name).toBe('test');
  });
});

describe('Pareto Dominance', () => {
  it('dominates checks single dimension', () => {
    const objectives: FitnessObjective[] = [
      {
        name: 'f1',
        weight: 1,
        direction: 'maximize',
        evaluate: () => 0,
      },
    ];

    const fitness = new CompositeFitness(objectives);

    const v1 = { scores: { f1: 10 }, aggregate: 10, evaluatedAt: Date.now() };
    const v2 = { scores: { f1: 5 }, aggregate: 5, evaluatedAt: Date.now() };

    expect(fitness.dominates(v1, v2)).toBe(true);
    expect(fitness.dominates(v2, v1)).toBe(false);
  });

  it('dominates requires strict improvement on at least one dimension', () => {
    const objectives: FitnessObjective[] = [
      { name: 'f1', weight: 1, direction: 'maximize', evaluate: () => 0 },
      { name: 'f2', weight: 1, direction: 'maximize', evaluate: () => 0 },
    ];

    const fitness = new CompositeFitness(objectives);

    const v1 = {
      scores: { f1: 10, f2: 10 },
      aggregate: 10,
      evaluatedAt: Date.now(),
    };
    const v2 = {
      scores: { f1: 10, f2: 10 },
      aggregate: 10,
      evaluatedAt: Date.now(),
    };

    // Equal on all dimensions - doesn't dominate
    expect(fitness.dominates(v1, v2)).toBe(false);
  });

  it('dominates returns false if dominated on any dimension', () => {
    const objectives: FitnessObjective[] = [
      { name: 'f1', weight: 1, direction: 'maximize', evaluate: () => 0 },
      { name: 'f2', weight: 1, direction: 'maximize', evaluate: () => 0 },
    ];

    const fitness = new CompositeFitness(objectives);

    const v1 = {
      scores: { f1: 10, f2: 5 },
      aggregate: 7.5,
      evaluatedAt: Date.now(),
    };
    const v2 = {
      scores: { f1: 8, f2: 10 },
      aggregate: 9,
      evaluatedAt: Date.now(),
    };

    // v1 is better on f1 but worse on f2 - no dominance
    expect(fitness.dominates(v1, v2)).toBe(false);
    expect(fitness.dominates(v2, v1)).toBe(false);
  });
});

describe('Pareto Frontier', () => {
  it('paretoFrontier returns non-dominated solutions', () => {
    const objectives: FitnessObjective[] = [
      { name: 'f1', weight: 1, direction: 'maximize', evaluate: () => 0 },
      { name: 'f2', weight: 1, direction: 'maximize', evaluate: () => 0 },
    ];

    const fitness = new CompositeFitness(objectives);

    const vectors = [
      { scores: { f1: 1, f2: 5 }, aggregate: 3, evaluatedAt: Date.now() },
      { scores: { f1: 2, f2: 4 }, aggregate: 3, evaluatedAt: Date.now() },
      { scores: { f1: 3, f2: 3 }, aggregate: 3, evaluatedAt: Date.now() },
      { scores: { f1: 4, f2: 2 }, aggregate: 3, evaluatedAt: Date.now() },
      { scores: { f1: 5, f2: 1 }, aggregate: 3, evaluatedAt: Date.now() },
      { scores: { f1: 3, f2: 0 }, aggregate: 1.5, evaluatedAt: Date.now() }, // dominated
    ];

    const frontier = fitness.paretoFrontier(vectors);

    expect(frontier.length).toBe(5); // All except the last one
  });

  it('paretoFrontier returns empty for empty input', () => {
    const objectives: FitnessObjective[] = [
      { name: 'f1', weight: 1, direction: 'maximize', evaluate: () => 0 },
    ];

    const fitness = new CompositeFitness(objectives);
    const frontier = fitness.paretoFrontier([]);

    expect(frontier).toHaveLength(0);
  });
});

describe('Hypervolume', () => {
  it('hypervolume returns 0 for empty frontier', () => {
    const objectives: FitnessObjective[] = [
      { name: 'f1', weight: 1, direction: 'maximize', evaluate: () => 0 },
    ];

    const fitness = new CompositeFitness(objectives);
    const hv = fitness.hypervolume([]);

    expect(hv).toBe(0);
  });

  it('hypervolume computes 1D correctly', () => {
    const objectives: FitnessObjective[] = [
      { name: 'f1', weight: 1, direction: 'maximize', evaluate: () => 0 },
    ];

    const fitness = new CompositeFitness(objectives);

    const frontier = [
      { scores: { f1: 5 }, aggregate: 5, evaluatedAt: Date.now() },
      { scores: { f1: 10 }, aggregate: 10, evaluatedAt: Date.now() },
    ];

    const hv = fitness.hypervolume(frontier, { f1: 0 });

    expect(hv).toBe(10); // max value above reference
  });

  it('hypervolume computes 2D using WFG algorithm', () => {
    const objectives: FitnessObjective[] = [
      { name: 'f1', weight: 1, direction: 'maximize', evaluate: () => 0 },
      { name: 'f2', weight: 1, direction: 'maximize', evaluate: () => 0 },
    ];

    const fitness = new CompositeFitness(objectives);

    const frontier = [
      { scores: { f1: 5, f2: 5 }, aggregate: 5, evaluatedAt: Date.now() },
      { scores: { f1: 10, f2: 2 }, aggregate: 6, evaluatedAt: Date.now() },
    ];

    const hv = fitness.hypervolume(frontier, { f1: 0, f2: 0 });

    expect(hv).toBeGreaterThan(0);
  });
});

// ============================================================================
// POPULATION EVOLUTION
// ============================================================================

describe('Population', () => {
  it('constructs with initial seeds', () => {
    const seeds = [
      createSeed('visual2d', 's1', { x: scalar(1, 0, 10) }),
      createSeed('visual2d', 's2', { x: scalar(2, 0, 10) }),
    ];

    const pop = new Population(seeds);

    expect(pop.seeds).toHaveLength(2);
    expect(pop.generation).toBe(0);
  });

  it('throws on empty initial seeds', () => {
    expect(() => new Population([])).toThrow();
  });

  it('selectParent uses tournament selection', () => {
    const seeds = [
      createSeed('visual2d', 's1', { x: scalar(1, 0, 10) }),
      createSeed('visual2d', 's2', { x: scalar(5, 0, 10) }),
      createSeed('visual2d', 's3', { x: scalar(3, 0, 10) }),
    ];

    const pop = new Population(seeds);
    const rng = new DeterministicRNG('test_tournament');
    const config: PopulationConfig = {
      size: 3,
      eliteCount: 1,
      tournamentSize: 2,
      mutationRate: 0.1,
      mutationIntensity: 0.1,
      noveltyWeight: 0,
      maxGenerations: 10,
    };

    const selected = pop.selectParent(config, rng);

    expect(selected).toBeDefined();
    expect(pop.seeds).toContain(selected);
  });

  it('best returns top N seeds by fitness', () => {
    const seeds = [
      createSeed('visual2d', 's1', { x: scalar(1, 0, 10) }),
      createSeed('visual2d', 's2', { x: scalar(5, 0, 10) }),
    ];

    const pop = new Population(seeds);

    // Add fitness to seeds
    (pop.seeds[0] as any).$fitness = { scores: {}, aggregate: 3, evaluatedAt: Date.now() };
    (pop.seeds[1] as any).$fitness = { scores: {}, aggregate: 7, evaluatedAt: Date.now() };

    const best = pop.best(1);

    expect(best).toHaveLength(1);
    expect((best[0].$fitness?.aggregate ?? 0)).toBe(7);
  });

  it('computeStats calculates population statistics', () => {
    const seeds = [
      createSeed('visual2d', 's1', { x: scalar(1, 0, 10) }),
      createSeed('visual2d', 's2', { x: scalar(5, 0, 10) }),
    ];

    const pop = new Population(seeds);

    (pop.seeds[0] as any).$fitness = { scores: {}, aggregate: 3, evaluatedAt: Date.now() };
    (pop.seeds[1] as any).$fitness = { scores: {}, aggregate: 7, evaluatedAt: Date.now() };

    const stats = pop.computeStats();

    expect(stats.bestFitness).toBe(7);
    expect(stats.worstFitness).toBe(3);
    expect(stats.averageFitness).toBe(5);
  });

  it('evolve produces new generation', () => {
    const seeds = [
      createSeed('visual2d', 's1', { x: scalar(1, 0, 10) }),
      createSeed('visual2d', 's2', { x: scalar(5, 0, 10) }),
    ];

    const pop = new Population(seeds);

    const fitness = (seed: any) => ({
      scores: {},
      aggregate: (seed.genes.x as any).value,
      evaluatedAt: Date.now(),
    });

    const config: PopulationConfig = {
      size: 2,
      eliteCount: 1,
      tournamentSize: 2,
      mutationRate: 0.1,
      mutationIntensity: 0.1,
      noveltyWeight: 0,
      maxGenerations: 10,
    };

    const rng = new DeterministicRNG('evolve_test');
    const nextGen = pop.evolve(fitness, config, rng);

    expect(nextGen.generation).toBe(1);
    expect(nextGen.seeds).toHaveLength(2);
  });
});

// ============================================================================
// MAP-ELITES QUALITY-DIVERSITY
// ============================================================================

describe('MapElites', () => {
  it('constructs with valid config', () => {
    const dimensions: BehaviorDimension[] = [
      {
        name: 'symmetry',
        min: 0,
        max: 1,
        resolution: 5,
        extract: (seed) => (seed.genes.sym as any).value,
      },
    ];

    const config: MapElitesConfig = {
      dimensions,
      batchSize: 10,
      mutationRate: 0.1,
      mutationIntensity: 0.3,
      maxIterations: 100,
    };

    const me = new MapElites(config);

    expect(me).toBeDefined();
  });

  it('throws on empty dimensions', () => {
    const config: MapElitesConfig = {
      dimensions: [],
      batchSize: 10,
      mutationRate: 0.1,
      mutationIntensity: 0.3,
      maxIterations: 100,
    };

    expect(() => new MapElites(config)).toThrow();
  });

  it('initialize populates grid with seeds', () => {
    const dimensions: BehaviorDimension[] = [
      {
        name: 'x',
        min: 0,
        max: 10,
        resolution: 5,
        extract: (seed) => (seed.genes.x as any).value,
      },
    ];

    const config: MapElitesConfig = {
      dimensions,
      batchSize: 10,
      mutationRate: 0.1,
      mutationIntensity: 0.3,
      maxIterations: 100,
    };

    const me = new MapElites(config);

    const seeds = [
      createSeed('visual2d', 's1', { x: scalar(1, 0, 10) }),
      createSeed('visual2d', 's2', { x: scalar(9, 0, 10) }),
    ];

    const fitness = (seed: any) => ({
      scores: {},
      aggregate: 1,
      evaluatedAt: Date.now(),
    });

    me.initialize(seeds, fitness);

    const cells = me.allCells();
    expect(cells.length).toBeGreaterThan(0);
  });

  it('step places seed in correct cell', () => {
    const dimensions: BehaviorDimension[] = [
      {
        name: 'x',
        min: 0,
        max: 10,
        resolution: 5,
        extract: (seed) => (seed.genes.x as any).value,
      },
    ];

    const config: MapElitesConfig = {
      dimensions,
      batchSize: 10,
      mutationRate: 0.1,
      mutationIntensity: 0.3,
      maxIterations: 100,
    };

    const me = new MapElites(config);

    const seeds = [
      createSeed('visual2d', 's1', { x: scalar(5, 0, 10) }),
    ];

    const fitness = (seed: any) => ({
      scores: {},
      aggregate: 0.5,
      evaluatedAt: Date.now(),
    });

    me.initialize(seeds, fitness);

    const rng = new DeterministicRNG('step_test');
    const result = me.step(fitness, rng);

    expect(result).toBeDefined();
  });

  it('coverage increases with more seeds', () => {
    const dimensions: BehaviorDimension[] = [
      {
        name: 'x',
        min: 0,
        max: 10,
        resolution: 3,
        extract: (seed) => (seed.genes.x as any).value,
      },
    ];

    const config: MapElitesConfig = {
      dimensions,
      batchSize: 10,
      mutationRate: 1.0,
      mutationIntensity: 0.5,
      maxIterations: 50,
    };

    const me = new MapElites(config);

    const seed = createSeed('visual2d', 's1', { x: scalar(5, 0, 10) });

    const fitness = (s: any) => ({
      scores: {},
      aggregate: 0.5,
      evaluatedAt: Date.now(),
    });

    me.initialize([seed], fitness);

    const initialCoverage = me.coverage();

    const rng = new DeterministicRNG('coverage_test');
    me.run(fitness, 30, rng);

    const finalCoverage = me.coverage();

    expect(finalCoverage).toBeGreaterThanOrEqual(initialCoverage);
  });

  it('qdScore sums fitness across all cells', () => {
    const dimensions: BehaviorDimension[] = [
      {
        name: 'x',
        min: 0,
        max: 10,
        resolution: 5,
        extract: (seed) => (seed.genes.x as any).value,
      },
    ];

    const config: MapElitesConfig = {
      dimensions,
      batchSize: 10,
      mutationRate: 0.1,
      mutationIntensity: 0.3,
      maxIterations: 100,
    };

    const me = new MapElites(config);

    const seeds = [
      createSeed('visual2d', 's1', { x: scalar(2, 0, 10) }),
      createSeed('visual2d', 's2', { x: scalar(8, 0, 10) }),
    ];

    const fitness = (seed: any) => ({
      scores: {},
      aggregate: (seed.genes.x as any).value / 10,
      evaluatedAt: Date.now(),
    });

    me.initialize(seeds, fitness);

    const qdScore = me.qdScore();

    expect(qdScore).toBeGreaterThan(0);
  });

  it('best returns cell with highest fitness', () => {
    const dimensions: BehaviorDimension[] = [
      {
        name: 'x',
        min: 0,
        max: 10,
        resolution: 5,
        extract: (seed) => (seed.genes.x as any).value,
      },
    ];

    const config: MapElitesConfig = {
      dimensions,
      batchSize: 10,
      mutationRate: 0.1,
      mutationIntensity: 0.3,
      maxIterations: 100,
    };

    const me = new MapElites(config);

    const seeds = [
      createSeed('visual2d', 's1', { x: scalar(1, 0, 10) }),
      createSeed('visual2d', 's2', { x: scalar(9, 0, 10) }),
    ];

    const fitness = (seed: any) => ({
      scores: {},
      aggregate: (seed.genes.x as any).value / 10,
      evaluatedAt: Date.now(),
    });

    me.initialize(seeds, fitness);

    const best = me.best();

    expect(best).toBeDefined();
    expect(best?.fitness).toBeGreaterThan(0.5);
  });

  it('getCell retrieves seed at coordinates', () => {
    const dimensions: BehaviorDimension[] = [
      {
        name: 'x',
        min: 0,
        max: 10,
        resolution: 5,
        extract: (seed) => (seed.genes.x as any).value,
      },
    ];

    const config: MapElitesConfig = {
      dimensions,
      batchSize: 10,
      mutationRate: 0.1,
      mutationIntensity: 0.3,
      maxIterations: 100,
    };

    const me = new MapElites(config);

    const seeds = [
      createSeed('visual2d', 's1', { x: scalar(2, 0, 10) }),
    ];

    const fitness = (seed: any) => ({
      scores: {},
      aggregate: 0.5,
      evaluatedAt: Date.now(),
    });

    me.initialize(seeds, fitness);

    const cells = me.allCells();
    if (cells.length > 0) {
      const cell = me.getCell(cells[0].coordinates);
      expect(cell).toBeDefined();
    }
  });

  it('allCells returns all occupied cells', () => {
    const dimensions: BehaviorDimension[] = [
      {
        name: 'x',
        min: 0,
        max: 10,
        resolution: 5,
        extract: (seed) => (seed.genes.x as any).value,
      },
    ];

    const config: MapElitesConfig = {
      dimensions,
      batchSize: 10,
      mutationRate: 0.1,
      mutationIntensity: 0.3,
      maxIterations: 100,
    };

    const me = new MapElites(config);

    const seeds = [
      createSeed('visual2d', 's1', { x: scalar(2, 0, 10) }),
      createSeed('visual2d', 's2', { x: scalar(5, 0, 10) }),
      createSeed('visual2d', 's3', { x: scalar(8, 0, 10) }),
    ];

    const fitness = (seed: any) => ({
      scores: {},
      aggregate: 0.5,
      evaluatedAt: Date.now(),
    });

    me.initialize(seeds, fitness);

    const cells = me.allCells();

    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it('runMapElites factory function works', () => {
    const dimensions: BehaviorDimension[] = [
      {
        name: 'x',
        min: 0,
        max: 10,
        resolution: 5,
        extract: (seed) => (seed.genes.x as any).value,
      },
    ];

    const config: MapElitesConfig = {
      dimensions,
      batchSize: 10,
      mutationRate: 0.1,
      mutationIntensity: 0.3,
      maxIterations: 20,
    };

    const seeds = [
      createSeed('visual2d', 's1', { x: scalar(5, 0, 10) }),
    ];

    const fitness = (seed: any) => ({
      scores: {},
      aggregate: (seed.genes.x as any).value / 10,
      evaluatedAt: Date.now(),
    });

    const rng = new DeterministicRNG('factory_test');

    const result = runMapElites(config, seeds, fitness, rng);

    expect(result.totalIterations).toBe(20);
    expect(result.cellCount).toBeGreaterThan(0);
    expect(result.coverage).toBeGreaterThan(0);
    expect(result.qdScore).toBeGreaterThan(0);
  });
});

// ============================================================================
// FITNESS HELPER FUNCTIONS
// ============================================================================

describe('Fitness Factory Functions', () => {
  it('createCompositeFitness returns evaluator function', () => {
    const objectives: FitnessObjective[] = [
      {
        name: 'test',
        weight: 1,
        direction: 'maximize',
        evaluate: (seed) => 0.5,
      },
    ];

    const evaluator = createCompositeFitness(objectives);

    const seed = createSeed('visual2d', 'test', { x: scalar(1, 0, 10) });
    const result = evaluator(seed);

    expect(result.scores.test).toBe(0.5);
  });

  it('createSingleObjectiveFitness creates single objective', () => {
    const evaluator = createSingleObjectiveFitness(
      (seed) => (seed.genes.x as any).value,
      'maximize'
    );

    const seed = createSeed('visual2d', 'test', { x: scalar(7, 0, 10) });
    const result = evaluator(seed);

    expect(result.scores.objective).toBe(7);
  });

  it('createSingleObjectiveFitness handles minimize', () => {
    const evaluator = createSingleObjectiveFitness(
      (seed) => (seed.genes.x as any).value,
      'minimize'
    );

    const seed = createSeed('visual2d', 'test', { x: scalar(3, 0, 10) });
    const result = evaluator(seed);

    expect(result.scores.objective).toBe(-3);
  });
});
