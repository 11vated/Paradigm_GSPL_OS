/**
 * fullgame/engine.ts — Full Game Generation Engine
 * Combines multiple domain engines to generate a complete mini-game specification from a single seed.
 * Developmental stages: World → Entities → Items → Rules → Music → UI → Package
 */

import {
  DomainEngine,
  DevelopmentalStage,
  DevelopmentalContext,
} from '../engine.js';
import { UniversalSeed, FitnessVector, GeneMap } from '../../kernel/seed.js';
import { scalar, categorical } from '../../kernel/genes.js';

interface TileMapData {
  width: number;
  height: number;
  tiles: number[][];
  tileTypes: Record<number, { name: string; solid: boolean; color: string }>;
}

interface EntityData {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  behavior: string;
  spriteId?: string;
}

interface ItemData {
  id: string;
  type: string;
  x: number;
  y: number;
  value: number;
}

interface GameRules {
  winConditions: string[];
  loseConditions: string[];
  scoring: Record<string, number>;
  interactions: Array<{
    trigger: string;
    action: string;
    target: string;
  }>;
}

interface GameUILayout {
  healthBar: { x: number; y: number; width: number; height: number };
  scoreDisplay: { x: number; y: number };
  minimap?: { x: number; y: number; width: number; height: number };
  inventory?: { x: number; y: number };
}

interface MusicTrackData {
  bpm: number;
  key: string;
  scale: string;
  duration: number;
  sections: Array<{
    name: string;
    startBeat: number;
    endBeat: number;
    pattern: string;
  }>;
}

interface GameSpecification {
  gameType: string;
  title: string;
  description: string;
  difficulty: number;
  world: TileMapData;
  entities: EntityData[];
  items: ItemData[];
  rules: GameRules;
  music: MusicTrackData;
  ui: GameUILayout;
  palette: string[];
}

export class FullGameEngine extends DomainEngine {
  readonly domain = 'fullgame';
  readonly name = 'Full Game Generation Engine';
  readonly version = '1.0.0';

  defaultGenes(): GeneMap {
    return {
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
    };
  }

  evaluate(seed: UniversalSeed): FitnessVector {
    const difficulty = this.getGeneValue('difficulty', seed.genes, 5) as number;
    const entityCount = this.getGeneValue('entityCount', seed.genes, 10) as number;

    return {
      scores: {
        difficulty: Math.min(difficulty / 10, 1),
        complexity: Math.min(entityCount / 50, 1),
      },
      aggregate: 0.8,
      evaluatedAt: Date.now(),
    };
  }

  stages(): DevelopmentalStage[] {
    return [
      this.stageWorldBuilder(),
      this.stageEntityGeneration(),
      this.stageItemPlacement(),
      this.stageRuleDefinition(),
      this.stageMusicGeneration(),
      this.stageUILayout(),
      this.stagePackageGame(),
    ];
  }

  private stageWorldBuilder(): DevelopmentalStage {
    return {
      name: 'World',
      description: 'Generate the game world',
      execute: (ctx: DevelopmentalContext) => {
        const gameType = this.getGeneValue('gameType', ctx.seed.genes, 'platformer') as string;
        const width = this.getGeneValue('worldWidth', ctx.seed.genes, 30) as number;
        const height = this.getGeneValue('worldHeight', ctx.seed.genes, 20) as number;
        const tileComplexity = this.getGeneValue('tileComplexity', ctx.seed.genes, 3) as number;

        const world = this.generateWorld(gameType, width, height, tileComplexity, ctx.rng);
        ctx.artifacts.set('world', world);
        ctx.parameters.worldWidth = width;
        ctx.parameters.worldHeight = height;
        ctx.parameters.gameType = gameType;

        return ctx;
      },
    };
  }

  private generateWorld(
    gameType: string,
    width: number,
    height: number,
    complexity: number,
    rng: any
  ): TileMapData {
    const tiles: number[][] = [];

    if (gameType === 'platformer') {
      for (let y = 0; y < height; y++) {
        const row: number[] = [];
        for (let x = 0; x < width; x++) {
          if (y === height - 1) {
            row.push(1);
          } else if (y > height - 3 && rng.nextBool(0.2)) {
            row.push(1);
          } else if (y > height - 5 && x % 4 === 0) {
            row.push(1);
          } else {
            row.push(0);
          }
        }
        tiles.push(row);
      }
    } else if (gameType === 'rpg') {
      const roomSize = Math.floor(width / 5);
      for (let y = 0; y < height; y++) {
        const row: number[] = [];
        for (let x = 0; x < width; x++) {
          const inRoom = (x % roomSize === 0 || x % roomSize === roomSize - 1 || y % roomSize === 0 || y % roomSize === roomSize - 1);
          row.push(inRoom ? 2 : 0);
        }
        tiles.push(row);
      }
    } else if (gameType === 'roguelike') {
      for (let y = 0; y < height; y++) {
        const row: number[] = [];
        for (let x = 0; x < width; x++) {
          if ((x + y) % 5 === 0 && rng.nextBool(0.6)) {
            row.push(1);
          } else {
            row.push(0);
          }
        }
        tiles.push(row);
      }
    } else if (gameType === 'puzzle') {
      for (let y = 0; y < height; y++) {
        const row: number[] = [];
        for (let x = 0; x < width; x++) {
          const checkerboard = (x + y) % 2;
          row.push(checkerboard);
        }
        tiles.push(row);
      }
    } else if (gameType === 'shooter') {
      for (let y = 0; y < height; y++) {
        const row: number[] = [];
        for (let x = 0; x < width; x++) {
          if (y < 3 || y > height - 4) {
            row.push(0);
          } else if (x % 8 === 0 || x % 8 === 7) {
            row.push(1);
          } else {
            row.push(0);
          }
        }
        tiles.push(row);
      }
    } else {
      for (let y = 0; y < height; y++) {
        tiles.push(new Array(width).fill(0));
      }
    }

    return {
      width,
      height,
      tiles,
      tileTypes: {
        0: { name: 'floor', solid: false, color: '#C0C0C0' },
        1: { name: 'wall', solid: true, color: '#696969' },
        2: { name: 'wall_brick', solid: true, color: '#8B4513' },
        3: { name: 'water', solid: false, color: '#4A90E2' },
      },
    };
  }

  private stageEntityGeneration(): DevelopmentalStage {
    return {
      name: 'Entities',
      description: 'Generate player, enemies, NPCs',
      execute: (ctx: DevelopmentalContext) => {
        const entityCount = this.getGeneValue('entityCount', ctx.seed.genes, 10) as number;
        const difficulty = this.getGeneValue('difficulty', ctx.seed.genes, 5) as number;
        const gameType = ctx.parameters.gameType as string;
        const world = ctx.artifacts.get('world') as TileMapData;

        const entities = this.generateEntities(entityCount, difficulty, gameType, world, ctx.rng);
        ctx.artifacts.set('entities', entities);

        return ctx;
      },
    };
  }

  private generateEntities(
    count: number,
    difficulty: number,
    gameType: string,
    world: TileMapData,
    rng: any
  ): EntityData[] {
    const entities: EntityData[] = [];

    entities.push({
      id: 'player',
      type: 'player',
      x: 2,
      y: world.height - 3,
      width: 1,
      height: 1,
      behavior: 'player_controlled',
    });

    const enemyCount = Math.floor((count - 1) * 0.6);
    for (let i = 0; i < enemyCount; i++) {
      const enemyTypes = ['goblin', 'orc', 'ghost', 'slime', 'bat'];
      const type = enemyTypes[Math.floor(difficulty / 2) % enemyTypes.length];

      let validX = false;
      let x = 0;
      let y = 0;

      while (!validX) {
        x = rng.nextInt(2, world.width - 2);
        y = rng.nextInt(1, world.height - 3);
        if (!world.tiles[y] || world.tiles[y][x] === 0) {
          validX = true;
        }
      }

      const behavior = type === 'bat' ? 'flying_patrol' : 'ground_patrol';

      entities.push({
        id: `enemy_${i}`,
        type,
        x,
        y,
        width: 1,
        height: 1,
        behavior,
      });
    }

    const npcCount = count - 1 - enemyCount;
    for (let i = 0; i < npcCount; i++) {
      const npcTypes = ['merchant', 'villager', 'guard', 'sage'];
      const type = npcTypes[i % npcTypes.length];

      let validX = false;
      let x = 0;
      let y = 0;

      while (!validX) {
        x = rng.nextInt(2, world.width - 2);
        y = rng.nextInt(1, world.height - 3);
        if (!world.tiles[y] || world.tiles[y][x] === 0) {
          validX = true;
        }
      }

      entities.push({
        id: `npc_${i}`,
        type,
        x,
        y,
        width: 1,
        height: 1,
        behavior: gameType === 'rpg' ? 'npc_dialogue' : 'npc_static',
      });
    }

    return entities;
  }

  private stageItemPlacement(): DevelopmentalStage {
    return {
      name: 'Items',
      description: 'Generate collectibles and equipment',
      execute: (ctx: DevelopmentalContext) => {
        const itemCount = this.getGeneValue('itemCount', ctx.seed.genes, 8) as number;
        const world = ctx.artifacts.get('world') as TileMapData;

        const items = this.generateItems(itemCount, world, ctx.rng);
        ctx.artifacts.set('items', items);

        return ctx;
      },
    };
  }

  private generateItems(count: number, world: TileMapData, rng: any): ItemData[] {
    const items: ItemData[] = [];

    const itemTypes = [
      { type: 'coin', value: 10 },
      { type: 'gem', value: 50 },
      { type: 'potion', value: 30 },
      { type: 'key', value: 100 },
      { type: 'scroll', value: 25 },
    ];

    for (let i = 0; i < count; i++) {
      const itemDef = itemTypes[i % itemTypes.length];

      let validX = false;
      let x = 0;
      let y = 0;

      while (!validX) {
        x = rng.nextInt(1, world.width - 1);
        y = rng.nextInt(1, world.height - 2);
        if (!world.tiles[y] || world.tiles[y][x] === 0) {
          validX = true;
        }
      }

      items.push({
        id: `item_${i}`,
        type: itemDef.type,
        x,
        y,
        value: itemDef.value,
      });
    }

    return items;
  }

  private stageRuleDefinition(): DevelopmentalStage {
    return {
      name: 'Rules',
      description: 'Define game rules and interactions',
      execute: (ctx: DevelopmentalContext) => {
        const gameType = ctx.parameters.gameType as string;
        const difficulty = this.getGeneValue('difficulty', ctx.seed.genes, 5) as number;

        const rules = this.generateRules(gameType, difficulty);
        ctx.artifacts.set('rules', rules);

        return ctx;
      },
    };
  }

  private generateRules(gameType: string, difficulty: number): GameRules {
    const baseRules: Record<string, GameRules> = {
      platformer: {
        winConditions: ['reach_exit', 'collect_all_coins'],
        loseConditions: ['fall_off_world', 'enemy_touch', 'time_expired'],
        scoring: { coin: 10, enemy_defeat: 50, time_bonus: 100 },
        interactions: [
          { trigger: 'player_collect_coin', action: 'add_score', target: 'coin' },
          { trigger: 'player_enemy_touch', action: 'lose_health', target: 'player' },
          { trigger: 'player_reach_exit', action: 'win_game', target: 'game' },
        ],
      },
      rpg: {
        winConditions: ['defeat_boss', 'collect_artifacts'],
        loseConditions: ['health_zero', 'time_expired'],
        scoring: { enemy_defeat: 50, item_collect: 20, boss_defeat: 200 },
        interactions: [
          { trigger: 'npc_dialogue', action: 'gain_quest', target: 'player' },
          { trigger: 'enemy_defeat', action: 'gain_experience', target: 'player' },
          { trigger: 'item_collect', action: 'add_inventory', target: 'player' },
        ],
      },
      roguelike: {
        winConditions: ['reach_floor_10', 'defeat_final_boss'],
        loseConditions: ['health_zero', 'permadeath'],
        scoring: { enemy_defeat: 50, item_collect: 15, floor_clear: 100 },
        interactions: [
          { trigger: 'enemy_defeat', action: 'drop_item', target: 'enemy' },
          { trigger: 'floor_clear', action: 'next_floor', target: 'game' },
          { trigger: 'item_use', action: 'apply_effect', target: 'player' },
        ],
      },
      puzzle: {
        winConditions: ['solve_puzzle', 'match_pattern'],
        loseConditions: ['moves_exceeded', 'time_expired'],
        scoring: { puzzle_solve: 100, moves_saved: 50, time_bonus: 25 },
        interactions: [
          { trigger: 'tile_match', action: 'remove_tiles', target: 'board' },
          { trigger: 'pattern_complete', action: 'level_complete', target: 'game' },
        ],
      },
      shooter: {
        winConditions: ['clear_enemies', 'high_score'],
        loseConditions: ['health_zero', 'time_expired'],
        scoring: { enemy_hit: 20, enemy_kill: 100, accuracy_bonus: 50 },
        interactions: [
          { trigger: 'player_shoot', action: 'spawn_bullet', target: 'game' },
          { trigger: 'enemy_hit', action: 'take_damage', target: 'enemy' },
          { trigger: 'enemy_kill', action: 'add_score', target: 'player' },
        ],
      },
      rhythm: {
        winConditions: ['complete_song', 'high_combo'],
        loseConditions: ['miss_too_many', 'break_combo'],
        scoring: { perfect: 100, good: 50, okay: 25, combo_bonus: 200 },
        interactions: [
          { trigger: 'key_press', action: 'check_timing', target: 'game' },
          { trigger: 'hit_note', action: 'add_combo', target: 'player' },
          { trigger: 'miss_note', action: 'reset_combo', target: 'player' },
        ],
      },
    };

    return baseRules[gameType] || baseRules.platformer;
  }

  private stageMusicGeneration(): DevelopmentalStage {
    return {
      name: 'Music',
      description: 'Generate music track specification',
      execute: (ctx: DevelopmentalContext) => {
        const tempo = this.getGeneValue('musicTempo', ctx.seed.genes, 120) as number;
        const key = this.getGeneValue('musicKey', ctx.seed.genes, 'C') as string;
        const scale = this.getGeneValue('musicScale', ctx.seed.genes, 'major') as string;

        const music = this.generateMusic(tempo, key, scale);
        ctx.artifacts.set('music', music);

        return ctx;
      },
    };
  }

  private generateMusic(tempo: number, key: string, scale: string): MusicTrackData {
    const duration = (4 * 4 * 60000) / tempo;
    const beatDuration = 60000 / tempo;

    return {
      bpm: tempo,
      key,
      scale,
      duration,
      sections: [
        {
          name: 'intro',
          startBeat: 0,
          endBeat: 8,
          pattern: scale === 'minor' ? 'minor_pattern_1' : 'major_pattern_1',
        },
        {
          name: 'verse',
          startBeat: 8,
          endBeat: 24,
          pattern: scale === 'pentatonic' ? 'pentatonic_pattern' : `${scale}_verse`,
        },
        {
          name: 'chorus',
          startBeat: 24,
          endBeat: 40,
          pattern: `${scale}_chorus_bright`,
        },
        {
          name: 'outro',
          startBeat: 40,
          endBeat: 48,
          pattern: `${scale}_outro_fade`,
        },
      ],
    };
  }

  private stageUILayout(): DevelopmentalStage {
    return {
      name: 'UI',
      description: 'Generate HUD layout',
      execute: (ctx: DevelopmentalContext) => {
        const gameType = ctx.parameters.gameType as string;

        const ui = this.generateUILayout(gameType);
        ctx.artifacts.set('ui', ui);

        return ctx;
      },
    };
  }

  private generateUILayout(gameType: string): GameUILayout {
    const baseUI: GameUILayout = {
      healthBar: { x: 10, y: 10, width: 200, height: 20 },
      scoreDisplay: { x: 10, y: 40 },
    };

    if (gameType === 'rpg') {
      baseUI.minimap = { x: 800 - 120, y: 10, width: 110, height: 110 };
      baseUI.inventory = { x: 800 - 120, y: 130 };
    } else if (gameType === 'roguelike') {
      baseUI.minimap = { x: 800 - 100, y: 10, width: 90, height: 90 };
    }

    return baseUI;
  }

  private stagePackageGame(): DevelopmentalStage {
    return {
      name: 'Package',
      description: 'Assemble complete game specification',
      execute: (ctx: DevelopmentalContext) => {
        const gameType = ctx.parameters.gameType as string;
        const world = ctx.artifacts.get('world') as TileMapData;
        const entities = ctx.artifacts.get('entities') as EntityData[];
        const items = ctx.artifacts.get('items') as ItemData[];
        const rules = ctx.artifacts.get('rules') as GameRules;
        const music = ctx.artifacts.get('music') as MusicTrackData;
        const ui = ctx.artifacts.get('ui') as GameUILayout;
        const colorScheme = this.getGeneValue('colorScheme', ctx.seed.genes, 'bright') as string;

        const palette = this.getPaletteForScheme(colorScheme);
        const tileset = this.generateTilesetSVG(world, palette);

        const gameSpec: GameSpecification = {
          gameType,
          title: `Generated ${gameType.toUpperCase()} Game`,
          description: `A procedurally generated ${gameType} experience`,
          difficulty: this.getGeneValue('difficulty', ctx.seed.genes, 5) as number,
          world,
          entities,
          items,
          rules,
          music,
          ui,
          palette,
        };

        ctx.artifacts.set('gameSpec', gameSpec);
        ctx.artifacts.set('tileset', tileset);
        ctx.artifacts.set('palette', palette);

        return ctx;
      },
    };
  }

  private getPaletteForScheme(scheme: string): string[] {
    const palettes: Record<string, string[]> = {
      dark: ['#1a1a2e', '#0f3460', '#e94560', '#f1e5e6', '#533483'],
      bright: ['#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3'],
      pastel: ['#FFB3BA', '#FFFFCC', '#BAE1FF', '#FFFFBA', '#E0BBE4'],
      neon: ['#FF006E', '#FB5607', '#FFBE0B', '#8338EC', '#3A86FF'],
      retro: ['#FF6B6B', '#FFA500', '#FFD700', '#4ECDC4', '#44AF69'],
    };

    return palettes[scheme] || palettes.bright;
  }

  private generateTilesetSVG(world: TileMapData, palette: string[]): string {
    const tileSize = 16;
    const cols = 4;
    const svg = `<svg width="${cols * tileSize}" height="${Math.ceil(Object.keys(world.tileTypes).length / cols) * tileSize}" viewBox="0 0 ${cols * tileSize} ${Math.ceil(Object.keys(world.tileTypes).length / cols) * tileSize}" xmlns="http://www.w3.org/2000/svg">`;

    let x = 0;
    let y = 0;

    for (const [tileId, tileType] of Object.entries(world.tileTypes)) {
      const color = tileType.color;
      const tileX = (parseInt(tileId) % cols) * tileSize;
      const tileY = Math.floor(parseInt(tileId) / cols) * tileSize;

      return svg +
        `<rect x="${tileX}" y="${tileY}" width="${tileSize}" height="${tileSize}" fill="${color}" stroke="#333" stroke-width="1"/>` +
        `<text x="${tileX + tileSize / 2}" y="${tileY + tileSize / 2}" text-anchor="middle" dy="0.3em" font-size="8" fill="#000">${tileType.name}</text>` +
        `</svg>`;
    }

    return svg + '</svg>';
  }
}
