/**
 * engine.ts — Domain Engine Framework
 * Abstract base class and registry for all domain engines.
 * Seeds UNFOLD through developmental stages, accumulating artifacts.
 */

import {
  UniversalSeed,
  SeedDomain,
  FitnessVector,
  GeneMap,
  cloneSeed,
} from '../kernel/seed.js';
import { Gene, cloneGene } from '../kernel/genes.js';
import { DeterministicRNG } from '../kernel/rng.js';

// ============================================================================
// DEVELOPMENTAL PIPELINE TYPES
// ============================================================================

/**
 * DevelopmentalStage represents a step in the seed-to-artifact pipeline.
 * This is the KEY INNOVATION: seeds don't just hold parameters — they UNFOLD
 * through developmental stages, like biological morphogenesis.
 */
export interface DevelopmentalStage {
  name: string;
  description: string;
  execute: (context: DevelopmentalContext) => DevelopmentalContext;
}

export interface DevelopmentalContext {
  seed: UniversalSeed;
  rng: DeterministicRNG;
  stage: number;
  totalStages: number;
  artifacts: Map<string, unknown>;
  parameters: Record<string, unknown>;
}

export interface GenerationResult {
  success: boolean;
  artifacts: Map<string, unknown>;
  timing: {
    totalMs: number;
    stageTimings: Array<{ stage: string; ms: number }>;
  };
  errors: string[];
}

// ============================================================================
// ABSTRACT DOMAIN ENGINE
// ============================================================================

export abstract class DomainEngine {
  abstract readonly domain: SeedDomain;
  abstract readonly name: string;
  abstract readonly version: string;

  /**
   * Define the developmental pipeline for this domain
   */
  abstract stages(): DevelopmentalStage[];

  /**
   * Create a default seed with sensible gene defaults for this domain
   */
  abstract defaultGenes(): GeneMap;

  /**
   * Domain-specific fitness evaluation
   */
  abstract evaluate(seed: UniversalSeed): FitnessVector;

  /**
   * Safely extract a gene value, handling both proper Gene objects and raw values.
   * This is critical for seeds created by the interpreter where genes may be raw scalars.
   */
  protected getGeneValue(key: string, genes: GeneMap, defaultValue?: unknown): unknown {
    const gene = genes[key];
    if (!gene) {
      const def = this.defaultGenes()[key];
      return def ? (def as any).value : defaultValue;
    }
    const val = (gene as any).value !== undefined ? (gene as any).value : gene;
    return val !== null && val !== undefined ? val : defaultValue;
  }

  /**
   * Run the full developmental pipeline
   */
  generate(seed: UniversalSeed, rngSeed?: string): GenerationResult {
    const startTime = Date.now();
    const stages = this.stages();
    const errors: string[] = [];
    const stageTimings: Array<{ stage: string; ms: number }> = [];

    // Validate seed matches this domain
    const validationErrors = this.validate(seed);
    if (validationErrors.length > 0) {
      return {
        success: false,
        artifacts: new Map(),
        timing: { totalMs: 0, stageTimings: [] },
        errors: validationErrors,
      };
    }

    // Normalize genes: merge user-provided genes with engine defaults
    // This handles seeds from the interpreter where genes may be raw values
    const normalizedSeed = this.normalizeGenes(seed);

    // Create RNG from seed hash or explicit seed
    const rng = new DeterministicRNG(rngSeed ?? seed.$hash);

    // Initialize context
    let context: DevelopmentalContext = {
      seed: normalizedSeed,
      rng,
      stage: 0,
      totalStages: stages.length,
      artifacts: new Map(),
      parameters: {},
    };

    // Execute each stage
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const stageStart = Date.now();

      try {
        context = stage.execute(context);
        context.stage = i + 1;
      } catch (err) {
        errors.push(`Stage ${i} (${stage.name}): ${err instanceof Error ? err.message : String(err)}`);
        return {
          success: false,
          artifacts: context.artifacts,
          timing: {
            totalMs: Date.now() - startTime,
            stageTimings,
          },
          errors,
        };
      }

      const stageMs = Date.now() - stageStart;
      stageTimings.push({ stage: stage.name, ms: stageMs });
    }

    const totalMs = Date.now() - startTime;

    return {
      success: true,
      artifacts: context.artifacts,
      timing: { totalMs, stageTimings },
      errors: [],
    };
  }

  /**
   * Normalize seed genes: merge with engine defaults so every gene has proper structure.
   * If a gene is a raw value (from interpreter), wrap it in the default gene's structure.
   */
  protected normalizeGenes(seed: UniversalSeed): UniversalSeed {
    const defaults = this.defaultGenes();
    const normalized: GeneMap = {};

    // Start with all defaults
    for (const [key, defaultGene] of Object.entries(defaults)) {
      normalized[key] = cloneGene(defaultGene as Gene);
    }

    // Override with seed's genes
    for (const [key, gene] of Object.entries(seed.genes)) {
      if (gene && typeof gene === 'object' && 'type' in gene && 'value' in gene) {
        // Proper Gene object — use as-is
        normalized[key] = gene as Gene;
      } else if (key in defaults) {
        // Raw value — inject into a clone of the default gene
        const def = cloneGene(defaults[key] as Gene);
        (def as any).value = (gene as any).value !== undefined ? (gene as any).value : gene;
        normalized[key] = def;
      } else {
        // Unknown gene key, pass through
        normalized[key] = gene as Gene;
      }
    }

    // Return a new seed with normalized genes (don't mutate original)
    return {
      ...seed,
      genes: normalized,
    };
  }

  /**
   * Validate that a seed's genes are compatible with this domain
   */
  validate(seed: UniversalSeed): string[] {
    const errors: string[] = [];

    if (seed.$domain !== this.domain) {
      errors.push(
        `Seed domain "${seed.$domain}" does not match engine domain "${this.domain}"`
      );
    }

    return errors;
  }
}

// ============================================================================
// ENGINE REGISTRY
// ============================================================================

/**
 * Engine Registry — singleton that manages all domain engines
 */
export class EngineRegistry {
  private engines: Map<SeedDomain, DomainEngine> = new Map();

  register(engine: DomainEngine): void {
    this.engines.set(engine.domain, engine);
  }

  get(domain: SeedDomain): DomainEngine | undefined {
    return this.engines.get(domain);
  }

  has(domain: SeedDomain): boolean {
    return this.engines.has(domain);
  }

  list(): Array<{ domain: SeedDomain; name: string; version: string }> {
    const result: Array<{ domain: SeedDomain; name: string; version: string }> = [];
    for (const [domain, engine] of this.engines) {
      result.push({
        domain,
        name: engine.name,
        version: engine.version,
      });
    }
    return result;
  }

  /**
   * Generate from any seed by routing to the right engine
   */
  generate(seed: UniversalSeed, rngSeed?: string): GenerationResult {
    const engine = this.get(seed.$domain);
    if (!engine) {
      return {
        success: false,
        artifacts: new Map(),
        timing: { totalMs: 0, stageTimings: [] },
        errors: [`No engine registered for domain "${seed.$domain}"`],
      };
    }
    return engine.generate(seed, rngSeed);
  }

  /**
   * Get default genes for a domain
   */
  defaultGenes(domain: SeedDomain): GeneMap | null {
    const engine = this.get(domain);
    return engine ? engine.defaultGenes() : null;
  }
}

// Global registry instance
export const registry = new EngineRegistry();
