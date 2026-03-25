/**
 * composition/index.ts — Barrel exports
 */

export {
  SeedComposer,
  type CompositionRecipe,
  type CompositionLayer,
  type CrossDomainBinding,
  type CompositionResult,
} from './composer.js';

export {
  PRESETS,
  getPreset,
  listPresets,
  findCompatiblePresets,
  type CompositionPreset,
} from './presets.js';
