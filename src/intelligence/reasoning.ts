/**
 * reasoning.ts — Reasoning Engine (LATS + ReAct)
 * Tree search for planning and ReAct-style reasoning loops
 */

import type { UniversalSeed } from '../kernel/index.js';
import { MemorySystem } from './memory.js';

// ============================================================================
// REACT INTERFACE & REASONING STEP
// ============================================================================

export interface ReasoningStep {
  type: 'thought' | 'action' | 'observation' | 'reflection';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface AgentAction {
  name: string;
  description: string;
  execute: (params: Record<string, unknown>, context: ReasoningContext) => ActionResult;
}

export interface ActionResult {
  success: boolean;
  output: unknown;
  observation: string;
}

export interface ReasoningContext {
  goal: string;
  domain: string;
  memory: MemorySystem;
  availableActions: AgentAction[];
  maxSteps: number;
  history: ReasoningStep[];
}

// ============================================================================
// LATS — LANGUAGE AGENT TREE SEARCH
// ============================================================================

export interface SearchNode {
  id: string;
  parentId?: string;
  state: ReasoningStep[];
  value: number;          // UCB1 score
  visits: number;
  reward: number;
  children: string[];
  depth: number;
  action?: string;        // Action that led to this state
}

export class LATS {
  private nodes: Map<string, SearchNode> = new Map();
  private rootId: string = '';
  private explorationConstant: number;

  constructor(explorationConstant: number = 1.414) {
    this.explorationConstant = explorationConstant;
  }

  initialize(initialState: ReasoningStep[]): string {
    const rootId = `node_${Date.now()}_0`;

    const root: SearchNode = {
      id: rootId,
      state: [...initialState],
      value: 0,
      visits: 0,
      reward: 0,
      children: [],
      depth: 0,
    };

    this.nodes.set(rootId, root);
    this.rootId = rootId;

    return rootId;
  }

  select(): SearchNode {
    // Use UCB1 to select best node to expand
    let current = this.nodes.get(this.rootId);
    if (!current) {
      throw new Error('LATS not initialized');
    }

    while (current.children.length > 0) {
      // Find best child by UCB1
      let bestChild: SearchNode | null = null;
      let bestScore = -Infinity;

      for (const childId of current.children) {
        const child = this.nodes.get(childId);
        if (!child) continue;

        const score = this.ucb1(child);
        if (score > bestScore) {
          bestScore = score;
          bestChild = child;
        }
      }

      if (!bestChild) break;
      current = bestChild;
    }

    return current;
  }

  expand(nodeId: string, actions: Array<{ action: string; newSteps: ReasoningStep[] }>): string[] {
    const parent = this.nodes.get(nodeId);
    if (!parent) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const childIds: string[] = [];

    for (let i = 0; i < actions.length; i++) {
      const { action, newSteps } = actions[i];
      const childId = `node_${nodeId}_${i}`;

      const child: SearchNode = {
        id: childId,
        parentId: nodeId,
        state: [...newSteps],
        value: 0,
        visits: 0,
        reward: 0,
        children: [],
        depth: parent.depth + 1,
        action,
      };

      this.nodes.set(childId, child);
      parent.children.push(childId);
      childIds.push(childId);
    }

    return childIds;
  }

  backpropagate(nodeId: string, reward: number): void {
    let current = this.nodes.get(nodeId);

    while (current) {
      current.visits++;
      current.reward += reward;
      current.value = current.visits > 0 ? current.reward / current.visits : 0;

      if (!current.parentId) break;
      current = this.nodes.get(current.parentId);
    }
  }

  bestPath(): SearchNode[] {
    const path: SearchNode[] = [];
    let current = this.nodes.get(this.rootId);

    while (current) {
      path.push(current);

      if (current.children.length === 0) break;

      // Pick child with highest visit count
      let bestChild: SearchNode | null = null;
      let maxVisits = -1;

      for (const childId of current.children) {
        const child = this.nodes.get(childId);
        if (!child) continue;

        if (child.visits > maxVisits) {
          maxVisits = child.visits;
          bestChild = child;
        }
      }

      if (!bestChild) break;
      current = bestChild;
    }

    return path;
  }

  private ucb1(node: SearchNode): number {
    if (node.visits === 0) {
      return Infinity;
    }

    const exploitation = node.reward / node.visits;
    const exploration = this.explorationConstant * Math.sqrt(Math.log(node.visits + 1) / node.visits);

    return exploitation + exploration;
  }

  getNode(id: string): SearchNode | undefined {
    return this.nodes.get(id);
  }

  getRoot(): SearchNode {
    const root = this.nodes.get(this.rootId);
    if (!root) {
      throw new Error('LATS not initialized');
    }
    return root;
  }

  size(): number {
    return this.nodes.size;
  }
}

// ============================================================================
// REASONING AGENT
// ============================================================================

export interface ReasoningResult {
  steps: ReasoningStep[];
  success: boolean;
  output: unknown;
  totalSteps: number;
  reasoning: string;      // Human-readable summary
}

export interface PlanResult {
  plan: Array<{ action: string; params: Record<string, unknown>; rationale: string }>;
  confidence: number;
  searchNodesExplored: number;
  bestValue: number;
}

export interface ReflectionResult {
  insights: string[];
  lessonsLearned: string[];
  suggestedImprovements: string[];
}

export class ReasoningAgent {
  private memory: MemorySystem;
  private actions: Map<string, AgentAction>;
  private maxDepth: number;
  private maxIterations: number;

  constructor(memory: MemorySystem, config?: { maxDepth?: number; maxIterations?: number }) {
    this.memory = memory;
    this.actions = new Map();
    this.maxDepth = config?.maxDepth ?? 10;
    this.maxIterations = config?.maxIterations ?? 100;
  }

  registerAction(action: AgentAction): void {
    this.actions.set(action.name, action);
  }

  reason(goal: string, domain: string): ReasoningResult {
    const steps: ReasoningStep[] = [];

    // Initial thought
    steps.push({
      type: 'thought',
      content: `Goal: ${goal} in domain ${domain}`,
      timestamp: Date.now(),
    });

    const context: ReasoningContext = {
      goal,
      domain,
      memory: this.memory,
      availableActions: Array.from(this.actions.values()),
      maxSteps: this.maxDepth,
      history: steps,
    };

    let stepCount = 0;
    let output: unknown = null;
    let success = false;

    while (stepCount < this.maxDepth && stepCount < this.maxIterations) {
      stepCount++;

      // Generate next action based on goal and history
      const actionName = this.selectAction(context);

      if (!actionName) {
        steps.push({
          type: 'thought',
          content: 'No suitable action found. Goal may be unreachable.',
          timestamp: Date.now(),
        });
        break;
      }

      steps.push({
        type: 'action',
        content: `Execute action: ${actionName}`,
        timestamp: Date.now(),
      });

      // Execute action
      const action = this.actions.get(actionName);
      if (!action) {
        steps.push({
          type: 'observation',
          content: `Action ${actionName} not found`,
          timestamp: Date.now(),
        });
        continue;
      }

      const params = this.extractParams(context);
      const result = action.execute(params, context);

      steps.push({
        type: 'observation',
        content: result.observation,
        timestamp: Date.now(),
      });

      if (result.success) {
        output = result.output;
        success = true;
        steps.push({
          type: 'thought',
          content: 'Goal achieved!',
          timestamp: Date.now(),
        });
        break;
      }

      context.history = steps;
    }

    const reasoning = `Reasoned through ${stepCount} steps. ${success ? 'Successfully achieved goal.' : 'Did not achieve goal.'}`;

    return {
      steps,
      success,
      output,
      totalSteps: stepCount,
      reasoning,
    };
  }

  plan(goal: string, domain: string, searchBudget: number = 50): PlanResult {
    const lats = new LATS();

    // Initialize with goal
    const initialStep: ReasoningStep = {
      type: 'thought',
      content: `Plan for: ${goal}`,
      timestamp: Date.now(),
    };

    const rootId = lats.initialize([initialStep]);

    // Tree search
    for (let i = 0; i < searchBudget; i++) {
      const selectedNode = lats.select();

      // Generate child actions
      const possibleActions = this.generatePossibleActions(goal, domain);

      if (possibleActions.length === 0) {
        // Dead end
        lats.backpropagate(selectedNode.id, 0);
        continue;
      }

      const childActions = possibleActions.map(action => ({
        action: action.name,
        newSteps: [
          ...selectedNode.state,
          {
            type: 'action' as const,
            content: `Execute ${action.name}: ${action.description}`,
            timestamp: Date.now(),
          },
        ],
      }));

      const childIds = lats.expand(selectedNode.id, childActions);

      // Simulate from first child
      if (childIds.length > 0) {
        const childId = childIds[0];
        const reward = this.simulateGoalProgress(goal, domain, selectedNode.state);
        lats.backpropagate(childId, reward);
      }
    }

    // Extract best path
    const bestPath = lats.bestPath();
    const root = lats.getRoot();

    const plan: Array<{ action: string; params: Record<string, unknown>; rationale: string }> = [];

    for (const node of bestPath) {
      if (node.action) {
        plan.push({
          action: node.action,
          params: {},
          rationale: `Selected from tree search with ${node.visits} visits`,
        });
      }
    }

    return {
      plan,
      confidence: bestPath.length > 0 ? Math.min(1, bestPath[bestPath.length - 1].visits / 10) : 0,
      searchNodesExplored: lats.size(),
      bestValue: root.children.length > 0 ? Math.max(...root.children.map(id => {
        const node = lats.getNode(id);
        return node?.value ?? 0;
      })) : 0,
    };
  }

  reflect(result: ReasoningResult): ReflectionResult {
    const insights: string[] = [];
    const lessonsLearned: string[] = [];
    const suggestedImprovements: string[] = [];

    // Analyze what worked
    if (result.success) {
      insights.push('Goal was successfully achieved');
      lessonsLearned.push(`Reasoning in ${result.totalSteps} steps was effective`);
    } else {
      insights.push('Goal was not achieved');
      lessonsLearned.push('Consider alternative strategies');
    }

    // Analyze steps
    const actionCount = result.steps.filter(s => s.type === 'action').length;
    if (actionCount > this.maxDepth * 0.8) {
      suggestedImprovements.push('Consider optimizing action selection to reduce step count');
    }

    // Store in episodic memory
    this.memory.episodic.record({
      domain: 'reasoning',
      seedHash: `reflect_${Date.now()}`,
      action: 'reflect',
      outcome: result.success ? 'success' : 'failure',
      fitness: result.success ? 1.0 : 0.0,
      context: { totalSteps: result.totalSteps, goal: result.reasoning },
      tags: ['reasoning', result.success ? 'success' : 'failure'],
    });

    return {
      insights,
      lessonsLearned,
      suggestedImprovements,
    };
  }

  private selectAction(context: ReasoningContext): string | undefined {
    // Simple heuristic: pick action that best matches goal
    if (context.availableActions.length === 0) return undefined;

    // For now, just pick the first action
    // In a full implementation, would use NLP/semantic similarity
    return context.availableActions[0].name;
  }

  private extractParams(context: ReasoningContext): Record<string, unknown> {
    // Extract relevant parameters from context and working memory
    const allContext = context.memory.getContext();

    return {
      goal: context.goal,
      domain: context.domain,
      ...allContext,
    };
  }

  private generatePossibleActions(goal: string, domain: string): AgentAction[] {
    // Filter actions relevant to domain
    return Array.from(this.actions.values()).filter(action =>
      action.name.includes(domain) || action.description.includes(domain) || this.actions.size < 5
    );
  }

  private simulateGoalProgress(goal: string, domain: string, history: ReasoningStep[]): number {
    // Simple simulation: measure steps toward goal
    const actionCount = history.filter(s => s.type === 'action').length;
    const successCount = history.filter(s => s.type === 'observation' && s.content.includes('success')).length;

    // Reward: more successes and fewer total steps is better
    return Math.min(1, (successCount + 0.1 * (1 - actionCount / this.maxDepth)));
  }
}
