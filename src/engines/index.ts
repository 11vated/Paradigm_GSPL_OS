/**
 * engines/index.ts — Barrel export + auto-registration
 * Exports all engines and the registry with automatic initialization
 */

import { registry } from './engine.js';
import { Visual2DEngine } from './visual2d/engine.js';
import { Geometry3DEngine } from './geometry3d/engine.js';
import { ProceduralEngine } from './procedural/engine.js';
import { AnimationEngine } from './animation/engine.js';
import { AudioEngine } from './audio/engine.js';
import { GameEngine } from './game/engine.js';
import { UIEngine } from './ui/engine.js';
import { SpriteEngine } from './sprite/engine.js';
import { FullGameEngine } from './fullgame/engine.js';

// ============================================================================
// AUTO-REGISTER ALL ENGINES
// ============================================================================

registry.register(new Visual2DEngine());
registry.register(new Geometry3DEngine());
registry.register(new ProceduralEngine());
registry.register(new AnimationEngine());
registry.register(new AudioEngine());
registry.register(new GameEngine());
registry.register(new UIEngine());
registry.register(new SpriteEngine());
registry.register(new FullGameEngine());

// ============================================================================
// BARREL EXPORTS
// ============================================================================

export {
  DomainEngine,
  EngineRegistry,
  registry,
  type DevelopmentalStage,
  type DevelopmentalContext,
  type GenerationResult,
} from './engine.js';

export { Visual2DEngine } from './visual2d/engine.js';
export { Geometry3DEngine } from './geometry3d/engine.js';
export { ProceduralEngine } from './procedural/engine.js';
export { AnimationEngine } from './animation/engine.js';
export { AudioEngine } from './audio/engine.js';
export { GameEngine } from './game/engine.js';
export { UIEngine } from './ui/engine.js';
export { SpriteEngine } from './sprite/engine.js';
export { FullGameEngine } from './fullgame/engine.js';
