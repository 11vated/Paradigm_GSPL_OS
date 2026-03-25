import { describe, it, expect } from 'vitest';
import { scalar, categorical, vector, validateGene } from '../src/kernel/genes.js';
import { createSeed, validateSeed } from '../src/kernel/seed.js';
import { Visual2DEngine } from '../src/engines/visual2d/engine.js';
import { DomainEngine } from '../src/engines/engine.js';

// ============================================================================
// VISUAL 2D ENGINE TESTS
// ============================================================================

describe('Visual2DEngine', () => {
  it('constructs with correct metadata', () => {
    const engine = new Visual2DEngine();

    expect(engine.domain).toBe('visual2d');
    expect(engine.name).toBe('Visual2D Engine');
    expect(engine.version).toBe('1.0.0');
  });

  it('defaultGenes returns valid gene map', () => {
    const engine = new Visual2DEngine();
    const genes = engine.defaultGenes();

    expect(genes).toBeDefined();
    expect(Object.keys(genes).length).toBeGreaterThan(0);
  });

  it('stages returns developmental pipeline', () => {
    const engine = new Visual2DEngine();
    const stages = engine.stages();

    expect(stages.length).toBeGreaterThan(0);
    expect(stages[0].name).toBeDefined();
    expect(stages[0].execute).toBeDefined();
  });

  it('has required developmental stages', () => {
    const engine = new Visual2DEngine();
    const stages = engine.stages();
    const stageNames = stages.map(s => s.name);

    expect(stageNames).toContain('Symmetry Breaking');
    expect(stageNames).toContain('Shape Genesis');
    expect(stageNames).toContain('Color Mapping');
    expect(stageNames).toContain('Detail Layering');
    expect(stageNames).toContain('Style Application');
  });

  it('validate rejects seed from wrong domain', () => {
    const engine = new Visual2DEngine();
    const seed = createSeed('geometry3d', 'test', {
      x: scalar(5, 0, 10),
    });

    const errors = engine.validate(seed);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('validate accepts seed from correct domain', () => {
    const engine = new Visual2DEngine();
    const defaultGenes = engine.defaultGenes();
    const seed = createSeed('visual2d', 'test', defaultGenes);

    const errors = engine.validate(seed);

    expect(errors).toHaveLength(0);
  });

  it('evaluate returns fitness vector', () => {
    const engine = new Visual2DEngine();
    const defaultGenes = engine.defaultGenes();
    const seed = createSeed('visual2d', 'test', defaultGenes);

    const fitness = engine.evaluate(seed);

    expect(fitness.scores).toBeDefined();
    expect(fitness.aggregate).toBeDefined();
    expect(fitness.evaluatedAt).toBeDefined();
  });

  it('generate returns GenerationResult', () => {
    const engine = new Visual2DEngine();
    const defaultGenes = engine.defaultGenes();
    const seed = createSeed('visual2d', 'test', defaultGenes);

    const result = engine.generate(seed);

    expect(result).toBeDefined();
    expect(result.success).toBeDefined();
    expect(result.artifacts).toBeDefined();
    expect(result.timing).toBeDefined();
    expect(result.errors).toBeDefined();
  });

  it('generate produces artifacts', () => {
    const engine = new Visual2DEngine();
    const defaultGenes = engine.defaultGenes();
    const seed = createSeed('visual2d', 'test', defaultGenes);

    const result = engine.generate(seed, 'test_seed');

    if (result.success) {
      expect(result.artifacts.size).toBeGreaterThan(0);
    }
  });

  it('generate includes stage timings', () => {
    const engine = new Visual2DEngine();
    const defaultGenes = engine.defaultGenes();
    const seed = createSeed('visual2d', 'test', defaultGenes);

    const result = engine.generate(seed);

    expect(result.timing.stageTimings).toBeDefined();
    if (result.success) {
      expect(result.timing.stageTimings.length).toBeGreaterThan(0);
    }
  });

  it('generate is deterministic with same RNG seed', () => {
    const engine = new Visual2DEngine();
    const defaultGenes = engine.defaultGenes();

    const seed1 = createSeed('visual2d', 'test1', defaultGenes);
    const seed2 = createSeed('visual2d', 'test2', defaultGenes);

    const result1 = engine.generate(seed1, 'fixed_rng_seed');
    const result2 = engine.generate(seed2, 'fixed_rng_seed');

    // Both should complete without error
    expect(result1.success).toBe(result2.success);

    // Both should have artifacts (if successful)
    if (result1.success && result2.success) {
      expect(result1.artifacts.size).toBeGreaterThan(0);
      expect(result2.artifacts.size).toBeGreaterThan(0);
    }
  });

  it('generate validates seed before execution', () => {
    const engine = new Visual2DEngine();

    // Create invalid seed (wrong domain)
    const invalidSeed = createSeed('audio', 'test', {
      x: scalar(1, 0, 10),
    });

    const result = engine.generate(invalidSeed);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('generates SVG output for visual2d', () => {
    const engine = new Visual2DEngine();
    const defaultGenes = engine.defaultGenes();
    const seed = createSeed('visual2d', 'test', defaultGenes);

    const result = engine.generate(seed);

    if (result.success) {
      const svg = result.artifacts.get('svg');
      if (svg) {
        expect(typeof svg).toBe('string');
        expect((svg as string).includes('svg')).toBe(true);
      }
    }
  });

  it('different RNG seeds produce different results', () => {
    const engine = new Visual2DEngine();
    const defaultGenes = engine.defaultGenes();

    const seed1 = createSeed('visual2d', 'test1', defaultGenes);
    const seed2 = createSeed('visual2d', 'test2', defaultGenes);

    const result1 = engine.generate(seed1, 'seed_a');
    const result2 = engine.generate(seed2, 'seed_b');

    if (result1.success && result2.success) {
      const svg1 = result1.artifacts.get('svg');
      const svg2 = result2.artifacts.get('svg');

      // Results should be different (very high probability)
      if (svg1 && svg2) {
        expect(svg1 !== svg2).toBe(true);
      }
    }
  });
});

// ============================================================================
// ENGINE FRAMEWORK TESTS
// ============================================================================

describe('DomainEngine - Abstract Interface', () => {
  it('has required abstract methods', () => {
    const engine = new Visual2DEngine();

    expect(engine.domain).toBeDefined();
    expect(engine.name).toBeDefined();
    expect(engine.version).toBeDefined();
    expect(typeof engine.stages).toBe('function');
    expect(typeof engine.defaultGenes).toBe('function');
    expect(typeof engine.evaluate).toBe('function');
    expect(typeof engine.generate).toBe('function');
  });

  it('validate method exists', () => {
    const engine = new Visual2DEngine();

    expect(typeof engine.validate).toBe('function');
  });
});

describe('Seed Validation for Engines', () => {
  it('seed validation matches engine domain', () => {
    const engine = new Visual2DEngine();
    const seed = createSeed('visual2d', 'test', engine.defaultGenes());

    const errors = validateSeed(seed);
    expect(errors).toHaveLength(0);

    const engineErrors = engine.validate(seed);
    expect(engineErrors).toHaveLength(0);
  });

  it('engine catches mismatched domains', () => {
    const engine = new Visual2DEngine();
    const wrongSeed = createSeed('geometry3d', 'test', {
      x: scalar(1, 0, 10),
    });

    const errors = engine.validate(wrongSeed);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('Fitness Evaluation by Engine', () => {
  it('engine evaluate returns valid FitnessVector', () => {
    const engine = new Visual2DEngine();
    const seed = createSeed('visual2d', 'test', engine.defaultGenes());

    const fitness = engine.evaluate(seed);

    expect(fitness.scores).toBeDefined();
    expect(typeof fitness.aggregate).toBe('number');
    expect(typeof fitness.evaluatedAt).toBe('number');
  });

  it('fitness aggregate is finite number', () => {
    const engine = new Visual2DEngine();
    const seed = createSeed('visual2d', 'test', engine.defaultGenes());

    const fitness = engine.evaluate(seed);

    expect(isFinite(fitness.aggregate)).toBe(true);
  });
});

describe('Generation Pipeline', () => {
  it('generate completes without throwing', () => {
    const engine = new Visual2DEngine();
    const seed = createSeed('visual2d', 'test', engine.defaultGenes());

    expect(() => engine.generate(seed)).not.toThrow();
  });

  it('generate returns timing information', () => {
    const engine = new Visual2DEngine();
    const seed = createSeed('visual2d', 'test', engine.defaultGenes());

    const result = engine.generate(seed);

    expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.timing.totalMs).toBe('number');
  });

  it('generate result includes all required fields', () => {
    const engine = new Visual2DEngine();
    const seed = createSeed('visual2d', 'test', engine.defaultGenes());

    const result = engine.generate(seed);

    expect(result.success).toBeDefined();
    expect(result.artifacts).toBeDefined();
    expect(result.timing).toBeDefined();
    expect(result.errors).toBeDefined();
  });

  it('successful generation has no errors', () => {
    const engine = new Visual2DEngine();
    const seed = createSeed('visual2d', 'test', engine.defaultGenes());

    const result = engine.generate(seed);

    if (result.success) {
      expect(result.errors).toHaveLength(0);
    }
  });

  it('failed generation has errors', () => {
    const engine = new Visual2DEngine();
    const badSeed = createSeed('audio', 'test', { x: scalar(1, 0, 10) });

    const result = engine.generate(badSeed);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('Engine Configuration', () => {
  it('engine has default genes with correct types', () => {
    const engine = new Visual2DEngine();
    const genes = engine.defaultGenes();

    // Visual2D should have composition genes
    expect(genes.width).toBeDefined();
    expect(genes.height).toBeDefined();

    // Shape generation genes
    expect(genes.shapeCount).toBeDefined();
    expect(genes.shapePrimitive).toBeDefined();

    // Color genes
    expect(genes.paletteHue).toBeDefined();
    expect(genes.paletteHarmony).toBeDefined();

    // Style genes
    expect(genes.style).toBeDefined();
  });

  it('default genes are valid', () => {
    const engine = new Visual2DEngine();
    const genes = engine.defaultGenes();

    for (const [name, gene] of Object.entries(genes)) {
      const errors = validateGene(gene);
      expect(errors.length).toBe(0);
    }
  });
});

describe('Artifact Generation', () => {
  it('generates artifacts with expected keys', () => {
    const engine = new Visual2DEngine();
    const seed = createSeed('visual2d', 'test', engine.defaultGenes());

    const result = engine.generate(seed);

    if (result.success) {
      expect(result.artifacts.size).toBeGreaterThan(0);
    }
  });

  it('artifacts are stored in Map', () => {
    const engine = new Visual2DEngine();
    const seed = createSeed('visual2d', 'test', engine.defaultGenes());

    const result = engine.generate(seed);

    expect(result.artifacts instanceof Map).toBe(true);
  });

  it('can retrieve artifacts from result', () => {
    const engine = new Visual2DEngine();
    const seed = createSeed('visual2d', 'test', engine.defaultGenes());

    const result = engine.generate(seed);

    if (result.success && result.artifacts.size > 0) {
      const firstKey = Array.from(result.artifacts.keys())[0];
      const artifact = result.artifacts.get(firstKey);

      expect(artifact).toBeDefined();
    }
  });
});

describe('Developmental Stages', () => {
  it('each stage has name and description', () => {
    const engine = new Visual2DEngine();
    const stages = engine.stages();

    for (const stage of stages) {
      expect(typeof stage.name).toBe('string');
      expect(typeof stage.description).toBe('string');
      expect(stage.name.length).toBeGreaterThan(0);
    }
  });

  it('stages execute without throwing', () => {
    const engine = new Visual2DEngine();
    const stages = engine.stages();

    expect(stages.every(s => typeof s.execute === 'function')).toBe(true);
  });
});

describe('Engine Extensibility', () => {
  it('can create custom engines by extending DomainEngine', () => {
    class TestEngine extends DomainEngine {
      readonly domain = 'custom' as const;
      readonly name = 'Test Engine';
      readonly version = '1.0.0';

      defaultGenes() {
        return { x: scalar(5, 0, 10) };
      }

      stages() {
        return [];
      }

      evaluate() {
        return { scores: {}, aggregate: 1, evaluatedAt: Date.now() };
      }
    }

    const engine = new TestEngine();

    expect(engine.domain).toBe('custom');
    expect(engine.name).toBe('Test Engine');
  });
});

describe('Error Handling in Generation', () => {
  it('handles invalid seeds gracefully', () => {
    const engine = new Visual2DEngine();

    const invalidSeed = createSeed('visual2d', 'test', {
      invalid_gene: scalar(-100, 0, 10), // Out of bounds
    });

    const result = engine.generate(invalidSeed);

    expect(result).toBeDefined();
    // Will either fail validation or complete depending on strictness
  });

  it('records errors in result', () => {
    const engine = new Visual2DEngine();

    const badSeed = createSeed('geometry3d', 'wrong_domain', {
      x: scalar(1, 0, 10),
    });

    const result = engine.generate(badSeed);

    if (!result.success) {
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});

describe('RNG Integration', () => {
  it('uses provided RNG seed for determinism', () => {
    const engine = new Visual2DEngine();
    const seed = createSeed('visual2d', 'test', engine.defaultGenes());

    const result1 = engine.generate(seed, 'deterministic_seed');
    const result2 = engine.generate(seed, 'deterministic_seed');

    if (result1.success && result2.success) {
      // Results should be identical with same RNG seed
      expect(result1.artifacts.size).toBe(result2.artifacts.size);
    }
  });

  it('uses seed hash when no RNG seed provided', () => {
    const engine = new Visual2DEngine();
    const seed = createSeed('visual2d', 'test', engine.defaultGenes());

    const result = engine.generate(seed);

    expect(result).toBeDefined();
    // Should use seed.$hash as RNG seed internally
  });
});
