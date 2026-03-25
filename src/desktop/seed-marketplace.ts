/**
 * seed-marketplace.ts — Seed Marketplace
 * Manages publishing, discovery, and interaction with seeds in a marketplace.
 */

import { computeHash, UniversalSeed } from '../kernel/seed.js';

export interface MarketplaceSeed {
  hash: string;
  name: string;
  domain: string;
  author: string;
  description: string;
  tags: string[];
  generation: number;
  parentHashes: string[];
  downloads: number;
  rating: number;
  createdAt: number;
  seedData: string;
}

export interface SearchQuery {
  text?: string;
  domain?: string;
  tags?: string[];
  sortBy?: 'downloads' | 'rating' | 'newest' | 'generation';
  limit?: number;
  offset?: number;
}

export class SeedMarketplace {
  private seeds: Map<string, MarketplaceSeed> = new Map();
  private downloadCounts: Map<string, number> = new Map();
  private ratings: Map<string, number[]> = new Map();

  constructor() {
    this.seeds = new Map();
    this.downloadCounts = new Map();
    this.ratings = new Map();
  }

  /**
   * Publish a seed to the marketplace
   */
  publish(seed: UniversalSeed, metadata: { description: string; tags: string[] }): MarketplaceSeed {
    const hash = seed.$hash;

    const marketplaceSeed: MarketplaceSeed = {
      hash,
      name: seed.$name,
      domain: seed.$domain,
      author: seed.$metadata.author,
      description: metadata.description,
      tags: metadata.tags,
      generation: seed.$lineage.generation,
      parentHashes: seed.$lineage.parents,
      downloads: 0,
      rating: 5.0,
      createdAt: Date.now(),
      seedData: JSON.stringify(seed),
    };

    this.seeds.set(hash, marketplaceSeed);
    this.downloadCounts.set(hash, 0);
    this.ratings.set(hash, [5.0]);

    return marketplaceSeed;
  }

  /**
   * Unpublish a seed from the marketplace
   */
  unpublish(hash: string): boolean {
    return this.seeds.delete(hash);
  }

  /**
   * Search for seeds by various criteria
   */
  search(query: SearchQuery): MarketplaceSeed[] {
    let results = Array.from(this.seeds.values());

    if (query.text) {
      const text = query.text.toLowerCase();
      results = results.filter(
        s =>
          s.name.toLowerCase().includes(text) ||
          s.description.toLowerCase().includes(text) ||
          s.author.toLowerCase().includes(text)
      );
    }

    if (query.domain) {
      results = results.filter(s => s.domain === query.domain);
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter(s =>
        query.tags!.some(tag => s.tags.includes(tag))
      );
    }

    // Sort results
    const sortBy = query.sortBy ?? 'newest';
    switch (sortBy) {
      case 'downloads':
        results.sort((a, b) => (this.downloadCounts.get(b.hash) ?? 0) - (this.downloadCounts.get(a.hash) ?? 0));
        break;
      case 'rating':
        results.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        results.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'generation':
        results.sort((a, b) => b.generation - a.generation);
        break;
    }

    // Apply limit and offset
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    return results.slice(offset, offset + limit);
  }

  /**
   * Get a seed by hash
   */
  getByHash(hash: string): MarketplaceSeed | undefined {
    return this.seeds.get(hash);
  }

  /**
   * Get all seeds in a domain
   */
  getByDomain(domain: string, limit: number = 50): MarketplaceSeed[] {
    const results = Array.from(this.seeds.values())
      .filter(s => s.domain === domain)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
    return results;
  }

  /**
   * Get most popular seeds
   */
  getPopular(limit: number = 50): MarketplaceSeed[] {
    return Array.from(this.seeds.values())
      .sort((a, b) => (this.downloadCounts.get(b.hash) ?? 0) - (this.downloadCounts.get(a.hash) ?? 0))
      .slice(0, limit);
  }

  /**
   * Get most recent seeds
   */
  getRecent(limit: number = 50): MarketplaceSeed[] {
    return Array.from(this.seeds.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Get all seeds by a specific author
   */
  getByAuthor(author: string): MarketplaceSeed[] {
    return Array.from(this.seeds.values())
      .filter(s => s.author === author)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Download a seed (returns deserialized seed object)
   */
  download(hash: string): UniversalSeed | undefined {
    const seed = this.seeds.get(hash);
    if (!seed) return undefined;

    const count = (this.downloadCounts.get(hash) ?? 0) + 1;
    this.downloadCounts.set(hash, count);
    seed.downloads = count;

    try {
      return JSON.parse(seed.seedData) as UniversalSeed;
    } catch {
      return undefined;
    }
  }

  /**
   * Rate a seed
   */
  rate(hash: string, rating: number): void {
    const clamped = Math.max(1, Math.min(5, rating));
    const ratings = this.ratings.get(hash) ?? [5.0];
    ratings.push(clamped);

    const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    this.ratings.set(hash, ratings);

    const seed = this.seeds.get(hash);
    if (seed) {
      seed.rating = average;
    }
  }

  /**
   * Fork a seed (create a copy with new name and parent reference)
   */
  fork(hash: string, newName: string): MarketplaceSeed | undefined {
    const original = this.seeds.get(hash);
    if (!original) return undefined;

    try {
      const seedData = JSON.parse(original.seedData) as UniversalSeed;
      const forked: UniversalSeed = {
        ...seedData,
        $name: newName,
        $lineage: {
          ...seedData.$lineage,
          parents: [hash],
          generation: seedData.$lineage.generation + 1,
        },
        $metadata: {
          ...seedData.$metadata,
          created: Date.now(),
          modified: Date.now(),
        },
      };

      // Recompute hash
      forked.$hash = computeHash(forked);

      const forkedMarketplaceSeed: MarketplaceSeed = {
        hash: forked.$hash,
        name: forked.$name,
        domain: forked.$domain,
        author: forked.$metadata.author,
        description: original.description,
        tags: original.tags,
        generation: forked.$lineage.generation,
        parentHashes: forked.$lineage.parents,
        downloads: 0,
        rating: 5.0,
        createdAt: Date.now(),
        seedData: JSON.stringify(forked),
      };

      this.seeds.set(forked.$hash, forkedMarketplaceSeed);
      this.downloadCounts.set(forked.$hash, 0);
      this.ratings.set(forked.$hash, [5.0]);

      return forkedMarketplaceSeed;
    } catch {
      return undefined;
    }
  }

  /**
   * Get marketplace statistics
   */
  getStats(): {
    totalSeeds: number;
    totalDomains: number;
    topDomains: Array<{ domain: string; count: number }>;
  } {
    const seeds = Array.from(this.seeds.values());
    const totalSeeds = seeds.length;

    const domainCounts = new Map<string, number>();
    for (const seed of seeds) {
      domainCounts.set(seed.domain, (domainCounts.get(seed.domain) ?? 0) + 1);
    }

    const topDomains = Array.from(domainCounts.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalSeeds,
      totalDomains: domainCounts.size,
      topDomains,
    };
  }
}
