/**
 * seed-package.ts — Portable Seed Package Format
 * A .gseed package bundles a seed with metadata, preview, lineage, and attribution
 * into a single shareable JSON document.
 */

import { UniversalSeed, SeedDomain, seedToJSON, seedFromJSON } from '../kernel/seed.js';
import { GeneMap, Gene } from '../kernel/genes.js';
import { registry } from '../engines/engine.js';

// ============================================================================
// PACKAGE FORMAT
// ============================================================================

export interface SeedPackage {
  /** Format identifier */
  $format: 'gseed';
  /** Format version */
  $version: '1.0';

  /** The seed itself */
  seed: UniversalSeed;

  /** Publishing metadata */
  publication: {
    /** Publisher identity */
    publisher: string;
    /** Publication timestamp */
    publishedAt: number;
    /** Semantic version of this package */
    version: string;
    /** Human-readable description */
    description: string;
    /** Categorization tags */
    tags: string[];
    /** License identifier (SPDX) */
    license: string;
    /** Source repository URL */
    repository?: string;
  };

  /** Lineage and attribution */
  attribution: {
    /** Original creator */
    creator: string;
    /** Chain of contributors who evolved this seed */
    contributors: Array<{
      name: string;
      operation: string;
      timestamp: number;
    }>;
    /** Parent package hashes (if forked/bred from published seeds) */
    parentPackages: string[];
    /** Number of known descendants */
    descendantCount: number;
  };

  /** Pre-generated preview data */
  preview: {
    /** SVG thumbnail (for visual domains) */
    svg?: string;
    /** Text summary of the seed's characteristics */
    summary: string;
    /** Gene value highlights */
    highlights: Array<{ gene: string; value: string; label: string }>;
    /** Domain-specific preview data */
    domainData?: Record<string, unknown>;
  };

  /** Community metrics */
  stats: {
    downloads: number;
    forks: number;
    stars: number;
    evolvedCount: number;
    bredCount: number;
    averageRating: number;
    ratingCount: number;
  };

  /** Package-level hash (covers entire package content) */
  $packageHash: string;
}

// ============================================================================
// PACKAGING
// ============================================================================

/**
 * Package a seed for publishing to the marketplace.
 */
export function packageSeed(
  seed: UniversalSeed,
  options: {
    publisher: string;
    description: string;
    tags?: string[];
    license?: string;
    version?: string;
    repository?: string;
    parentPackages?: string[];
  }
): SeedPackage {
  const preview = generatePreview(seed);

  const pkg: SeedPackage = {
    $format: 'gseed',
    $version: '1.0',
    seed,
    publication: {
      publisher: options.publisher,
      publishedAt: Date.now(),
      version: options.version ?? '1.0.0',
      description: options.description,
      tags: options.tags ?? [],
      license: options.license ?? seed.$metadata.license,
      repository: options.repository,
    },
    attribution: {
      creator: seed.$metadata.author,
      contributors: [],
      parentPackages: options.parentPackages ?? [],
      descendantCount: 0,
    },
    preview,
    stats: {
      downloads: 0,
      forks: 0,
      stars: 0,
      evolvedCount: 0,
      bredCount: 0,
      averageRating: 0,
      ratingCount: 0,
    },
    $packageHash: '',
  };

  // Add publisher as contributor
  if (options.publisher !== seed.$metadata.author) {
    pkg.attribution.contributors.push({
      name: options.publisher,
      operation: 'publish',
      timestamp: Date.now(),
    });
  }

  // Compute package hash
  pkg.$packageHash = computePackageHash(pkg);

  return pkg;
}

/**
 * Create a forked package from an existing one.
 */
export function forkPackage(
  original: SeedPackage,
  forkedSeed: UniversalSeed,
  forker: string,
  operation: string = 'fork'
): SeedPackage {
  const preview = generatePreview(forkedSeed);

  const pkg: SeedPackage = {
    $format: 'gseed',
    $version: '1.0',
    seed: forkedSeed,
    publication: {
      publisher: forker,
      publishedAt: Date.now(),
      version: '1.0.0',
      description: `Forked from ${original.seed.$name} by ${original.publication.publisher}`,
      tags: [...original.publication.tags],
      license: original.publication.license,
    },
    attribution: {
      creator: original.attribution.creator,
      contributors: [
        ...original.attribution.contributors,
        { name: forker, operation, timestamp: Date.now() },
      ],
      parentPackages: [original.$packageHash],
      descendantCount: 0,
    },
    preview,
    stats: {
      downloads: 0,
      forks: 0,
      stars: 0,
      evolvedCount: 0,
      bredCount: 0,
      averageRating: 0,
      ratingCount: 0,
    },
    $packageHash: '',
  };

  pkg.$packageHash = computePackageHash(pkg);
  return pkg;
}

// ============================================================================
// PREVIEW GENERATION
// ============================================================================

function generatePreview(seed: UniversalSeed): SeedPackage['preview'] {
  const highlights: Array<{ gene: string; value: string; label: string }> = [];

  // Extract top genes as highlights
  for (const [key, gene] of Object.entries(seed.genes)) {
    if (highlights.length >= 6) break;
    highlights.push({
      gene: key,
      value: formatGeneValue(gene),
      label: key.replace(/([A-Z])/g, ' $1').trim(),
    });
  }

  // Generate SVG preview for visual domains
  let svg: string | undefined;
  const engine = registry.get(seed.$domain);
  if (engine && (seed.$domain === 'visual2d' || seed.$domain === 'sprite')) {
    try {
      const result = engine.generate(seed);
      if (result.success) {
        svg = (result.artifacts.get('svg') ?? result.artifacts.get('spriteSheet')) as string | undefined;
      }
    } catch {
      // Preview generation failed — not critical
    }
  }

  const summary = `${seed.$domain} seed "${seed.$name}" with ${Object.keys(seed.genes).length} genes, generation ${seed.$lineage.generation}`;

  return { svg, summary, highlights };
}

function formatGeneValue(gene: Gene): string {
  switch (gene.type) {
    case 'scalar':
      return gene.max > 10
        ? Math.round(gene.value).toString()
        : gene.value.toFixed(2);
    case 'categorical':
      return gene.value;
    case 'vector':
      return `[${gene.value.map(v => v.toFixed(2)).join(', ')}]`;
    default:
      return gene.type;
  }
}

// ============================================================================
// SERIALIZATION
// ============================================================================

/**
 * Serialize a package to JSON string.
 */
export function serializePackage(pkg: SeedPackage): string {
  return JSON.stringify(pkg, null, 2);
}

/**
 * Deserialize a package from JSON string.
 */
export function deserializePackage(json: string): SeedPackage {
  const parsed = JSON.parse(json);

  if (parsed.$format !== 'gseed') {
    throw new Error(`Invalid format: expected "gseed", got "${parsed.$format}"`);
  }
  if (parsed.$version !== '1.0') {
    throw new Error(`Unsupported version: ${parsed.$version}`);
  }
  if (!parsed.seed || !parsed.publication || !parsed.attribution) {
    throw new Error('Package missing required fields');
  }

  return parsed as SeedPackage;
}

// ============================================================================
// HASHING
// ============================================================================

function computePackageHash(pkg: SeedPackage): string {
  const content = JSON.stringify({
    seed: pkg.seed.$hash,
    publisher: pkg.publication.publisher,
    publishedAt: pkg.publication.publishedAt,
    version: pkg.publication.version,
  });

  // FNV-1a hash
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i);
    h1 = (h1 ^ c) * 0x01000193 >>> 0;
    h2 = (h2 ^ (c + i)) * 0x01000193 >>> 0;
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}
