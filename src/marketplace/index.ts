/**
 * marketplace/index.ts — Barrel export for marketplace module
 */

export {
  type SeedPackage,
  packageSeed,
  forkPackage,
  serializePackage,
  deserializePackage,
} from './seed-package.js';

export {
  MarketplaceRegistry,
  type SearchQuery,
  type SearchResult,
  type RegistryStats,
} from './registry.js';

export {
  startMarketplaceAPI,
  type MarketplaceAPIOptions,
} from './api.js';
