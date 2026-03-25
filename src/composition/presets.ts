/**
 * presets.ts — Pre-built Composition Templates
 * Predefined composition recipes for common multi-domain scenarios.
 */

import { UniversalSeed, SeedDomain } from '../kernel/seed.js';
import { CompositionRecipe, CompositionLayer, CrossDomainBinding } from './composer.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CompositionPreset {
  name: string;
  description: string;
  domains: SeedDomain[];
  createRecipe: (...seeds: UniversalSeed[]) => CompositionRecipe;
}

// ============================================================================
// PRESET IMPLEMENTATIONS
// ============================================================================

const ANIMATED_SCENE: CompositionPreset = {
  name: 'animated-scene',
  description: 'Visual art + animation + music',
  domains: ['visual2d', 'animation', 'audio'],
  createRecipe: (visual: UniversalSeed, anim: UniversalSeed, audio: UniversalSeed) => {
    return {
      name: `animated-scene_${Date.now()}`,
      description: 'An animated visual scene with synchronized audio',
      layers: [
        {
          name: 'visual-base',
          domain: 'visual2d',
          seed: visual,
          priority: 0,
          enabled: true,
        },
        {
          name: 'animation-layer',
          domain: 'animation',
          seed: anim,
          priority: 1,
          enabled: true,
        },
        {
          name: 'audio-track',
          domain: 'audio',
          seed: audio,
          priority: 2,
          enabled: true,
        },
      ],
      bindings: [
        {
          sourceDomain: 'animation',
          sourceGene: 'tempo',
          targetDomain: 'audio',
          targetGene: 'tempo',
          description: 'Sync animation tempo with audio',
        },
        {
          sourceDomain: 'visual2d',
          sourceGene: 'palette',
          targetDomain: 'audio',
          targetGene: 'key',
          description: 'Color theme influences musical key',
        },
      ],
    };
  },
};

const GAME_WORLD: CompositionPreset = {
  name: 'game-world',
  description: 'Terrain + game logic + ambient music + visual theme',
  domains: ['procedural', 'game', 'audio', 'visual2d'],
  createRecipe: (
    terrain: UniversalSeed,
    game: UniversalSeed,
    audio: UniversalSeed,
    visual: UniversalSeed
  ) => {
    return {
      name: `game-world_${Date.now()}`,
      description: 'A procedurally generated game world with cohesive aesthetics',
      layers: [
        {
          name: 'terrain-gen',
          domain: 'procedural',
          seed: terrain,
          priority: 0,
          enabled: true,
        },
        {
          name: 'game-rules',
          domain: 'game',
          seed: game,
          priority: 1,
          enabled: true,
        },
        {
          name: 'visual-theme',
          domain: 'visual2d',
          seed: visual,
          priority: 2,
          enabled: true,
        },
        {
          name: 'ambient-audio',
          domain: 'audio',
          seed: audio,
          priority: 3,
          enabled: true,
        },
      ],
      bindings: [
        {
          sourceDomain: 'procedural',
          sourceGene: 'complexity',
          targetDomain: 'game',
          targetGene: 'difficulty',
          description: 'Terrain complexity influences game difficulty',
        },
        {
          sourceDomain: 'procedural',
          sourceGene: 'type',
          targetDomain: 'game',
          targetGene: 'theme',
          description: 'Terrain type determines game theme',
        },
        {
          sourceDomain: 'procedural',
          sourceGene: 'type',
          targetDomain: 'visual2d',
          targetGene: 'palette',
          description: 'Terrain type influences visual palette',
        },
      ],
    };
  },
};

const INTERACTIVE_UI: CompositionPreset = {
  name: 'interactive-ui',
  description: 'UI layout + visual theme + SFX',
  domains: ['ui', 'visual2d', 'audio'],
  createRecipe: (ui: UniversalSeed, visual: UniversalSeed, audio: UniversalSeed) => {
    return {
      name: `interactive-ui_${Date.now()}`,
      description: 'An interactive UI with themed visuals and sound effects',
      layers: [
        {
          name: 'ui-layout',
          domain: 'ui',
          seed: ui,
          priority: 0,
          enabled: true,
        },
        {
          name: 'visual-theme',
          domain: 'visual2d',
          seed: visual,
          priority: 1,
          enabled: true,
        },
        {
          name: 'sfx-audio',
          domain: 'audio',
          seed: audio,
          priority: 2,
          enabled: true,
        },
      ],
      bindings: [
        {
          sourceDomain: 'visual2d',
          sourceGene: 'palette',
          targetDomain: 'ui',
          targetGene: 'colorScheme',
          description: 'Visual palette determines UI color scheme',
        },
        {
          sourceDomain: 'ui',
          sourceGene: 'complexity',
          targetDomain: 'audio',
          targetGene: 'density',
          description: 'UI complexity influences SFX density',
        },
      ],
    };
  },
};

const NARRATIVE_WORLD: CompositionPreset = {
  name: 'narrative-world',
  description: 'Story + environment + character interaction',
  domains: ['narrative', 'procedural', 'agent'],
  createRecipe: (
    narrative: UniversalSeed,
    environment: UniversalSeed,
    agent: UniversalSeed
  ) => {
    return {
      name: `narrative-world_${Date.now()}`,
      description: 'A narrative-driven world with procedural environments and agents',
      layers: [
        {
          name: 'story-script',
          domain: 'narrative',
          seed: narrative,
          priority: 0,
          enabled: true,
        },
        {
          name: 'environment-gen',
          domain: 'procedural',
          seed: environment,
          priority: 1,
          enabled: true,
        },
        {
          name: 'character-agents',
          domain: 'agent',
          seed: agent,
          priority: 2,
          enabled: true,
        },
      ],
      bindings: [
        {
          sourceDomain: 'narrative',
          sourceGene: 'genre',
          targetDomain: 'procedural',
          targetGene: 'type',
          description: 'Story genre influences environment type',
        },
        {
          sourceDomain: 'procedural',
          sourceGene: 'complexity',
          targetDomain: 'agent',
          targetGene: 'complexity',
          description: 'Environment complexity affects agent behavior complexity',
        },
      ],
    };
  },
};

const PHYSICS_SIMULATION: CompositionPreset = {
  name: 'physics-simulation',
  description: 'Geometry + physics + visualization',
  domains: ['geometry3d', 'physics', 'visual2d'],
  createRecipe: (
    geometry: UniversalSeed,
    physics: UniversalSeed,
    visual: UniversalSeed
  ) => {
    return {
      name: `physics-simulation_${Date.now()}`,
      description: 'A physics-based simulation with 3D geometry and visualization',
      layers: [
        {
          name: 'geometry-mesh',
          domain: 'geometry3d',
          seed: geometry,
          priority: 0,
          enabled: true,
        },
        {
          name: 'physics-engine',
          domain: 'physics',
          seed: physics,
          priority: 1,
          enabled: true,
        },
        {
          name: 'visualization',
          domain: 'visual2d',
          seed: visual,
          priority: 2,
          enabled: true,
        },
      ],
      bindings: [
        {
          sourceDomain: 'geometry3d',
          sourceGene: 'complexity',
          targetDomain: 'physics',
          targetGene: 'complexity',
          description: 'Geometric complexity affects physics simulation complexity',
        },
        {
          sourceDomain: 'physics',
          sourceGene: 'gravityStrength',
          targetDomain: 'visual2d',
          targetGene: 'motion',
          description: 'Physics properties influence visual motion style',
        },
      ],
    };
  },
};

// ============================================================================
// PRESET REGISTRY
// ============================================================================

export const PRESETS: CompositionPreset[] = [
  ANIMATED_SCENE,
  GAME_WORLD,
  INTERACTIVE_UI,
  NARRATIVE_WORLD,
  PHYSICS_SIMULATION,
];

/**
 * Get a preset by name
 */
export function getPreset(name: string): CompositionPreset | undefined {
  return PRESETS.find(p => p.name === name);
}

/**
 * List all available presets
 */
export function listPresets(): CompositionPreset[] {
  return [...PRESETS];
}

/**
 * Find presets that can accommodate the given domains
 */
export function findCompatiblePresets(domains: SeedDomain[]): CompositionPreset[] {
  const domainSet = new Set(domains);
  return PRESETS.filter(preset =>
    preset.domains.every(d => domainSet.has(d))
  );
}
