/**
 * runtime/index.ts — Runtime Module Barrel Export
 * Exports pipeline and CLI components
 */

export { Pipeline, run } from './pipeline.js';
export type { PipelineConfig, PipelineResult, GeneratedArtifact } from './pipeline.js';
export { cli } from './cli.js';
export { startRepl } from './repl.js';
export { watch } from './watcher.js';
export type { WatchOptions } from './watcher.js';
export { startServer } from './server.js';
export type { ServerOptions } from './server.js';
export { getInitPackageJson, getInitMainGspl, getDomainTemplate, getAvailableDomains } from './templates.js';
