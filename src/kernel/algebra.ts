/**
 * algebra.ts — Seed Algebra (Category Theory)
 * Provides algebraic operations on seeds, treating them as mathematical objects in a category.
 * Includes breed, compose, interpolate, and domain functors.
 */

import { GeneMap, Gene, cloneGene, cloneGeneMap, ScalarGene, VectorGene, CategoricalGene } from './genes.js';
import { UniversalSeed, createSeed, computeHash, SeedDomain, recordOperation, cloneSeed } from './seed.js';
import { DeterministicRNG, lerp, clamp } from './rng.js';
import { crossover, mutate, CrossoverOptions, MutationOptions, computeGeneticDistance } from './operators.js';

// ============================================================================
// BREED: Commutative Composition (A ⊕ B)
// ============================================================================

/**
 * Breed two seeds together: takes genes from both parents weighted by dominance.
 * This is commutative: breed(A, B) is semantically similar to breed(B, A) with inverted dominance.
 *
 * @param seedA First parent seed
 * @param seedB Second parent seed
 * @param dominance Probability (0-1) that a gene comes from seedA (defaults to 0.5)
 * @param rng Optional RNG for determinism
 * @returns A new seed with mixed genes from both parents
 */
export function breed<T extends GeneMap>(
  seedA: UniversalSeed<T>,
  seedB: UniversalSeed<T>,
  dominance: number = 0.5,
  rng?: DeterministicRNG
): UniversalSeed<T> {
  const _rng = rng ?? new DeterministicRNG(`breed_${seedA.$hash}_${seedB.$hash}`);

  // Use crossover with uniform strategy (most commutative approach)
  const offspring = crossover(seedA, seedB, {
    strategy: 'uniform',
    dominance: Math.max(0, Math.min(1, dominance)),
  }, _rng);

  // Record the breeding operation
  return recordOperation(offspring, {
    type: 'crossover',
    timestamp: Date.now(),
    details: {
      operation: 'breed',
      parentA: seedA.$hash,
      parentB: seedB.$hash,
      dominance,
    },
  });
}

// ============================================================================
// COMPOSE: Non-Commutative Overlay (A ⊗ B)
// ============================================================================

/**
 * Compose two seeds: B's genes override A's where present.
 * This is non-commutative: compose(A, B) != compose(B, A)
 *
 * @param base Base seed
 * @param overlay Overlay seed whose genes override base
 * @param layers Which gene keys to overlay (all if omitted)
 * @param weight How much of overlay vs base (0-1, default 1.0 = full overlay)
 * @returns A new seed with overlaid genes
 */
export function compose<T extends GeneMap>(
  base: UniversalSeed<T>,
  overlay: UniversalSeed<T>,
  layers?: string[],
  weight: number = 1.0
): UniversalSeed<T> {
  const w = Math.max(0, Math.min(1, weight));
  const layerSet = new Set(layers);

  const composedGenes: GeneMap = cloneGeneMap(base.genes);

  for (const key of Object.keys(overlay.genes)) {
    // Skip if layers are specified and this key is not in them
    if (layers && !layerSet.has(key)) {
      continue;
    }

    const baseGene = composedGenes[key];
    const overlayGene = overlay.genes[key];

    if (!baseGene) {
      // No base gene for this key, just clone from overlay
      composedGenes[key] = cloneGene(overlayGene);
    } else if (baseGene.type !== overlayGene.type) {
      // Type mismatch: take from overlay
      composedGenes[key] = cloneGene(overlayGene);
    } else {
      // Same type: blend based on weight
      composedGenes[key] = blendGenes(baseGene, overlayGene, w);
    }
  }

  const composed = cloneSeed(base);
  composed.genes = composedGenes as T;
  composed.$name = `${base.$name}_∘_${overlay.$name}`;

  return recordOperation(composed, {
    type: 'composition',
    timestamp: Date.now(),
    details: {
      base: base.$hash,
      overlay: overlay.$hash,
      layers: layers ?? 'all',
      weight: w,
    },
  });
}

/**
 * Helper: blend two genes of the same type by weight
 */
function blendGenes(baseGene: Gene, overlayGene: Gene, weight: number): Gene {
  const result = cloneGene(baseGene);

  switch (result.type) {
    case 'scalar': {
      const base = baseGene as ScalarGene;
      const overlay = overlayGene as ScalarGene;
      const r = result as ScalarGene;
      r.value = lerp(base.value, overlay.value, weight);
      r.value = clamp(r.value, r.min, r.max);
      break;
    }

    case 'vector': {
      const base = baseGene as VectorGene;
      const overlay = overlayGene as VectorGene;
      const r = result as VectorGene;
      if (base.dimensions === overlay.dimensions) {
        for (let i = 0; i < base.dimensions; i++) {
          let blended = lerp(base.value[i], overlay.value[i], weight);
          if (base.min && base.max) {
            blended = clamp(blended, base.min[i] ?? 0, base.max[i] ?? 1);
          }
          r.value[i] = blended;
        }
      }
      break;
    }

    case 'categorical': {
      const overlay = overlayGene as CategoricalGene;
      const r = result as CategoricalGene;
      // For categorical, weight > 0.5 means take overlay
      if (weight > 0.5) {
        r.value = overlay.value;
      }
      break;
    }

    // Other types: keep base as-is
  }

  return result;
}

// ============================================================================
// INTERPOLATE: Linear Interpolation in Gene Space
// ============================================================================

/**
 * Linearly interpolate between two seeds in gene space.
 *
 * @param seedA First seed (t=0)
 * @param seedB Second seed (t=1)
 * @param t Interpolation parameter (0 = A, 1 = B, 0.5 = midpoint)
 * @returns Interpolated seed
 */
export function interpolate<T extends GeneMap>(
  seedA: UniversalSeed<T>,
  seedB: UniversalSeed<T>,
  t: number
): UniversalSeed<T> {
  const _t = Math.max(0, Math.min(1, t));
  const interpolated = cloneSeed(seedA);
  const resultGenes: GeneMap = {};

  // Interpolate each gene
  const allKeys = new Set([...Object.keys(seedA.genes), ...Object.keys(seedB.genes)]);

  for (const key of allKeys) {
    const geneA = seedA.genes[key];
    const geneB = seedB.genes[key];

    if (!geneA) {
      resultGenes[key] = cloneGene(geneB);
    } else if (!geneB) {
      resultGenes[key] = cloneGene(geneA);
    } else if (geneA.type !== geneB.type) {
      // Type mismatch: pick one based on t
      resultGenes[key] = cloneGene(_t < 0.5 ? geneA : geneB);
    } else {
      resultGenes[key] = interpolateGene(geneA, geneB, _t);
    }
  }

  interpolated.genes = resultGenes as T;
  interpolated.$name = `${seedA.$name}_lerp_${seedB.$name}`;

  return recordOperation(interpolated, {
    type: 'adaptation',
    timestamp: Date.now(),
    details: {
      seedA: seedA.$hash,
      seedB: seedB.$hash,
      parameter: _t,
    },
  });
}

/**
 * Interpolate a single gene
 */
function interpolateGene(geneA: Gene, geneB: Gene, t: number): Gene {
  const result = cloneGene(geneA);

  switch (result.type) {
    case 'scalar': {
      const a = geneA as ScalarGene;
      const b = geneB as ScalarGene;
      const r = result as ScalarGene;
      r.value = lerp(a.value, b.value, t);
      r.value = clamp(r.value, r.min, r.max);
      break;
    }

    case 'vector': {
      const a = geneA as VectorGene;
      const b = geneB as VectorGene;
      const r = result as VectorGene;
      if (a.dimensions === b.dimensions) {
        for (let i = 0; i < a.dimensions; i++) {
          let interpolated = lerp(a.value[i], b.value[i], t);
          if (a.min && a.max) {
            interpolated = clamp(interpolated, a.min[i] ?? 0, a.max[i] ?? 1);
          }
          r.value[i] = interpolated;
        }
      }
      break;
    }

    case 'categorical': {
      // For categorical, pick based on which side of 0.5 we are
      const a = geneA as CategoricalGene;
      const b = geneB as CategoricalGene;
      const r = result as CategoricalGene;
      r.value = t < 0.5 ? a.value : b.value;
      break;
    }

    // Other types: keep base as-is
  }

  return result;
}

// ============================================================================
// SEED EXPRESSION: Lazy Pipeline Builder
// ============================================================================

/**
 * SeedExpression: Fluent interface for chaining seed transformations.
 * Operations accumulate and only execute on evaluate().
 */
export class SeedExpression<T extends GeneMap = GeneMap> {
  private seed: UniversalSeed<T>;
  private operations: Array<(seed: UniversalSeed<T>, rng: DeterministicRNG) => UniversalSeed<T>>;

  constructor(seed: UniversalSeed<T>) {
    this.seed = cloneSeed(seed) as UniversalSeed<T>;
    this.operations = [];
  }

  /**
   * Chain a breed operation
   */
  breed(other: UniversalSeed<T>, dominance: number = 0.5): SeedExpression<T> {
    this.operations.push((current, rng) => breed(current, other, dominance, rng));
    return this;
  }

  /**
   * Chain a compose operation
   */
  compose(overlay: UniversalSeed<T>, layers?: string[], weight: number = 1.0): SeedExpression<T> {
    this.operations.push((current) => compose(current, overlay, layers, weight));
    return this;
  }

  /**
   * Chain a mutate operation
   */
  mutate(rate: number = 0.1, intensity: number = 0.3): SeedExpression<T> {
    this.operations.push((current, rng) => {
      return mutate(current, { rate, intensity }, rng);
    });
    return this;
  }

  /**
   * Chain an interpolate operation
   */
  interpolate(target: UniversalSeed<T>, t: number): SeedExpression<T> {
    this.operations.push((current) => interpolate(current, target, t));
    return this;
  }

  /**
   * Chain a custom mapping function on genes
   */
  map(fn: (genes: T) => T): SeedExpression<T> {
    this.operations.push((current) => {
      const mapped = cloneSeed(current) as UniversalSeed<T>;
      mapped.genes = fn(cloneGeneMap(current.genes) as T);
      return recordOperation(mapped, {
        type: 'adaptation',
        timestamp: Date.now(),
        details: { operation: 'custom_map' },
      });
    });
    return this;
  }

  /**
   * Execute the pipeline and return the final seed
   */
  evaluate(rng?: DeterministicRNG): UniversalSeed<T> {
    const _rng = rng ?? new DeterministicRNG(`expr_${this.seed.$hash}`);
    let result = this.seed;

    for (const operation of this.operations) {
      result = operation(result, _rng);
    }

    return result;
  }
}

// ============================================================================
// DOMAIN FUNCTOR: Cross-Domain Transfer
// ============================================================================

/**
 * DomainFunctor: Maps seeds between domains (category theory).
 * Provides provably correct cross-domain transfer.
 */
export interface DomainFunctor {
  source: SeedDomain;
  target: SeedDomain;
  name: string;

  /**
   * Map genes from source domain to target domain
   */
  mapGenes(sourceGenes: GeneMap): GeneMap;

  /**
   * Map a complete seed
   */
  mapSeed(seed: UniversalSeed): UniversalSeed;
}

/**
 * Create a domain functor from a mapping function
 */
export function createFunctor(
  source: SeedDomain,
  target: SeedDomain,
  name: string,
  geneMapping: (genes: GeneMap) => GeneMap
): DomainFunctor {
  return {
    source,
    target,
    name,
    mapGenes: geneMapping,
    mapSeed: (seed: UniversalSeed): UniversalSeed => {
      const mapped = cloneSeed(seed);
      const mappedGenes = geneMapping(mapped.genes);
      const transformed: UniversalSeed = {
        $gst: mapped.$gst,
        $domain: target,
        $hash: '',
        $name: `${seed.$name}_via_${name}`,
        $lineage: mapped.$lineage,
        genes: mappedGenes,
        $fitness: mapped.$fitness,
        $metadata: { ...mapped.$metadata, modified: Date.now() },
      };
      transformed.$hash = computeHash(transformed);

      return recordOperation(transformed, {
        type: 'adaptation',
        timestamp: Date.now(),
        details: {
          operation: 'functor_map',
          functor: name,
          source,
          target,
        },
      });
    },
  };
}

// ============================================================================
// FUNCTOR REGISTRY
// ============================================================================

/**
 * FunctorRegistry: Manages and composes domain functors
 */
export class FunctorRegistry {
  private functors: Map<string, DomainFunctor> = new Map();

  /**
   * Register a functor with a composite key
   */
  register(functor: DomainFunctor): void {
    const key = `${functor.source}→${functor.target}`;
    this.functors.set(key, functor);
  }

  /**
   * Get a functor from source to target domain
   */
  get(source: SeedDomain, target: SeedDomain): DomainFunctor | undefined {
    const key = `${source}→${target}`;
    return this.functors.get(key);
  }

  /**
   * Apply a functor to transform a seed
   */
  transform(seed: UniversalSeed, targetDomain: SeedDomain): UniversalSeed {
    const functor = this.get(seed.$domain, targetDomain);
    if (!functor) {
      throw new Error(
        `No functor registered from ${seed.$domain} to ${targetDomain}`
      );
    }
    return functor.mapSeed(seed);
  }

  /**
   * Compose two functors: F: A→B, G: B→C => (G∘F): A→C
   */
  compose(f: DomainFunctor, g: DomainFunctor): DomainFunctor {
    if (f.target !== g.source) {
      throw new Error(
        `Cannot compose functors: ${f.target} ≠ ${g.source}`
      );
    }

    const compositeName = `${f.name}∘${g.name}`;

    return createFunctor(
      f.source,
      g.target,
      compositeName,
      (genes: GeneMap): GeneMap => {
        const intermediate = f.mapGenes(genes);
        return g.mapGenes(intermediate);
      }
    );
  }

  /**
   * List all registered functors
   */
  list(): Array<{ source: SeedDomain; target: SeedDomain; name: string }> {
    const result: Array<{ source: SeedDomain; target: SeedDomain; name: string }> = [];
    for (const functor of this.functors.values()) {
      result.push({
        source: functor.source,
        target: functor.target,
        name: functor.name,
      });
    }
    return result;
  }
}

// ============================================================================
// CONVENIENCE ENTRY POINT
// ============================================================================

/**
 * Start a pipeline: from(seed).breed(...).compose(...).evaluate()
 */
export function from<T extends GeneMap>(seed: UniversalSeed<T>): SeedExpression<T> {
  return new SeedExpression(seed);
}
