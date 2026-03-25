/**
 * evolution/index.ts — Barrel Export
 * Complete Evolution Engine for GSPL Paradigm
 */

// Fitness evaluation and multi-objective optimization
export {
  type FitnessObjective,
  CompositeFitness,
  createCompositeFitness,
  createSingleObjectiveFitness,
} from './fitness.js';

// Population management and genetic algorithms
export {
  type PopulationConfig,
  type PopulationStats,
  Population,
} from './population.js';

// Quality-Diversity: MAP-Elites algorithm
export {
  type BehaviorDimension,
  type MapElitesConfig,
  type CellInfo,
  type MapElitesResult,
  MapElites,
  runMapElites,
} from './map-elites.js';
