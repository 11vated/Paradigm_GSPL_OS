/**
 * index.ts — Main Entry Point
 * Re-exports everything from the package
 */

// Kernel: Genes, Seeds, Operators, RNG, and Algebra
export * from './kernel/index.js';

// Evolution: Fitness, Population, MAP-Elites
export * from './evolution/index.js';

// Intelligence: Memory, Reasoning, and Agents
export * from './intelligence/index.js';

// Language: Lexer, Parser, AST, Interpreter
export * from './language/index.js';

// Runtime: Pipeline, CLI
export * from './runtime/index.js';

// Library: Seed Repository and Versioning
export * from './library/index.js';

// Composition: Cross-Domain Integration
export * from './composition/index.js';

// Renderers: Visual, Audio, Game, Animation, 3D
export * from './renderers/index.js';

// Marketplace: Seed packaging, registry, and API
export * from './marketplace/index.js';

// Top-level convenience re-exports
export { Pipeline, run } from './runtime/pipeline.js';
export type { PipelineConfig, PipelineResult, GeneratedArtifact } from './runtime/pipeline.js';
export { cli } from './runtime/cli.js';
export {
  breed,
  compose,
  interpolate,
  SeedExpression,
  createFunctor,
  FunctorRegistry,
  from,
} from './kernel/algebra.js';
export type { DomainFunctor } from './kernel/algebra.js';
