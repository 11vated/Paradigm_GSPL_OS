/**
 * memory.ts — 4-Layer Memory System
 * Episodic (experience), Semantic (knowledge), Working (context), and Long-term (library) memory
 */

import type { UniversalSeed, GeneMap } from '../kernel/index.js';

// ============================================================================
// EPISODIC MEMORY — Past Evolution Runs
// ============================================================================

export interface Episode {
  id: string;
  timestamp: number;
  domain: string;
  seedHash: string;
  action: string;           // What was done
  outcome: string;          // What happened
  fitness: number;          // How good was the result
  context: Record<string, unknown>;  // Environmental context
  tags: string[];
}

export class EpisodicMemory {
  private episodes: Episode[] = [];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  record(episode: Omit<Episode, 'id' | 'timestamp'>): void {
    const fullEpisode: Episode = {
      id: `ep_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now(),
      ...episode,
    };

    this.episodes.push(fullEpisode);

    // Maintain max size by removing oldest episodes
    if (this.episodes.length > this.maxSize) {
      this.episodes = this.episodes.slice(-this.maxSize);
    }
  }

  recall(query: {
    domain?: string;
    action?: string;
    tags?: string[];
    minFitness?: number;
    limit?: number;
  }): Episode[] {
    let results = this.episodes;

    if (query.domain) {
      results = results.filter(ep => ep.domain === query.domain);
    }

    if (query.action) {
      results = results.filter(ep => ep.action === query.action);
    }

    if (query.minFitness !== undefined) {
      results = results.filter(ep => ep.fitness >= query.minFitness!);
    }

    if (query.tags && query.tags.length > 0) {
      const tagSet = new Set(query.tags);
      results = results.filter(ep =>
        ep.tags.some(tag => tagSet.has(tag))
      );
    }

    // Return most recent first
    results = results.reverse();

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  getBestEpisodes(domain: string, limit: number = 10): Episode[] {
    return this.episodes
      .filter(ep => ep.domain === domain)
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, limit);
  }

  getRecentEpisodes(limit: number = 10): Episode[] {
    return this.episodes.slice(-limit).reverse();
  }

  size(): number {
    return this.episodes.length;
  }

  clear(): void {
    this.episodes = [];
  }
}

// ============================================================================
// SEMANTIC MEMORY — Gene-to-Phenotype Knowledge Graph
// ============================================================================

export interface KnowledgeNode {
  id: string;
  type: 'gene' | 'phenotype' | 'domain' | 'operator' | 'pattern';
  label: string;
  properties: Record<string, unknown>;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  relation: string;    // 'produces', 'requires', 'enhances', 'conflicts', 'similar'
  weight: number;      // 0-1 confidence
}

export class SemanticMemory {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private edges: KnowledgeEdge[] = [];

  addNode(node: KnowledgeNode): void {
    this.nodes.set(node.id, { ...node });
  }

  addEdge(edge: KnowledgeEdge): void {
    // Check nodes exist
    if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) {
      throw new Error(`Cannot add edge: source or target node not found`);
    }

    // Check for duplicate edges and update weight if exists
    const existingIndex = this.edges.findIndex(
      e => e.source === edge.source && e.target === edge.target && e.relation === edge.relation
    );

    if (existingIndex >= 0) {
      this.edges[existingIndex] = edge;
    } else {
      this.edges.push({ ...edge });
    }
  }

  getNode(id: string): KnowledgeNode | undefined {
    return this.nodes.get(id);
  }

  getRelated(nodeId: string, relation?: string): Array<{ node: KnowledgeNode; edge: KnowledgeEdge }> {
    const source = this.nodes.get(nodeId);
    if (!source) return [];

    return this.edges
      .filter(edge =>
        edge.source === nodeId &&
        (!relation || edge.relation === relation)
      )
      .map(edge => {
        const targetNode = this.nodes.get(edge.target);
        if (!targetNode) return null;
        return { node: targetNode, edge };
      })
      .filter((item): item is { node: KnowledgeNode; edge: KnowledgeEdge } => item !== null);
  }

  query(type: string, properties?: Record<string, unknown>): KnowledgeNode[] {
    const results: KnowledgeNode[] = [];

    for (const node of this.nodes.values()) {
      if (node.type !== type) continue;

      if (properties) {
        let matches = true;
        for (const [key, value] of Object.entries(properties)) {
          if (node.properties[key] !== value) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }

      results.push(node);
    }

    return results;
  }

  findPath(fromId: string, toId: string): KnowledgeNode[] {
    // BFS to find a path
    const queue: { nodeId: string; path: string[] }[] = [{ nodeId: fromId, path: [fromId] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (nodeId === toId) {
        return path.map(id => this.nodes.get(id)!).filter(n => n);
      }

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const related = this.getRelated(nodeId);
      for (const { node } of related) {
        if (!visited.has(node.id)) {
          queue.push({ nodeId: node.id, path: [...path, node.id] });
        }
      }
    }

    return [];
  }

  size(): { nodes: number; edges: number } {
    return {
      nodes: this.nodes.size,
      edges: this.edges.length,
    };
  }
}

// ============================================================================
// WORKING MEMORY — Active Context
// ============================================================================

export class WorkingMemory {
  private context: Map<string, { value: unknown; priority: number; addedAt: number }> = new Map();
  private capacity: number;

  constructor(capacity: number = 100) {
    this.capacity = capacity;
  }

  set(key: string, value: unknown, priority: number = 0.5): void {
    this.context.set(key, {
      value,
      priority: Math.max(0, Math.min(1, priority)),
      addedAt: Date.now(),
    });

    if (this.context.size > this.capacity) {
      this.compact();
    }
  }

  get(key: string): unknown {
    return this.context.get(key)?.value;
  }

  has(key: string): boolean {
    return this.context.has(key);
  }

  remove(key: string): void {
    this.context.delete(key);
  }

  getAll(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, item] of this.context.entries()) {
      result[key] = item.value;
    }
    return result;
  }

  compact(): void {
    // Evict lowest-priority items when over capacity
    if (this.context.size <= this.capacity) return;

    const entries = Array.from(this.context.entries());
    entries.sort((a, b) => {
      // Sort by priority (ascending) then by age (ascending)
      if (a[1].priority !== b[1].priority) {
        return a[1].priority - b[1].priority;
      }
      return a[1].addedAt - b[1].addedAt;
    });

    // Keep only the most important items
    const toKeep = entries.slice(-(this.capacity - 1)).map(e => e[0]);
    const toRemove = entries.slice(0, entries.length - (this.capacity - 1)).map(e => e[0]);

    for (const key of toRemove) {
      this.context.delete(key);
    }
  }

  clear(): void {
    this.context.clear();
  }

  size(): number {
    return this.context.size;
  }
}

// ============================================================================
// LONG-TERM MEMORY — Persistent Seed Libraries
// ============================================================================

export interface SeedLibraryEntry {
  seed: UniversalSeed;
  useCount: number;
  avgFitness: number;
  tags: string[];
  description: string;
  addedAt: number;
  lastUsedAt: number;
}

export class LongTermMemory {
  private library: Map<string, SeedLibraryEntry> = new Map();

  store(entry: Omit<SeedLibraryEntry, 'useCount' | 'addedAt' | 'lastUsedAt'>): void {
    const now = Date.now();
    const fullEntry: SeedLibraryEntry = {
      ...entry,
      useCount: 0,
      addedAt: now,
      lastUsedAt: now,
    };

    const hash = entry.seed.$hash;
    this.library.set(hash, fullEntry);
  }

  retrieve(hash: string): SeedLibraryEntry | undefined {
    return this.library.get(hash);
  }

  search(query: {
    domain?: string;
    tags?: string[];
    minFitness?: number;
  }): SeedLibraryEntry[] {
    let results: SeedLibraryEntry[] = Array.from(this.library.values());

    if (query.domain) {
      results = results.filter(entry => entry.seed.$domain === query.domain);
    }

    if (query.tags && query.tags.length > 0) {
      const tagSet = new Set(query.tags);
      results = results.filter(entry =>
        entry.tags.some(tag => tagSet.has(tag))
      );
    }

    if (query.minFitness !== undefined) {
      results = results.filter(entry => entry.avgFitness >= query.minFitness!);
    }

    return results;
  }

  recordUse(hash: string, fitness: number): void {
    const entry = this.library.get(hash);
    if (!entry) return;

    // Update average fitness before incrementing useCount
    const prevCount = entry.useCount;
    entry.avgFitness = prevCount === 0
      ? fitness
      : (entry.avgFitness * prevCount + fitness) / (prevCount + 1);

    entry.useCount++;
    entry.lastUsedAt = Date.now();
  }

  getMostUsed(limit: number = 10): SeedLibraryEntry[] {
    return Array.from(this.library.values())
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, limit);
  }

  getHighestFitness(domain?: string, limit: number = 10): SeedLibraryEntry[] {
    let results = Array.from(this.library.values());

    if (domain) {
      results = results.filter(entry => entry.seed.$domain === domain);
    }

    return results
      .sort((a, b) => b.avgFitness - a.avgFitness)
      .slice(0, limit);
  }

  size(): number {
    return this.library.size;
  }

  export(): SeedLibraryEntry[] {
    return Array.from(this.library.values());
  }

  import(entries: SeedLibraryEntry[]): void {
    for (const entry of entries) {
      const hash = entry.seed.$hash;
      this.library.set(hash, { ...entry });
    }
  }
}

// ============================================================================
// COMBINED MEMORY SYSTEM
// ============================================================================

export class MemorySystem {
  readonly episodic: EpisodicMemory;
  readonly semantic: SemanticMemory;
  readonly working: WorkingMemory;
  readonly longTerm: LongTermMemory;

  constructor(config?: { episodicSize?: number; workingCapacity?: number }) {
    this.episodic = new EpisodicMemory(config?.episodicSize);
    this.semantic = new SemanticMemory();
    this.working = new WorkingMemory(config?.workingCapacity);
    this.longTerm = new LongTermMemory();
  }

  learnFromEvolution(seed: UniversalSeed, fitness: number, context: Record<string, unknown>): void {
    // Record to episodic memory
    this.episodic.record({
      domain: seed.$domain,
      seedHash: seed.$hash,
      action: 'evolution',
      outcome: `fitness: ${fitness.toFixed(3)}`,
      fitness,
      context,
      tags: [seed.$domain, 'evolution'],
    });

    // Store high-fitness seeds to long-term memory
    if (fitness > 0.5) {
      this.longTerm.store({
        seed,
        avgFitness: fitness,
        tags: [seed.$domain, 'high-fitness'],
        description: `Seed with fitness ${fitness.toFixed(3)}`,
      });
    }

    // Update working memory with latest result
    this.working.set(`last_fitness_${seed.$domain}`, fitness, 0.9);
    this.working.set(`last_seed_${seed.$domain}`, seed.$hash, 0.8);
  }

  suggestSeed(domain: string, intent?: string): UniversalSeed | undefined {
    // Try to find high-fitness seed for domain from long-term memory
    const candidates = this.longTerm.getHighestFitness(domain, 5);

    if (candidates.length > 0) {
      return candidates[0].seed;
    }

    // Fall back to recent episodes
    const recent = this.episodic.recall({
      domain,
      limit: 1,
      minFitness: 0.5,
    });

    if (recent.length > 0) {
      const entry = this.longTerm.retrieve(recent[0].seedHash);
      if (entry) {
        return entry.seed;
      }
    }

    return undefined;
  }

  getContext(): Record<string, unknown> {
    return this.working.getAll();
  }
}
