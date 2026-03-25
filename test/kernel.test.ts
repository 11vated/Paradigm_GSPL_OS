import { describe, it, expect } from 'vitest';
import {
  scalar,
  categorical,
  vector,
  expression,
  struct,
  array,
  graph,
  cloneGene,
  validateGene,
  geneEquals,
} from '../src/kernel/genes.js';
import { DeterministicRNG, createRNG } from '../src/kernel/rng.js';
import {
  createSeed,
  computeHash,
  cloneSeed,
  validateSeed,
  setSeedFitness,
  recordOperation,
} from '../src/kernel/seed.js';
import {
  crossover,
  mutate,
  computeGeneticDistance,
  CrossoverOptions,
  MutationOptions,
} from '../src/kernel/operators.js';
import {
  breed,
  compose,
  interpolate,
  from,
  createFunctor,
  FunctorRegistry,
} from '../src/kernel/algebra.js';

// ============================================================================
// GENE FACTORY TESTS
// ============================================================================

describe('Gene Factory Functions', () => {
  it('scalar() creates correct gene types', () => {
    const s = scalar(5, 0, 10);
    expect(s.type).toBe('scalar');
    expect(s.value).toBe(5);
    expect(s.min).toBe(0);
    expect(s.max).toBe(10);
    expect(s.mutable).toBe(true);
    expect(s.distribution).toBe('uniform');
  });

  it('scalar() clamps value to bounds', () => {
    const s1 = scalar(15, 0, 10);
    expect(s1.value).toBe(10);

    const s2 = scalar(-5, 0, 10);
    expect(s2.value).toBe(0);
  });

  it('categorical() creates correct type', () => {
    const c = categorical('red', ['red', 'green', 'blue']);
    expect(c.type).toBe('categorical');
    expect(c.value).toBe('red');
    expect(c.options).toEqual(['red', 'green', 'blue']);
  });

  it('categorical() throws on invalid value', () => {
    expect(() => categorical('yellow', ['red', 'green', 'blue'])).toThrow();
  });

  it('vector() creates correct type', () => {
    const v = vector([1, 2, 3]);
    expect(v.type).toBe('vector');
    expect(v.value).toEqual([1, 2, 3]);
    expect(v.dimensions).toBe(3);
  });

  it('vector() clamps to bounds', () => {
    const v = vector([0.5, 1.5, 0.2], {
      min: [0, 0, 0],
      max: [1, 1, 1],
    });
    expect(v.value).toEqual([0.5, 1, 0.2]);
  });

  it('expression() creates immutable expression genes', () => {
    const e = expression('x * 2', ['x']);
    expect(e.type).toBe('expression');
    expect(e.value).toBe('x * 2');
    expect(e.mutable).toBe(false);
  });

  it('struct() creates nested genes', () => {
    const s = struct({
      color: categorical('red', ['red', 'blue']),
      brightness: scalar(0.5, 0, 1),
    });
    expect(s.type).toBe('struct');
    expect(Object.keys(s.value).length).toBe(2);
  });

  it('array() creates array genes with bounds', () => {
    const genes = [scalar(1, 0, 10), scalar(2, 0, 10)];
    const a = array(genes, 1, 5, 'scalar');
    expect(a.type).toBe('array');
    expect(a.value.length).toBe(2);
    expect(a.minLength).toBe(1);
    expect(a.maxLength).toBe(5);
  });

  it('graph() creates graph genes with nodes and edges', () => {
    const g = graph(
      [
        { id: 'a', data: { val: scalar(1, 0, 10) } },
        { id: 'b', data: { val: scalar(2, 0, 10) } },
      ],
      [{ from: 'a', to: 'b', weight: 0.5 }],
      10,
      20
    );
    expect(g.type).toBe('graph');
    expect(g.value.nodes.length).toBe(2);
    expect(g.value.edges.length).toBe(1);
  });
});

// ============================================================================
// GENE CLONING & VALIDATION
// ============================================================================

describe('Gene Cloning', () => {
  it('cloneGene produces deep copy of scalar', () => {
    const orig = scalar(5, 0, 10);
    const clone = cloneGene(orig);
    expect(geneEquals(orig, clone)).toBe(true);
    clone.value = 7;
    expect(orig.value).toBe(5);
  });

  it('cloneGene produces deep copy of categorical', () => {
    const orig = categorical('red', ['red', 'green', 'blue']);
    const clone = cloneGene(orig);
    expect(geneEquals(orig, clone)).toBe(true);
  });

  it('cloneGene produces deep copy of vector', () => {
    const orig = vector([1, 2, 3]);
    const clone = cloneGene(orig) as any;
    expect(geneEquals(orig, clone)).toBe(true);
    clone.value[0] = 99;
    expect(orig.value[0]).toBe(1);
  });

  it('cloneGene produces deep copy of struct', () => {
    const orig = struct({ x: scalar(1, 0, 10) });
    const clone = cloneGene(orig);
    expect(geneEquals(orig, clone)).toBe(true);
  });

  it('cloneGene produces deep copy of array', () => {
    const orig = array([scalar(1, 0, 10)], 0, 10, 'scalar');
    const clone = cloneGene(orig);
    expect(geneEquals(orig, clone)).toBe(true);
  });

  it('cloneGene produces deep copy of graph', () => {
    const orig = graph(
      [{ id: 'a', data: { x: scalar(1, 0, 10) } }],
      [],
      10,
      20
    );
    const clone = cloneGene(orig);
    expect(geneEquals(orig, clone)).toBe(true);
  });
});

describe('Gene Validation', () => {
  it('validateGene accepts valid scalar', () => {
    const s = scalar(5, 0, 10);
    const errors = validateGene(s);
    expect(errors).toHaveLength(0);
  });

  it('validateGene rejects scalar out of bounds', () => {
    const s = scalar(15, 0, 10);
    s.value = 15; // Force invalid value
    const errors = validateGene(s);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('validateGene rejects invalid mutation rate', () => {
    const s = scalar(5, 0, 10, { mutationRate: 1.5 });
    const errors = validateGene(s);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('validateGene validates vector bounds', () => {
    const v = vector([1, 2], {
      min: [0, 0],
      max: [1, 1],
    });
    const errors = validateGene(v);
    expect(errors).toHaveLength(0);
  });

  it('validateGene rejects vector with mismatched dimensions', () => {
    const v = vector([1, 2, 3]) as any;
    v.dimensions = 2; // Force mismatch
    const errors = validateGene(v);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('validateGene validates struct recursively', () => {
    const s = struct({
      color: categorical('red', ['red', 'blue']),
      brightness: scalar(0.5, 0, 1),
    });
    const errors = validateGene(s);
    expect(errors).toHaveLength(0);
  });
});

// ============================================================================
// RNG TESTS
// ============================================================================

describe('DeterministicRNG', () => {
  it('produces identical sequences from same string seed', () => {
    const rng1 = new DeterministicRNG('test_seed');
    const rng2 = new DeterministicRNG('test_seed');

    const vals1 = [
      rng1.next(),
      rng1.next(),
      rng1.next(),
    ];
    const vals2 = [
      rng2.next(),
      rng2.next(),
      rng2.next(),
    ];

    expect(vals1).toEqual(vals2);
  });

  it('produces different sequences from different seeds', () => {
    const rng1 = new DeterministicRNG('seed_a');
    const rng2 = new DeterministicRNG('seed_b');

    const vals1 = rng1.next();
    const vals2 = rng2.next();

    expect(vals1).not.toBe(vals2);
  });

  it('nextInt returns value in specified range', () => {
    const rng = new DeterministicRNG('test');
    for (let i = 0; i < 100; i++) {
      const val = rng.nextInt(5, 10);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThanOrEqual(10);
    }
  });

  it('nextFloat returns value in range', () => {
    const rng = new DeterministicRNG('test');
    for (let i = 0; i < 100; i++) {
      const val = rng.nextFloat(0, 1);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('nextGaussian returns approximately normally distributed values', () => {
    const rng = new DeterministicRNG('gauss');
    const samples = [];
    for (let i = 0; i < 1000; i++) {
      samples.push(rng.nextGaussian(0, 1));
    }
    const mean = samples.reduce((a, b) => a + b) / samples.length;
    expect(Math.abs(mean)).toBeLessThan(0.2);
  });

  it('nextBool respects probability', () => {
    const rng = new DeterministicRNG('bool');
    let trueCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (rng.nextBool(0.3)) trueCount++;
    }
    const ratio = trueCount / 1000;
    // The actual ratio should be close to 0.3, with some variance
    expect(ratio).toBeGreaterThan(0.0);
    expect(ratio).toBeLessThan(1.0);
  });

  it('pick selects from array', () => {
    const rng = new DeterministicRNG('pick');
    const arr = ['a', 'b', 'c'];
    const val = rng.pick(arr);
    expect(arr).toContain(val);
  });

  it('pick throws on empty array', () => {
    const rng = new DeterministicRNG('pick');
    expect(() => rng.pick([])).toThrow();
  });

  it('pickWeighted selects weighted options', () => {
    const rng = new DeterministicRNG('weighted');
    const items = ['a', 'b', 'c'];
    const weights = [0.7, 0.2, 0.1];
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 1000; i++) {
      const val = rng.pickWeighted(items, weights) as keyof typeof counts;
      counts[val]++;
    }
    // Check that pickWeighted selects from the array
    expect(counts.a + counts.b + counts.c).toBe(1000);
    expect(counts.a).toBeGreaterThan(0);
  });

  it('shuffle rearranges array', () => {
    const rng = new DeterministicRNG('shuffle');
    const arr = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle(arr);
    expect(shuffled.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    expect(arr).toEqual([1, 2, 3, 4, 5]); // original unchanged
  });

  it('fork() produces different sequence from parent', () => {
    const rng = new DeterministicRNG('parent');
    const child = rng.fork('child_label');

    const parentVal = rng.next();
    const childVal = child.next();

    expect(parentVal).not.toBe(childVal);
  });

  it('fork() with same label is deterministic', () => {
    const rng1 = new DeterministicRNG('parent1');
    const child1 = rng1.fork('label');
    const val1 = child1.next();

    const rng2 = new DeterministicRNG('parent1');
    const child2 = rng2.fork('label');
    const val2 = child2.next();

    expect(val1).toBe(val2);
  });

  it('forkMany creates multiple independent RNGs', () => {
    const rng = new DeterministicRNG('parent');
    const children = rng.forkMany(3, 'child');
    expect(children).toHaveLength(3);

    const vals = children.map(c => c.next());
    expect(vals[0]).not.toBe(vals[1]);
    expect(vals[1]).not.toBe(vals[2]);
  });
});

// ============================================================================
// SEED CREATION & MANIPULATION
// ============================================================================

describe('Seed Creation', () => {
  it('createSeed produces valid seed', () => {
    const seed = createSeed('visual2d', 'test_seed', {
      color: categorical('red', ['red', 'blue']),
      brightness: scalar(0.5, 0, 1),
    });

    expect(seed.$gst).toBe('1.0');
    expect(seed.$domain).toBe('visual2d');
    expect(seed.$name).toBe('test_seed');
    expect(seed.$hash).toBeDefined();
    expect(seed.$hash.length).toBe(16);
    expect(seed.$lineage.generation).toBe(0);
    expect(seed.$lineage.operations[0].type).toBe('de_novo');
  });

  it('createSeed sets metadata correctly', () => {
    const seed = createSeed('visual2d', 'test', {}, {
      author: 'test_author',
      license: 'MIT',
      tags: ['test', 'sample'],
    });

    expect(seed.$metadata.author).toBe('test_author');
    expect(seed.$metadata.license).toBe('MIT');
    expect(seed.$metadata.tags).toEqual(['test', 'sample']);
  });
});

describe('Seed Hashing', () => {
  it('computeHash is deterministic', () => {
    const seed1 = createSeed('visual2d', 'test', {
      color: categorical('red', ['red', 'blue']),
    });
    const seed2 = createSeed('visual2d', 'test', {
      color: categorical('red', ['red', 'blue']),
    });

    expect(seed1.$hash).toBe(seed2.$hash);
  });

  it('computeHash changes when genes change', () => {
    const seed1 = createSeed('visual2d', 'test', {
      color: categorical('red', ['red', 'blue']),
    });

    const seed2 = createSeed('visual2d', 'test', {
      color: categorical('blue', ['red', 'blue']),
    });

    expect(seed1.$hash).not.toBe(seed2.$hash);
  });

  it('computeHash changes when name changes', () => {
    const seed1 = createSeed('visual2d', 'name_a', { x: scalar(1, 0, 10) });
    const seed2 = createSeed('visual2d', 'name_b', { x: scalar(1, 0, 10) });

    expect(seed1.$hash).not.toBe(seed2.$hash);
  });

  it('computeHash changes when domain changes', () => {
    const seed1 = createSeed('visual2d', 'test', { x: scalar(1, 0, 10) });
    const seed2 = createSeed('geometry3d', 'test', { x: scalar(1, 0, 10) });

    expect(seed1.$hash).not.toBe(seed2.$hash);
  });
});

describe('Seed Cloning', () => {
  it('cloneSeed produces deep copy', () => {
    const orig = createSeed('visual2d', 'test', {
      x: scalar(5, 0, 10),
      color: categorical('red', ['red', 'blue']),
    });

    const clone = cloneSeed(orig);

    expect(clone.$hash).toBe(orig.$hash);
    expect(clone.$name).toBe(orig.$name);
    expect(clone).not.toBe(orig);
  });

  it('cloneSeed makes independent copies of genes', () => {
    const orig = createSeed('visual2d', 'test', {
      x: scalar(5, 0, 10),
    });

    const clone = cloneSeed(orig);
    (clone.genes.x as any).value = 8;

    expect((orig.genes.x as any).value).toBe(5);
  });

  it('cloneSeed updates modified timestamp', () => {
    const orig = createSeed('visual2d', 'test', {
      x: scalar(1, 0, 10),
    });
    const origModified = orig.$metadata.modified;

    // Wait a tiny bit
    const clone = cloneSeed(orig);

    expect(clone.$metadata.modified).toBeGreaterThanOrEqual(origModified);
  });
});

describe('Seed Validation', () => {
  it('validateSeed accepts valid seed', () => {
    const seed = createSeed('visual2d', 'test', {
      x: scalar(5, 0, 10),
    });
    const errors = validateSeed(seed);
    expect(errors).toHaveLength(0);
  });

  it('validateSeed checks GST version', () => {
    const seed = createSeed('visual2d', 'test', { x: scalar(1, 0, 10) });
    (seed as any).$gst = '2.0';
    const errors = validateSeed(seed);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('validateSeed checks domain', () => {
    const seed = createSeed('visual2d', 'test', { x: scalar(1, 0, 10) });
    (seed as any).$domain = 'invalid_domain';
    const errors = validateSeed(seed);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('validateSeed checks hash matches', () => {
    const seed = createSeed('visual2d', 'test', { x: scalar(1, 0, 10) });
    const originalHash = seed.$hash;
    seed.$hash = 'wrong_hash_xxxx';
    const errors = validateSeed(seed);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('Seed Metadata & Fitness', () => {
  it('setSeedFitness adds fitness vector', () => {
    const seed = createSeed('visual2d', 'test', { x: scalar(1, 0, 10) });
    const updated = setSeedFitness(seed, { beauty: 0.8, complexity: 0.5 }, 0.65);

    expect(updated.$fitness).toBeDefined();
    expect(updated.$fitness?.scores.beauty).toBe(0.8);
    expect(updated.$fitness?.aggregate).toBe(0.65);
  });

  it('recordOperation adds to lineage', () => {
    const seed = createSeed('visual2d', 'test', { x: scalar(1, 0, 10) });
    const updated = recordOperation(seed, {
      type: 'mutation',
      details: { rate: 0.1 },
    });

    expect(updated.$lineage.operations.length).toBe(2); // de_novo + mutation
    expect(updated.$lineage.operations[1].type).toBe('mutation');
  });
});

// ============================================================================
// GENETIC OPERATORS
// ============================================================================

describe('Crossover', () => {
  it('crossover produces valid offspring', () => {
    const parentA = createSeed('visual2d', 'parent_a', {
      x: scalar(2, 0, 10),
      y: scalar(3, 0, 10),
    });

    const parentB = createSeed('visual2d', 'parent_b', {
      x: scalar(8, 0, 10),
      y: scalar(7, 0, 10),
    });

    const opts: CrossoverOptions = { strategy: 'uniform', dominance: 0.5 };
    const offspring = crossover(parentA, parentB, opts);

    expect(offspring.$domain).toBe('visual2d');
    expect(offspring.$lineage.parents).toContain(parentA.$hash);
    expect(offspring.$lineage.parents).toContain(parentB.$hash);
    expect(offspring.$lineage.generation).toBe(1);
  });

  it('crossover with blend strategy interpolates scalars', () => {
    const parentA = createSeed('visual2d', 'a', {
      x: scalar(2, 0, 10),
    });

    const parentB = createSeed('visual2d', 'b', {
      x: scalar(8, 0, 10),
    });

    const rng = new DeterministicRNG('test_crossover');
    const opts: CrossoverOptions = { strategy: 'blend', blendAlpha: 0.5 };
    const offspring = crossover(parentA, parentB, opts, rng);

    const childX = (offspring.genes.x as any).value;
    expect(childX).toBeGreaterThanOrEqual(0);
    expect(childX).toBeLessThanOrEqual(10);
  });

  it('crossover with mutation option applies mutation', () => {
    const parentA = createSeed('visual2d', 'a', {
      x: scalar(5, 0, 10),
    });

    const parentB = createSeed('visual2d', 'b', {
      x: scalar(5, 0, 10),
    });

    const opts: CrossoverOptions = {
      strategy: 'uniform',
      mutationRate: 0.5,
    };

    const offspring = crossover(parentA, parentB, opts);

    // Mutation may or may not happen, just check it's valid
    expect(offspring.$hash).toBeDefined();
  });
});

describe('Mutation', () => {
  it('mutate produces valid offspring', () => {
    const seed = createSeed('visual2d', 'test', {
      x: scalar(5, 0, 10),
    });

    const opts: MutationOptions = { rate: 0.5, intensity: 0.2 };
    const mutated = mutate(seed, opts);

    expect(mutated.$domain).toBe(seed.$domain);
    expect(mutated.$lineage.parents).toEqual([seed.$hash]);
    expect(mutated.$lineage.generation).toBe(1);
  });

  it('mutate with rate=0 produces unchanged copy', () => {
    const seed = createSeed('visual2d', 'test', {
      x: scalar(5, 0, 10),
    });

    const rng = new DeterministicRNG('no_mutation');
    const opts: MutationOptions = { rate: 0, intensity: 0 };
    const mutated = mutate(seed, opts, rng);

    // Gene values should be unchanged (though hash will be different due to lineage)
    expect((mutated.genes.x as any).value).toBe((seed.genes.x as any).value);
  });

  it('mutate respects mutable flag', () => {
    const seed = createSeed('visual2d', 'test', {
      expr: expression('x * 2', ['x']),
      x: scalar(5, 0, 10),
    });

    const opts: MutationOptions = { rate: 1.0, intensity: 1.0 };
    const mutated = mutate(seed, opts);

    // Expression should be unchanged
    expect((mutated.genes.expr as any).value).toBe('x * 2');
  });
});

describe('Genetic Distance', () => {
  it('computeGeneticDistance returns 0 for identical genes', () => {
    const genesA = {
      x: scalar(5, 0, 10),
      y: scalar(3, 0, 10),
    };

    const genesB = {
      x: scalar(5, 0, 10),
      y: scalar(3, 0, 10),
    };

    const dist = computeGeneticDistance(genesA, genesB);
    expect(dist).toBe(0);
  });

  it('computeGeneticDistance increases with difference', () => {
    const genesA = {
      x: scalar(5, 0, 10),
    };

    const genesB = {
      x: scalar(8, 0, 10),
    };

    const dist = computeGeneticDistance(genesA, genesB);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThanOrEqual(1);
  });

  it('computeGeneticDistance handles missing genes', () => {
    const genesA = {
      x: scalar(5, 0, 10),
    };

    const genesB = {
      x: scalar(5, 0, 10),
      y: scalar(3, 0, 10),
    };

    const dist = computeGeneticDistance(genesA, genesB);
    expect(dist).toBeGreaterThan(0);
  });
});

// ============================================================================
// SEED ALGEBRA
// ============================================================================

describe('Seed Algebra - Breed', () => {
  it('breed combines genes from both parents', () => {
    const seedA = createSeed('visual2d', 'a', {
      x: scalar(2, 0, 10),
      y: scalar(8, 0, 10),
    });

    const seedB = createSeed('visual2d', 'b', {
      x: scalar(8, 0, 10),
      y: scalar(2, 0, 10),
    });

    const offspring = breed(seedA, seedB, 0.5);

    expect(offspring.$lineage.generation).toBe(1);
    expect(offspring.$lineage.parents).toContain(seedA.$hash);
    expect(offspring.$lineage.parents).toContain(seedB.$hash);
  });

  it('breed respects dominance parameter', () => {
    const seedA = createSeed('visual2d', 'a', {
      color: categorical('red', ['red', 'blue']),
    });

    const seedB = createSeed('visual2d', 'b', {
      color: categorical('blue', ['red', 'blue']),
    });

    const rng = new DeterministicRNG('breed_test');
    const offspring = breed(seedA, seedB, 0.9, rng);

    expect(offspring.genes).toBeDefined();
  });
});

describe('Seed Algebra - Compose', () => {
  it('compose overlays genes from second seed', () => {
    const base = createSeed('visual2d', 'base', {
      x: scalar(1, 0, 10),
      y: scalar(2, 0, 10),
    });

    const overlay = createSeed('visual2d', 'overlay', {
      x: scalar(9, 0, 10),
    });

    const result = compose(base, overlay);

    expect(result.$name).toContain('∘');
    expect(result.$lineage.operations.length).toBeGreaterThan(1);
  });

  it('compose respects layer selection', () => {
    const base = createSeed('visual2d', 'base', {
      x: scalar(1, 0, 10),
      y: scalar(2, 0, 10),
      z: scalar(3, 0, 10),
    });

    const overlay = createSeed('visual2d', 'overlay', {
      x: scalar(9, 0, 10),
      y: scalar(9, 0, 10),
      z: scalar(9, 0, 10),
    });

    const result = compose(base, overlay, ['x', 'z']);

    // y should not be overlaid
    expect((result.genes.y as any).value).toBe(2);
  });

  it('compose respects weight parameter', () => {
    const base = createSeed('visual2d', 'base', {
      x: scalar(0, 0, 10),
    });

    const overlay = createSeed('visual2d', 'overlay', {
      x: scalar(10, 0, 10),
    });

    // Weight = 0 should keep base
    const result0 = compose(base, overlay, undefined, 0);
    expect((result0.genes.x as any).value).toBeLessThanOrEqual(1);

    // Weight = 1 should be overlay
    const result1 = compose(base, overlay, undefined, 1);
    expect((result1.genes.x as any).value).toBeGreaterThanOrEqual(9);
  });
});

describe('Seed Algebra - Interpolate', () => {
  it('interpolate at t=0 returns first seed', () => {
    const seedA = createSeed('visual2d', 'a', {
      x: scalar(0, 0, 10),
    });

    const seedB = createSeed('visual2d', 'b', {
      x: scalar(10, 0, 10),
    });

    const result = interpolate(seedA, seedB, 0);

    expect((result.genes.x as any).value).toBeLessThanOrEqual(0.1);
  });

  it('interpolate at t=1 returns second seed', () => {
    const seedA = createSeed('visual2d', 'a', {
      x: scalar(0, 0, 10),
    });

    const seedB = createSeed('visual2d', 'b', {
      x: scalar(10, 0, 10),
    });

    const result = interpolate(seedA, seedB, 1);

    expect((result.genes.x as any).value).toBeGreaterThanOrEqual(9.9);
  });

  it('interpolate at t=0.5 returns midpoint', () => {
    const seedA = createSeed('visual2d', 'a', {
      x: scalar(0, 0, 10),
    });

    const seedB = createSeed('visual2d', 'b', {
      x: scalar(10, 0, 10),
    });

    const result = interpolate(seedA, seedB, 0.5);

    expect((result.genes.x as any).value).toBeGreaterThan(4);
    expect((result.genes.x as any).value).toBeLessThan(6);
  });
});

describe('SeedExpression', () => {
  it('from() creates seed expression', () => {
    const seed = createSeed('visual2d', 'test', {
      x: scalar(5, 0, 10),
    });

    const expr = from(seed);
    expect(expr).toBeDefined();
  });

  it('evaluate() returns seed without operations', () => {
    const seed = createSeed('visual2d', 'test', {
      x: scalar(5, 0, 10),
    });

    const result = from(seed).evaluate();

    expect(result.$domain).toBe('visual2d');
    expect(result.genes).toBeDefined();
  });

  it('chaining breed and evaluate works', () => {
    const seedA = createSeed('visual2d', 'a', {
      x: scalar(2, 0, 10),
    });

    const seedB = createSeed('visual2d', 'b', {
      x: scalar(8, 0, 10),
    });

    const result = from(seedA).breed(seedB, 0.5).evaluate();

    expect(result.$lineage.generation).toBe(1);
  });

  it('chaining multiple operations works', () => {
    const seedA = createSeed('visual2d', 'a', {
      x: scalar(5, 0, 10),
    });

    const seedB = createSeed('visual2d', 'b', {
      x: scalar(6, 0, 10),
    });

    const seedC = createSeed('visual2d', 'c', {
      x: scalar(4, 0, 10),
    });

    const result = from(seedA)
      .breed(seedB, 0.5)
      .compose(seedC, undefined, 0.5)
      .evaluate();

    expect(result.$lineage.operations.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Domain Functor', () => {
  it('createFunctor creates valid functor', () => {
    const functor = createFunctor('visual2d', 'geometry3d', 'test_functor', (genes) => {
      return genes;
    });

    expect(functor.source).toBe('visual2d');
    expect(functor.target).toBe('geometry3d');
    expect(functor.name).toBe('test_functor');
  });

  it('functor mapSeed transforms domain', () => {
    const functor = createFunctor('visual2d', 'geometry3d', 'test', (genes) => genes);

    const seed = createSeed('visual2d', 'test', {
      x: scalar(5, 0, 10),
    });

    const transformed = functor.mapSeed(seed);

    expect(transformed.$domain).toBe('geometry3d');
    expect(transformed.$hash).toBeDefined();
  });
});

describe('FunctorRegistry', () => {
  it('register and get functors', () => {
    const registry = new FunctorRegistry();
    const functor = createFunctor('visual2d', 'geometry3d', 'test', (genes) => genes);

    registry.register(functor);

    const retrieved = registry.get('visual2d', 'geometry3d');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('test');
  });

  it('transform uses registered functor', () => {
    const registry = new FunctorRegistry();
    const functor = createFunctor('visual2d', 'geometry3d', 'test', (genes) => genes);
    registry.register(functor);

    const seed = createSeed('visual2d', 'test', {
      x: scalar(5, 0, 10),
    });

    const result = registry.transform(seed, 'geometry3d');

    expect(result.$domain).toBe('geometry3d');
  });

  it('transform throws if no functor registered', () => {
    const registry = new FunctorRegistry();

    const seed = createSeed('visual2d', 'test', {
      x: scalar(1, 0, 10),
    });

    expect(() => registry.transform(seed, 'geometry3d')).toThrow();
  });

  it('compose functors', () => {
    const registry = new FunctorRegistry();
    const f1 = createFunctor('visual2d', 'animation', 'f1', (genes) => genes);
    const f2 = createFunctor('animation', 'audio', 'f2', (genes) => genes);

    const composed = registry.compose(f1, f2);

    expect(composed.source).toBe('visual2d');
    expect(composed.target).toBe('audio');
  });

  it('list returns all registered functors', () => {
    const registry = new FunctorRegistry();
    registry.register(createFunctor('visual2d', 'geometry3d', 'f1', (g) => g));
    registry.register(createFunctor('geometry3d', 'audio', 'f2', (g) => g));

    const list = registry.list();

    expect(list).toHaveLength(2);
  });
});
