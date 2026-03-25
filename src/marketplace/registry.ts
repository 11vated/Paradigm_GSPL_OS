/**
 * registry.ts — Seed Marketplace Registry
 * In-memory catalog with search, filter, sort, trending, and JSON persistence.
 * Serves as both local registry and foundation for cloud marketplace.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SeedPackage, serializePackage, deserializePackage } from './seed-package.js';
import { SeedDomain } from '../kernel/seed.js';
import { computeGeneticDistance } from '../kernel/operators.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SearchQuery {
  /** Text search across name, description, tags */
  text?: string;
  /** Filter by domain */
  domain?: SeedDomain;
  /** Filter by tags (any match) */
  tags?: string[];
  /** Filter by publisher */
  publisher?: string;
  /** Minimum star rating */
  minRating?: number;
  /** Sort order */
  sortBy?: 'newest' | 'popular' | 'stars' | 'downloads' | 'trending';
  /** Pagination */
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  packages: SeedPackage[];
  total: number;
  query: SearchQuery;
}

export interface RegistryStats {
  totalPackages: number;
  totalPublishers: number;
  totalDownloads: number;
  totalForks: number;
  byDomain: Record<string, number>;
  topPublishers: Array<{ name: string; packageCount: number }>;
  recentActivity: Array<{ action: string; package: string; timestamp: number }>;
}

// ============================================================================
// MARKETPLACE REGISTRY
// ============================================================================

export class MarketplaceRegistry {
  private packages: Map<string, SeedPackage> = new Map();
  private activity: Array<{ action: string; packageHash: string; user: string; timestamp: number }> = [];
  private persistPath: string | null;

  constructor(persistPath?: string) {
    this.persistPath = persistPath ?? null;
    if (this.persistPath) {
      this.loadFromDisk();
    }
  }

  // ========================================================================
  // PUBLISH
  // ========================================================================

  /**
   * Publish a seed package to the registry.
   */
  publish(pkg: SeedPackage): { success: boolean; hash: string; error?: string } {
    // Validate
    if (pkg.$format !== 'gseed') {
      return { success: false, hash: '', error: 'Invalid package format' };
    }

    // Check for duplicate hash
    if (this.packages.has(pkg.$packageHash)) {
      return { success: false, hash: pkg.$packageHash, error: 'Package already published' };
    }

    // Check for duplicate name+version from same publisher
    for (const existing of this.packages.values()) {
      if (
        existing.seed.$name === pkg.seed.$name &&
        existing.publication.publisher === pkg.publication.publisher &&
        existing.publication.version === pkg.publication.version
      ) {
        return { success: false, hash: '', error: 'Version already exists. Bump version to republish.' };
      }
    }

    this.packages.set(pkg.$packageHash, pkg);

    // Update parent descendant counts
    for (const parentHash of pkg.attribution.parentPackages) {
      const parent = this.packages.get(parentHash);
      if (parent) {
        parent.attribution.descendantCount++;
        parent.stats.forks++;
      }
    }

    this.recordActivity('publish', pkg.$packageHash, pkg.publication.publisher);
    this.persist();

    return { success: true, hash: pkg.$packageHash };
  }

  // ========================================================================
  // SEARCH
  // ========================================================================

  /**
   * Search packages with filtering and sorting.
   */
  search(query: SearchQuery): SearchResult {
    let results = Array.from(this.packages.values());

    // Text search
    if (query.text) {
      const q = query.text.toLowerCase();
      results = results.filter(pkg =>
        pkg.seed.$name.toLowerCase().includes(q) ||
        pkg.publication.description.toLowerCase().includes(q) ||
        pkg.publication.tags.some(t => t.toLowerCase().includes(q)) ||
        pkg.publication.publisher.toLowerCase().includes(q)
      );
    }

    // Domain filter
    if (query.domain) {
      results = results.filter(pkg => pkg.seed.$domain === query.domain);
    }

    // Tag filter
    if (query.tags && query.tags.length > 0) {
      const tagSet = new Set(query.tags.map(t => t.toLowerCase()));
      results = results.filter(pkg =>
        pkg.publication.tags.some(t => tagSet.has(t.toLowerCase()))
      );
    }

    // Publisher filter
    if (query.publisher) {
      results = results.filter(pkg =>
        pkg.publication.publisher.toLowerCase() === query.publisher!.toLowerCase()
      );
    }

    // Rating filter
    if (query.minRating !== undefined) {
      results = results.filter(pkg => pkg.stats.averageRating >= query.minRating!);
    }

    const total = results.length;

    // Sort
    switch (query.sortBy) {
      case 'newest':
        results.sort((a, b) => b.publication.publishedAt - a.publication.publishedAt);
        break;
      case 'popular':
        results.sort((a, b) => b.stats.downloads - a.stats.downloads);
        break;
      case 'stars':
        results.sort((a, b) => b.stats.stars - a.stats.stars);
        break;
      case 'downloads':
        results.sort((a, b) => b.stats.downloads - a.stats.downloads);
        break;
      case 'trending':
        results.sort((a, b) => this.trendingScore(b) - this.trendingScore(a));
        break;
      default:
        results.sort((a, b) => b.publication.publishedAt - a.publication.publishedAt);
    }

    // Pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;
    results = results.slice(offset, offset + limit);

    return { packages: results, total, query };
  }

  /**
   * Get a single package by hash.
   */
  get(hash: string): SeedPackage | undefined {
    return this.packages.get(hash);
  }

  /**
   * Get all packages by a publisher.
   */
  getByPublisher(publisher: string): SeedPackage[] {
    return Array.from(this.packages.values())
      .filter(pkg => pkg.publication.publisher === publisher);
  }

  /**
   * Find genetically similar seeds.
   */
  findSimilar(seedHash: string, maxResults: number = 5): SeedPackage[] {
    const target = this.packages.get(seedHash);
    if (!target) return [];

    const scored = Array.from(this.packages.values())
      .filter(pkg => pkg.$packageHash !== seedHash && pkg.seed.$domain === target.seed.$domain)
      .map(pkg => ({
        pkg,
        distance: computeGeneticDistance(target.seed.genes, pkg.seed.genes),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxResults);

    return scored.map(s => s.pkg);
  }

  // ========================================================================
  // INTERACTIONS
  // ========================================================================

  /**
   * Record a download.
   */
  download(hash: string, user: string): SeedPackage | undefined {
    const pkg = this.packages.get(hash);
    if (!pkg) return undefined;

    pkg.stats.downloads++;
    this.recordActivity('download', hash, user);
    this.persist();
    return pkg;
  }

  /**
   * Star a package.
   */
  star(hash: string, user: string): boolean {
    const pkg = this.packages.get(hash);
    if (!pkg) return false;

    pkg.stats.stars++;
    this.recordActivity('star', hash, user);
    this.persist();
    return true;
  }

  /**
   * Rate a package (1-5).
   */
  rate(hash: string, user: string, rating: number): boolean {
    const pkg = this.packages.get(hash);
    if (!pkg) return false;

    const clamped = Math.max(1, Math.min(5, Math.round(rating)));
    const total = pkg.stats.averageRating * pkg.stats.ratingCount + clamped;
    pkg.stats.ratingCount++;
    pkg.stats.averageRating = total / pkg.stats.ratingCount;

    this.recordActivity('rate', hash, user);
    this.persist();
    return true;
  }

  /**
   * Record that a package was used in evolution.
   */
  recordEvolve(hash: string): void {
    const pkg = this.packages.get(hash);
    if (pkg) {
      pkg.stats.evolvedCount++;
      this.persist();
    }
  }

  /**
   * Record that a package was used in breeding.
   */
  recordBreed(hash: string): void {
    const pkg = this.packages.get(hash);
    if (pkg) {
      pkg.stats.bredCount++;
      this.persist();
    }
  }

  // ========================================================================
  // STATS & TRENDING
  // ========================================================================

  /**
   * Get registry-wide statistics.
   */
  stats(): RegistryStats {
    const packages = Array.from(this.packages.values());
    const byDomain: Record<string, number> = {};
    const publisherCounts: Map<string, number> = new Map();
    let totalDownloads = 0;
    let totalForks = 0;

    for (const pkg of packages) {
      byDomain[pkg.seed.$domain] = (byDomain[pkg.seed.$domain] ?? 0) + 1;
      totalDownloads += pkg.stats.downloads;
      totalForks += pkg.stats.forks;
      const count = publisherCounts.get(pkg.publication.publisher) ?? 0;
      publisherCounts.set(pkg.publication.publisher, count + 1);
    }

    const topPublishers = Array.from(publisherCounts.entries())
      .map(([name, packageCount]) => ({ name, packageCount }))
      .sort((a, b) => b.packageCount - a.packageCount)
      .slice(0, 10);

    const recentActivity = this.activity
      .slice(-20)
      .reverse()
      .map(a => ({ action: a.action, package: a.packageHash.slice(0, 8), timestamp: a.timestamp }));

    return {
      totalPackages: packages.length,
      totalPublishers: publisherCounts.size,
      totalDownloads,
      totalForks,
      byDomain,
      topPublishers,
      recentActivity,
    };
  }

  /**
   * Get featured/curated packages.
   */
  featured(limit: number = 6): SeedPackage[] {
    return Array.from(this.packages.values())
      .sort((a, b) => this.trendingScore(b) - this.trendingScore(a))
      .slice(0, limit);
  }

  private trendingScore(pkg: SeedPackage): number {
    const age = (Date.now() - pkg.publication.publishedAt) / (1000 * 60 * 60 * 24); // days
    const recency = Math.max(0.1, 1 / (1 + age / 7)); // decay over a week
    const engagement = pkg.stats.downloads + pkg.stats.stars * 3 + pkg.stats.forks * 5;
    return engagement * recency;
  }

  // ========================================================================
  // PERSISTENCE
  // ========================================================================

  private persist(): void {
    if (!this.persistPath) return;
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const data = {
        packages: Array.from(this.packages.entries()),
        activity: this.activity.slice(-1000),
      };
      fs.writeFileSync(this.persistPath, JSON.stringify(data), 'utf-8');
    } catch {
      // Persistence failure is non-fatal
    }
  }

  private loadFromDisk(): void {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return;
    try {
      const raw = fs.readFileSync(this.persistPath, 'utf-8');
      const data = JSON.parse(raw);
      if (data.packages) {
        this.packages = new Map(data.packages);
      }
      if (data.activity) {
        this.activity = data.activity;
      }
    } catch {
      // Load failure is non-fatal — start fresh
    }
  }

  private recordActivity(action: string, packageHash: string, user: string): void {
    this.activity.push({ action, packageHash, user, timestamp: Date.now() });
    if (this.activity.length > 10000) {
      this.activity = this.activity.slice(-5000);
    }
  }

  /**
   * Total package count.
   */
  size(): number {
    return this.packages.size;
  }

  /**
   * Remove a package (by publisher only).
   */
  unpublish(hash: string, publisher: string): boolean {
    const pkg = this.packages.get(hash);
    if (!pkg || pkg.publication.publisher !== publisher) return false;
    this.packages.delete(hash);
    this.recordActivity('unpublish', hash, publisher);
    this.persist();
    return true;
  }
}
