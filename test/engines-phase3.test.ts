/**
 * engines-phase3.test.ts — Tests for Sprite and Full Game Engines
 * Verifies deterministic generation, correct SVG output, and complete game specifications
 */

import { describe, it, expect } from 'vitest';
import { createSeed } from '../src/kernel/seed.js';
import { scalar, categorical } from '../src/kernel/genes.js';
import { SpriteEngine } from '../src/engines/sprite/engine.js';
import { FullGameEngine } from '../src/engines/fullgame/engine.js';

describe('Sprite Engine', () => {
  it('creates a valid sprite engine instance', () => {
    const engine = new SpriteEngine();
    expect(engine.domain).toBe('sprite');
    expect(engine.name).toBe('Sprite Generation Engine');
    expect(engine.version).toBe('1.0.0');
  });

  it('has correct default genes', () => {
    const engine = new SpriteEngine();
    const defaults = engine.defaultGenes();

    expect(defaults.spriteType).toBeDefined();
    expect(defaults.size).toBeDefined();
    expect(defaults.frameCount).toBeDefined();
    expect(defaults.direction).toBeDefined();
    expect(defaults.colorPalette).toBeDefined();
    expect(defaults.complexity).toBeDefined();
    expect(defaults.bodyType).toBeDefined();
    expect(defaults.headRatio).toBeDefined();
    expect(defaults.limbStyle).toBeDefined();
    expect(defaults.armorLevel).toBeDefined();
    expect(defaults.expression).toBeDefined();
    expect(defaults.animationType).toBeDefined();
    expect(defaults.outlineWeight).toBeDefined();
    expect(defaults.shading).toBeDefined();
  });

  it('generates a valid sprite sheet SVG', () => {
    const engine = new SpriteEngine();
    const seed = createSeed(
      'sprite',
      'test_sprite',
      {
        spriteType: categorical('character', ['character', 'item', 'tile', 'icon', 'particle']),
        size: scalar(32, 8, 256),
        frameCount: scalar(4, 1, 32),
        direction: categorical('front', ['front', 'side', 'top-down', 'isometric']),
        colorPalette: categorical('fantasy', ['retro', 'pastel', 'neon', 'earth', 'monochrome', 'fantasy']),
        complexity: scalar(5, 1, 10),
        bodyType: categorical('humanoid', ['humanoid', 'creature', 'mech', 'blob', 'geometric', 'plant']),
        headRatio: scalar(0.25, 0.15, 0.45),
        limbStyle: categorical('normal', ['normal', 'stubby', 'long', 'tentacle', 'wings']),
        armorLevel: scalar(0.3, 0, 1),
        expression: categorical('neutral', ['neutral', 'happy', 'angry', 'sad', 'determined']),
        animationType: categorical('idle', ['idle', 'walk', 'run', 'attack', 'death', 'jump']),
        outlineWeight: scalar(1, 0, 3),
        shading: categorical('flat', ['flat', 'cel', 'gradient', 'pixel']),
      }
    );

    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.artifacts.has('spriteSheet')).toBe(true);
    expect(result.artifacts.has('frames')).toBe(true);
    expect(result.artifacts.has('metadata')).toBe(true);
    expect(result.artifacts.has('palette')).toBe(true);

    const spriteSheet = result.artifacts.get('spriteSheet') as string;
    expect(spriteSheet).toMatch(/<svg/);
    expect(spriteSheet).toMatch(/<\/svg>/);
  });

  it('creates walk cycle with correct frame count', () => {
    const engine = new SpriteEngine();
    const seed = createSeed('sprite', 'walk_test', {
      spriteType: categorical('character', ['character', 'item', 'tile', 'icon', 'particle']),
      size: scalar(32, 8, 256),
      frameCount: scalar(8, 1, 32),
      direction: categorical('side', ['front', 'side', 'top-down', 'isometric']),
      colorPalette: categorical('fantasy', ['retro', 'pastel', 'neon', 'earth', 'monochrome', 'fantasy']),
      complexity: scalar(5, 1, 10),
      bodyType: categorical('humanoid', ['humanoid', 'creature', 'mech', 'blob', 'geometric', 'plant']),
      headRatio: scalar(0.25, 0.15, 0.45),
      limbStyle: categorical('normal', ['normal', 'stubby', 'long', 'tentacle', 'wings']),
      armorLevel: scalar(0.3, 0, 1),
      expression: categorical('neutral', ['neutral', 'happy', 'angry', 'sad', 'determined']),
      animationType: categorical('walk', ['idle', 'walk', 'run', 'attack', 'death', 'jump']),
      outlineWeight: scalar(1, 0, 3),
      shading: categorical('flat', ['flat', 'cel', 'gradient', 'pixel']),
    });

    const result = engine.generate(seed);
    const frames = result.artifacts.get('frames') as any[];
    const metadata = result.artifacts.get('metadata') as any;

    expect(frames.length).toBe(8);
    expect(metadata.frameCount).toBe(8);
    expect(metadata.animationFrames.length).toBe(8);
  });

  it('generates different outputs for different body types', () => {
    const engine = new SpriteEngine();

    const bodyTypes = ['humanoid', 'creature', 'mech', 'blob', 'geometric', 'plant'];
    const generatedSvgs: string[] = [];

    for (const bodyType of bodyTypes) {
      const seed = createSeed('sprite', `body_type_${bodyType}`, {
        spriteType: categorical('character', ['character', 'item', 'tile', 'icon', 'particle']),
        size: scalar(32, 8, 256),
        frameCount: scalar(1, 1, 32),
        direction: categorical('front', ['front', 'side', 'top-down', 'isometric']),
        colorPalette: categorical('fantasy', ['retro', 'pastel', 'neon', 'earth', 'monochrome', 'fantasy']),
        complexity: scalar(5, 1, 10),
        bodyType: categorical(bodyType, ['humanoid', 'creature', 'mech', 'blob', 'geometric', 'plant']),
        headRatio: scalar(0.25, 0.15, 0.45),
        limbStyle: categorical('normal', ['normal', 'stubby', 'long', 'tentacle', 'wings']),
        armorLevel: scalar(0.3, 0, 1),
        expression: categorical('neutral', ['neutral', 'happy', 'angry', 'sad', 'determined']),
        animationType: categorical('idle', ['idle', 'walk', 'run', 'attack', 'death', 'jump']),
        outlineWeight: scalar(1, 0, 3),
        shading: categorical('flat', ['flat', 'cel', 'gradient', 'pixel']),
      });

      const result = engine.generate(seed);
      const frames = result.artifacts.get('frames') as any[];
      generatedSvgs.push(frames[0].svg);
    }

    const uniqueSvgs = new Set(generatedSvgs);
    expect(uniqueSvgs.size).toBeGreaterThan(1);
  });

  it('generates deterministic output with same seed', () => {
    const engine = new SpriteEngine();
    const seed = createSeed('sprite', 'determinism_test', {
      spriteType: categorical('character', ['character', 'item', 'tile', 'icon', 'particle']),
      size: scalar(32, 8, 256),
      frameCount: scalar(4, 1, 32),
      direction: categorical('front', ['front', 'side', 'top-down', 'isometric']),
      colorPalette: categorical('fantasy', ['retro', 'pastel', 'neon', 'earth', 'monochrome', 'fantasy']),
      complexity: scalar(5, 1, 10),
      bodyType: categorical('humanoid', ['humanoid', 'creature', 'mech', 'blob', 'geometric', 'plant']),
      headRatio: scalar(0.25, 0.15, 0.45),
      limbStyle: categorical('normal', ['normal', 'stubby', 'long', 'tentacle', 'wings']),
      armorLevel: scalar(0.3, 0, 1),
      expression: categorical('neutral', ['neutral', 'happy', 'angry', 'sad', 'determined']),
      animationType: categorical('idle', ['idle', 'walk', 'run', 'attack', 'death', 'jump']),
      outlineWeight: scalar(1, 0, 3),
      shading: categorical('flat', ['flat', 'cel', 'gradient', 'pixel']),
    });

    const result1 = engine.generate(seed, 'test_seed');
    const result2 = engine.generate(seed, 'test_seed');

    const sheet1 = result1.artifacts.get('spriteSheet') as string;
    const sheet2 = result2.artifacts.get('spriteSheet') as string;

    expect(sheet1).toBe(sheet2);
  });

  it('generates valid color palettes', () => {
    const engine = new SpriteEngine();
    const palettes = ['retro', 'pastel', 'neon', 'earth', 'monochrome', 'fantasy'];

    for (const palette of palettes) {
      const seed = createSeed('sprite', `palette_${palette}`, {
        spriteType: categorical('character', ['character', 'item', 'tile', 'icon', 'particle']),
        size: scalar(32, 8, 256),
        frameCount: scalar(1, 1, 32),
        direction: categorical('front', ['front', 'side', 'top-down', 'isometric']),
        colorPalette: categorical(palette, ['retro', 'pastel', 'neon', 'earth', 'monochrome', 'fantasy']),
        complexity: scalar(5, 1, 10),
        bodyType: categorical('humanoid', ['humanoid', 'creature', 'mech', 'blob', 'geometric', 'plant']),
        headRatio: scalar(0.25, 0.15, 0.45),
        limbStyle: categorical('normal', ['normal', 'stubby', 'long', 'tentacle', 'wings']),
        armorLevel: scalar(0.3, 0, 1),
        expression: categorical('neutral', ['neutral', 'happy', 'angry', 'sad', 'determined']),
        animationType: categorical('idle', ['idle', 'walk', 'run', 'attack', 'death', 'jump']),
        outlineWeight: scalar(1, 0, 3),
        shading: categorical('flat', ['flat', 'cel', 'gradient', 'pixel']),
      });

      const result = engine.generate(seed);
      const paletteColors = result.artifacts.get('palette') as string[];

      expect(paletteColors).toBeDefined();
      expect(Array.isArray(paletteColors)).toBe(true);
      expect(paletteColors.length).toBeGreaterThan(0);

      for (const color of paletteColors) {
        expect(color).toMatch(/^#[0-9A-F]{6}$/i);
      }
    }
  });

  it('includes metadata with hitbox information', () => {
    const engine = new SpriteEngine();
    const seed = createSeed('sprite', 'metadata_test', {
      spriteType: categorical('character', ['character', 'item', 'tile', 'icon', 'particle']),
      size: scalar(32, 8, 256),
      frameCount: scalar(4, 1, 32),
      direction: categorical('front', ['front', 'side', 'top-down', 'isometric']),
      colorPalette: categorical('fantasy', ['retro', 'pastel', 'neon', 'earth', 'monochrome', 'fantasy']),
      complexity: scalar(5, 1, 10),
      bodyType: categorical('humanoid', ['humanoid', 'creature', 'mech', 'blob', 'geometric', 'plant']),
      headRatio: scalar(0.25, 0.15, 0.45),
      limbStyle: categorical('normal', ['normal', 'stubby', 'long', 'tentacle', 'wings']),
      armorLevel: scalar(0.3, 0, 1),
      expression: categorical('neutral', ['neutral', 'happy', 'angry', 'sad', 'determined']),
      animationType: categorical('idle', ['idle', 'walk', 'run', 'attack', 'death', 'jump']),
      outlineWeight: scalar(1, 0, 3),
      shading: categorical('flat', ['flat', 'cel', 'gradient', 'pixel']),
    });

    const result = engine.generate(seed);
    const metadata = result.artifacts.get('metadata') as any;

    expect(metadata.hitbox).toBeDefined();
    expect(metadata.hitbox.x).toBeDefined();
    expect(metadata.hitbox.y).toBeDefined();
    expect(metadata.hitbox.width).toBeDefined();
    expect(metadata.hitbox.height).toBeDefined();
  });
});

describe('Full Game Engine', () => {
  it('creates a valid full game engine instance', () => {
    const engine = new FullGameEngine();
    expect(engine.domain).toBe('fullgame');
    expect(engine.name).toBe('Full Game Generation Engine');
    expect(engine.version).toBe('1.0.0');
  });

  it('has correct default genes', () => {
    const engine = new FullGameEngine();
    const defaults = engine.defaultGenes();

    expect(defaults.gameType).toBeDefined();
    expect(defaults.worldWidth).toBeDefined();
    expect(defaults.worldHeight).toBeDefined();
    expect(defaults.difficulty).toBeDefined();
    expect(defaults.entityCount).toBeDefined();
    expect(defaults.itemCount).toBeDefined();
    expect(defaults.colorScheme).toBeDefined();
    expect(defaults.musicTempo).toBeDefined();
    expect(defaults.musicKey).toBeDefined();
    expect(defaults.musicScale).toBeDefined();
    expect(defaults.tileComplexity).toBeDefined();
    expect(defaults.storyComplexity).toBeDefined();
  });

  it('generates a complete game specification', () => {
    const engine = new FullGameEngine();
    const seed = createSeed('fullgame', 'test_game', {
      gameType: categorical('platformer', ['platformer', 'rpg', 'puzzle', 'shooter', 'roguelike', 'rhythm']),
      worldWidth: scalar(30, 10, 100),
      worldHeight: scalar(20, 10, 100),
      difficulty: scalar(5, 1, 10),
      entityCount: scalar(10, 3, 50),
      itemCount: scalar(8, 2, 20),
      colorScheme: categorical('bright', ['dark', 'bright', 'pastel', 'neon', 'retro']),
      musicTempo: scalar(120, 60, 180),
      musicKey: categorical('C', ['C', 'D', 'E', 'F', 'G', 'A', 'B']),
      musicScale: categorical('major', ['major', 'minor', 'pentatonic']),
      tileComplexity: scalar(3, 1, 5),
      storyComplexity: scalar(2, 1, 5),
    });

    const result = engine.generate(seed);

    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.artifacts.has('gameSpec')).toBe(true);
    expect(result.artifacts.has('world')).toBe(true);
    expect(result.artifacts.has('entities')).toBe(true);
    expect(result.artifacts.has('items')).toBe(true);
    expect(result.artifacts.has('rules')).toBe(true);
    expect(result.artifacts.has('music')).toBe(true);
    expect(result.artifacts.has('ui')).toBe(true);
    expect(result.artifacts.has('tileset')).toBe(true);
    expect(result.artifacts.has('palette')).toBe(true);
  });

  it('generates valid game specification structure', () => {
    const engine = new FullGameEngine();
    const seed = createSeed('fullgame', 'spec_test', {
      gameType: categorical('rpg', ['platformer', 'rpg', 'puzzle', 'shooter', 'roguelike', 'rhythm']),
      worldWidth: scalar(30, 10, 100),
      worldHeight: scalar(20, 10, 100),
      difficulty: scalar(5, 1, 10),
      entityCount: scalar(10, 3, 50),
      itemCount: scalar(8, 2, 20),
      colorScheme: categorical('bright', ['dark', 'bright', 'pastel', 'neon', 'retro']),
      musicTempo: scalar(120, 60, 180),
      musicKey: categorical('C', ['C', 'D', 'E', 'F', 'G', 'A', 'B']),
      musicScale: categorical('major', ['major', 'minor', 'pentatonic']),
      tileComplexity: scalar(3, 1, 5),
      storyComplexity: scalar(2, 1, 5),
    });

    const result = engine.generate(seed);
    const gameSpec = result.artifacts.get('gameSpec') as any;

    expect(gameSpec.gameType).toBe('rpg');
    expect(gameSpec.title).toBeDefined();
    expect(gameSpec.description).toBeDefined();
    expect(gameSpec.difficulty).toBeDefined();
    expect(gameSpec.world).toBeDefined();
    expect(gameSpec.entities).toBeDefined();
    expect(gameSpec.items).toBeDefined();
    expect(gameSpec.rules).toBeDefined();
    expect(gameSpec.music).toBeDefined();
    expect(gameSpec.ui).toBeDefined();
    expect(gameSpec.palette).toBeDefined();
  });

  it('generates valid world with tiles for all game types', () => {
    const engine = new FullGameEngine();
    const gameTypes = ['platformer', 'rpg', 'puzzle', 'shooter', 'roguelike', 'rhythm'];

    for (const gameType of gameTypes) {
      const seed = createSeed('fullgame', `world_${gameType}`, {
        gameType: categorical(gameType, ['platformer', 'rpg', 'puzzle', 'shooter', 'roguelike', 'rhythm']),
        worldWidth: scalar(20, 10, 100),
        worldHeight: scalar(15, 10, 100),
        difficulty: scalar(5, 1, 10),
        entityCount: scalar(10, 3, 50),
        itemCount: scalar(8, 2, 20),
        colorScheme: categorical('bright', ['dark', 'bright', 'pastel', 'neon', 'retro']),
        musicTempo: scalar(120, 60, 180),
        musicKey: categorical('C', ['C', 'D', 'E', 'F', 'G', 'A', 'B']),
        musicScale: categorical('major', ['major', 'minor', 'pentatonic']),
        tileComplexity: scalar(3, 1, 5),
        storyComplexity: scalar(2, 1, 5),
      });

      const result = engine.generate(seed);
      const world = result.artifacts.get('world') as any;

      expect(world.width).toBe(20);
      expect(world.height).toBe(15);
      expect(world.tiles.length).toBe(15);
      expect(world.tiles[0].length).toBe(20);
      expect(world.tileTypes).toBeDefined();
    }
  });

  it('generates correct number of entities', () => {
    const engine = new FullGameEngine();
    const seed = createSeed('fullgame', 'entity_test', {
      gameType: categorical('platformer', ['platformer', 'rpg', 'puzzle', 'shooter', 'roguelike', 'rhythm']),
      worldWidth: scalar(30, 10, 100),
      worldHeight: scalar(20, 10, 100),
      difficulty: scalar(5, 1, 10),
      entityCount: scalar(15, 3, 50),
      itemCount: scalar(8, 2, 20),
      colorScheme: categorical('bright', ['dark', 'bright', 'pastel', 'neon', 'retro']),
      musicTempo: scalar(120, 60, 180),
      musicKey: categorical('C', ['C', 'D', 'E', 'F', 'G', 'A', 'B']),
      musicScale: categorical('major', ['major', 'minor', 'pentatonic']),
      tileComplexity: scalar(3, 1, 5),
      storyComplexity: scalar(2, 1, 5),
    });

    const result = engine.generate(seed);
    const entities = result.artifacts.get('entities') as any[];

    expect(entities.length).toBe(15);
    expect(entities[0].type).toBe('player');
    expect(entities[0].behavior).toBe('player_controlled');
  });

  it('generates valid item placements', () => {
    const engine = new FullGameEngine();
    const seed = createSeed('fullgame', 'item_test', {
      gameType: categorical('platformer', ['platformer', 'rpg', 'puzzle', 'shooter', 'roguelike', 'rhythm']),
      worldWidth: scalar(30, 10, 100),
      worldHeight: scalar(20, 10, 100),
      difficulty: scalar(5, 1, 10),
      entityCount: scalar(10, 3, 50),
      itemCount: scalar(12, 2, 20),
      colorScheme: categorical('bright', ['dark', 'bright', 'pastel', 'neon', 'retro']),
      musicTempo: scalar(120, 60, 180),
      musicKey: categorical('C', ['C', 'D', 'E', 'F', 'G', 'A', 'B']),
      musicScale: categorical('major', ['major', 'minor', 'pentatonic']),
      tileComplexity: scalar(3, 1, 5),
      storyComplexity: scalar(2, 1, 5),
    });

    const result = engine.generate(seed);
    const items = result.artifacts.get('items') as any[];

    expect(items.length).toBe(12);

    for (const item of items) {
      expect(item.id).toBeDefined();
      expect(item.type).toBeDefined();
      expect(item.x).toBeDefined();
      expect(item.y).toBeDefined();
      expect(item.value).toBeGreaterThan(0);
    }
  });

  it('generates game rules for all game types', () => {
    const engine = new FullGameEngine();
    const gameTypes = ['platformer', 'rpg', 'puzzle', 'shooter', 'roguelike', 'rhythm'];

    for (const gameType of gameTypes) {
      const seed = createSeed('fullgame', `rules_${gameType}`, {
        gameType: categorical(gameType, ['platformer', 'rpg', 'puzzle', 'shooter', 'roguelike', 'rhythm']),
        worldWidth: scalar(20, 10, 100),
        worldHeight: scalar(15, 10, 100),
        difficulty: scalar(5, 1, 10),
        entityCount: scalar(10, 3, 50),
        itemCount: scalar(8, 2, 20),
        colorScheme: categorical('bright', ['dark', 'bright', 'pastel', 'neon', 'retro']),
        musicTempo: scalar(120, 60, 180),
        musicKey: categorical('C', ['C', 'D', 'E', 'F', 'G', 'A', 'B']),
        musicScale: categorical('major', ['major', 'minor', 'pentatonic']),
        tileComplexity: scalar(3, 1, 5),
        storyComplexity: scalar(2, 1, 5),
      });

      const result = engine.generate(seed);
      const rules = result.artifacts.get('rules') as any;

      expect(rules.winConditions).toBeDefined();
      expect(Array.isArray(rules.winConditions)).toBe(true);
      expect(rules.winConditions.length).toBeGreaterThan(0);

      expect(rules.loseConditions).toBeDefined();
      expect(Array.isArray(rules.loseConditions)).toBe(true);
      expect(rules.loseConditions.length).toBeGreaterThan(0);

      expect(rules.scoring).toBeDefined();
      expect(typeof rules.scoring).toBe('object');

      expect(rules.interactions).toBeDefined();
      expect(Array.isArray(rules.interactions)).toBe(true);
    }
  });

  it('generates valid music specifications', () => {
    const engine = new FullGameEngine();
    const seed = createSeed('fullgame', 'music_test', {
      gameType: categorical('platformer', ['platformer', 'rpg', 'puzzle', 'shooter', 'roguelike', 'rhythm']),
      worldWidth: scalar(30, 10, 100),
      worldHeight: scalar(20, 10, 100),
      difficulty: scalar(5, 1, 10),
      entityCount: scalar(10, 3, 50),
      itemCount: scalar(8, 2, 20),
      colorScheme: categorical('bright', ['dark', 'bright', 'pastel', 'neon', 'retro']),
      musicTempo: scalar(140, 60, 180),
      musicKey: categorical('G', ['C', 'D', 'E', 'F', 'G', 'A', 'B']),
      musicScale: categorical('minor', ['major', 'minor', 'pentatonic']),
      tileComplexity: scalar(3, 1, 5),
      storyComplexity: scalar(2, 1, 5),
    });

    const result = engine.generate(seed);
    const music = result.artifacts.get('music') as any;

    expect(music.bpm).toBe(140);
    expect(music.key).toBe('G');
    expect(music.scale).toBe('minor');
    expect(music.duration).toBeGreaterThan(0);
    expect(Array.isArray(music.sections)).toBe(true);
    expect(music.sections.length).toBeGreaterThan(0);

    for (const section of music.sections) {
      expect(section.name).toBeDefined();
      expect(section.startBeat).toBeDefined();
      expect(section.endBeat).toBeDefined();
      expect(section.pattern).toBeDefined();
    }
  });

  it('generates valid UI layout specifications', () => {
    const engine = new FullGameEngine();
    const seed = createSeed('fullgame', 'ui_test', {
      gameType: categorical('rpg', ['platformer', 'rpg', 'puzzle', 'shooter', 'roguelike', 'rhythm']),
      worldWidth: scalar(30, 10, 100),
      worldHeight: scalar(20, 10, 100),
      difficulty: scalar(5, 1, 10),
      entityCount: scalar(10, 3, 50),
      itemCount: scalar(8, 2, 20),
      colorScheme: categorical('bright', ['dark', 'bright', 'pastel', 'neon', 'retro']),
      musicTempo: scalar(120, 60, 180),
      musicKey: categorical('C', ['C', 'D', 'E', 'F', 'G', 'A', 'B']),
      musicScale: categorical('major', ['major', 'minor', 'pentatonic']),
      tileComplexity: scalar(3, 1, 5),
      storyComplexity: scalar(2, 1, 5),
    });

    const result = engine.generate(seed);
    const ui = result.artifacts.get('ui') as any;

    expect(ui.healthBar).toBeDefined();
    expect(ui.healthBar.x).toBeDefined();
    expect(ui.healthBar.y).toBeDefined();
    expect(ui.healthBar.width).toBeDefined();
    expect(ui.healthBar.height).toBeDefined();

    expect(ui.scoreDisplay).toBeDefined();
    expect(ui.scoreDisplay.x).toBeDefined();
    expect(ui.scoreDisplay.y).toBeDefined();
  });

  it('generates deterministic output with same seed', () => {
    const engine = new FullGameEngine();
    const seed = createSeed('fullgame', 'determinism_test', {
      gameType: categorical('platformer', ['platformer', 'rpg', 'puzzle', 'shooter', 'roguelike', 'rhythm']),
      worldWidth: scalar(30, 10, 100),
      worldHeight: scalar(20, 10, 100),
      difficulty: scalar(5, 1, 10),
      entityCount: scalar(10, 3, 50),
      itemCount: scalar(8, 2, 20),
      colorScheme: categorical('bright', ['dark', 'bright', 'pastel', 'neon', 'retro']),
      musicTempo: scalar(120, 60, 180),
      musicKey: categorical('C', ['C', 'D', 'E', 'F', 'G', 'A', 'B']),
      musicScale: categorical('major', ['major', 'minor', 'pentatonic']),
      tileComplexity: scalar(3, 1, 5),
      storyComplexity: scalar(2, 1, 5),
    });

    const result1 = engine.generate(seed, 'test_seed');
    const result2 = engine.generate(seed, 'test_seed');

    const spec1 = JSON.stringify(result1.artifacts.get('gameSpec'));
    const spec2 = JSON.stringify(result2.artifacts.get('gameSpec'));

    expect(spec1).toBe(spec2);
  });

  it('includes all required sections in game specification', () => {
    const engine = new FullGameEngine();
    const seed = createSeed('fullgame', 'full_spec_test', {
      gameType: categorical('platformer', ['platformer', 'rpg', 'puzzle', 'shooter', 'roguelike', 'rhythm']),
      worldWidth: scalar(30, 10, 100),
      worldHeight: scalar(20, 10, 100),
      difficulty: scalar(5, 1, 10),
      entityCount: scalar(10, 3, 50),
      itemCount: scalar(8, 2, 20),
      colorScheme: categorical('bright', ['dark', 'bright', 'pastel', 'neon', 'retro']),
      musicTempo: scalar(120, 60, 180),
      musicKey: categorical('C', ['C', 'D', 'E', 'F', 'G', 'A', 'B']),
      musicScale: categorical('major', ['major', 'minor', 'pentatonic']),
      tileComplexity: scalar(3, 1, 5),
      storyComplexity: scalar(2, 1, 5),
    });

    const result = engine.generate(seed);
    const gameSpec = result.artifacts.get('gameSpec') as any;

    const requiredFields = [
      'gameType',
      'title',
      'description',
      'difficulty',
      'world',
      'entities',
      'items',
      'rules',
      'music',
      'ui',
      'palette',
    ];

    for (const field of requiredFields) {
      expect(gameSpec[field]).toBeDefined();
    }
  });

  it('generates valid color schemes', () => {
    const engine = new FullGameEngine();
    const schemes = ['dark', 'bright', 'pastel', 'neon', 'retro'];

    for (const scheme of schemes) {
      const seed = createSeed('fullgame', `scheme_${scheme}`, {
        gameType: categorical('platformer', ['platformer', 'rpg', 'puzzle', 'shooter', 'roguelike', 'rhythm']),
        worldWidth: scalar(30, 10, 100),
        worldHeight: scalar(20, 10, 100),
        difficulty: scalar(5, 1, 10),
        entityCount: scalar(10, 3, 50),
        itemCount: scalar(8, 2, 20),
        colorScheme: categorical(scheme, ['dark', 'bright', 'pastel', 'neon', 'retro']),
        musicTempo: scalar(120, 60, 180),
        musicKey: categorical('C', ['C', 'D', 'E', 'F', 'G', 'A', 'B']),
        musicScale: categorical('major', ['major', 'minor', 'pentatonic']),
        tileComplexity: scalar(3, 1, 5),
        storyComplexity: scalar(2, 1, 5),
      });

      const result = engine.generate(seed);
      const palette = result.artifacts.get('palette') as string[];

      expect(Array.isArray(palette)).toBe(true);
      expect(palette.length).toBeGreaterThan(0);

      for (const color of palette) {
        expect(color).toMatch(/^#[0-9A-F]{6}$/i);
      }
    }
  });

  it('measures generation performance', () => {
    const engine = new FullGameEngine();
    const seed = createSeed('fullgame', 'perf_test', {
      gameType: categorical('platformer', ['platformer', 'rpg', 'puzzle', 'shooter', 'roguelike', 'rhythm']),
      worldWidth: scalar(30, 10, 100),
      worldHeight: scalar(20, 10, 100),
      difficulty: scalar(5, 1, 10),
      entityCount: scalar(10, 3, 50),
      itemCount: scalar(8, 2, 20),
      colorScheme: categorical('bright', ['dark', 'bright', 'pastel', 'neon', 'retro']),
      musicTempo: scalar(120, 60, 180),
      musicKey: categorical('C', ['C', 'D', 'E', 'F', 'G', 'A', 'B']),
      musicScale: categorical('major', ['major', 'minor', 'pentatonic']),
      tileComplexity: scalar(3, 1, 5),
      storyComplexity: scalar(2, 1, 5),
    });

    const result = engine.generate(seed);

    expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.stageTimings.length).toBeGreaterThan(0);
  });
});
