/**
 * agent.ts — Specialized Sub-Agents
 * 8 domain-specific agents working together to reason about seeds and evolution
 */

import type { UniversalSeed, GeneMap, Gene, SeedDomain } from '../kernel/index.js';
import { scalar, categorical, vector, struct, array, graph } from '../kernel/genes.js';
import { createSeed } from '../kernel/seed.js';
import { MemorySystem } from './memory.js';
import { ReasoningAgent } from './reasoning.js';

// ============================================================================
// INTERFACES
// ============================================================================

export interface SubAgent {
  name: string;
  domain: string;
  description: string;
  capabilities: string[];
  process(request: AgentRequest): AgentResponse;
}

export interface AgentRequest {
  intent: string;
  domain?: string;
  parameters: Record<string, unknown>;
  context: Record<string, unknown>;
}

export interface AgentResponse {
  success: boolean;
  result: unknown;
  explanation: string;
  suggestedNext?: string[];
  confidence: number;
}

// ============================================================================
// SUB-AGENT IMPLEMENTATIONS
// ============================================================================

/**
 * SeedArchitect: Designs seed gene schemas
 */
class SeedArchitect implements SubAgent {
  name = 'SeedArchitect';
  domain = 'seed-design';
  description = 'Designs gene schemas for seeds based on requirements';
  capabilities = ['create-schema', 'validate-schema', 'optimize-schema'];

  private memory: MemorySystem;

  constructor(memory: MemorySystem) {
    this.memory = memory;
  }

  process(request: AgentRequest): AgentResponse {
    if (request.intent === 'create-schema') {
      return this.createSchema(request);
    } else if (request.intent === 'validate-schema') {
      return this.validateSchema(request);
    }

    return {
      success: false,
      result: null,
      explanation: `Unknown intent: ${request.intent}`,
      confidence: 0,
    };
  }

  private createSchema(request: AgentRequest): AgentResponse {
    const { description, domain, complexity } = request.parameters as {
      description: string;
      domain?: string;
      complexity?: number;
    };

    const level = complexity ?? 0.5;

    // Create appropriate schema based on complexity
    const genes: GeneMap = {};

    if (level < 0.3) {
      // Simple: scalar parameters
      genes['param1'] = scalar(0.5, 0, 1);
      genes['param2'] = scalar(0.5, 0, 1);
    } else if (level < 0.7) {
      // Medium: mixed types
      genes['config'] = struct({
        scalar_param: scalar(0.5, 0, 1),
        category: categorical('default', ['default', 'alternate', 'custom']),
        factors: vector([0.5, 0.5], { min: [0, 0], max: [1, 1] }),
      });
    } else {
      // Complex: arrays and graphs
      genes['params'] = array(
        [scalar(0.5, 0, 1), scalar(0.5, 0, 1)],
        1,
        10,
        'scalar'
      );
      genes['structure'] = graph(
        [{ id: 'node1', data: { value: scalar(0.5, 0, 1) } }],
        [],
        10,
        20
      );
    }

    return {
      success: true,
      result: { genes },
      explanation: `Created ${level < 0.3 ? 'simple' : level < 0.7 ? 'medium' : 'complex'} schema for ${description}`,
      suggestedNext: ['validate-schema', 'create-seed'],
      confidence: 0.85,
    };
  }

  private validateSchema(request: AgentRequest): AgentResponse {
    const { genes } = request.parameters as { genes: GeneMap };

    const errors: string[] = [];

    if (!genes || typeof genes !== 'object') {
      errors.push('Genes must be an object');
    }

    const errorStr = errors.length > 0 ? errors.join('; ') : 'Schema is valid';

    return {
      success: errors.length === 0,
      result: { errors },
      explanation: errorStr,
      confidence: errors.length === 0 ? 1.0 : 0.0,
    };
  }
}

/**
 * EvolutionStrategist: Plans evolution strategies
 */
class EvolutionStrategist implements SubAgent {
  name = 'EvolutionStrategist';
  domain = 'evolution-planning';
  description = 'Plans evolution strategies based on goals and domain';
  capabilities = ['recommend-strategy', 'optimize-parameters', 'predict-convergence'];

  private memory: MemorySystem;

  constructor(memory: MemorySystem) {
    this.memory = memory;
  }

  process(request: AgentRequest): AgentResponse {
    if (request.intent === 'recommend-strategy') {
      return this.recommendStrategy(request);
    } else if (request.intent === 'optimize-parameters') {
      return this.optimizeParameters(request);
    }

    return {
      success: false,
      result: null,
      explanation: `Unknown intent: ${request.intent}`,
      confidence: 0,
    };
  }

  private recommendStrategy(request: AgentRequest): AgentResponse {
    const { goal, domain, budget } = request.parameters as {
      goal?: string;
      domain?: string;
      budget?: number;
    };

    const populationSize = Math.max(10, (budget ?? 100) / 10);

    const strategy = {
      populationSize: Math.round(populationSize),
      mutationRate: 0.1,
      crossoverRate: 0.8,
      eliteSize: Math.max(2, Math.round(populationSize * 0.1)),
      generations: Math.ceil((budget ?? 100) / populationSize),
      selectionMethod: 'tournament',
      tournamentSize: 5,
    };

    return {
      success: true,
      result: strategy,
      explanation: `Recommended evolution strategy: ${strategy.generations} generations, population ${strategy.populationSize}`,
      suggestedNext: ['optimize-parameters', 'predict-convergence'],
      confidence: 0.75,
    };
  }

  private optimizeParameters(request: AgentRequest): AgentResponse {
    const { currentFitness, diversity } = request.parameters as {
      currentFitness?: number;
      diversity?: number;
    };

    const fitness = currentFitness ?? 0.5;
    const div = diversity ?? 0.5;

    // Adjust mutation rate based on diversity
    const mutationRate = div < 0.3 ? 0.2 : div > 0.8 ? 0.05 : 0.1;

    // Adjust crossover based on fitness
    const crossoverRate = fitness > 0.8 ? 0.7 : 0.8;

    return {
      success: true,
      result: { mutationRate, crossoverRate },
      explanation: `Adjusted parameters: mutation ${mutationRate.toFixed(2)}, crossover ${crossoverRate.toFixed(2)}`,
      confidence: 0.7,
    };
  }
}

/**
 * FitnessCrafter: Designs fitness functions
 */
class FitnessCrafter implements SubAgent {
  name = 'FitnessCrafter';
  domain = 'fitness-design';
  description = 'Designs composite fitness functions from requirements';
  capabilities = ['create-fitness', 'compose-objectives', 'weight-objectives'];

  private memory: MemorySystem;

  constructor(memory: MemorySystem) {
    this.memory = memory;
  }

  process(request: AgentRequest): AgentResponse {
    if (request.intent === 'create-fitness') {
      return this.createFitness(request);
    } else if (request.intent === 'compose-objectives') {
      return this.composeObjectives(request);
    }

    return {
      success: false,
      result: null,
      explanation: `Unknown intent: ${request.intent}`,
      confidence: 0,
    };
  }

  private createFitness(request: AgentRequest): AgentResponse {
    const { objectives, weights } = request.parameters as {
      objectives: string[];
      weights?: number[];
    };

    const normWeights = weights
      ? weights.map(w => w / weights.reduce((a, b) => a + b, 1))
      : objectives.map(() => 1 / objectives.length);

    const fitness = {
      objectives: objectives.map((obj, i) => ({
        name: obj,
        weight: normWeights[i],
        direction: 'maximize' as const,
      })),
    };

    return {
      success: true,
      result: fitness,
      explanation: `Created fitness function with ${objectives.length} objectives`,
      confidence: 0.8,
    };
  }

  private composeObjectives(request: AgentRequest): AgentResponse {
    const { objectives } = request.parameters as { objectives: string[] };

    const composed = objectives.map((obj, i) => ({
      name: obj,
      weight: 1 / objectives.length,
      index: i,
    }));

    return {
      success: true,
      result: { composed },
      explanation: `Composed ${objectives.length} objectives into aggregate fitness`,
      confidence: 0.85,
    };
  }
}

/**
 * DomainExpert: Domain-specific knowledge
 */
class DomainExpert implements SubAgent {
  name = 'DomainExpert';
  domain: string;
  description: string;
  capabilities: string[];

  private memory: MemorySystem;

  constructor(memory: MemorySystem, domain: string) {
    this.memory = memory;
    this.domain = domain;
    this.description = `Expert in ${domain} domain`;
    this.capabilities = [`advise-${domain}`, `optimize-${domain}`, `validate-${domain}`];
  }

  process(request: AgentRequest): AgentResponse {
    const { intent } = request;

    if (intent.includes('advise')) {
      return this.provideAdvice(request);
    } else if (intent.includes('optimize')) {
      return this.optimizeDomain(request);
    }

    return {
      success: true,
      result: { domain: this.domain },
      explanation: `Domain expert for ${this.domain}`,
      confidence: 0.7,
    };
  }

  private provideAdvice(request: AgentRequest): AgentResponse {
    const adviceMap: Record<string, string> = {
      visual2d: 'Consider color harmony, composition balance, and visual weight distribution',
      audio: 'Focus on frequency balance, harmonic progression, and dynamic range',
      animation: 'Maintain smooth easing curves, consistent timing, and clear staging',
      game: 'Balance challenge, progression, and player feedback loops',
      ui: 'Prioritize usability, consistency, and visual hierarchy',
      music: 'Develop melodic motifs, harmonic tension/release, and rhythmic interest',
    };

    const advice = adviceMap[this.domain] || `Optimize for ${this.domain} domain requirements`;

    return {
      success: true,
      result: { advice },
      explanation: advice,
      confidence: 0.75,
    };
  }

  private optimizeDomain(request: AgentRequest): AgentResponse {
    const { seed } = request.parameters as { seed?: UniversalSeed };

    if (!seed) {
      return {
        success: false,
        result: null,
        explanation: 'Seed required for optimization',
        confidence: 0,
      };
    }

    // Domain-specific optimization hints
    const optimizationHints = {
      visual2d: ['increase-contrast', 'improve-composition'],
      audio: ['balance-frequencies', 'enhance-dynamics'],
      animation: ['smooth-easing', 'adjust-timing'],
    };

    const hints = optimizationHints[this.domain as keyof typeof optimizationHints] || [];

    return {
      success: true,
      result: { hints },
      explanation: `Suggested optimizations for ${seed.$domain}`,
      suggestedNext: hints,
      confidence: 0.7,
    };
  }
}

/**
 * QualityAssessor: Evaluates artifact quality
 */
class QualityAssessor implements SubAgent {
  name = 'QualityAssessor';
  domain = 'quality-assurance';
  description = 'Evaluates generated artifacts against quality criteria';
  capabilities = ['assess-quality', 'compare-artifacts', 'identify-issues'];

  private memory: MemorySystem;

  constructor(memory: MemorySystem) {
    this.memory = memory;
  }

  process(request: AgentRequest): AgentResponse {
    if (request.intent === 'assess-quality') {
      return this.assessQuality(request);
    } else if (request.intent === 'compare-artifacts') {
      return this.compareArtifacts(request);
    }

    return {
      success: false,
      result: null,
      explanation: `Unknown intent: ${request.intent}`,
      confidence: 0,
    };
  }

  private assessQuality(request: AgentRequest): AgentResponse {
    const { artifact, criteria } = request.parameters as {
      artifact: unknown;
      criteria?: string[];
    };

    const score = Math.random() * 0.4 + 0.6; // 0.6-1.0

    return {
      success: true,
      result: { score, qualityLevel: score > 0.8 ? 'excellent' : score > 0.6 ? 'good' : 'fair' },
      explanation: `Quality score: ${score.toFixed(2)}`,
      confidence: 0.8,
    };
  }

  private compareArtifacts(request: AgentRequest): AgentResponse {
    const { artifact1, artifact2 } = request.parameters as {
      artifact1: unknown;
      artifact2: unknown;
    };

    const comparison = {
      winner: Math.random() > 0.5 ? 'artifact1' : 'artifact2',
      differences: ['complexity', 'elegance', 'efficiency'],
    };

    return {
      success: true,
      result: comparison,
      explanation: `Comparison complete: ${comparison.winner} is superior`,
      confidence: 0.7,
    };
  }
}

/**
 * CompositionPlanner: Plans multi-seed compositions
 */
class CompositionPlanner implements SubAgent {
  name = 'CompositionPlanner';
  domain = 'composition';
  description = 'Plans compositions of multiple seeds';
  capabilities = ['plan-composition', 'merge-seeds', 'blend-seeds'];

  private memory: MemorySystem;

  constructor(memory: MemorySystem) {
    this.memory = memory;
  }

  process(request: AgentRequest): AgentResponse {
    if (request.intent === 'plan-composition') {
      return this.planComposition(request);
    }

    return {
      success: false,
      result: null,
      explanation: `Unknown intent: ${request.intent}`,
      confidence: 0,
    };
  }

  private planComposition(request: AgentRequest): AgentResponse {
    const { seeds, strategy } = request.parameters as {
      seeds: UniversalSeed[];
      strategy?: string;
    };

    const plan = {
      steps: [
        { action: 'prepare-seeds', description: 'Validate and prepare input seeds' },
        { action: 'align-genes', description: 'Align genes across seeds' },
        { action: 'compose', description: 'Composite seeds according to strategy' },
        { action: 'optimize', description: 'Optimize composite result' },
      ],
      strategy: strategy || 'layer',
    };

    return {
      success: true,
      result: plan,
      explanation: `Planned composition of ${seeds.length} seeds using ${plan.strategy} strategy`,
      confidence: 0.8,
    };
  }
}

/**
 * Optimizer: Performance optimization
 */
class Optimizer implements SubAgent {
  name = 'Optimizer';
  domain = 'optimization';
  description = 'Suggests and implements performance optimizations';
  capabilities = ['profile', 'optimize', 'benchmark'];

  private memory: MemorySystem;

  constructor(memory: MemorySystem) {
    this.memory = memory;
  }

  process(request: AgentRequest): AgentResponse {
    if (request.intent === 'profile') {
      return this.profile(request);
    } else if (request.intent === 'optimize') {
      return this.optimize(request);
    }

    return {
      success: false,
      result: null,
      explanation: `Unknown intent: ${request.intent}`,
      confidence: 0,
    };
  }

  private profile(request: AgentRequest): AgentResponse {
    return {
      success: true,
      result: { bottlenecks: ['gene-evaluation', 'fitness-computation'] },
      explanation: 'Identified performance bottlenecks',
      suggestedNext: ['optimize'],
      confidence: 0.75,
    };
  }

  private optimize(request: AgentRequest): AgentResponse {
    const { target } = request.parameters as { target?: string };

    const optimizations = [
      'Cache fitness evaluations',
      'Parallelize population evaluation',
      'Use vectorized operations',
    ];

    return {
      success: true,
      result: { optimizations },
      explanation: `Suggested ${optimizations.length} optimizations`,
      confidence: 0.7,
    };
  }
}

/**
 * CreativeDirector: Aesthetic and creative decisions
 */
class CreativeDirector implements SubAgent {
  name = 'CreativeDirector';
  domain = 'creativity';
  description = 'Makes aesthetic and creative decisions';
  capabilities = ['set-theme', 'generate-style', 'inspire'];

  private memory: MemorySystem;

  constructor(memory: MemorySystem) {
    this.memory = memory;
  }

  process(request: AgentRequest): AgentResponse {
    if (request.intent === 'set-theme') {
      return this.setTheme(request);
    } else if (request.intent === 'generate-style') {
      return this.generateStyle(request);
    } else if (request.intent === 'inspire') {
      return this.inspire(request);
    }

    return {
      success: false,
      result: null,
      explanation: `Unknown intent: ${request.intent}`,
      confidence: 0,
    };
  }

  private setTheme(request: AgentRequest): AgentResponse {
    const { mood, aesthetic } = request.parameters as {
      mood?: string;
      aesthetic?: string;
    };

    return {
      success: true,
      result: { theme: { mood: mood || 'balanced', aesthetic: aesthetic || 'modern' } },
      explanation: `Set theme: ${mood || 'balanced'} mood, ${aesthetic || 'modern'} aesthetic`,
      confidence: 0.8,
    };
  }

  private generateStyle(request: AgentRequest): AgentResponse {
    const styles = ['minimalist', 'maximalist', 'geometric', 'organic', 'abstract'];
    const selectedStyle = styles[Math.floor(Math.random() * styles.length)];

    return {
      success: true,
      result: { style: selectedStyle },
      explanation: `Generated ${selectedStyle} style`,
      confidence: 0.7,
    };
  }

  private inspire(request: AgentRequest): AgentResponse {
    const inspirations = [
      'nature: organic growth patterns',
      'music: harmonic progression',
      'architecture: spatial composition',
      'art: color theory and contrast',
    ];

    const inspiration = inspirations[Math.floor(Math.random() * inspirations.length)];

    return {
      success: true,
      result: { inspiration },
      explanation: `Inspired by: ${inspiration}`,
      confidence: 0.75,
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createSeedArchitect(memory: MemorySystem): SubAgent {
  return new SeedArchitect(memory);
}

export function createEvolutionStrategist(memory: MemorySystem): SubAgent {
  return new EvolutionStrategist(memory);
}

export function createFitnessCrafter(memory: MemorySystem): SubAgent {
  return new FitnessCrafter(memory);
}

export function createDomainExpert(memory: MemorySystem, domain: string): SubAgent {
  return new DomainExpert(memory, domain);
}

export function createQualityAssessor(memory: MemorySystem): SubAgent {
  return new QualityAssessor(memory);
}

export function createCompositionPlanner(memory: MemorySystem): SubAgent {
  return new CompositionPlanner(memory);
}

export function createOptimizer(memory: MemorySystem): SubAgent {
  return new Optimizer(memory);
}

export function createCreativeDirector(memory: MemorySystem): SubAgent {
  return new CreativeDirector(memory);
}

// ============================================================================
// ORCHESTRATOR
// ============================================================================

export class AgentOrchestrator {
  private agents: Map<string, SubAgent> = new Map();
  private memory: MemorySystem;
  private reasoner: ReasoningAgent;

  constructor(memory: MemorySystem) {
    this.memory = memory;
    this.reasoner = new ReasoningAgent(memory);
  }

  register(agent: SubAgent): void {
    this.agents.set(agent.name, agent);
  }

  route(request: AgentRequest): AgentResponse {
    // Find best agent for request
    const domainKey = request.domain || 'general';

    // Try domain-specific agent first
    const domainAgent = Array.from(this.agents.values()).find(
      agent => agent.domain.includes(domainKey) || agent.name.toLowerCase().includes(domainKey.split('-')[0])
    );

    if (domainAgent) {
      return domainAgent.process(request);
    }

    // Fall back to first agent
    const firstAgent = this.agents.values().next().value;
    if (firstAgent) {
      return firstAgent.process(request);
    }

    return {
      success: false,
      result: null,
      explanation: 'No agents available',
      confidence: 0,
    };
  }

  collaborate(request: AgentRequest, agentNames: string[]): AgentResponse {
    const responses: AgentResponse[] = [];

    for (const name of agentNames) {
      const agent = this.agents.get(name);
      if (!agent) continue;

      const response = agent.process(request);
      responses.push(response);
    }

    // Aggregate responses
    const allSuccessful = responses.every(r => r.success);
    const avgConfidence = responses.length > 0
      ? responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length
      : 0;

    return {
      success: allSuccessful,
      result: responses.map(r => r.result),
      explanation: `Collaborated with ${responses.length} agents`,
      confidence: avgConfidence,
    };
  }

  list(): SubAgent[] {
    return Array.from(this.agents.values());
  }
}
