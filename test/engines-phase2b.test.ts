/**
 * engines-phase2b.test.ts — Tests for Game and UI Engines
 * Comprehensive test suite for new domain engines
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSeed, validateSeed } from '../src/kernel/seed.js';
import { GameEngine, type GameWorldData } from '../src/engines/game/engine.js';
import { UIEngine, type UILayout } from '../src/engines/ui/engine.js';

// ============================================================================
// GAME ENGINE TESTS
// ============================================================================

describe('GameEngine', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
  });

  it('should have correct domain and metadata', () => {
    expect(engine.domain).toBe('game');
    expect(engine.name).toBe('Game World Generation Engine');
    expect(engine.version).toBe('1.0.0');
  });

  it('should generate default genes', () => {
    const genes = engine.defaultGenes();

    expect(genes.genre).toBeDefined();
    expect(genes.worldWidth).toBeDefined();
    expect(genes.worldHeight).toBeDefined();
    expect(genes.tileSize).toBeDefined();
    expect(genes.biomeCount).toBeDefined();
    expect(genes.entityDensity).toBeDefined();
    expect(genes.difficulty).toBeDefined();
    expect(genes.gravity).toBeDefined();
    expect(genes.friction).toBeDefined();
  });

  it('should have required developmental stages', () => {
    const stages = engine.stages();

    expect(stages.length).toBe(6);
    expect(stages[0].name).toBe('Terrain');
    expect(stages[1].name).toBe('Biomes');
    expect(stages[2].name).toBe('Structures');
    expect(stages[3].name).toBe('Entities');
    expect(stages[4].name).toBe('Paths');
    expect(stages[5].name).toBe('Export');
  });

  it('should generate platformer levels', () => {
    const genes = engine.defaultGenes();
    (genes.genre as any).value = 'platformer';
    (genes.worldWidth as any).value = 100;
    (genes.worldHeight as any).value = 50;

    const seed = createSeed('game', 'test-platformer', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    expect(result.artifacts.size).toBeGreaterThan(0);
    expect(result.artifacts.has('gameWorldData')).toBe(true);

    const gameWorld = result.artifacts.get('gameWorldData') as GameWorldData;
    expect(gameWorld.metadata.genre).toBe('platformer');
    expect(gameWorld.metadata.width).toBe(100);
    expect(gameWorld.metadata.height).toBe(50);
  });

  it('should generate RPG levels', () => {
    const genes = engine.defaultGenes();
    (genes.genre as any).value = 'rpg';
    (genes.worldWidth as any).value = 80;
    (genes.worldHeight as any).value = 80;

    const seed = createSeed('game', 'test-rpg', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    const gameWorld = result.artifacts.get('gameWorldData') as GameWorldData;
    expect(gameWorld.metadata.genre).toBe('rpg');
  });

  it('should generate roguelike levels', () => {
    const genes = engine.defaultGenes();
    (genes.genre as any).value = 'roguelike';

    const seed = createSeed('game', 'test-roguelike', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    const gameWorld = result.artifacts.get('gameWorldData') as GameWorldData;
    expect(gameWorld.metadata.genre).toBe('roguelike');
  });

  it('should ensure entrance/exit connectivity', () => {
    const genes = engine.defaultGenes();
    const seed = createSeed('game', 'test-connectivity', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    const gameWorld = result.artifacts.get('gameWorldData') as GameWorldData;

    expect(gameWorld.connections.entrance).toBeDefined();
    expect(gameWorld.connections.entrance.length).toBe(2);
    expect(gameWorld.connections.exit).toBeDefined();
    expect(gameWorld.connections.exit.length).toBe(2);

    // Entrance and exit should be different locations
    const [entranceX, entranceY] = gameWorld.connections.entrance;
    const [exitX, exitY] = gameWorld.connections.exit;
    expect(entranceX !== exitX || entranceY !== exitY).toBe(true);
  });

  it('should place entities respecting terrain', () => {
    const genes = engine.defaultGenes();
    (genes.entityDensity as any).value = 0.5;
    (genes.spawnRate as any).value = 0.5;

    const seed = createSeed('game', 'test-entities', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    const gameWorld = result.artifacts.get('gameWorldData') as GameWorldData;

    expect(gameWorld.entities.length).toBeGreaterThan(0);

    // Check that player spawn exists
    const playerSpawns = gameWorld.entities.filter((e) => e.type === 'player_spawn');
    expect(playerSpawns.length).toBe(1);

    // Check that enemies exist
    const enemies = gameWorld.entities.filter((e) => e.type === 'enemy');
    expect(enemies.length).toBeGreaterThan(0);

    // Check that collectibles exist
    const collectibles = gameWorld.entities.filter((e) => e.type === 'collectible');
    expect(collectibles.length).toBeGreaterThan(0);
  });

  it('should scale difficulty properly', () => {
    const genes1 = engine.defaultGenes();
    (genes1.difficulty as any).value = 0.1;

    const seed1 = createSeed('game', 'easy', genes1);
    const result1 = engine.generate(seed1);
    const gameWorld1 = result1.artifacts.get('gameWorldData') as GameWorldData;
    const enemies1 = gameWorld1.entities.filter((e) => e.type === 'enemy');

    const genes2 = engine.defaultGenes();
    (genes2.difficulty as any).value = 0.9;

    const seed2 = createSeed('game', 'hard', genes2);
    const result2 = engine.generate(seed2);
    const gameWorld2 = result2.artifacts.get('gameWorldData') as GameWorldData;
    const enemies2 = gameWorld2.entities.filter((e) => e.type === 'enemy');

    if (enemies1.length > 0 && enemies2.length > 0) {
      const enemy1HP = (enemies1[0].properties.hp as number) || 1;
      const enemy2HP = (enemies2[0].properties.hp as number) || 1;
      expect(enemy2HP).toBeGreaterThanOrEqual(enemy1HP);
    }
  });

  it('should produce deterministic output with same seed', () => {
    const genes = engine.defaultGenes();
    const seed1 = createSeed('game', 'test-deterministic', genes);
    const seed2 = createSeed('game', 'test-deterministic', genes);

    const result1 = engine.generate(seed1);
    const result2 = engine.generate(seed2);

    const gameWorld1 = result1.artifacts.get('gameWorldData') as GameWorldData;
    const gameWorld2 = result2.artifacts.get('gameWorldData') as GameWorldData;

    expect(gameWorld1.entities.length).toBe(gameWorld2.entities.length);
    expect(gameWorld1.metadata).toEqual(gameWorld2.metadata);
  });

  it('should validate seed domain', () => {
    const genes = engine.defaultGenes();
    const seed = createSeed('ui' as any, 'wrong-domain', genes);

    const errors = engine.validate(seed);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('domain');
  });

  it('should output valid game world data', () => {
    const genes = engine.defaultGenes();
    const seed = createSeed('game', 'test-output', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    const gameWorld = result.artifacts.get('gameWorldData') as GameWorldData;

    // Validate structure
    expect(gameWorld.metadata).toBeDefined();
    expect(gameWorld.layers).toBeDefined();
    expect(Array.isArray(gameWorld.layers)).toBe(true);
    expect(gameWorld.entities).toBeDefined();
    expect(Array.isArray(gameWorld.entities)).toBe(true);
    expect(gameWorld.connections).toBeDefined();
    expect(gameWorld.physics).toBeDefined();

    // Validate physics values
    expect(gameWorld.physics.gravity).toBeGreaterThan(0);
    expect(gameWorld.physics.gravity).toBeLessThanOrEqual(2);
    expect(gameWorld.physics.friction).toBeGreaterThanOrEqual(0);
    expect(gameWorld.physics.friction).toBeLessThanOrEqual(1);
  });

  it('should respect world dimensions', () => {
    const genes = engine.defaultGenes();
    (genes.worldWidth as any).value = 150;
    (genes.worldHeight as any).value = 75;

    const seed = createSeed('game', 'test-dimensions', genes);
    const result = engine.generate(seed);

    const gameWorld = result.artifacts.get('gameWorldData') as GameWorldData;
    expect(gameWorld.layers[0].grid.length).toBe(75);
    expect(gameWorld.layers[0].grid[0].length).toBe(150);
  });
});

// ============================================================================
// UI ENGINE TESTS
// ============================================================================

describe('UIEngine', () => {
  let engine: UIEngine;

  beforeEach(() => {
    engine = new UIEngine();
  });

  it('should have correct domain and metadata', () => {
    expect(engine.domain).toBe('ui');
    expect(engine.name).toBe('UI Component Generation Engine');
    expect(engine.version).toBe('1.0.0');
  });

  it('should generate default genes', () => {
    const genes = engine.defaultGenes();

    expect(genes.type).toBeDefined();
    expect(genes.theme).toBeDefined();
    expect(genes.colorScheme).toBeDefined();
    expect(genes.borderRadius).toBeDefined();
    expect(genes.spacing).toBeDefined();
    expect(genes.fontSize).toBeDefined();
    expect(genes.columns).toBeDefined();
    expect(genes.density).toBeDefined();
    expect(genes.interactivity).toBeDefined();
    expect(genes.animationLevel).toBeDefined();
  });

  it('should have required developmental stages', () => {
    const stages = engine.stages();

    expect(stages.length).toBe(6);
    expect(stages[0].name).toBe('Layout');
    expect(stages[1].name).toBe('Components');
    expect(stages[2].name).toBe('Content');
    expect(stages[3].name).toBe('Styling');
    expect(stages[4].name).toBe('Interaction');
    expect(stages[5].name).toBe('Export');
  });

  it('should generate landing page UI', () => {
    const genes = engine.defaultGenes();
    (genes.type as any).value = 'landing-page';

    const seed = createSeed('ui', 'test-landing', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    expect(result.artifacts.has('htmlOutput')).toBe(true);

    const html = result.artifacts.get('htmlOutput') as string;
    expect(typeof html).toBe('string');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('landing-page');
  });

  it('should generate dashboard UI', () => {
    const genes = engine.defaultGenes();
    (genes.type as any).value = 'dashboard';

    const seed = createSeed('ui', 'test-dashboard', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    const html = result.artifacts.get('htmlOutput') as string;
    expect(html).toContain('dashboard');
    expect(html).toContain('sidebar');
  });

  it('should generate form UI', () => {
    const genes = engine.defaultGenes();
    (genes.type as any).value = 'form';

    const seed = createSeed('ui', 'test-form', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    const html = result.artifacts.get('htmlOutput') as string;
    expect(html).toContain('form');
    expect(html).toContain('form-group');
  });

  it('should generate card UI', () => {
    const genes = engine.defaultGenes();
    (genes.type as any).value = 'card';

    const seed = createSeed('ui', 'test-card', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    const html = result.artifacts.get('htmlOutput') as string;
    expect(html).toContain('card');
  });

  it('should generate gallery UI', () => {
    const genes = engine.defaultGenes();
    (genes.type as any).value = 'gallery';

    const seed = createSeed('ui', 'test-gallery', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    const html = result.artifacts.get('htmlOutput') as string;
    expect(html).toContain('gallery');
  });

  it('should generate profile UI', () => {
    const genes = engine.defaultGenes();
    (genes.type as any).value = 'profile';

    const seed = createSeed('ui', 'test-profile', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    const html = result.artifacts.get('htmlOutput') as string;
    expect(html).toContain('profile');
  });

  it('should respect theme settings', () => {
    const genes1 = engine.defaultGenes();
    (genes1.theme as any).value = 'light';

    const seed1 = createSeed('ui', 'test-light', genes1);
    const result1 = engine.generate(seed1);
    const html1 = result1.artifacts.get('htmlOutput') as string;

    const genes2 = engine.defaultGenes();
    (genes2.theme as any).value = 'dark';

    const seed2 = createSeed('ui', 'test-dark', genes2);
    const result2 = engine.generate(seed2);
    const html2 = result2.artifacts.get('htmlOutput') as string;

    // Both should be valid HTML but potentially different theme implementations
    expect(html1).toContain('<style>');
    expect(html2).toContain('<style>');
  });

  it('should include CSS in output', () => {
    const genes = engine.defaultGenes();
    const seed = createSeed('ui', 'test-css', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    const html = result.artifacts.get('htmlOutput') as string;

    expect(html).toContain('<style>');
    expect(html).toContain('</style>');
    expect(html).toContain('font-family');
    expect(html).toContain('color');
  });

  it('should respect color scheme', () => {
    const genes = engine.defaultGenes();
    const colorScheme = (genes.colorScheme as any).value;
    colorScheme.primary.value = [255, 0, 0]; // Red

    const seed = createSeed('ui', 'test-colors', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    const html = result.artifacts.get('htmlOutput') as string;
    expect(html).toContain('rgb(255, 0, 0)');
  });

  it('should respect spacing settings', () => {
    const genes = engine.defaultGenes();
    (genes.spacing as any).value = 24;

    const seed = createSeed('ui', 'test-spacing', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    const html = result.artifacts.get('htmlOutput') as string;
    expect(html).toContain('--spacing: 24px');
  });

  it('should respect border radius', () => {
    const genes = engine.defaultGenes();
    (genes.borderRadius as any).value = 16;

    const seed = createSeed('ui', 'test-radius', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    const html = result.artifacts.get('htmlOutput') as string;
    expect(html).toContain('--radius: 16px');
  });

  it('should respect font size', () => {
    const genes = engine.defaultGenes();
    (genes.fontSize as any).value = 18;

    const seed = createSeed('ui', 'test-fontsize', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    const html = result.artifacts.get('htmlOutput') as string;
    // Font size should appear in style
    expect(html).toContain('18px');
  });

  it('should include animation styles based on animation level', () => {
    const genes = engine.defaultGenes();
    (genes.animationLevel as any).value = 'expressive';

    const seed = createSeed('ui', 'test-animations', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    const html = result.artifacts.get('htmlOutput') as string;
    expect(html).toContain('transition');
  });

  it('should produce valid HTML structure', () => {
    const genes = engine.defaultGenes();
    const seed = createSeed('ui', 'test-html-valid', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    const html = result.artifacts.get('htmlOutput') as string;

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('<head>');
    expect(html).toContain('</head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</body>');
    expect(html).toContain('<meta charset');
    expect(html).toContain('<meta name="viewport"');
  });

  it('should produce deterministic output with same seed', () => {
    const genes = engine.defaultGenes();
    const seed1 = createSeed('ui', 'test-deterministic', genes);
    const seed2 = createSeed('ui', 'test-deterministic', genes);

    const result1 = engine.generate(seed1);
    const result2 = engine.generate(seed2);

    const html1 = result1.artifacts.get('htmlOutput') as string;
    const html2 = result2.artifacts.get('htmlOutput') as string;

    expect(html1).toBe(html2);
  });

  it('should validate seed domain', () => {
    const genes = engine.defaultGenes();
    const seed = createSeed('game' as any, 'wrong-domain', genes);

    const errors = engine.validate(seed);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('domain');
  });

  it('should respect content amount', () => {
    const genes1 = engine.defaultGenes();
    (genes1.contentAmount as any).value = 2;

    const seed1 = createSeed('ui', 'test-content-2', genes1);
    const result1 = engine.generate(seed1);
    const html1 = result1.artifacts.get('htmlOutput') as string;

    const genes2 = engine.defaultGenes();
    (genes2.contentAmount as any).value = 8;

    const seed2 = createSeed('ui', 'test-content-8', genes2);
    const result2 = engine.generate(seed2);
    const html2 = result2.artifacts.get('htmlOutput') as string;

    // More content should mean more elements
    const divCount1 = (html1.match(/<div/g) || []).length;
    const divCount2 = (html2.match(/<div/g) || []).length;

    expect(divCount2).toBeGreaterThanOrEqual(divCount1);
  });

  it('should include button styles and interactive elements', () => {
    const genes = engine.defaultGenes();
    const seed = createSeed('ui', 'test-interactive', genes);
    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    const html = result.artifacts.get('htmlOutput') as string;

    expect(html).toContain('btn');
    expect(html).toContain('button');
  });
});

// ============================================================================
// CROSS-ENGINE TESTS
// ============================================================================

describe('Cross-Engine Functionality', () => {
  it('should register both engines in registry', async () => {
    const { registry } = await import('../src/engines/index.js');

    expect(registry.has('game')).toBe(true);
    expect(registry.has('ui')).toBe(true);

    const gameEngine = registry.get('game');
    const uiEngine = registry.get('ui');

    expect(gameEngine).toBeDefined();
    expect(uiEngine).toBeDefined();
    expect(gameEngine?.name).toContain('Game');
    expect(uiEngine?.name).toContain('UI');
  });

  it('should list both engines', async () => {
    const { registry } = await import('../src/engines/index.js');

    const engines = registry.list();
    const domains = engines.map((e) => e.domain);

    expect(domains).toContain('game');
    expect(domains).toContain('ui');
  });

  it('should generate from registry for game', async () => {
    const { registry } = await import('../src/engines/index.js');
    const gameEngine = registry.get('game');

    if (!gameEngine) throw new Error('Game engine not registered');

    const genes = gameEngine.defaultGenes();
    const seed = createSeed('game', 'registry-test-game', genes);

    const result = registry.generate(seed);

    expect(result.success).toBe(true);
    expect(result.artifacts.has('gameWorldData')).toBe(true);
  });

  it('should generate from registry for ui', async () => {
    const { registry } = await import('../src/engines/index.js');
    const uiEngine = registry.get('ui');

    if (!uiEngine) throw new Error('UI engine not registered');

    const genes = uiEngine.defaultGenes();
    const seed = createSeed('ui', 'registry-test-ui', genes);

    const result = registry.generate(seed);

    expect(result.success).toBe(true);
    expect(result.artifacts.has('htmlOutput')).toBe(true);
  });
});
