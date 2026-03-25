/**
 * pipeline.ts — Execution Pipeline
 * End-to-end orchestration: GSPL source → compilation → artifact generation.
 */

import { Lexer } from '../language/lexer.js';
import { Parser } from '../language/parser.js';
import { Interpreter, ExecutionResult } from '../language/interpreter.js';
import { UniversalSeed, SeedDomain } from '../kernel/seed.js';
import { GeneMap } from '../kernel/genes.js';
import { DeterministicRNG } from '../kernel/rng.js';
import { registry, GenerationResult } from '../engines/engine.js';
// Import to trigger auto-registration of all engines
import '../engines/index.js';
import { Population, PopulationConfig } from '../evolution/population.js';
import { FitnessVector } from '../kernel/seed.js';

// ============================================================================
// GENERATED ARTIFACT INTERFACE
// ============================================================================

/**
 * Represents a generated artifact from a seed
 */
export interface GeneratedArtifact {
  type: string;
  name: string;
  data: unknown;
  metadata: Record<string, unknown>;
  sizeBytes?: number;
}

// ============================================================================
// PIPELINE CONFIGURATION & RESULTS
// ============================================================================

export interface PipelineConfig {
  /**
   * GSPL source code
   */
  source: string;

  /**
   * Optional source file name (for diagnostics)
   */
  file?: string;

  /**
   * Optional output directory
   */
  outputDir?: string;

  /**
   * Quality level (0-1, affects generation parameters)
   */
  quality?: number;

  /**
   * Maximum execution time in milliseconds
   */
  maxTimeMs?: number;

  /**
   * Enable verbose logging
   */
  verbose?: boolean;

  /**
   * Run evolution on output seeds
   */
  evolve?: boolean;

  /**
   * Number of evolution generations
   */
  evolutionGenerations?: number;

  /**
   * Master RNG seed for determinism
   */
  seed?: string;
}

export interface PipelineResult {
  /**
   * Seeds produced by the program
   */
  seeds: UniversalSeed[];

  /**
   * Generated artifacts keyed by seed
   */
  artifacts: Array<{ seed: UniversalSeed; artifacts: GeneratedArtifact[] }>;

  /**
   * Interpreter execution result
   */
  execution: ExecutionResult;

  /**
   * Pipeline timing breakdown
   */
  timing: {
    lexMs: number;
    parseMs: number;
    interpretMs: number;
    generateMs: number;
    totalMs: number;
  };

  /**
   * All errors encountered
   */
  errors: string[];
}

// ============================================================================
// PIPELINE IMPLEMENTATION
// ============================================================================

export class Pipeline {
  private config: PipelineConfig;
  private startTime: number;

  constructor(config: PipelineConfig) {
    this.config = {
      quality: 1.0,
      maxTimeMs: 30000,
      verbose: false,
      evolve: false,
      evolutionGenerations: 10,
      seed: 'paradigm',
      ...config,
    };
    this.startTime = Date.now();
  }

  /**
   * Run the full pipeline: lex → parse → interpret → generate
   */
  run(): PipelineResult {
    const totalStartMs = Date.now();
    const errors: string[] = [];
    const seeds: UniversalSeed[] = [];
    const artifacts: Array<{ seed: UniversalSeed; artifacts: GeneratedArtifact[] }> = [];

    try {
      // Compilation phase
      const compilationResult = this.compile();
      seeds.push(...compilationResult.seeds);

      // Evolution phase (optional)
      let evolvedSeeds = seeds;
      if (this.config.evolve && this.config.evolutionGenerations && this.config.evolutionGenerations > 0) {
        try {
          evolvedSeeds = this.evolveSeeds(seeds, this.config.evolutionGenerations);
          if (this.config.verbose) {
            console.log(`[Pipeline] Evolved seeds: ${seeds.length} → ${evolvedSeeds.length}`);
          }
        } catch (err) {
          errors.push(`Evolution failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Generation phase: create artifacts from seeds
      const generateStartMs = Date.now();
      artifacts.push(...this.generate(evolvedSeeds));
      const generateMs = Date.now() - generateStartMs;

      // Collect errors from execution
      errors.push(...compilationResult.execution.errors.map((e: any) => e.message || String(e)));

      const totalMs = Date.now() - totalStartMs;

      return {
        seeds: evolvedSeeds,
        artifacts,
        execution: compilationResult.execution,
        timing: {
          lexMs: compilationResult.timing.lexMs,
          parseMs: compilationResult.timing.parseMs,
          interpretMs: compilationResult.timing.interpretMs,
          generateMs,
          totalMs,
        },
        errors,
      };
    } catch (err) {
      errors.push(`Pipeline fatal error: ${err instanceof Error ? err.message : String(err)}`);

      return {
        seeds: [],
        artifacts: [],
        execution: {
          seeds: [],
          exports: {},
          errors: [],
          timing: { parseMs: 0, executeMs: 0, totalMs: 0 },
        },
        timing: { lexMs: 0, parseMs: 0, interpretMs: 0, generateMs: 0, totalMs: 0 },
        errors,
      };
    }
  }

  /**
   * Run just the language phases (no generation)
   */
  compile(): PipelineResult {
    const errors: string[] = [];
    const seeds: UniversalSeed[] = [];

    // Lexical analysis
    const lexStartMs = Date.now();
    let tokens;
    try {
      const lexer = new Lexer(this.config.source);
      tokens = lexer.tokenize();
      if (this.config.verbose) {
        console.log(`[Lexer] Generated ${tokens.length} tokens`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Lexical error: ${msg}`);
      return {
        seeds: [],
        artifacts: [],
        execution: {
          seeds: [],
          exports: {},
          errors: [],
          timing: { parseMs: 0, executeMs: 0, totalMs: 0 },
        },
        timing: { lexMs: Date.now() - lexStartMs, parseMs: 0, interpretMs: 0, generateMs: 0, totalMs: 0 },
        errors: errors,
      };
    }
    const lexMs = Date.now() - lexStartMs;

    // Parsing
    const parseStartMs = Date.now();
    let ast;
    try {
      const parser = new Parser(tokens);
      ast = parser.parse();
      if (this.config.verbose) {
        console.log(`[Parser] Generated AST with ${ast.body.length} statements`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Parse error: ${msg}`);
      return {
        seeds: [],
        artifacts: [],
        execution: {
          seeds: [],
          exports: {},
          errors: [],
          timing: { parseMs: 0, executeMs: 0, totalMs: 0 },
        },
        timing: {
          lexMs,
          parseMs: Date.now() - parseStartMs,
          interpretMs: 0,
          generateMs: 0,
          totalMs: 0,
        },
        errors,
      };
    }
    const parseMs = Date.now() - parseStartMs;

    // Interpretation
    const interpretStartMs = Date.now();
    let executionResult: ExecutionResult;
    try {
      const interpreter = new Interpreter();
      executionResult = interpreter.execute(ast);
      seeds.push(...executionResult.seeds);

      if (this.config.verbose) {
        console.log(`[Interpreter] Produced ${seeds.length} seeds`);
        if (executionResult.errors.length > 0) {
          console.log(`[Interpreter] Errors: ${executionResult.errors.length}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Interpretation error: ${msg}`);
      return {
        seeds: [],
        artifacts: [],
        execution: {
          seeds: [],
          exports: {},
          errors: [],
          timing: { parseMs: 0, executeMs: 0, totalMs: 0 },
        },
        timing: {
          lexMs,
          parseMs,
          interpretMs: Date.now() - interpretStartMs,
          generateMs: 0,
          totalMs: 0,
        },
        errors,
      };
    }
    const interpretMs = Date.now() - interpretStartMs;

    return {
      seeds,
      artifacts: [],
      execution: executionResult,
      timing: {
        lexMs,
        parseMs,
        interpretMs,
        generateMs: 0,
        totalMs: lexMs + parseMs + interpretMs,
      },
      errors,
    };
  }

  /**
   * Generate artifacts from seeds using registered domain engines
   */
  generate(seeds: UniversalSeed[]): Array<{ seed: UniversalSeed; artifacts: GeneratedArtifact[] }> {
    const result: Array<{ seed: UniversalSeed; artifacts: GeneratedArtifact[] }> = [];

    for (const seed of seeds) {
      const generatedArtifacts: GeneratedArtifact[] = [];

      // Get the appropriate engine for this seed's domain
      const engine = registry.get(seed.$domain);

      if (!engine) {
        if (this.config.verbose) {
          console.log(`[Generation] No engine for domain ${seed.$domain}, skipping`);
        }
        continue;
      }

      // Run the developmental pipeline
      const genResult: GenerationResult = engine.generate(seed);

      if (!genResult.success) {
        if (this.config.verbose) {
          console.log(`[Generation] Failed for seed ${seed.$name}: ${genResult.errors.join(', ')}`);
        }
        continue;
      }

      // Convert artifacts map to array
      for (const [key, data] of genResult.artifacts) {
        const size = typeof data === 'string'
          ? Buffer.byteLength(data, 'utf-8')
          : JSON.stringify(data).length;

        generatedArtifacts.push({
          type: key.split(':')[0] ?? 'unknown',
          name: `${seed.$name}_${key}`,
          data,
          metadata: {
            domain: seed.$domain,
            seed: seed.$hash,
            stages: genResult.timing.stageTimings.map(st => ({ stage: st.stage, ms: st.ms })),
          },
          sizeBytes: size,
        });
      }

      if (this.config.verbose) {
        console.log(
          `[Generation] Seed ${seed.$name}: ${generatedArtifacts.length} artifacts, ` +
          `${genResult.timing.totalMs}ms total`
        );
      }

      result.push({ seed, artifacts: generatedArtifacts });
    }

    return result;
  }

  /**
   * Evolve seeds for N generations using genetic algorithm
   */
  private evolveSeeds(seeds: UniversalSeed[], generations: number): UniversalSeed[] {
    if (seeds.length === 0) {
      return [];
    }

    // Create a simple fitness function (just aggregate fitness)
    const fitnessFunc = (seed: UniversalSeed): FitnessVector => {
      return seed.$fitness ?? {
        scores: { default: 0 },
        aggregate: 0,
        evaluatedAt: Date.now(),
      };
    };

    // Initialize population
    let population = new Population(seeds);

    // Evolution loop
    const rng = new DeterministicRNG(this.config.seed ?? 'evolution');
    const config: PopulationConfig = {
      size: seeds.length,
      eliteCount: Math.ceil(seeds.length * 0.2),
      tournamentSize: 3,
      mutationRate: 0.3,
      mutationIntensity: 0.1,
      noveltyWeight: 0.1,
      maxGenerations: generations,
    };

    for (let gen = 0; gen < generations; gen++) {
      population = population.evolve(fitnessFunc, config, rng);

      if (this.config.verbose) {
        console.log(
          `[Evolution] Gen ${gen + 1}/${generations}: ` +
          `best=${population.stats.bestFitness.toFixed(3)}, ` +
          `avg=${population.stats.averageFitness.toFixed(3)}, ` +
          `diversity=${population.stats.diversity.toFixed(3)}`
        );
      }
    }

    return population.seeds;
  }
}

/**
 * Convenience function to run a pipeline in one call
 */
export function run(config: PipelineConfig): PipelineResult {
  const pipeline = new Pipeline(config);
  return pipeline.run();
}
