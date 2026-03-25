/**
 * renderers/index.ts — Barrel export for all renderers
 */

export { VisualRenderer, type VisualRendererOptions } from './visual-renderer.js';
export { AudioRenderer, type AudioRendererOptions, type MusicData } from './audio-renderer.js';
export { GameRenderer, type GameRendererOptions, type GameSpecification } from './game-renderer.js';
export { AnimationPlayer, type AnimationPlayerOptions, type AnimationData } from './animation-player.js';
export { ThreeRenderer, type ThreeRendererOptions, type MeshData } from './three-renderer.js';
