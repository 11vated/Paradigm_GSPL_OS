import { describe, it, expect, beforeEach } from 'vitest';
import { scalar, categorical, vector } from '../src/kernel/genes.js';
import { createSeed, setSeedFitness, recordOperation } from '../src/kernel/seed.js';
import {
  SeedLibrary,
  type SeedEntry,
  type LibraryStats,
} from '../src/library/seed-library.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createTestSeed(name: string, domain: string = 'visual2d') {
  return createSeed(domain as any, name, {
    color: categorical('red', ['red', 'blue', 'green']),
    size: scalar(10, 1, 100),
    brightness: scalar(0.5, 0, 1),
  });
}

// ============================================================================
// LIBRARY TESTS
// ============================================================================

describe('SeedLibrary', () => {
  let library: SeedLibrary;

  beforeEach(() => {
    library = new SeedLibrary();
  });

  describe('store and retrieve', () => {
    it('stores a seed and retrieves by hash', () => {
      const seed = createTestSeed('test-seed');
      const entry = library.store(seed, 'Test description', ['tag1', 'tag2']);

      expect(entry.seed.$name).toBe('test-seed');
      expect(entry.version).toBe(1);
      expect(entry.tags).toEqual(['tag1', 'tag2']);
      expect(entry.description).toBe('Test description');

      const retrieved = library.get(seed.$hash);
      expect(retrieved).toBeDefined();
      expect(retrieved?.seed.$name).toBe('test-seed');
    });

    it('retrieves by name (latest version)', () => {
      const seed1 = createTestSeed('named-seed');
      const seed2 = createTestSeed('named-seed');

      library.store(seed1);
      library.store(seed2);

      const retrieved = library.getByName('named-seed');
      expect(retrieved).toBeDefined();
      expect(retrieved?.version).toBe(2);
    });

    it('returns undefined for non-existent seed', () => {
      const retrieved = library.get('nonexistent');
      expect(retrieved).toBeUndefined();
    });

    it('tracks usage statistics', () => {
      const seed = createTestSeed('stats-seed');
      const entry = library.store(seed);
      const hash = seed.$hash;

      expect(entry.stats.timesUsed).toBe(0);

      library.markUsed(hash);
      library.markUsed(hash);
      library.markEvolved(hash);
      library.markBred(hash);

      const updated = library.get(hash);
      expect(updated?.stats.timesUsed).toBe(2);
      expect(updated?.stats.timesEvolved).toBe(1);
      expect(updated?.stats.timesBred).toBe(1);
    });

    it('updates fitness scores', () => {
      const seed = createTestSeed('fitness-seed');
      library.store(seed);
      const hash = seed.$hash;

      library.updateFitness(hash, 0.5);
      library.updateFitness(hash, 0.8);
      library.updateFitness(hash, 0.6);

      const updated = library.get(hash);
      expect(updated?.stats.bestFitness).toBe(0.8);
    });
  });

  describe('query functionality', () => {
    beforeEach(() => {
      // Create seeds in different domains with various tags
      const visual = createTestSeed('visual-1', 'visual2d');
      const audio = createTestSeed('audio-1', 'audio');
      const game = createTestSeed('game-1', 'game');

      library.store(visual, 'Visual art', ['art', 'creative']);
      library.store(audio, 'Music composition', ['music', 'creative']);
      library.store(game, 'Game logic', ['game', 'mechanic']);
    });

    it('queries by domain', () => {
      const results = library.query({ domain: 'visual2d' });
      expect(results.length).toBe(1);
      expect(results[0].seed.$domain).toBe('visual2d');
    });

    it('queries by tag', () => {
      const results = library.query({ tags: ['creative'] });
      expect(results.length).toBe(2);
    });

    it('queries by name pattern', () => {
      const results = library.query({ namePattern: 'audio' });
      expect(results.length).toBe(1);
      expect(results[0].seed.$name).toMatch(/audio/);
    });

    it('queries with multiple filters', () => {
      const results = library.query({
        domain: 'audio',
        tags: ['creative'],
      });
      expect(results.length).toBe(1);
      expect(results[0].seed.$domain).toBe('audio');
    });

    it('sorts results', () => {
      library.store(
        createTestSeed('aaa', 'visual2d'),
        '',
        ['sort-test']
      );
      library.store(
        createTestSeed('zzz', 'visual2d'),
        '',
        ['sort-test']
      );

      const byName = library.query({
        tags: ['sort-test'],
        sortBy: 'name',
      });

      expect(byName[0].seed.$name).toBe('aaa');
      expect(byName[1].seed.$name).toBe('zzz');
    });

    it('applies limit', () => {
      const results = library.query({ limit: 1 });
      expect(results.length).toBe(1);
    });
  });

  describe('list operations', () => {
    beforeEach(() => {
      const v1 = createTestSeed('v1', 'visual2d');
      const v2 = createTestSeed('v2', 'visual2d');
      const a1 = createTestSeed('a1', 'audio');

      library.store(v1);
      library.store(v2);
      library.store(a1);
    });

    it('lists all seeds', () => {
      const all = library.listAll();
      expect(all.length).toBe(3);
    });

    it('lists seeds by domain', () => {
      const visual = library.listByDomain('visual2d');
      expect(visual.length).toBe(2);
      expect(visual.every(e => e.seed.$domain === 'visual2d')).toBe(true);
    });
  });

  describe('removal', () => {
    it('removes a seed from library', () => {
      const seed = createTestSeed('removable');
      const entry = library.store(seed, '', ['temp']);
      const hash = seed.$hash;

      expect(library.get(hash)).toBeDefined();

      const success = library.remove(hash);
      expect(success).toBe(true);
      expect(library.get(hash)).toBeUndefined();
    });

    it('returns false when removing non-existent seed', () => {
      const success = library.remove('nonexistent');
      expect(success).toBe(false);
    });

    it('cleans up indices when removing', () => {
      const seed = createTestSeed('indexed-seed');
      library.store(seed, '', ['removal-tag']);
      const hash = seed.$hash;

      library.remove(hash);

      // Try to query by tag - should find nothing
      const results = library.query({ tags: ['removal-tag'] });
      expect(results.length).toBe(0);
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      const v = createTestSeed('v', 'visual2d');
      const a = createTestSeed('a', 'audio');
      const g = createTestSeed('g', 'game');

      library.store(v, '', ['tag1', 'tag2']);
      library.store(a, '', ['tag2', 'tag3']);
      library.store(g, '', ['tag3']);
    });

    it('calculates library statistics', () => {
      const stats = library.stats();

      expect(stats.totalSeeds).toBe(3);
      expect(stats.byDomain.visual2d).toBe(1);
      expect(stats.byDomain.audio).toBe(1);
      expect(stats.byDomain.game).toBe(1);
      expect(stats.totalTags).toBe(3);
    });

    it('calculates average fitness', () => {
      const seed = createTestSeed('fitness-test');
      const seedWithFitness = setSeedFitness(seed, { quality: 0.8 }, 0.8);
      library.store(seedWithFitness);

      const stats = library.stats();
      expect(stats.averageFitness).toBeGreaterThan(0);
    });

    it('tracks oldest and newest seeds', () => {
      const stats = library.stats();
      expect(stats.oldestSeed).toBeGreaterThan(0);
      expect(stats.newestSeed).toBeGreaterThanOrEqual(stats.oldestSeed);
    });
  });

  describe('serialization', () => {
    it('serializes library to JSON', () => {
      const seed1 = createTestSeed('json-test-1');
      const seed2 = createTestSeed('json-test-2');

      library.store(seed1, 'First seed', ['test']);
      library.store(seed2, 'Second seed', ['test']);

      const json = library.toJSON();
      expect(json).toBeTruthy();
      expect(json).toContain('json-test-1');
      expect(json).toContain('json-test-2');
    });

    it('deserializes library from JSON', () => {
      const seed1 = createTestSeed('deser-1');
      const seed2 = createTestSeed('deser-2');

      library.store(seed1, 'First', ['deserialize-tag']);
      library.store(seed2, 'Second', ['deserialize-tag']);

      const json = library.toJSON();
      const restored = SeedLibrary.fromJSON(json);

      expect(restored.listAll().length).toBe(2);
      const results = restored.query({ tags: ['deserialize-tag'] });
      expect(results.length).toBe(2);
    });

    it('roundtrip serialization preserves data', () => {
      const seed = createTestSeed('roundtrip');
      library.store(seed, 'Test description', ['tag1', 'tag2']);
      library.markUsed(seed.$hash);
      library.markEvolved(seed.$hash);
      library.updateFitness(seed.$hash, 0.95);

      const json = library.toJSON();
      const restored = SeedLibrary.fromJSON(json);

      const original = library.get(seed.$hash)!;
      const restoredEntry = restored.get(seed.$hash)!;

      expect(restoredEntry.seed.$name).toBe(original.seed.$name);
      expect(restoredEntry.stats.timesUsed).toBe(original.stats.timesUsed);
      expect(restoredEntry.stats.timesEvolved).toBe(
        original.stats.timesEvolved
      );
      expect(restoredEntry.stats.bestFitness).toBe(original.stats.bestFitness);
    });
  });

  describe('lineage tracking', () => {
    it('builds lineage tree for a seed', () => {
      const root = createTestSeed('root');
      library.store(root);

      const child = createTestSeed('child');
      const childWithLineage = recordOperation(child, {
        type: 'mutation',
        timestamp: Date.now(),
        details: { parentHash: root.$hash },
      });
      library.store(childWithLineage);

      const lineage = library.getLineage(root.$hash);
      expect(lineage.hash).toBe(root.$hash);
      expect(lineage.name).toBe('root');
    });

    it('throws for non-existent seed', () => {
      expect(() => library.getLineage('nonexistent')).toThrow();
    });
  });

  describe('similarity search', () => {
    beforeEach(() => {
      const base = createTestSeed('base-seed', 'visual2d');
      library.store(base);

      // Create similar seeds in same domain
      for (let i = 0; i < 5; i++) {
        const similar = createTestSeed(`similar-${i}`, 'visual2d');
        library.store(similar);
      }

      // Add a seed from different domain (should not match)
      const different = createTestSeed('different', 'audio');
      library.store(different);
    });

    it('finds similar seeds in same domain', () => {
      const base = createTestSeed('search-base', 'visual2d');
      library.store(base);

      const similar = library.findSimilar(base, 100, 10);
      expect(similar.length).toBeGreaterThan(0);
      expect(
        similar.every(e => e.seed.$domain === 'visual2d')
      ).toBe(true);
    });

    it('respects limit parameter', () => {
      const base = createTestSeed('limit-base', 'visual2d');
      library.store(base);

      const similar = library.findSimilar(base, 100, 2);
      expect(similar.length).toBeLessThanOrEqual(2);
    });

    it('only returns same-domain seeds', () => {
      const base = createTestSeed('domain-base', 'visual2d');
      library.store(base);

      const similar = library.findSimilar(base);
      expect(
        similar.every(e => e.seed.$domain === base.$domain)
      ).toBe(true);
    });
  });
});
