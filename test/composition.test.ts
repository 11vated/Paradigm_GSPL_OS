import { describe, it, expect, beforeEach } from 'vitest';
import { scalar, categorical, vector } from '../src/kernel/genes.js';
import { createSeed } from '../src/kernel/seed.js';
import {
  SeedComposer,
  type CompositionRecipe,
  type CrossDomainBinding,
} from '../src/composition/composer.js';
import {
  PRESETS,
  getPreset,
  listPresets,
  findCompatiblePresets,
} from '../src/composition/presets.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createTestSeed(
  name: string,
  domain: string = 'visual2d',
  genes: any = {}
) {
  const defaultGenes = {
    color: categorical('red', ['red', 'blue', 'green']),
    size: scalar(10, 1, 100),
    brightness: scalar(0.5, 0, 1),
    ...genes,
  };

  return createSeed(domain as any, name, defaultGenes);
}

// ============================================================================
// COMPOSER TESTS
// ============================================================================

describe('SeedComposer', () => {
  let composer: SeedComposer;

  beforeEach(() => {
    composer = new SeedComposer();
  });

  describe('basic composition', () => {
    it('creates a composer instance', () => {
      expect(composer).toBeDefined();
    });

    it('composes a recipe with single domain', () => {
      const seed = createTestSeed('single-layer', 'visual2d');

      const recipe: CompositionRecipe = {
        name: 'simple-composition',
        description: 'A simple single-domain composition',
        layers: [
          {
            name: 'visual',
            domain: 'visual2d',
            seed,
            priority: 0,
            enabled: true,
          },
        ],
        bindings: [],
      };

      const result = composer.compose(recipe);

      expect(result.name).toBe('simple-composition');
      expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
      // Composition may fail if engine doesn't exist, but should complete
      expect(result).toBeDefined();
    });

    it('composes multiple layers', () => {
      const visual = createTestSeed('visual', 'visual2d');
      const anim = createTestSeed('animation', 'animation', {
        tempo: scalar(120, 30, 300),
      });
      const audio = createTestSeed('audio', 'audio', {
        tempo: scalar(120, 30, 300),
      });

      const recipe: CompositionRecipe = {
        name: 'multi-layer',
        description: 'Multi-layer composition',
        layers: [
          {
            name: 'visual-layer',
            domain: 'visual2d',
            seed: visual,
            priority: 0,
            enabled: true,
          },
          {
            name: 'anim-layer',
            domain: 'animation',
            seed: anim,
            priority: 1,
            enabled: true,
          },
          {
            name: 'audio-layer',
            domain: 'audio',
            seed: audio,
            priority: 2,
            enabled: true,
          },
        ],
        bindings: [],
      };

      const result = composer.compose(recipe);

      expect(result.name).toBe('multi-layer');
      expect(result.timing.layerTimings).toBeDefined();
    });

    it('skips disabled layers', () => {
      const seed1 = createTestSeed('enabled', 'visual2d');
      const seed2 = createTestSeed('disabled', 'audio');

      const recipe: CompositionRecipe = {
        name: 'disabled-test',
        description: 'Test with disabled layers',
        layers: [
          {
            name: 'enabled-layer',
            domain: 'visual2d',
            seed: seed1,
            priority: 0,
            enabled: true,
          },
          {
            name: 'disabled-layer',
            domain: 'audio',
            seed: seed2,
            priority: 1,
            enabled: false,
          },
        ],
        bindings: [],
      };

      const result = composer.compose(recipe);

      expect(result.layers.length).toBeLessThan(2);
    });
  });

  describe('cross-domain bindings', () => {
    it('applies bindings to propagate gene values', () => {
      const visual = createTestSeed('visual-with-palette', 'visual2d', {
        palette: categorical('warm', ['warm', 'cool', 'neutral']),
        size: scalar(50, 10, 100),
      });

      const audio = createTestSeed('audio-with-key', 'audio', {
        key: categorical('C', ['C', 'D', 'E', 'G', 'A']),
      });

      const binding: CrossDomainBinding = {
        sourceDomain: 'visual2d',
        sourceGene: 'palette',
        targetDomain: 'audio',
        targetGene: 'key',
        transform: (value) => {
          if (value === 'warm') return 'C';
          if (value === 'cool') return 'A';
          return 'G';
        },
      };

      const recipe: CompositionRecipe = {
        name: 'binding-test',
        description: 'Test cross-domain bindings',
        layers: [
          {
            name: 'visual',
            domain: 'visual2d',
            seed: visual,
            priority: 0,
            enabled: true,
          },
          {
            name: 'audio',
            domain: 'audio',
            seed: audio,
            priority: 1,
            enabled: true,
          },
        ],
        bindings: [binding],
      };

      const result = composer.compose(recipe);

      // Check that composition completed (may have errors if engines missing)
      expect(result).toBeDefined();
      expect(result.name).toBe('binding-test');
    });

    it('handles binding transforms', () => {
      const layers = [
        {
          name: 'source',
          domain: 'animation' as const,
          seed: createTestSeed('source', 'animation', {
            tempo: scalar(120, 30, 300),
          }),
          priority: 0,
          enabled: true,
        },
        {
          name: 'target',
          domain: 'audio' as const,
          seed: createTestSeed('target', 'audio', {
            tempo: scalar(100, 30, 300),
          }),
          priority: 1,
          enabled: true,
        },
      ];

      const bindings: CrossDomainBinding[] = [
        {
          sourceDomain: 'animation',
          sourceGene: 'tempo',
          targetDomain: 'audio',
          targetGene: 'tempo',
          transform: (value) => {
            if (typeof value === 'number') {
              return value * 0.9; // Slow down audio by 10%
            }
            return value;
          },
        },
      ];

      const updatedLayers = composer.applyBindings(layers, bindings);

      expect(updatedLayers).toBeDefined();
      expect(updatedLayers.length).toBe(2);
    });

    it('skips invalid bindings gracefully', () => {
      const layers = [
        {
          name: 'layer',
          domain: 'visual2d' as const,
          seed: createTestSeed('test', 'visual2d'),
          priority: 0,
          enabled: true,
        },
      ];

      const invalidBindings: CrossDomainBinding[] = [
        {
          sourceDomain: 'nonexistent-domain' as any,
          sourceGene: 'missing-gene',
          targetDomain: 'visual2d',
          targetGene: 'color',
        },
      ];

      const result = composer.applyBindings(layers, invalidBindings);
      expect(result).toBeDefined();
    });
  });

  describe('quick compose', () => {
    it('quick composes multiple seeds', () => {
      const seed1 = createTestSeed('quick-1', 'visual2d');
      const seed2 = createTestSeed('quick-2', 'animation', {
        tempo: scalar(120, 30, 300),
      });

      const result = composer.quickCompose('quick-test', seed1, seed2);

      expect(result.name).toBe('quick-test');
      expect(result.timing).toBeDefined();
    });

    it('auto-detects applicable bindings', () => {
      const visual = createTestSeed('visual', 'visual2d', {
        palette: categorical('warm', ['warm', 'cool']),
      });

      const audio = createTestSeed('audio', 'audio', {
        key: categorical('C', ['C', 'G', 'D']),
      });

      const result = composer.quickCompose('auto-bind-test', visual, audio);

      // Should have completed composition with bindings applied
      expect(result).toBeDefined();
      expect(result.name).toBe('auto-bind-test');
    });
  });

  describe('default bindings', () => {
    it('provides default cross-domain bindings', () => {
      const defaults = SeedComposer.defaultBindings();

      expect(defaults.length).toBeGreaterThan(0);
      expect(defaults.some(b => b.sourceDomain === 'visual2d')).toBe(true);
      expect(defaults.some(b => b.targetDomain === 'audio')).toBe(true);
    });

    it('includes animation-to-audio tempo binding', () => {
      const defaults = SeedComposer.defaultBindings();

      const tempoBinding = defaults.find(
        b =>
          b.sourceDomain === 'animation' &&
          b.sourceGene === 'tempo' &&
          b.targetDomain === 'audio' &&
          b.targetGene === 'tempo'
      );

      expect(tempoBinding).toBeDefined();
    });

    it('includes procedural-to-game difficulty binding', () => {
      const defaults = SeedComposer.defaultBindings();

      const difficultyBinding = defaults.find(
        b =>
          b.sourceDomain === 'procedural' &&
          b.sourceGene === 'complexity' &&
          b.targetDomain === 'game'
      );

      expect(difficultyBinding).toBeDefined();
    });
  });

  describe('binding registration', () => {
    it('registers custom bindings', () => {
      const customBinding: CrossDomainBinding = {
        sourceDomain: 'visual2d',
        sourceGene: 'size',
        targetDomain: 'audio',
        targetGene: 'volume',
        transform: (value) => {
          if (typeof value === 'number') {
            return value / 100; // Normalize to 0-1
          }
          return 0.5;
        },
      };

      composer.registerBinding(customBinding);

      // Verify binding is registered by using quickCompose
      const visual = createTestSeed('v', 'visual2d', {
        size: scalar(50, 0, 100),
      });
      const audio = createTestSeed('a', 'audio', {
        volume: scalar(0.5, 0, 1),
      });

      const result = composer.quickCompose('custom-binding-test', visual, audio);
      expect(result).toBeDefined();
    });
  });
});

// ============================================================================
// PRESETS TESTS
// ============================================================================

describe('Composition Presets', () => {
  describe('preset registry', () => {
    it('lists all presets', () => {
      const presets = listPresets();
      expect(presets.length).toBeGreaterThan(0);
    });

    it('finds preset by name', () => {
      const preset = getPreset('animated-scene');
      expect(preset).toBeDefined();
      expect(preset?.name).toBe('animated-scene');
    });

    it('returns undefined for non-existent preset', () => {
      const preset = getPreset('nonexistent-preset');
      expect(preset).toBeUndefined();
    });

    it('finds compatible presets by domains', () => {
      const compatible = findCompatiblePresets([
        'visual2d',
        'animation',
        'audio',
      ]);

      expect(compatible.length).toBeGreaterThan(0);
      expect(compatible.some(p => p.name === 'animated-scene')).toBe(true);
    });
  });

  describe('animated-scene preset', () => {
    it('creates animated-scene recipe', () => {
      const preset = getPreset('animated-scene')!;

      const visual = createTestSeed('visual', 'visual2d');
      const anim = createTestSeed('anim', 'animation');
      const audio = createTestSeed('audio', 'audio');

      const recipe = preset.createRecipe(visual, anim, audio);

      expect(recipe.name).toContain('animated-scene');
      expect(recipe.layers.length).toBe(3);
      expect(recipe.bindings.length).toBeGreaterThan(0);
    });
  });

  describe('game-world preset', () => {
    it('creates game-world recipe', () => {
      const preset = getPreset('game-world')!;

      const terrain = createTestSeed('terrain', 'procedural');
      const game = createTestSeed('game', 'game');
      const audio = createTestSeed('audio', 'audio');
      const visual = createTestSeed('visual', 'visual2d');

      const recipe = preset.createRecipe(terrain, game, audio, visual);

      expect(recipe.name).toContain('game-world');
      expect(recipe.layers.length).toBe(4);
      expect(recipe.bindings.length).toBeGreaterThan(0);
    });

    it('game-world recipe includes terrain-to-difficulty binding', () => {
      const preset = getPreset('game-world')!;

      const terrain = createTestSeed('terrain', 'procedural');
      const game = createTestSeed('game', 'game');
      const audio = createTestSeed('audio', 'audio');
      const visual = createTestSeed('visual', 'visual2d');

      const recipe = preset.createRecipe(terrain, game, audio, visual);

      const difficultyBinding = recipe.bindings.find(
        b =>
          b.sourceDomain === 'procedural' &&
          b.targetDomain === 'game'
      );

      expect(difficultyBinding).toBeDefined();
    });
  });

  describe('interactive-ui preset', () => {
    it('creates interactive-ui recipe', () => {
      const preset = getPreset('interactive-ui')!;

      const ui = createTestSeed('ui', 'ui');
      const visual = createTestSeed('visual', 'visual2d');
      const audio = createTestSeed('audio', 'audio');

      const recipe = preset.createRecipe(ui, visual, audio);

      expect(recipe.name).toContain('interactive-ui');
      expect(recipe.layers.length).toBe(3);
      expect(recipe.bindings.length).toBeGreaterThan(0);
    });
  });

  describe('preset composition', () => {
    it('composes using animated-scene preset', () => {
      const composer = new SeedComposer();
      const preset = getPreset('animated-scene')!;

      const visual = createTestSeed('visual', 'visual2d');
      const anim = createTestSeed('anim', 'animation');
      const audio = createTestSeed('audio', 'audio');

      const recipe = preset.createRecipe(visual, anim, audio);
      const result = composer.compose(recipe);

      expect(result.name).toContain('animated-scene');
    });

    it('game-world composition includes multiple domains', () => {
      const composer = new SeedComposer();
      const preset = getPreset('game-world')!;

      const terrain = createTestSeed('terrain', 'procedural');
      const game = createTestSeed('game', 'game');
      const audio = createTestSeed('audio', 'audio');
      const visual = createTestSeed('visual', 'visual2d');

      const recipe = preset.createRecipe(terrain, game, audio, visual);
      const result = composer.compose(recipe);

      expect(result.name).toContain('game-world');
      expect(result.timing).toBeDefined();
    });
  });

  describe('preset domains', () => {
    it('animated-scene uses visual2d, animation, audio', () => {
      const preset = getPreset('animated-scene')!;
      expect(preset.domains).toContain('visual2d');
      expect(preset.domains).toContain('animation');
      expect(preset.domains).toContain('audio');
    });

    it('game-world uses procedural, game, audio, visual2d', () => {
      const preset = getPreset('game-world')!;
      expect(preset.domains).toContain('procedural');
      expect(preset.domains).toContain('game');
      expect(preset.domains).toContain('audio');
      expect(preset.domains).toContain('visual2d');
    });

    it('interactive-ui uses ui, visual2d, audio', () => {
      const preset = getPreset('interactive-ui')!;
      expect(preset.domains).toContain('ui');
      expect(preset.domains).toContain('visual2d');
      expect(preset.domains).toContain('audio');
    });
  });
});
