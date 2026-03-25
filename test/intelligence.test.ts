/**
 * intelligence.test.ts — Tests for the Intelligence Layer
 * Comprehensive test coverage for memory, reasoning, and agents
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EpisodicMemory,
  SemanticMemory,
  WorkingMemory,
  LongTermMemory,
  MemorySystem,
  LATS,
  ReasoningAgent,
  AgentOrchestrator,
  createSeedArchitect,
  createEvolutionStrategist,
  createFitnessCrafter,
  createQualityAssessor,
  createCompositionPlanner,
  createOptimizer,
  createCreativeDirector,
} from '../src/intelligence/index.js';
import { createSeed, scalar, categorical, vector } from '../src/kernel/index.js';

// ============================================================================
// EPISODIC MEMORY TESTS
// ============================================================================

describe('EpisodicMemory', () => {
  let memory: EpisodicMemory;

  beforeEach(() => {
    memory = new EpisodicMemory(100);
  });

  it('should record episodes', () => {
    memory.record({
      domain: 'visual2d',
      seedHash: 'seed1',
      action: 'evolution',
      outcome: 'success',
      fitness: 0.8,
      context: { step: 1 },
      tags: ['visual', 'high-fitness'],
    });

    expect(memory.size()).toBe(1);
  });

  it('should recall episodes by domain', () => {
    memory.record({
      domain: 'visual2d',
      seedHash: 'seed1',
      action: 'evolution',
      outcome: 'success',
      fitness: 0.8,
      context: {},
      tags: [],
    });

    memory.record({
      domain: 'audio',
      seedHash: 'seed2',
      action: 'evolution',
      outcome: 'success',
      fitness: 0.7,
      context: {},
      tags: [],
    });

    const visual = memory.recall({ domain: 'visual2d' });
    expect(visual).toHaveLength(1);
    expect(visual[0].domain).toBe('visual2d');
  });

  it('should recall episodes by minimum fitness', () => {
    memory.record({
      domain: 'visual2d',
      seedHash: 'seed1',
      action: 'evolution',
      outcome: 'success',
      fitness: 0.9,
      context: {},
      tags: [],
    });

    memory.record({
      domain: 'visual2d',
      seedHash: 'seed2',
      action: 'evolution',
      outcome: 'success',
      fitness: 0.3,
      context: {},
      tags: [],
    });

    const high = memory.recall({ minFitness: 0.7 });
    expect(high).toHaveLength(1);
    expect(high[0].fitness).toBe(0.9);
  });

  it('should get best episodes', () => {
    memory.record({
      domain: 'visual2d',
      seedHash: 'seed1',
      action: 'evolution',
      outcome: 'success',
      fitness: 0.5,
      context: {},
      tags: [],
    });

    memory.record({
      domain: 'visual2d',
      seedHash: 'seed2',
      action: 'evolution',
      outcome: 'success',
      fitness: 0.9,
      context: {},
      tags: [],
    });

    const best = memory.getBestEpisodes('visual2d', 1);
    expect(best).toHaveLength(1);
    expect(best[0].fitness).toBe(0.9);
  });

  it('should clear episodes', () => {
    memory.record({
      domain: 'visual2d',
      seedHash: 'seed1',
      action: 'evolution',
      outcome: 'success',
      fitness: 0.8,
      context: {},
      tags: [],
    });

    memory.clear();
    expect(memory.size()).toBe(0);
  });
});

// ============================================================================
// SEMANTIC MEMORY TESTS
// ============================================================================

describe('SemanticMemory', () => {
  let memory: SemanticMemory;

  beforeEach(() => {
    memory = new SemanticMemory();
  });

  it('should add nodes', () => {
    memory.addNode({
      id: 'gene1',
      type: 'gene',
      label: 'color',
      properties: { domain: 'visual2d' },
    });

    expect(memory.getNode('gene1')).toBeDefined();
  });

  it('should add edges between nodes', () => {
    memory.addNode({
      id: 'gene1',
      type: 'gene',
      label: 'color',
      properties: {},
    });

    memory.addNode({
      id: 'pheno1',
      type: 'phenotype',
      label: 'colored_shape',
      properties: {},
    });

    memory.addEdge({
      source: 'gene1',
      target: 'pheno1',
      relation: 'produces',
      weight: 0.9,
    });

    const related = memory.getRelated('gene1');
    expect(related).toHaveLength(1);
    expect(related[0].node.id).toBe('pheno1');
  });

  it('should query nodes by type', () => {
    memory.addNode({
      id: 'gene1',
      type: 'gene',
      label: 'color',
      properties: {},
    });

    memory.addNode({
      id: 'gene2',
      type: 'gene',
      label: 'size',
      properties: {},
    });

    const genes = memory.query('gene');
    expect(genes).toHaveLength(2);
  });

  it('should find paths between nodes', () => {
    memory.addNode({
      id: 'n1',
      type: 'gene',
      label: 'a',
      properties: {},
    });

    memory.addNode({
      id: 'n2',
      type: 'gene',
      label: 'b',
      properties: {},
    });

    memory.addNode({
      id: 'n3',
      type: 'gene',
      label: 'c',
      properties: {},
    });

    memory.addEdge({
      source: 'n1',
      target: 'n2',
      relation: 'produces',
      weight: 1,
    });

    memory.addEdge({
      source: 'n2',
      target: 'n3',
      relation: 'produces',
      weight: 1,
    });

    const path = memory.findPath('n1', 'n3');
    expect(path.length).toBeGreaterThan(0);
    expect(path[0].id).toBe('n1');
  });

  it('should report size', () => {
    memory.addNode({
      id: 'n1',
      type: 'gene',
      label: 'a',
      properties: {},
    });

    memory.addNode({
      id: 'n2',
      type: 'gene',
      label: 'b',
      properties: {},
    });

    const size = memory.size();
    expect(size.nodes).toBe(2);
  });
});

// ============================================================================
// WORKING MEMORY TESTS
// ============================================================================

describe('WorkingMemory', () => {
  let memory: WorkingMemory;

  beforeEach(() => {
    memory = new WorkingMemory(5);
  });

  it('should set and get values', () => {
    memory.set('key1', 'value1');
    expect(memory.get('key1')).toBe('value1');
  });

  it('should respect priority when compacting', () => {
    memory.set('k1', 'v1', 0.1);
    memory.set('k2', 'v2', 0.9);
    memory.set('k3', 'v3', 0.5);
    memory.set('k4', 'v4', 0.8);
    memory.set('k5', 'v5', 0.2);
    memory.set('k6', 'v6', 0.7); // Trigger compaction

    // Should keep high-priority items
    expect(memory.has('k2')).toBe(true);
    expect(memory.has('k4')).toBe(true);
  });

  it('should check existence', () => {
    memory.set('key1', 'value1');
    expect(memory.has('key1')).toBe(true);
    expect(memory.has('key2')).toBe(false);
  });

  it('should remove values', () => {
    memory.set('key1', 'value1');
    memory.remove('key1');
    expect(memory.has('key1')).toBe(false);
  });

  it('should get all values', () => {
    memory.set('k1', 'v1');
    memory.set('k2', 'v2');
    const all = memory.getAll();
    expect(Object.keys(all).length).toBeGreaterThanOrEqual(2);
  });

  it('should clear all', () => {
    memory.set('k1', 'v1');
    memory.clear();
    expect(memory.size()).toBe(0);
  });
});

// ============================================================================
// LONG-TERM MEMORY TESTS
// ============================================================================

describe('LongTermMemory', () => {
  let memory: LongTermMemory;

  beforeEach(() => {
    memory = new LongTermMemory();
  });

  it('should store and retrieve seeds', () => {
    const seed = createSeed('visual2d', 'test-seed', {
      color: scalar(0.5, 0, 1),
    });

    memory.store({
      seed,
      tags: ['test'],
      description: 'A test seed',
    });

    const retrieved = memory.retrieve(seed.$hash);
    expect(retrieved).toBeDefined();
    expect(retrieved?.seed.$hash).toBe(seed.$hash);
  });

  it('should search by domain', () => {
    const seed1 = createSeed('visual2d', 'seed1', {
      color: scalar(0.5, 0, 1),
    });

    const seed2 = createSeed('audio', 'seed2', {
      frequency: scalar(440, 20, 20000),
    });

    memory.store({ seed: seed1, tags: [], description: '' });
    memory.store({ seed: seed2, tags: [], description: '' });

    const visual = memory.search({ domain: 'visual2d' });
    expect(visual).toHaveLength(1);
    expect(visual[0].seed.$domain).toBe('visual2d');
  });

  it('should search by tags', () => {
    const seed1 = createSeed('visual2d', 'seed1', {
      color: scalar(0.5, 0, 1),
    });

    memory.store({ seed: seed1, tags: ['high-quality', 'visual'], description: '' });

    const found = memory.search({ tags: ['high-quality'] });
    expect(found).toHaveLength(1);
  });

  it('should track usage', () => {
    const seed = createSeed('visual2d', 'seed1', {
      color: scalar(0.5, 0, 1),
    });

    memory.store({ seed, tags: [], description: '' });
    memory.recordUse(seed.$hash, 0.9);
    memory.recordUse(seed.$hash, 0.85);

    const entry = memory.retrieve(seed.$hash);
    expect(entry?.useCount).toBe(2);
    // First: avgFitness = 0, then (0 * 0 + 0.9) / 1 = 0.9
    // Second: avgFitness = 0.9, then (0.9 * 1 + 0.85) / 2 = 1.75/2 = 0.875
    expect(entry?.avgFitness).toBeCloseTo(0.875);
  });

  it('should get most used seeds', () => {
    const seed1 = createSeed('visual2d', 'seed1', {
      color: scalar(0.5, 0, 1),
    });

    const seed2 = createSeed('visual2d', 'seed2', {
      color: scalar(0.6, 0, 1),
    });

    memory.store({ seed: seed1, tags: [], description: '' });
    memory.store({ seed: seed2, tags: [], description: '' });

    memory.recordUse(seed1.$hash, 0.8);
    memory.recordUse(seed1.$hash, 0.9);
    memory.recordUse(seed2.$hash, 0.7);

    const mostUsed = memory.getMostUsed(1);
    expect(mostUsed[0].seed.$hash).toBe(seed1.$hash);
  });
});

// ============================================================================
// MEMORY SYSTEM TESTS
// ============================================================================

describe('MemorySystem', () => {
  let system: MemorySystem;

  beforeEach(() => {
    system = new MemorySystem();
  });

  it('should learn from evolution', () => {
    const seed = createSeed('visual2d', 'seed1', {
      color: scalar(0.5, 0, 1),
    });

    system.learnFromEvolution(seed, 0.85, { generation: 1 });

    expect(system.episodic.size()).toBeGreaterThan(0);
  });

  it('should suggest high-fitness seeds', () => {
    const seed = createSeed('visual2d', 'seed1', {
      color: scalar(0.5, 0, 1),
    });

    system.learnFromEvolution(seed, 0.9, {});

    const suggested = system.suggestSeed('visual2d');
    expect(suggested).toBeDefined();
  });

  it('should maintain working context', () => {
    system.learnFromEvolution(
      createSeed('audio', 'seed1', { freq: scalar(440, 20, 20000) }),
      0.8,
      { step: 1 }
    );

    const context = system.getContext();
    expect(Object.keys(context).length).toBeGreaterThan(0);
  });
});

// ============================================================================
// LATS TESTS
// ============================================================================

describe('LATS', () => {
  let lats: LATS;

  beforeEach(() => {
    lats = new LATS();
  });

  it('should initialize with root node', () => {
    const rootId = lats.initialize([
      {
        type: 'thought',
        content: 'test',
        timestamp: Date.now(),
      },
    ]);

    expect(rootId).toBeDefined();
    expect(lats.getRoot()).toBeDefined();
  });

  it('should expand nodes', () => {
    const rootId = lats.initialize([
      {
        type: 'thought',
        content: 'test',
        timestamp: Date.now(),
      },
    ]);

    const childIds = lats.expand(rootId, [
      {
        action: 'action1',
        newSteps: [
          {
            type: 'action',
            content: 'do something',
            timestamp: Date.now(),
          },
        ],
      },
    ]);

    expect(childIds).toHaveLength(1);
  });

  it('should backpropagate rewards', () => {
    const rootId = lats.initialize([
      {
        type: 'thought',
        content: 'test',
        timestamp: Date.now(),
      },
    ]);

    const childIds = lats.expand(rootId, [
      {
        action: 'action1',
        newSteps: [
          {
            type: 'action',
            content: 'test',
            timestamp: Date.now(),
          },
        ],
      },
    ]);

    lats.backpropagate(childIds[0], 0.8);

    const child = lats.getNode(childIds[0]);
    expect(child?.visits).toBe(1);
    expect(child?.reward).toBe(0.8);
  });

  it('should find best path', () => {
    const rootId = lats.initialize([
      {
        type: 'thought',
        content: 'test',
        timestamp: Date.now(),
      },
    ]);

    const childIds = lats.expand(rootId, [
      {
        action: 'action1',
        newSteps: [
          {
            type: 'action',
            content: 'test',
            timestamp: Date.now(),
          },
        ],
      },
    ]);

    lats.backpropagate(childIds[0], 0.9);

    const path = lats.bestPath();
    expect(path.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// REASONING AGENT TESTS
// ============================================================================

describe('ReasoningAgent', () => {
  let memory: MemorySystem;
  let agent: ReasoningAgent;

  beforeEach(() => {
    memory = new MemorySystem();
    agent = new ReasoningAgent(memory);
  });

  it('should perform ReAct reasoning', () => {
    agent.registerAction({
      name: 'test-action',
      description: 'A test action',
      execute: () => ({
        success: true,
        output: 'success',
        observation: 'Action succeeded',
      }),
    });

    const result = agent.reason('Achieve goal', 'visual2d');

    expect(result).toBeDefined();
    expect(result.totalSteps).toBeGreaterThan(0);
    expect(result.steps.length).toBeGreaterThanOrEqual(result.totalSteps);
  });

  it('should plan with LATS', () => {
    agent.registerAction({
      name: 'action1',
      description: 'Test action 1',
      execute: () => ({
        success: true,
        output: null,
        observation: 'Done',
      }),
    });

    const plan = agent.plan('Test goal', 'visual2d', 10);

    expect(plan).toBeDefined();
    expect(plan.confidence).toBeGreaterThanOrEqual(0);
    expect(plan.searchNodesExplored).toBeGreaterThan(0);
  });

  it('should reflect on results', () => {
    const result = {
      steps: [
        { type: 'thought' as const, content: 'test', timestamp: Date.now() },
        { type: 'action' as const, content: 'test', timestamp: Date.now() },
      ],
      success: true,
      output: null,
      totalSteps: 2,
      reasoning: 'Test',
    };

    const reflection = agent.reflect(result);

    expect(reflection.insights).toHaveLength(1);
    expect(reflection.lessonsLearned).toHaveLength(1);
  });
});

// ============================================================================
// ORCHESTRATOR TESTS
// ============================================================================

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator;
  let memory: MemorySystem;

  beforeEach(() => {
    memory = new MemorySystem();
    orchestrator = new AgentOrchestrator(memory);

    orchestrator.register(createSeedArchitect(memory));
    orchestrator.register(createEvolutionStrategist(memory));
    orchestrator.register(createFitnessCrafter(memory));
    orchestrator.register(createQualityAssessor(memory));
  });

  it('should route requests to agents', () => {
    const response = orchestrator.route({
      intent: 'create-schema',
      domain: 'seed-design',
      parameters: { description: 'Test schema' },
      context: {},
    });

    expect(response.success).toBe(true);
  });

  it('should list available agents', () => {
    const agents = orchestrator.list();
    expect(agents.length).toBeGreaterThan(0);
  });

  it('should collaborate between agents', () => {
    const response = orchestrator.collaborate(
      {
        intent: 'test',
        parameters: {},
        context: {},
      },
      ['SeedArchitect', 'EvolutionStrategist']
    );

    expect(Array.isArray(response.result)).toBe(true);
  });
});

// ============================================================================
// SUB-AGENT TESTS
// ============================================================================

describe('Sub-Agents', () => {
  let memory: MemorySystem;

  beforeEach(() => {
    memory = new MemorySystem();
  });

  it('SeedArchitect should create schema', () => {
    const architect = createSeedArchitect(memory);

    const response = architect.process({
      intent: 'create-schema',
      parameters: { description: 'Test', complexity: 0.5 },
      context: {},
    });

    expect(response.success).toBe(true);
    expect(response.result).toBeDefined();
  });

  it('EvolutionStrategist should recommend strategy', () => {
    const strategist = createEvolutionStrategist(memory);

    const response = strategist.process({
      intent: 'recommend-strategy',
      parameters: { goal: 'optimize', budget: 500 },
      context: {},
    });

    expect(response.success).toBe(true);
    expect(response.result).toBeDefined();
  });

  it('FitnessCrafter should create fitness function', () => {
    const crafter = createFitnessCrafter(memory);

    const response = crafter.process({
      intent: 'create-fitness',
      parameters: { objectives: ['beauty', 'efficiency', 'novelty'] },
      context: {},
    });

    expect(response.success).toBe(true);
  });

  it('QualityAssessor should assess quality', () => {
    const assessor = createQualityAssessor(memory);

    const response = assessor.process({
      intent: 'assess-quality',
      parameters: { artifact: {}, criteria: ['clarity', 'completeness'] },
      context: {},
    });

    expect(response.success).toBe(true);
  });

  it('CompositionPlanner should plan composition', () => {
    const planner = createCompositionPlanner(memory);

    const seed1 = createSeed('visual2d', 'seed1', {
      color: scalar(0.5, 0, 1),
    });

    const response = planner.process({
      intent: 'plan-composition',
      parameters: { seeds: [seed1], strategy: 'layer' },
      context: {},
    });

    expect(response.success).toBe(true);
  });

  it('Optimizer should profile performance', () => {
    const optimizer = createOptimizer(memory);

    const response = optimizer.process({
      intent: 'profile',
      parameters: {},
      context: {},
    });

    expect(response.success).toBe(true);
  });

  it('CreativeDirector should set theme', () => {
    const director = createCreativeDirector(memory);

    const response = director.process({
      intent: 'set-theme',
      parameters: { mood: 'energetic', aesthetic: 'futuristic' },
      context: {},
    });

    expect(response.success).toBe(true);
  });
});
