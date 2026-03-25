/**
 * seed-library.ts — Seed Library and Repository
 * A local seed repository for storing, versioning, and browsing seeds.
 */

import {
  UniversalSeed,
  SeedDomain,
  seedToJSON,
  seedFromJSON,
  computeHash,
  cloneSeed,
} from '../kernel/seed.js';
import { GeneMap } from '../kernel/genes.js';
import { computeGeneticDistance } from '../kernel/operators.js';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface SeedEntry {
  seed: UniversalSeed;
  version: number;
  tags: string[];
  description: string;
  createdAt: number;
  updatedAt: number;
  parentHashes: string[];
  stats: {
    timesUsed: number;
    timesEvolved: number;
    timesBred: number;
    bestFitness: number;
  };
}

export interface LibraryQuery {
  domain?: SeedDomain;
  tags?: string[];
  namePattern?: string;
  minFitness?: number;
  limit?: number;
  sortBy?: 'name' | 'fitness' | 'created' | 'used';
}

export interface LibraryStats {
  totalSeeds: number;
  byDomain: Record<string, number>;
  totalTags: number;
  averageFitness: number;
  oldestSeed: number;
  newestSeed: number;
}

export interface LineageNode {
  hash: string;
  name: string;
  generation: number;
  children: LineageNode[];
}

// ============================================================================
// SEED LIBRARY
// ============================================================================

export class SeedLibrary {
  private entries: Map<string, SeedEntry> = new Map();
  private nameIndex: Map<string, string[]> = new Map();
  private domainIndex: Map<SeedDomain, string[]> = new Map();
  private tagIndex: Map<string, string[]> = new Map();

  /**
   * Store a seed in the library
   */
  store(
    seed: UniversalSeed,
    description?: string,
    tags?: string[]
  ): SeedEntry {
    const hash = seed.$hash;
    const now = Date.now();

    // Check if this hash already exists (versioning)
    let version = 1;
    let existingEntry = this.entries.get(hash);
    if (existingEntry) {
      version = existingEntry.version + 1;
    }

    const entry: SeedEntry = {
      seed: cloneSeed(seed),
      version,
      tags: tags ?? [],
      description: description ?? seed.$metadata.description ?? '',
      createdAt: existingEntry?.createdAt ?? now,
      updatedAt: now,
      parentHashes: seed.$lineage.parents,
      stats: existingEntry?.stats ?? {
        timesUsed: 0,
        timesEvolved: 0,
        timesBred: 0,
        bestFitness: seed.$fitness?.aggregate ?? 0,
      },
    };

    // Store by hash
    this.entries.set(hash, entry);

    // Update name index
    const name = seed.$name;
    if (!this.nameIndex.has(name)) {
      this.nameIndex.set(name, []);
    }
    const hashes = this.nameIndex.get(name)!;
    if (!hashes.includes(hash)) {
      hashes.push(hash);
    }

    // Update domain index
    const domain = seed.$domain;
    if (!this.domainIndex.has(domain)) {
      this.domainIndex.set(domain, []);
    }
    const domainHashes = this.domainIndex.get(domain)!;
    if (!domainHashes.includes(hash)) {
      domainHashes.push(hash);
    }

    // Update tag index
    for (const tag of tags ?? []) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, []);
      }
      const tagHashes = this.tagIndex.get(tag)!;
      if (!tagHashes.includes(hash)) {
        tagHashes.push(hash);
      }
    }

    return entry;
  }

  /**
   * Retrieve by hash
   */
  get(hash: string): SeedEntry | undefined {
    return this.entries.get(hash);
  }

  /**
   * Retrieve by name (returns latest version)
   */
  getByName(name: string): SeedEntry | undefined {
    const hashes = this.nameIndex.get(name);
    if (!hashes || hashes.length === 0) {
      return undefined;
    }

    // Return the entry with highest version
    let latest: SeedEntry | undefined;
    for (const hash of hashes) {
      const entry = this.entries.get(hash);
      if (entry && (!latest || entry.version > latest.version)) {
        latest = entry;
      }
    }
    return latest;
  }

  /**
   * Search/query the library
   */
  query(q: LibraryQuery): SeedEntry[] {
    let results: SeedEntry[] = [];

    // Start with domain filter if specified
    if (q.domain) {
      const domainHashes = this.domainIndex.get(q.domain) ?? [];
      results = domainHashes
        .map(h => this.entries.get(h))
        .filter((e): e is SeedEntry => e !== undefined);
    } else {
      results = Array.from(this.entries.values());
    }

    // Filter by tags
    if (q.tags && q.tags.length > 0) {
      const tagSet = new Set(q.tags);
      results = results.filter(entry =>
        entry.tags.some(tag => tagSet.has(tag))
      );
    }

    // Filter by name pattern
    if (q.namePattern) {
      const regex = new RegExp(q.namePattern, 'i');
      results = results.filter(entry => regex.test(entry.seed.$name));
    }

    // Filter by fitness
    if (q.minFitness !== undefined) {
      results = results.filter(
        entry => (entry.seed.$fitness?.aggregate ?? 0) >= q.minFitness!
      );
    }

    // Sort
    if (q.sortBy) {
      switch (q.sortBy) {
        case 'name':
          results.sort((a, b) => a.seed.$name.localeCompare(b.seed.$name));
          break;
        case 'fitness':
          results.sort(
            (a, b) =>
              (b.seed.$fitness?.aggregate ?? 0) -
              (a.seed.$fitness?.aggregate ?? 0)
          );
          break;
        case 'created':
          results.sort((a, b) => a.createdAt - b.createdAt);
          break;
        case 'used':
          results.sort((a, b) => b.stats.timesUsed - a.stats.timesUsed);
          break;
      }
    }

    // Apply limit
    if (q.limit) {
      results = results.slice(0, q.limit);
    }

    return results;
  }

  /**
   * List all seeds
   */
  listAll(): SeedEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * List seeds by domain
   */
  listByDomain(domain: SeedDomain): SeedEntry[] {
    const hashes = this.domainIndex.get(domain) ?? [];
    return hashes
      .map(h => this.entries.get(h))
      .filter((e): e is SeedEntry => e !== undefined);
  }

  /**
   * Update usage stats
   */
  markUsed(hash: string): void {
    const entry = this.entries.get(hash);
    if (entry) {
      entry.stats.timesUsed++;
      entry.updatedAt = Date.now();
    }
  }

  /**
   * Mark evolved
   */
  markEvolved(hash: string): void {
    const entry = this.entries.get(hash);
    if (entry) {
      entry.stats.timesEvolved++;
      entry.updatedAt = Date.now();
    }
  }

  /**
   * Mark bred
   */
  markBred(hash: string): void {
    const entry = this.entries.get(hash);
    if (entry) {
      entry.stats.timesBred++;
      entry.updatedAt = Date.now();
    }
  }

  /**
   * Update fitness
   */
  updateFitness(hash: string, fitness: number): void {
    const entry = this.entries.get(hash);
    if (entry) {
      entry.stats.bestFitness = Math.max(
        entry.stats.bestFitness,
        fitness
      );
      entry.updatedAt = Date.now();
    }
  }

  /**
   * Remove a seed
   */
  remove(hash: string): boolean {
    const entry = this.entries.get(hash);
    if (!entry) {
      return false;
    }

    // Remove from hash map
    this.entries.delete(hash);

    // Remove from name index
    const name = entry.seed.$name;
    const nameHashes = this.nameIndex.get(name);
    if (nameHashes) {
      const idx = nameHashes.indexOf(hash);
      if (idx >= 0) {
        nameHashes.splice(idx, 1);
      }
      if (nameHashes.length === 0) {
        this.nameIndex.delete(name);
      }
    }

    // Remove from domain index
    const domain = entry.seed.$domain;
    const domainHashes = this.domainIndex.get(domain);
    if (domainHashes) {
      const idx = domainHashes.indexOf(hash);
      if (idx >= 0) {
        domainHashes.splice(idx, 1);
      }
      if (domainHashes.length === 0) {
        this.domainIndex.delete(domain);
      }
    }

    // Remove from tag indices
    for (const tag of entry.tags) {
      const tagHashes = this.tagIndex.get(tag);
      if (tagHashes) {
        const idx = tagHashes.indexOf(hash);
        if (idx >= 0) {
          tagHashes.splice(idx, 1);
        }
        if (tagHashes.length === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    return true;
  }

  /**
   * Get library statistics
   */
  stats(): LibraryStats {
    const allEntries = Array.from(this.entries.values());

    const byDomain: Record<string, number> = {};
    for (const entry of allEntries) {
      const domain = entry.seed.$domain;
      byDomain[domain] = (byDomain[domain] ?? 0) + 1;
    }

    const allTags = new Set<string>();
    for (const entry of allEntries) {
      for (const tag of entry.tags) {
        allTags.add(tag);
      }
    }

    const fitnesses = allEntries
      .map(e => e.seed.$fitness?.aggregate ?? 0)
      .filter(f => f > 0);

    const averageFitness =
      fitnesses.length > 0
        ? fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length
        : 0;

    const createdAts = allEntries.map(e => e.createdAt);

    return {
      totalSeeds: allEntries.length,
      byDomain,
      totalTags: allTags.size,
      averageFitness,
      oldestSeed: createdAts.length > 0 ? Math.min(...createdAts) : 0,
      newestSeed: createdAts.length > 0 ? Math.max(...createdAts) : 0,
    };
  }

  /**
   * Serialize entire library to JSON
   */
  toJSON(): string {
    const data = {
      entries: Array.from(this.entries.entries()).map(([hash, entry]) => ({
        hash,
        entry: {
          seed: entry.seed,
          version: entry.version,
          tags: entry.tags,
          description: entry.description,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          parentHashes: entry.parentHashes,
          stats: entry.stats,
        },
      })),
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Deserialize library from JSON
   */
  static fromJSON(json: string): SeedLibrary {
    const library = new SeedLibrary();
    const data = JSON.parse(json);

    for (const item of data.entries) {
      const entry: SeedEntry = {
        seed: item.entry.seed,
        version: item.entry.version,
        tags: item.entry.tags,
        description: item.entry.description,
        createdAt: item.entry.createdAt,
        updatedAt: item.entry.updatedAt,
        parentHashes: item.entry.parentHashes,
        stats: item.entry.stats,
      };

      const hash = item.hash;
      library.entries.set(hash, entry);

      // Rebuild indices
      const name = entry.seed.$name;
      if (!library.nameIndex.has(name)) {
        library.nameIndex.set(name, []);
      }
      library.nameIndex.get(name)!.push(hash);

      const domain = entry.seed.$domain;
      if (!library.domainIndex.has(domain)) {
        library.domainIndex.set(domain, []);
      }
      library.domainIndex.get(domain)!.push(hash);

      for (const tag of entry.tags) {
        if (!library.tagIndex.has(tag)) {
          library.tagIndex.set(tag, []);
        }
        library.tagIndex.get(tag)!.push(hash);
      }
    }

    return library;
  }

  /**
   * Get lineage tree for a seed
   */
  getLineage(hash: string, depth: number = 10): LineageNode {
    const entry = this.entries.get(hash);
    if (!entry) {
      throw new Error(`Seed not found: ${hash}`);
    }

    const node: LineageNode = {
      hash,
      name: entry.seed.$name,
      generation: entry.seed.$lineage.generation,
      children: [],
    };

    if (depth <= 0) {
      return node;
    }

    // Find all entries that have this hash as a parent
    for (const otherEntry of this.entries.values()) {
      if (otherEntry.parentHashes.includes(hash)) {
        const childNode = this.getLineage(otherEntry.seed.$hash, depth - 1);
        node.children.push(childNode);
      }
    }

    return node;
  }

  /**
   * Find seeds that are similar (by genetic distance)
   */
  findSimilar(
    seed: UniversalSeed,
    maxDistance: number = 5,
    limit: number = 10
  ): SeedEntry[] {
    const results: Array<{ entry: SeedEntry; distance: number }> = [];

    for (const entry of this.entries.values()) {
      // Only compare seeds from the same domain
      if (entry.seed.$domain !== seed.$domain) {
        continue;
      }

      const distance = computeGeneticDistance(seed.genes, entry.seed.genes);
      if (distance <= maxDistance) {
        results.push({ entry, distance });
      }
    }

    // Sort by distance (ascending)
    results.sort((a, b) => a.distance - b.distance);

    return results.slice(0, limit).map(r => r.entry);
  }
}
