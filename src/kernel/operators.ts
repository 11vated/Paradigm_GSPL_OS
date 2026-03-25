/**
 * operators.ts — Genetic Operators
 * Core operations that work across ALL domains.
 * Includes crossover, mutation, and distance metrics.
 */

import { Gene, GeneMap, GeneType, cloneGene, ScalarGene, CategoricalGene, VectorGene, StructGene, ArrayGene, GraphGene } from './genes.js';
import { UniversalSeed, computeHash, cloneSeed, recordOperation } from './seed.js';
import { DeterministicRNG, clamp, lerp } from './rng.js';

// ============================================================================
// CROSSOVER OPTIONS & MUTATION OPTIONS
// ============================================================================

export interface CrossoverOptions {
  strategy: 'uniform' | 'single_point' | 'blend' | 'sbx';
  dominance?: number;
  mutationRate?: number;
  blendAlpha?: number;
  sbxEta?: number;
}

export interface MutationOptions {
  rate: number;
  intensity: number;
  adaptiveRate?: boolean;
}

// ============================================================================
// CROSSOVER OPERATIONS
// ============================================================================

/**
 * Crossover two seeds to create offspring
 */
export function crossover<T extends GeneMap>(
  parentA: UniversalSeed<T>,
  parentB: UniversalSeed<T>,
  options: CrossoverOptions,
  rng?: DeterministicRNG
): UniversalSeed<T> {
  const _rng = rng ?? new DeterministicRNG(`crossover_${parentA.$hash}_${parentB.$hash}`);
  const dominance = options.dominance ?? 0.5;

  const offspringGenes: GeneMap = {};

  for (const key of Object.keys(parentA.genes)) {
    const geneA = parentA.genes[key];
    const geneB = parentB.genes[key];

    if (geneB) {
      offspringGenes[key] = crossoverGene(
        geneA,
        geneB,
        options.strategy,
        dominance,
        _rng,
        options.blendAlpha ?? 0.5,
        options.sbxEta ?? 20
      );
    } else {
      offspringGenes[key] = cloneGene(geneA);
    }
  }

  let offspring: UniversalSeed<T> = {
    $gst: parentA.$gst,
    $domain: parentA.$domain,
    $hash: '',
    $name: `${parentA.$name}_x_${parentB.$name}`,
    $lineage: {
      parents: [parentA.$hash, parentB.$hash],
      generation: Math.max(parentA.$lineage.generation, parentB.$lineage.generation) + 1,
      operations: [
        {
          type: 'crossover',
          timestamp: Date.now(),
          details: { strategy: options.strategy, dominance },
        },
      ],
      createdAt: Date.now(),
      engineVersion: parentA.$lineage.engineVersion,
    },
    genes: offspringGenes as T,
    $fitness: undefined,
    $metadata: { ...parentA.$metadata, modified: Date.now() },
  };
  offspring.$hash = computeHash(offspring);

  // Post-crossover mutation if specified
  if (options.mutationRate && options.mutationRate > 0) {
    offspring = mutate(offspring, { rate: options.mutationRate, intensity: 0.1 }, _rng);
  }

  return offspring;
}

/**
 * Crossover two individual genes
 */
export function crossoverGene(
  geneA: Gene,
  geneB: Gene,
  strategy: string,
  dominance: number,
  rng: DeterministicRNG,
  blendAlpha: number = 0.5,
  sbxEta: number = 20
): Gene {
  const _rng = rng;

  if (geneA.type !== geneB.type) {
    return cloneGene(_rng.nextBool(dominance) ? geneA : geneB);
  }

  switch (geneA.type) {
    case 'scalar': {
      const ga = geneA as ScalarGene;
      const gb = geneB as ScalarGene;

      if (strategy === 'uniform') {
        return cloneGene(_rng.nextBool(dominance) ? ga : gb);
      } else if (strategy === 'single_point') {
        return cloneGene(_rng.nextBool(dominance) ? ga : gb);
      } else if (strategy === 'blend') {
        return crossoverScalarBlend(ga, gb, blendAlpha, _rng);
      } else if (strategy === 'sbx') {
        return crossoverScalarSBX(ga, gb, sbxEta, _rng);
      }
      return cloneGene(ga);
    }

    case 'categorical': {
      const ga = geneA as CategoricalGene;
      const gb = geneB as CategoricalGene;
      // Categorical: pick from one of the parents' values
      return cloneGene(_rng.nextBool(dominance) ? ga : gb);
    }

    case 'vector': {
      const ga = geneA as VectorGene;
      const gb = geneB as VectorGene;

      if (strategy === 'uniform') {
        const newValue: number[] = [];
        for (let i = 0; i < ga.value.length; i++) {
          newValue.push(_rng.nextBool(dominance) ? ga.value[i] : gb.value[i]);
        }
        const result = cloneGene(ga) as VectorGene;
        result.value = newValue;
        return result;
      } else if (strategy === 'blend' || strategy === 'sbx') {
        const newValue: number[] = [];
        for (let i = 0; i < ga.value.length; i++) {
          const minI = Math.min(ga.value[i], gb.value[i]);
          const maxI = Math.max(ga.value[i], gb.value[i]);
          const range = maxI - minI;
          const alpha = blendAlpha;
          const lower = minI - alpha * range;
          const upper = maxI + alpha * range;
          const min = ga.min ? ga.min[i] : undefined;
          const max = ga.max ? ga.max[i] : undefined;
          const clampedLower = min !== undefined ? Math.max(lower, min) : lower;
          const clampedUpper = max !== undefined ? Math.min(upper, max) : upper;
          newValue.push(_rng.nextFloat(clampedLower, clampedUpper));
        }
        const result = cloneGene(ga) as VectorGene;
        result.value = newValue;
        return result;
      }
      return cloneGene(ga);
    }

    case 'expression': {
      return cloneGene(geneA);
    }

    case 'struct': {
      const ga = geneA as StructGene;
      const gb = geneB as StructGene;
      const newValue: GeneMap = {};
      const allKeys = new Set([...Object.keys(ga.value), ...Object.keys(gb.value)]);
      for (const key of allKeys) {
        if (ga.value[key] && gb.value[key]) {
          newValue[key] = crossoverGene(ga.value[key], gb.value[key], strategy, dominance, _rng, blendAlpha, sbxEta);
        } else if (ga.value[key]) {
          newValue[key] = cloneGene(ga.value[key]);
        } else if (gb.value[key]) {
          newValue[key] = cloneGene(gb.value[key]);
        }
      }
      const result = cloneGene(ga) as StructGene;
      result.value = newValue;
      return result;
    }

    case 'array': {
      const ga = geneA as ArrayGene;
      const gb = geneB as ArrayGene;
      // Simple: interleave elements from both
      const minLen = Math.min(ga.value.length, gb.value.length);
      const maxLen = Math.max(ga.value.length, gb.value.length);
      const clampedLen = clamp(minLen + Math.floor(_rng.next() * (maxLen - minLen + 1)), ga.minLength, ga.maxLength);
      const newValue: Gene[] = [];
      for (let i = 0; i < clampedLen; i++) {
        if (i < ga.value.length && i < gb.value.length) {
          newValue.push(crossoverGene(ga.value[i], gb.value[i], strategy, dominance, _rng, blendAlpha, sbxEta));
        } else if (i < ga.value.length) {
          newValue.push(cloneGene(ga.value[i]));
        } else {
          newValue.push(cloneGene(gb.value[i]));
        }
      }
      const result = cloneGene(ga) as ArrayGene;
      result.value = newValue;
      return result;
    }

    case 'graph': {
      const ga = geneA as GraphGene;
      const gb = geneB as GraphGene;
      // Mix nodes and edges
      const nodeMap = new Map<string, { id: string; data: GeneMap }>();
      for (const node of ga.value.nodes) {
        nodeMap.set(node.id, { ...node, data: { ...node.data } });
      }
      for (const node of gb.value.nodes) {
        if (nodeMap.has(node.id)) {
          const existing = nodeMap.get(node.id)!;
          for (const [key, gene] of Object.entries(node.data)) {
            if (existing.data[key]) {
              existing.data[key] = crossoverGene(existing.data[key], gene, strategy, dominance, _rng, blendAlpha, sbxEta);
            } else {
              existing.data[key] = cloneGene(gene);
            }
          }
        } else if (nodeMap.size < ga.maxNodes) {
          nodeMap.set(node.id, { ...node, data: { ...node.data } });
        }
      }
      const nodes = Array.from(nodeMap.values());
      const edgeSet = new Map<string, { from: string; to: string; weight: number }>();
      for (const edge of ga.value.edges) {
        edgeSet.set(`${edge.from}→${edge.to}`, { ...edge });
      }
      for (const edge of gb.value.edges) {
        const key = `${edge.from}→${edge.to}`;
        if (edgeSet.has(key)) {
          edgeSet.get(key)!.weight = lerp(edgeSet.get(key)!.weight, edge.weight, 0.5);
        } else if (edgeSet.size < ga.maxEdges) {
          edgeSet.set(key, { ...edge });
        }
      }
      const edges = Array.from(edgeSet.values());
      const result = cloneGene(ga) as GraphGene;
      result.value = { nodes, edges };
      return result;
    }
  }
}

/**
 * BLX-α crossover for scalars
 */
function crossoverScalarBlend(a: ScalarGene, b: ScalarGene, alpha: number, rng: DeterministicRNG): ScalarGene {
  const min = Math.min(a.value, b.value);
  const max = Math.max(a.value, b.value);
  const range = max - min;
  const lower = Math.max(min - alpha * range, a.min);
  const upper = Math.min(max + alpha * range, a.max);
  const newValue = rng.nextFloat(lower, upper);
  const result = cloneGene(a) as ScalarGene;
  result.value = newValue;
  return result;
}

/**
 * Simulated Binary Crossover (SBX) for scalars
 */
function crossoverScalarSBX(a: ScalarGene, b: ScalarGene, eta: number, rng: DeterministicRNG): ScalarGene {
  const y1 = Math.min(a.value, b.value);
  const y2 = Math.max(a.value, b.value);

  if (Math.abs(y2 - y1) < 1e-10) {
    const result = cloneGene(a) as ScalarGene;
    result.value = y1;
    return result;
  }

  const beta = 1 + (2 * (y1 - a.min) / (y2 - y1));
  const alphaQ = 2 - Math.pow(beta, -(eta + 1));
  let rand = rng.next();
  let betaQ = (alphaQ * rand) ** (1 / (eta + 1));
  let y1new = y1 - betaQ * (y2 - y1);

  const beta2 = 1 + (2 * (a.max - y2) / (y2 - y1));
  const alphaQ2 = 2 - Math.pow(beta2, -(eta + 1));
  rand = rng.next();
  let betaQ2 = (alphaQ2 * rand) ** (1 / (eta + 1));
  let y2new = y2 + betaQ2 * (y2 - y1);

  y1new = clamp(y1new, a.min, a.max);
  y2new = clamp(y2new, a.min, a.max);

  const result = cloneGene(a) as ScalarGene;
  result.value = rng.nextBool() ? y1new : y2new;
  return result;
}

// ============================================================================
// MUTATION OPERATIONS
// ============================================================================

/**
 * Mutate a seed
 */
export function mutate<T extends GeneMap>(
  seed: UniversalSeed<T>,
  options: MutationOptions,
  rng?: DeterministicRNG
): UniversalSeed<T> {
  const _rng = rng ?? new DeterministicRNG(`mutate_${seed.$hash}`);
  const mutatedGenes: GeneMap = {};

  for (const [key, gene] of Object.entries(seed.genes)) {
    if (gene.mutable && _rng.next() < options.rate) {
      mutatedGenes[key] = mutateGene(gene, options.intensity, _rng);
    } else {
      mutatedGenes[key] = cloneGene(gene);
    }
  }

  const baseName = seed.$name.replace(/_evolved$|_mut.*$/, '');
  const mutated: UniversalSeed<T> = {
    $gst: seed.$gst,
    $domain: seed.$domain,
    $hash: '',
    $name: `${baseName}_evolved`,
    $lineage: {
      parents: [seed.$hash],
      generation: seed.$lineage.generation + 1,
      operations: [
        {
          type: 'mutation',
          timestamp: Date.now(),
          details: { rate: options.rate, intensity: options.intensity },
        },
      ],
      createdAt: Date.now(),
      engineVersion: seed.$lineage.engineVersion,
    },
    genes: mutatedGenes as T,
    $fitness: undefined,
    $metadata: { ...seed.$metadata, modified: Date.now() },
  };
  mutated.$hash = computeHash(mutated);

  return mutated;
}

/**
 * Mutate a single gene
 */
export function mutateGene(gene: Gene, intensity: number, rng: DeterministicRNG): Gene {
  const result = cloneGene(gene);

  switch (result.type) {
    case 'scalar': {
      const g = result as ScalarGene;
      const range = g.max - g.min;
      const delta = rng.nextGaussian(0, 1) * intensity * range;
      g.value = clamp(g.value + delta, g.min, g.max);
      break;
    }

    case 'categorical': {
      const g = result as CategoricalGene;
      const options = g.options.filter(o => o !== g.value);
      if (options.length > 0) {
        g.value = rng.pick(options);
      }
      break;
    }

    case 'vector': {
      const g = result as VectorGene;
      for (let i = 0; i < g.value.length; i++) {
        const min = g.min?.[i] ?? g.value[i] - 1;
        const max = g.max?.[i] ?? g.value[i] + 1;
        const range = max - min;
        const delta = rng.nextGaussian(0, 1) * intensity * range;
        g.value[i] = clamp(g.value[i] + delta, min, max);
      }
      break;
    }

    case 'expression': {
      // Expressions are not mutated (kept stable)
      break;
    }

    case 'struct': {
      const g = result as StructGene;
      for (const [key, subGene] of Object.entries(g.value)) {
        if (subGene.mutable && rng.next() < (subGene.mutationRate ?? 0.3)) {
          g.value[key] = mutateGene(subGene, intensity, rng);
        }
      }
      break;
    }

    case 'array': {
      const g = result as ArrayGene;
      // Mutate existing elements
      for (let i = 0; i < g.value.length; i++) {
        if (g.value[i].mutable && rng.next() < (g.value[i].mutationRate ?? 0.2)) {
          g.value[i] = mutateGene(g.value[i], intensity, rng);
        }
      }
      // Possibly add/remove elements
      if (rng.next() < 0.1 && g.value.length < g.maxLength) {
        // Add random element
        const newElem = createRandomGeneOfType(g.elementType, rng);
        g.value.push(newElem);
      } else if (rng.next() < 0.1 && g.value.length > g.minLength) {
        // Remove random element
        const idx = Math.floor(rng.next() * g.value.length);
        g.value.splice(idx, 1);
      }
      break;
    }

    case 'graph': {
      const g = result as GraphGene;
      // Mutate node data
      for (const node of g.value.nodes) {
        for (const [key, subGene] of Object.entries(node.data)) {
          if (subGene.mutable && rng.next() < (subGene.mutationRate ?? 0.2)) {
            node.data[key] = mutateGene(subGene, intensity, rng);
          }
        }
      }
      // Mutate edge weights
      for (const edge of g.value.edges) {
        if (rng.next() < 0.2) {
          edge.weight = clamp(edge.weight + rng.nextGaussian(0, intensity * 0.2), 0, 1);
        }
      }
      // Possibly add/remove nodes/edges
      if (rng.next() < 0.05 && g.value.nodes.length < g.maxNodes) {
        const newNode = {
          id: `node_${Date.now()}`,
          data: {},
        };
        g.value.nodes.push(newNode);
      }
      if (rng.next() < 0.05 && g.value.edges.length < g.maxEdges && g.value.nodes.length >= 2) {
        const fromIdx = Math.floor(rng.next() * g.value.nodes.length);
        const toIdx = Math.floor(rng.next() * g.value.nodes.length);
        if (fromIdx !== toIdx) {
          g.value.edges.push({
            from: g.value.nodes[fromIdx].id,
            to: g.value.nodes[toIdx].id,
            weight: rng.next(),
          });
        }
      }
      break;
    }
  }

  return result;
}

/**
 * Create a random gene of given type
 */
function createRandomGeneOfType(type: GeneType, rng: DeterministicRNG): Gene {
  switch (type) {
    case 'scalar':
      return { type: 'scalar', value: rng.next(), min: 0, max: 1, mutable: true };
    case 'categorical':
      return { type: 'categorical', value: 'a', options: ['a', 'b', 'c'], mutable: true };
    case 'vector':
      return { type: 'vector', value: [rng.next(), rng.next()], dimensions: 2, mutable: true };
    case 'expression':
      return { type: 'expression', value: 'x', variables: ['x'], mutable: false };
    case 'struct':
      return { type: 'struct', value: {}, mutable: true };
    case 'array':
      return { type: 'array', value: [], minLength: 0, maxLength: 10, elementType: 'scalar', mutable: true };
    case 'graph':
      return { type: 'graph', value: { nodes: [], edges: [] }, maxNodes: 10, maxEdges: 20, mutable: true };
  }
}

// ============================================================================
// DISTANCE METRICS
// ============================================================================

/**
 * Compute genetic distance between two gene maps
 * Returns a value in [0, infinity), where 0 means identical
 */
export function computeGeneticDistance(mapA: GeneMap, mapB: GeneMap): number {
  let totalDistance = 0;
  let count = 0;

  const allKeys = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);

  for (const key of allKeys) {
    const geneA = mapA[key];
    const geneB = mapB[key];

    if (!geneA || !geneB) {
      totalDistance += 1;
      count += 1;
    } else {
      totalDistance += computeSingleGeneDistance(geneA, geneB);
      count += 1;
    }
  }

  return count > 0 ? totalDistance / count : 0;
}

/**
 * Compute distance between two genes
 */
function computeSingleGeneDistance(geneA: Gene, geneB: Gene): number {
  if (geneA.type !== geneB.type) {
    return 1;
  }

  switch (geneA.type) {
    case 'scalar': {
      const ga = geneA as ScalarGene;
      const gb = geneB as ScalarGene;
      const range = Math.max(ga.max - ga.min, 1);
      return Math.abs(ga.value - gb.value) / range;
    }

    case 'categorical': {
      const ga = geneA as CategoricalGene;
      const gb = geneB as CategoricalGene;
      return ga.value === gb.value ? 0 : 1;
    }

    case 'vector': {
      const ga = geneA as VectorGene;
      const gb = geneB as VectorGene;
      if (ga.dimensions !== gb.dimensions) return 1;
      let sumSq = 0;
      for (let i = 0; i < ga.dimensions; i++) {
        sumSq += Math.pow(ga.value[i] - gb.value[i], 2);
      }
      return Math.sqrt(sumSq) / Math.max(ga.dimensions, 1);
    }

    case 'expression': {
      const ga = geneA as ExpressionGene;
      const gb = geneB as ExpressionGene;
      return ga.value === gb.value ? 0 : 1;
    }

    case 'struct': {
      const ga = geneA as StructGene;
      const gb = geneB as StructGene;
      return computeGeneticDistance(ga.value, gb.value);
    }

    case 'array': {
      const ga = geneA as ArrayGene;
      const gb = geneB as ArrayGene;
      const lenDiff = Math.abs(ga.value.length - gb.value.length) / Math.max(ga.maxLength, 1);
      let elemDist = 0;
      const minLen = Math.min(ga.value.length, gb.value.length);
      for (let i = 0; i < minLen; i++) {
        elemDist += computeSingleGeneDistance(ga.value[i], gb.value[i]);
      }
      const avgElemDist = minLen > 0 ? elemDist / minLen : 0;
      return (lenDiff + avgElemDist) / 2;
    }

    case 'graph': {
      const ga = geneA as GraphGene;
      const gb = geneB as GraphGene;
      const nodeDiff = Math.abs(ga.value.nodes.length - gb.value.nodes.length) / Math.max(ga.maxNodes, 1);
      const edgeDiff = Math.abs(ga.value.edges.length - gb.value.edges.length) / Math.max(ga.maxEdges, 1);
      return (nodeDiff + edgeDiff) / 2;
    }
  }
}

// Helper import
import { ExpressionGene } from './genes.js';
