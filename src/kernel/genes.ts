/**
 * genes.ts — The 7 Gene Types
 * Every parameter in a seed is a typed gene. This module defines the gene type system
 * and factory functions for creating, validating, and manipulating genes.
 */

// ============================================================================
// GENE TYPE DISCRIMINATOR & BASE INTERFACE
// ============================================================================

export type GeneType = 'scalar' | 'categorical' | 'vector' | 'expression' | 'struct' | 'array' | 'graph';

export interface GeneBase {
  type: GeneType;
  mutable: boolean;
  mutationRate?: number;
}

// ============================================================================
// INDIVIDUAL GENE INTERFACES
// ============================================================================

export interface ScalarGene extends GeneBase {
  type: 'scalar';
  value: number;
  min: number;
  max: number;
  distribution?: 'uniform' | 'gaussian' | 'exponential';
}

export interface CategoricalGene extends GeneBase {
  type: 'categorical';
  value: string;
  options: string[];
}

export interface VectorGene extends GeneBase {
  type: 'vector';
  value: number[];
  dimensions: number;
  min?: number[];
  max?: number[];
}

export interface ExpressionGene extends GeneBase {
  type: 'expression';
  value: string;
  variables: string[];
}

export interface StructGene extends GeneBase {
  type: 'struct';
  value: GeneMap;
}

export interface ArrayGene extends GeneBase {
  type: 'array';
  value: Gene[];
  minLength: number;
  maxLength: number;
  elementType: GeneType;
}

export interface GraphGene extends GeneBase {
  type: 'graph';
  value: {
    nodes: Array<{ id: string; data: GeneMap }>;
    edges: Array<{ from: string; to: string; weight: number }>;
  };
  maxNodes: number;
  maxEdges: number;
}

// ============================================================================
// UNION TYPE & GENE MAP
// ============================================================================

export type Gene = ScalarGene | CategoricalGene | VectorGene | ExpressionGene | StructGene | ArrayGene | GraphGene;
export type GeneMap = Record<string, Gene>;

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function scalar(
  value: number,
  min: number,
  max: number,
  opts?: {
    mutable?: boolean;
    mutationRate?: number;
    distribution?: 'uniform' | 'gaussian' | 'exponential';
  }
): ScalarGene {
  return {
    type: 'scalar',
    value: Math.max(min, Math.min(max, value)),
    min,
    max,
    mutable: opts?.mutable ?? true,
    mutationRate: opts?.mutationRate,
    distribution: opts?.distribution ?? 'uniform',
  };
}

export function categorical(
  value: string,
  options: string[],
  opts?: {
    mutable?: boolean;
    mutationRate?: number;
  }
): CategoricalGene {
  if (!options.includes(value)) {
    throw new Error(`Value "${value}" not in options: ${options.join(', ')}`);
  }
  return {
    type: 'categorical',
    value,
    options: [...options],
    mutable: opts?.mutable ?? true,
    mutationRate: opts?.mutationRate,
  };
}

export function vector(
  values: number[],
  opts?: {
    mutable?: boolean;
    mutationRate?: number;
    min?: number[];
    max?: number[];
  }
): VectorGene {
  const dimensions = values.length;
  const min = opts?.min;
  const max = opts?.max;

  // Clamp values to bounds if provided
  const clampedValues = values.map((v, i) => {
    let clamped = v;
    if (min && min[i] !== undefined) clamped = Math.max(min[i], clamped);
    if (max && max[i] !== undefined) clamped = Math.min(max[i], clamped);
    return clamped;
  });

  return {
    type: 'vector',
    value: clampedValues,
    dimensions,
    mutable: opts?.mutable ?? true,
    mutationRate: opts?.mutationRate,
    min,
    max,
  };
}

export function expression(
  value: string,
  variables: string[],
  opts?: {
    mutable?: boolean;
    mutationRate?: number;
  }
): ExpressionGene {
  return {
    type: 'expression',
    value,
    variables: [...variables],
    mutable: opts?.mutable ?? false,
    mutationRate: opts?.mutationRate ?? 0,
  };
}

export function struct(
  genes: GeneMap,
  opts?: {
    mutable?: boolean;
    mutationRate?: number;
  }
): StructGene {
  return {
    type: 'struct',
    value: { ...genes },
    mutable: opts?.mutable ?? true,
    mutationRate: opts?.mutationRate,
  };
}

export function array(
  genes: Gene[],
  minLength: number,
  maxLength: number,
  elementType: GeneType,
  opts?: {
    mutable?: boolean;
    mutationRate?: number;
  }
): ArrayGene {
  return {
    type: 'array',
    value: [...genes],
    minLength,
    maxLength,
    elementType,
    mutable: opts?.mutable ?? true,
    mutationRate: opts?.mutationRate,
  };
}

export function graph(
  nodes: Array<{ id: string; data: GeneMap }>,
  edges: Array<{ from: string; to: string; weight: number }>,
  maxNodes: number,
  maxEdges: number,
  opts?: {
    mutable?: boolean;
    mutationRate?: number;
  }
): GraphGene {
  return {
    type: 'graph',
    value: {
      nodes: nodes.map(n => ({ id: n.id, data: { ...n.data } })),
      edges: edges.map(e => ({ ...e })),
    },
    maxNodes,
    maxEdges,
    mutable: opts?.mutable ?? true,
    mutationRate: opts?.mutationRate,
  };
}

// ============================================================================
// VALIDATION & MANIPULATION
// ============================================================================

export function validateGene(gene: Gene): string[] {
  const errors: string[] = [];

  switch (gene.type) {
    case 'scalar': {
      const g = gene as ScalarGene;
      if (g.value < g.min || g.value > g.max) {
        errors.push(`Scalar value ${g.value} out of bounds [${g.min}, ${g.max}]`);
      }
      if (!['uniform', 'gaussian', 'exponential'].includes(g.distribution ?? 'uniform')) {
        errors.push(`Unknown scalar distribution: ${g.distribution}`);
      }
      break;
    }

    case 'categorical': {
      const g = gene as CategoricalGene;
      if (!g.options.includes(g.value)) {
        errors.push(`Categorical value "${g.value}" not in options`);
      }
      if (g.options.length === 0) {
        errors.push('Categorical gene must have at least one option');
      }
      break;
    }

    case 'vector': {
      const g = gene as VectorGene;
      if (g.value.length !== g.dimensions) {
        errors.push(`Vector length ${g.value.length} does not match dimensions ${g.dimensions}`);
      }
      if (g.min && g.min.length !== g.dimensions) {
        errors.push(`Vector min bounds length does not match dimensions`);
      }
      if (g.max && g.max.length !== g.dimensions) {
        errors.push(`Vector max bounds length does not match dimensions`);
      }
      if (g.min && g.max) {
        for (let i = 0; i < g.dimensions; i++) {
          if (g.min[i] > g.max[i]) {
            errors.push(`Vector dimension ${i}: min > max`);
          }
          if (g.value[i] < g.min[i] || g.value[i] > g.max[i]) {
            errors.push(`Vector dimension ${i}: value out of bounds`);
          }
        }
      }
      break;
    }

    case 'expression': {
      const g = gene as ExpressionGene;
      if (typeof g.value !== 'string' || g.value.length === 0) {
        errors.push('Expression gene must have non-empty string value');
      }
      if (!Array.isArray(g.variables)) {
        errors.push('Expression gene must have variables array');
      }
      break;
    }

    case 'struct': {
      const g = gene as StructGene;
      if (typeof g.value !== 'object' || g.value === null) {
        errors.push('Struct gene value must be an object');
      }
      for (const [key, subGene] of Object.entries(g.value)) {
        const subErrors = validateGene(subGene);
        errors.push(...subErrors.map(e => `struct.${key}: ${e}`));
      }
      break;
    }

    case 'array': {
      const g = gene as ArrayGene;
      if (g.value.length < g.minLength || g.value.length > g.maxLength) {
        errors.push(
          `Array length ${g.value.length} outside bounds [${g.minLength}, ${g.maxLength}]`
        );
      }
      if (g.minLength < 0 || g.maxLength < g.minLength) {
        errors.push(`Invalid array bounds: min=${g.minLength}, max=${g.maxLength}`);
      }
      for (let i = 0; i < g.value.length; i++) {
        if (g.value[i].type !== g.elementType) {
          errors.push(`Array element ${i} type ${g.value[i].type} does not match elementType ${g.elementType}`);
        }
        const elemErrors = validateGene(g.value[i]);
        errors.push(...elemErrors.map(e => `array[${i}]: ${e}`));
      }
      break;
    }

    case 'graph': {
      const g = gene as GraphGene;
      if (g.value.nodes.length > g.maxNodes) {
        errors.push(`Graph nodes ${g.value.nodes.length} exceeds maxNodes ${g.maxNodes}`);
      }
      if (g.value.edges.length > g.maxEdges) {
        errors.push(`Graph edges ${g.value.edges.length} exceeds maxEdges ${g.maxEdges}`);
      }
      const nodeIds = new Set(g.value.nodes.map(n => n.id));
      for (const edge of g.value.edges) {
        if (!nodeIds.has(edge.from)) {
          errors.push(`Graph edge references non-existent source node: ${edge.from}`);
        }
        if (!nodeIds.has(edge.to)) {
          errors.push(`Graph edge references non-existent target node: ${edge.to}`);
        }
      }
      for (const node of g.value.nodes) {
        for (const [key, subGene] of Object.entries(node.data)) {
          const subErrors = validateGene(subGene);
          errors.push(...subErrors.map(e => `graph.node[${node.id}].${key}: ${e}`));
        }
      }
      break;
    }
  }

  if (typeof gene.mutable !== 'boolean') {
    errors.push('Gene must have boolean mutable field');
  }

  if (gene.mutationRate !== undefined && (gene.mutationRate < 0 || gene.mutationRate > 1)) {
    errors.push(`Gene mutationRate ${gene.mutationRate} must be in [0, 1]`);
  }

  return errors;
}

export function cloneGene(gene: Gene): Gene {
  switch (gene.type) {
    case 'scalar': {
      const g = gene as ScalarGene;
      return {
        ...g,
        min: g.min,
        max: g.max,
      };
    }

    case 'categorical': {
      const g = gene as CategoricalGene;
      return {
        ...g,
        options: [...g.options],
      };
    }

    case 'vector': {
      const g = gene as VectorGene;
      return {
        ...g,
        value: [...g.value],
        min: g.min ? [...g.min] : undefined,
        max: g.max ? [...g.max] : undefined,
      };
    }

    case 'expression': {
      const g = gene as ExpressionGene;
      return {
        ...g,
        variables: [...g.variables],
      };
    }

    case 'struct': {
      const g = gene as StructGene;
      const clonedValue: GeneMap = {};
      for (const [key, subGene] of Object.entries(g.value)) {
        clonedValue[key] = cloneGene(subGene);
      }
      return {
        ...g,
        value: clonedValue,
      };
    }

    case 'array': {
      const g = gene as ArrayGene;
      return {
        ...g,
        value: g.value.map(e => cloneGene(e)),
      };
    }

    case 'graph': {
      const g = gene as GraphGene;
      return {
        ...g,
        value: {
          nodes: g.value.nodes.map(n => ({
            id: n.id,
            data: (() => {
              const clonedData: GeneMap = {};
              for (const [key, subGene] of Object.entries(n.data)) {
                clonedData[key] = cloneGene(subGene);
              }
              return clonedData;
            })(),
          })),
          edges: g.value.edges.map(e => ({ ...e })),
        },
      };
    }
  }
}

export function geneEquals(a: Gene, b: Gene): boolean {
  if (a.type !== b.type) return false;
  if (a.mutable !== b.mutable) return false;
  if ((a.mutationRate ?? 0) !== (b.mutationRate ?? 0)) return false;

  switch (a.type) {
    case 'scalar': {
      const ga = a as ScalarGene;
      const gb = b as ScalarGene;
      return (
        ga.value === gb.value &&
        ga.min === gb.min &&
        ga.max === gb.max &&
        (ga.distribution ?? 'uniform') === (gb.distribution ?? 'uniform')
      );
    }

    case 'categorical': {
      const ga = a as CategoricalGene;
      const gb = b as CategoricalGene;
      return (
        ga.value === gb.value &&
        ga.options.length === gb.options.length &&
        ga.options.every((opt, i) => opt === gb.options[i])
      );
    }

    case 'vector': {
      const ga = a as VectorGene;
      const gb = b as VectorGene;
      return (
        ga.dimensions === gb.dimensions &&
        ga.value.length === gb.value.length &&
        ga.value.every((v, i) => v === gb.value[i]) &&
        (ga.min?.length ?? 0) === (gb.min?.length ?? 0) &&
        (ga.min?.every((v, i) => v === (gb.min?.[i] ?? v)) ?? true) &&
        (ga.max?.length ?? 0) === (gb.max?.length ?? 0) &&
        (ga.max?.every((v, i) => v === (gb.max?.[i] ?? v)) ?? true)
      );
    }

    case 'expression': {
      const ga = a as ExpressionGene;
      const gb = b as ExpressionGene;
      return (
        ga.value === gb.value &&
        ga.variables.length === gb.variables.length &&
        ga.variables.every((v, i) => v === gb.variables[i])
      );
    }

    case 'struct': {
      const ga = a as StructGene;
      const gb = b as StructGene;
      const keysA = Object.keys(ga.value);
      const keysB = Object.keys(gb.value);
      if (keysA.length !== keysB.length) return false;
      return keysA.every(key => geneEquals(ga.value[key], gb.value[key]));
    }

    case 'array': {
      const ga = a as ArrayGene;
      const gb = b as ArrayGene;
      return (
        ga.minLength === gb.minLength &&
        ga.maxLength === gb.maxLength &&
        ga.elementType === gb.elementType &&
        ga.value.length === gb.value.length &&
        ga.value.every((g, i) => geneEquals(g, gb.value[i]))
      );
    }

    case 'graph': {
      const ga = a as GraphGene;
      const gb = b as GraphGene;
      if (
        ga.maxNodes !== gb.maxNodes ||
        ga.maxEdges !== gb.maxEdges ||
        ga.value.nodes.length !== gb.value.nodes.length ||
        ga.value.edges.length !== gb.value.edges.length
      ) {
        return false;
      }
      // Check nodes
      const nodesMatch = ga.value.nodes.every(nodeA => {
        const nodeB = gb.value.nodes.find(n => n.id === nodeA.id);
        if (!nodeB) return false;
        const keysA = Object.keys(nodeA.data);
        const keysB = Object.keys(nodeB.data);
        if (keysA.length !== keysB.length) return false;
        return keysA.every(key => geneEquals(nodeA.data[key], nodeB.data[key]));
      });
      if (!nodesMatch) return false;
      // Check edges
      return ga.value.edges.every(edgeA => {
        const edgeB = gb.value.edges.find(e => e.from === edgeA.from && e.to === edgeA.to);
        if (!edgeB) return false;
        return edgeA.weight === edgeB.weight;
      });
    }
  }
}

export function cloneGeneMap(geneMap: GeneMap): GeneMap {
  const result: GeneMap = {};
  for (const [key, gene] of Object.entries(geneMap)) {
    result[key] = cloneGene(gene);
  }
  return result;
}
