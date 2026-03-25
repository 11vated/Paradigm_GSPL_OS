/**
 * seed.ts — The Universal Seed
 * Core data structure for the GSPL Paradigm Engine.
 * Every artifact in the system originates from a seed.
 */

import { GeneMap, Gene, cloneGene, validateGene } from './genes.js';
export type { GeneMap } from './genes.js';
let nodeCrypto: { createHash: (alg: string) => { update: (data: string) => { digest: (enc: string) => string } } } | null = null;
try {
  // Use require-style check — works in Node, fails silently in browser
  if (typeof globalThis.process !== 'undefined' && globalThis.process.versions?.node) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    nodeCrypto = require('crypto');
  }
} catch {
  // Browser environment — use fallback hash
}

// ============================================================================
// DOMAIN & LINEAGE TYPES
// ============================================================================

export type SeedDomain =
  | 'visual2d'
  | 'geometry3d'
  | 'animation'
  | 'audio'
  | 'game'
  | 'ui'
  | 'web'
  | 'narrative'
  | 'ecosystem'
  | 'architecture'
  | 'material'
  | 'terrain'
  | 'neural'
  | 'simulation'
  | 'agent'
  | 'procedural'
  | 'sprite'
  | 'fullgame'
  | 'logo'
  | 'typography'
  | 'shader'
  | 'particle'
  | 'physics'
  | 'music'
  | 'custom';

export interface GeneticOperation {
  type: 'crossover' | 'mutation' | 'composition' | 'adaptation' | 'de_novo';
  timestamp: number;
  details: Record<string, unknown>;
}

export interface LineageRecord {
  parents: string[];
  generation: number;
  operations: GeneticOperation[];
  createdAt: number;
  engineVersion: string;
}

export interface FitnessVector {
  scores: Record<string, number>;
  aggregate: number;
  novelty?: number;
  evaluatedAt: number;
}

export interface SeedMetadata {
  author: string;
  license: string;
  description?: string;
  tags: string[];
  created: number;
  modified: number;
}

export interface UniversalSeed<TGenes extends GeneMap = GeneMap> {
  $gst: '1.0';
  $domain: SeedDomain;
  $hash: string;
  $name: string;
  $lineage: LineageRecord;
  genes: TGenes;
  $fitness?: FitnessVector;
  $metadata: SeedMetadata;
}

// ============================================================================
// SEED CREATION & MANIPULATION
// ============================================================================

/**
 * Creates a new seed with de_novo lineage
 */
export function createSeed<T extends GeneMap>(
  domain: SeedDomain,
  name: string,
  genes: T,
  metadata?: Partial<SeedMetadata>
): UniversalSeed<T> {
  const now = Date.now();

  const fullMetadata: SeedMetadata = {
    author: metadata?.author ?? 'unknown',
    license: metadata?.license ?? 'CC0',
    description: metadata?.description,
    tags: metadata?.tags ?? [],
    created: now,
    modified: now,
  };

  const seed: UniversalSeed<T> = {
    $gst: '1.0',
    $domain: domain,
    $hash: '',
    $name: name,
    $lineage: {
      parents: [],
      generation: 0,
      operations: [
        {
          type: 'de_novo',
          timestamp: now,
          details: { domain, name },
        },
      ],
      createdAt: now,
      engineVersion: '1.0.0',
    },
    genes,
    $metadata: fullMetadata,
  };

  // Compute hash after creating basic structure
  seed.$hash = computeHash(seed);

  return seed;
}

/**
 * Computes a deterministic 16-character hex hash from seed
 * Uses canonical JSON representation (sorted keys, excludes volatile fields)
 */
export function computeHash(seed: UniversalSeed): string {
  const canonical = canonicalizeForHash(seed);
  const jsonStr = JSON.stringify(canonical);

  // Use Node crypto if available, otherwise use FNV-1a fallback for browser
  if (nodeCrypto) {
    const hash = nodeCrypto.createHash('sha256').update(jsonStr).digest('hex');
    return hash.substring(0, 16);
  }

  // Browser fallback: FNV-1a 64-bit hash
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < jsonStr.length; i++) {
    const c = jsonStr.charCodeAt(i);
    h1 = (h1 ^ c) * 0x01000193 >>> 0;
    h2 = (h2 ^ (c + i)) * 0x01000193 >>> 0;
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/**
 * Creates a canonical representation suitable for hashing
 */
function canonicalizeForHash(seed: UniversalSeed): unknown {
  return {
    $domain: seed.$domain,
    $name: seed.$name,
    genes: canonicalizeGenes(seed.genes),
  };
}

/**
 * Recursively canonicalize genes with sorted keys
 */
function canonicalizeGenes(geneMap: GeneMap): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const keys = Object.keys(geneMap).sort();

  for (const key of keys) {
    const gene = geneMap[key];
    result[key] = canonicalizeGene(gene);
  }

  return result;
}

/**
 * Canonicalize a single gene
 */
function canonicalizeGene(gene: Gene): unknown {
  switch (gene.type) {
    case 'scalar':
      return {
        type: 'scalar',
        value: gene.value,
        min: gene.min,
        max: gene.max,
        distribution: gene.distribution ?? 'uniform',
      };

    case 'categorical':
      return {
        type: 'categorical',
        value: gene.value,
        options: [...gene.options].sort(),
      };

    case 'vector':
      return {
        type: 'vector',
        value: [...gene.value],
        dimensions: gene.dimensions,
      };

    case 'expression':
      return {
        type: 'expression',
        value: gene.value,
        variables: [...gene.variables].sort(),
      };

    case 'struct':
      return {
        type: 'struct',
        value: canonicalizeGenes(gene.value),
      };

    case 'array':
      return {
        type: 'array',
        value: gene.value.map(g => canonicalizeGene(g)),
        elementType: gene.elementType,
      };

    case 'graph':
      return {
        type: 'graph',
        nodeCount: gene.value.nodes.length,
        edgeCount: gene.value.edges.length,
      };
  }
}

/**
 * Deep clone a seed
 */
export function cloneSeed<T extends GeneMap>(seed: UniversalSeed<T>): UniversalSeed<T> {
  const clonedGenes: GeneMap = {};
  for (const [key, gene] of Object.entries(seed.genes)) {
    clonedGenes[key] = cloneGene(gene);
  }

  const cloned: UniversalSeed<T> = {
    $gst: seed.$gst,
    $domain: seed.$domain,
    $hash: seed.$hash,
    $name: seed.$name,
    $lineage: {
      parents: [...seed.$lineage.parents],
      generation: seed.$lineage.generation,
      operations: seed.$lineage.operations.map(op => ({
        type: op.type,
        timestamp: op.timestamp,
        details: { ...op.details },
      })),
      createdAt: seed.$lineage.createdAt,
      engineVersion: seed.$lineage.engineVersion,
    },
    genes: clonedGenes as T,
    $fitness: seed.$fitness
      ? {
          scores: { ...seed.$fitness.scores },
          aggregate: seed.$fitness.aggregate,
          novelty: seed.$fitness.novelty,
          evaluatedAt: seed.$fitness.evaluatedAt,
        }
      : undefined,
    $metadata: {
      author: seed.$metadata.author,
      license: seed.$metadata.license,
      description: seed.$metadata.description,
      tags: [...seed.$metadata.tags],
      created: seed.$metadata.created,
      modified: Date.now(),
    },
  };

  // Recompute hash for the clone
  cloned.$hash = computeHash(cloned);

  return cloned;
}

/**
 * Validate a seed for consistency
 */
export function validateSeed(seed: UniversalSeed): string[] {
  const errors: string[] = [];

  // Check structure
  if (seed.$gst !== '1.0') {
    errors.push(`Invalid GST version: ${seed.$gst}`);
  }

  const validDomains: SeedDomain[] = [
    'visual2d',
    'geometry3d',
    'animation',
    'audio',
    'game',
    'ui',
    'web',
    'narrative',
    'ecosystem',
    'architecture',
    'material',
    'terrain',
    'neural',
    'simulation',
    'agent',
    'procedural',
    'sprite',
    'fullgame',
    'logo',
    'typography',
    'shader',
    'particle',
    'physics',
    'music',
    'custom',
  ];

  if (!validDomains.includes(seed.$domain)) {
    errors.push(`Invalid domain: ${seed.$domain}`);
  }

  if (typeof seed.$name !== 'string' || seed.$name.length === 0) {
    errors.push('Seed name must be non-empty string');
  }

  if (typeof seed.$hash !== 'string' || seed.$hash.length !== 16) {
    errors.push(`Invalid hash: must be 16-char hex string, got "${seed.$hash}"`);
  }

  // Validate hash matches
  const expectedHash = computeHash(seed);
  if (seed.$hash !== expectedHash) {
    errors.push(`Hash mismatch: stored ${seed.$hash} but computed ${expectedHash}`);
  }

  // Validate lineage
  if (!Array.isArray(seed.$lineage.parents)) {
    errors.push('Lineage parents must be array');
  }

  if (!Number.isInteger(seed.$lineage.generation) || seed.$lineage.generation < 0) {
    errors.push(`Invalid generation: ${seed.$lineage.generation}`);
  }

  if (!Array.isArray(seed.$lineage.operations) || seed.$lineage.operations.length === 0) {
    errors.push('Lineage must have at least one operation');
  }

  for (const op of seed.$lineage.operations) {
    const validOps = ['crossover', 'mutation', 'composition', 'adaptation', 'de_novo'];
    if (!validOps.includes(op.type)) {
      errors.push(`Invalid operation type: ${op.type}`);
    }
  }

  // Validate genes
  for (const [key, gene] of Object.entries(seed.genes)) {
    const geneErrors = validateGene(gene);
    errors.push(...geneErrors.map(e => `gene[${key}]: ${e}`));
  }

  // Validate metadata
  if (typeof seed.$metadata.author !== 'string') {
    errors.push('Metadata author must be string');
  }
  if (typeof seed.$metadata.license !== 'string') {
    errors.push('Metadata license must be string');
  }
  if (!Number.isInteger(seed.$metadata.created)) {
    errors.push('Metadata created must be integer timestamp');
  }
  if (!Number.isInteger(seed.$metadata.modified)) {
    errors.push('Metadata modified must be integer timestamp');
  }

  return errors;
}

// ============================================================================
// SERIALIZATION
// ============================================================================

/**
 * Serialize seed to JSON string
 */
export function seedToJSON(seed: UniversalSeed): string {
  return JSON.stringify(seed, null, 2);
}

/**
 * Deserialize seed from JSON string
 */
export function seedFromJSON(json: string): UniversalSeed {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Parsed JSON must be an object');
  }

  const obj = parsed as Record<string, unknown>;

  // Basic structure check
  if (obj.$gst !== '1.0') {
    throw new Error('Invalid GST version');
  }
  if (typeof obj.$domain !== 'string') {
    throw new Error('Missing or invalid $domain');
  }
  if (typeof obj.$name !== 'string') {
    throw new Error('Missing or invalid $name');
  }
  if (typeof obj.$hash !== 'string') {
    throw new Error('Missing or invalid $hash');
  }

  const seed = obj as unknown as UniversalSeed;

  // Validate
  const validationErrors = validateSeed(seed);
  if (validationErrors.length > 0) {
    throw new Error(`Seed validation failed:\n${validationErrors.join('\n')}`);
  }

  return seed;
}

// ============================================================================
// SEED MUTATIONS
// ============================================================================

/**
 * Update seed metadata
 */
export function updateSeedMetadata<T extends GeneMap>(
  seed: UniversalSeed<T>,
  updates: Partial<SeedMetadata>
): UniversalSeed<T> {
  const updated = cloneSeed(seed);
  updated.$metadata = {
    ...updated.$metadata,
    ...updates,
    modified: Date.now(),
  };
  updated.$hash = computeHash(updated);
  return updated;
}

/**
 * Add fitness score to seed
 */
export function setSeedFitness<T extends GeneMap>(
  seed: UniversalSeed<T>,
  scores: Record<string, number>,
  aggregate: number,
  novelty?: number
): UniversalSeed<T> {
  const updated = cloneSeed(seed);
  updated.$fitness = {
    scores: { ...scores },
    aggregate,
    novelty,
    evaluatedAt: Date.now(),
  };
  return updated;
}

/**
 * Record a genetic operation in lineage
 */
export function recordOperation<T extends GeneMap>(
  seed: UniversalSeed<T>,
  operation: GeneticOperation
): UniversalSeed<T> {
  const updated = cloneSeed(seed);
  updated.$lineage.operations.push({
    ...operation,
    timestamp: Date.now(),
  });
  updated.$hash = computeHash(updated);
  return updated;
}
