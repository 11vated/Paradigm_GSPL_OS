/**
 * composer.ts — Cross-Domain Composition
 * Composes seeds from different domains into unified experiences.
 */

import {
  UniversalSeed,
  SeedDomain,
  createSeed,
  cloneSeed,
  recordOperation,
} from '../kernel/seed.js';
import { GeneMap, Gene, scalar, categorical, vector, cloneGene, cloneGeneMap } from '../kernel/genes.js';
import { registry, GenerationResult } from '../engines/engine.js';
import { FunctorRegistry, createFunctor } from '../kernel/algebra.js';
import { DeterministicRNG } from '../kernel/rng.js';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface CompositionRecipe {
  name: string;
  description: string;
  layers: CompositionLayer[];
  bindings: CrossDomainBinding[];
}

export interface CompositionLayer {
  name: string;
  domain: SeedDomain;
  seed: UniversalSeed;
  priority: number;
  enabled: boolean;
}

export interface CrossDomainBinding {
  sourceDomain: SeedDomain;
  sourceGene: string;
  targetDomain: SeedDomain;
  targetGene: string;
  transform?: (value: unknown) => unknown;
  description?: string;
}

export interface CompositionResult {
  name: string;
  layers: Array<{
    name: string;
    domain: SeedDomain;
    generation: GenerationResult;
  }>;
  timing: { totalMs: number; layerTimings: Record<string, number> };
  errors: string[];
}

// ============================================================================
// SEED COMPOSER
// ============================================================================

export class SeedComposer {
  private functorRegistry: FunctorRegistry;
  private presetBindings: CrossDomainBinding[] = [];

  constructor() {
    this.functorRegistry = new FunctorRegistry();
  }

  /**
   * Create a composition from multiple seeds
   */
  compose(recipe: CompositionRecipe): CompositionResult {
    const startTime = Date.now();
    const layerTimings: Record<string, number> = {};
    const errors: string[] = [];
    const results: Array<{
      name: string;
      domain: SeedDomain;
      generation: GenerationResult;
    }> = [];

    // Sort layers by priority
    const sortedLayers = [...recipe.layers].sort(
      (a, b) => a.priority - b.priority
    );

    // Apply cross-domain bindings
    let updatedLayers = this.applyBindings(sortedLayers, recipe.bindings);

    // Generate each layer
    for (const layer of updatedLayers) {
      if (!layer.enabled) {
        continue;
      }

      const layerStart = Date.now();
      const engine = registry.get(layer.domain);

      if (!engine) {
        errors.push(`No engine registered for domain: ${layer.domain}`);
        continue;
      }

      const generation = engine.generate(layer.seed);
      const layerMs = Date.now() - layerStart;
      layerTimings[layer.name] = layerMs;

      results.push({
        name: layer.name,
        domain: layer.domain,
        generation,
      });

      if (!generation.success) {
        errors.push(
          `Layer ${layer.name} generation failed: ${generation.errors.join(', ')}`
        );
      }
    }

    const totalMs = Date.now() - startTime;

    return {
      name: recipe.name,
      layers: results,
      timing: { totalMs, layerTimings },
      errors,
    };
  }

  /**
   * Quick compose — just provide seeds, auto-detect bindings
   */
  quickCompose(name: string, ...seeds: UniversalSeed[]): CompositionResult {
    const layers: CompositionLayer[] = seeds.map((seed, i) => ({
      name: seed.$name,
      domain: seed.$domain,
      seed,
      priority: i,
      enabled: true,
    }));

    // Auto-detect applicable bindings
    const applicableBindings = this.getApplicableBindings(
      layers.map(l => l.domain)
    );

    const recipe: CompositionRecipe = {
      name,
      description: `Quick composition of ${seeds.length} seeds`,
      layers,
      bindings: applicableBindings,
    };

    return this.compose(recipe);
  }

  /**
   * Register preset cross-domain bindings
   */
  registerBinding(binding: CrossDomainBinding): void {
    this.presetBindings.push(binding);
  }

  /**
   * Apply bindings — propagate gene values across domains
   */
  applyBindings(
    layers: CompositionLayer[],
    bindings: CrossDomainBinding[]
  ): CompositionLayer[] {
    const updated = layers.map(layer => ({
      ...layer,
      seed: cloneSeed(layer.seed),
    }));

    for (const binding of bindings) {
      // Find source and target layers
      const sourceLayer = updated.find(l => l.domain === binding.sourceDomain);
      const targetLayer = updated.find(l => l.domain === binding.targetDomain);

      if (!sourceLayer || !targetLayer) {
        continue;
      }

      // Get source gene value
      const sourceGene = sourceLayer.seed.genes[binding.sourceGene];
      if (!sourceGene) {
        continue;
      }

      let value = sourceGene.value;

      // Apply transform if provided
      if (binding.transform) {
        try {
          value = binding.transform(value) as any;
        } catch {
          continue;
        }
      }

      // Apply to target gene
      const targetGene = targetLayer.seed.genes[binding.targetGene];
      if (targetGene) {
        try {
          const updatedGene = this.updateGeneValue(targetGene, value);
          targetLayer.seed.genes[binding.targetGene] = updatedGene;
        } catch {
          continue;
        }
      }
    }

    return updated;
  }

  /**
   * Update a gene's value while preserving type and bounds
   */
  private updateGeneValue(gene: Gene, value: unknown): Gene {
    const updated = cloneGene(gene);

    switch (updated.type) {
      case 'scalar': {
        const g = updated as any;
        if (typeof value === 'number') {
          g.value = Math.max(g.min, Math.min(g.max, value));
        }
        break;
      }

      case 'categorical': {
        const g = updated as any;
        if (typeof value === 'string' && g.options.includes(value)) {
          g.value = value;
        }
        break;
      }

      case 'vector': {
        const g = updated as any;
        if (Array.isArray(value) && value.length === g.dimensions) {
          g.value = value.map((v: unknown, i: number) => {
            let num = typeof v === 'number' ? v : 0;
            if (g.min) num = Math.max(g.min[i] ?? 0, num);
            if (g.max) num = Math.min(g.max[i] ?? 1, num);
            return num;
          });
        }
        break;
      }
    }

    return updated;
  }

  /**
   * Get applicable bindings for a set of domains
   */
  private getApplicableBindings(domains: SeedDomain[]): CrossDomainBinding[] {
    const domainSet = new Set(domains);
    const applicable: CrossDomainBinding[] = [];

    // Check default bindings
    const defaults = SeedComposer.defaultBindings();
    for (const binding of defaults) {
      if (
        domainSet.has(binding.sourceDomain) &&
        domainSet.has(binding.targetDomain)
      ) {
        applicable.push(binding);
      }
    }

    // Check registered bindings
    for (const binding of this.presetBindings) {
      if (
        domainSet.has(binding.sourceDomain) &&
        domainSet.has(binding.targetDomain)
      ) {
        // Avoid duplicates
        if (
          !applicable.some(
            b =>
              b.sourceDomain === binding.sourceDomain &&
              b.sourceGene === binding.sourceGene &&
              b.targetDomain === binding.targetDomain &&
              b.targetGene === binding.targetGene
          )
        ) {
          applicable.push(binding);
        }
      }
    }

    return applicable;
  }

  /**
   * Get built-in cross-domain binding presets
   */
  static defaultBindings(): CrossDomainBinding[] {
    return [
      {
        sourceDomain: 'visual2d',
        sourceGene: 'palette',
        targetDomain: 'audio',
        targetGene: 'key',
        transform: (value) => {
          // Map color temperature (palette index) to musical key
          if (typeof value === 'string') {
            const colorToKey: Record<string, string> = {
              warm: 'C',
              neutral: 'G',
              cool: 'D',
              cold: 'A',
            };
            return colorToKey[value] || 'C';
          }
          return 'C';
        },
        description:
          'Color temperature → musical key (warm=C, cool=D, etc.)',
      },

      {
        sourceDomain: 'procedural',
        sourceGene: 'complexity',
        targetDomain: 'game',
        targetGene: 'difficulty',
        transform: (value) => {
          // Map terrain complexity to game difficulty
          if (typeof value === 'number') {
            if (value < 0.3) return 'easy';
            if (value < 0.6) return 'normal';
            if (value < 0.8) return 'hard';
            return 'extreme';
          }
          return 'normal';
        },
        description: 'Terrain roughness → game challenge level',
      },

      {
        sourceDomain: 'animation',
        sourceGene: 'tempo',
        targetDomain: 'audio',
        targetGene: 'tempo',
        transform: (value) => {
          // Direct mapping of animation tempo to audio tempo
          return value;
        },
        description: 'Animation speed → music speed',
      },

      {
        sourceDomain: 'visual2d',
        sourceGene: 'density',
        targetDomain: 'audio',
        targetGene: 'density',
        transform: (value) => {
          // Visual density → note density
          return value;
        },
        description: 'Visual density → note density (frequency)',
      },

      {
        sourceDomain: 'procedural',
        sourceGene: 'type',
        targetDomain: 'game',
        targetGene: 'theme',
        transform: (value) => {
          // Map terrain type to game theme
          if (typeof value === 'string') {
            const typeToTheme: Record<string, string> = {
              mountain: 'adventure',
              desert: 'survival',
              forest: 'exploration',
              urban: 'cyberpunk',
              alien: 'scifi',
              organic: 'nature',
            };
            return typeToTheme[value] || 'fantasy';
          }
          return 'fantasy';
        },
        description: 'Terrain type → game genre hint',
      },
    ];
  }
}
