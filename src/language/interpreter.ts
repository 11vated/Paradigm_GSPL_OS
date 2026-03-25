/**
 * interpreter.ts — Direct AST Interpreter for GSPL
 * Executes the AST to produce seeds and results.
 */

import * as AST from './ast.js';
import { SourceLocation } from './tokens.js';
import { GeneMap, Gene, scalar, categorical, vector } from '../kernel/genes.js';
import { UniversalSeed, createSeed } from '../kernel/seed.js';
import { DeterministicRNG } from '../kernel/rng.js';
import { crossover, mutate as mutateOperator } from '../kernel/operators.js';

export class RuntimeError extends Error {
  constructor(message: string, public location?: SourceLocation) {
    super(location ? `[${location.line}:${location.column}] ${message}` : message);
  }
}

export interface ExecutionResult {
  seeds: UniversalSeed[];
  exports: Record<string, unknown>;
  errors: RuntimeError[];
  timing: { parseMs: number; executeMs: number; totalMs: number };
}

export class Environment {
  private values: Map<string, { value: unknown; mutable: boolean }> = new Map();
  private parent?: Environment;

  constructor(parent?: Environment) {
    this.parent = parent;
  }

  define(name: string, value: unknown, mutable: boolean = true): void {
    if (this.values.has(name)) {
      throw new RuntimeError(`Variable ${name} already defined in this scope`);
    }
    this.values.set(name, { value, mutable });
  }

  get(name: string): unknown {
    if (this.values.has(name)) {
      return this.values.get(name)!.value;
    }
    if (this.parent) {
      return this.parent.get(name);
    }
    throw new RuntimeError(`Undefined variable: ${name}`);
  }

  set(name: string, value: unknown): void {
    if (this.values.has(name)) {
      const entry = this.values.get(name)!;
      if (!entry.mutable) {
        throw new RuntimeError(`Cannot assign to immutable variable: ${name}`);
      }
      entry.value = value;
      return;
    }
    if (this.parent) {
      this.parent.set(name, value);
      return;
    }
    throw new RuntimeError(`Undefined variable: ${name}`);
  }

  has(name: string): boolean {
    if (this.values.has(name)) {
      return true;
    }
    if (this.parent) {
      return this.parent.has(name);
    }
    return false;
  }

  forEach(callback: (name: string, entry: { value: unknown; mutable: boolean }) => void): void {
    this.values.forEach((entry, name) => callback(name, entry));
  }
}

interface ControlFlow {
  type: 'return' | 'break' | 'continue';
  value?: unknown;
}

export class Interpreter {
  private globalEnv: Environment;
  private seeds: Map<string, UniversalSeed> = new Map();
  private currentFlow?: ControlFlow;

  constructor() {
    this.globalEnv = new Environment();
    this.loadStdlib(this.globalEnv);
  }

  execute(program: AST.ProgramNode): ExecutionResult {
    const startTime = Date.now();
    const startExecute = startTime;
    const errors: RuntimeError[] = [];
    const seedList: UniversalSeed[] = [];
    const exports: Record<string, unknown> = {};

    try {
      this.executeProgram(program, this.globalEnv);

      // Collect all created seeds (from seed declarations)
      const seenHashes = new Set<string>();
      this.seeds.forEach((seed) => {
        seedList.push(seed);
        seenHashes.add(seed.$hash);
      });

      // Also collect seeds stored in variables (from breed, mutate, evolve, compose)
      this.globalEnv.forEach((name, entry) => {
        const val = entry.value;
        if (val && typeof val === 'object' && '$gst' in (val as any) && '$hash' in (val as any)) {
          const seed = val as UniversalSeed;
          if (!seenHashes.has(seed.$hash)) {
            seedList.push(seed);
            seenHashes.add(seed.$hash);
          }
        }
      });
    } catch (err) {
      if (err instanceof RuntimeError) {
        errors.push(err);
      } else {
        errors.push(new RuntimeError(String(err)));
      }
    }

    const executeMs = Date.now() - startExecute;
    const totalMs = Date.now() - startTime;

    return {
      seeds: seedList,
      exports,
      errors,
      timing: { parseMs: 0, executeMs, totalMs },
    };
  }

  private executeProgram(node: AST.ProgramNode, env: Environment): void {
    for (const statement of node.body) {
      this.executeNode(statement, env);
      if (this.currentFlow) break;
    }
  }

  private executeNode(node: AST.ASTNode, env: Environment): unknown {
    try {
      switch (node.kind) {
        case 'Program':
          return this.executeProgram(node as AST.ProgramNode, env);

        case 'SeedDeclaration':
          return this.executeSeedDeclaration(node as AST.SeedDeclarationNode, env);

        case 'FunctionDeclaration':
          return this.executeFunctionDeclaration(node as AST.FunctionDeclarationNode, env);

        case 'LetDeclaration':
          return this.executeLetDeclaration(node as AST.LetDeclarationNode, env);

        case 'ExpressionStatement':
          return this.evaluate((node as AST.ExpressionStatement).expression, env);

        case 'IfStatement':
          return this.executeIfStatement(node as AST.IfStatement, env);

        case 'ForStatement':
          return this.executeForStatement(node as AST.ForStatement, env);

        case 'WhileStatement':
          return this.executeWhileStatement(node as AST.WhileStatement, env);

        case 'ReturnStatement':
          return this.executeReturnStatement(node as AST.ReturnStatement, env);

        case 'Block':
          return this.executeBlock((node as AST.BlockNode).body, env);

        case 'Import':
        case 'Export':
          // Not implemented in basic interpreter
          return undefined;

        default:
          throw new RuntimeError(`Unknown node kind: ${(node as any).kind}`);
      }
    } catch (err) {
      if (err instanceof RuntimeError && !err.location) {
        err.location = node.location;
      }
      throw err;
    }
  }

  private executeSeedDeclaration(node: AST.SeedDeclarationNode, env: Environment): UniversalSeed {
    const geneMap: GeneMap = {};

    for (const prop of node.genes.properties) {
      const value = this.evaluate(prop.value, env);
      geneMap[prop.name] = this.valueToGene(prop.name, value, prop.geneType, prop.constraints, env);
    }

    const seed = createSeed(node.domain as any, node.name, geneMap);
    this.seeds.set(node.name, seed);
    env.define(node.name, seed, false);

    return seed;
  }

  private executeFunctionDeclaration(node: AST.FunctionDeclarationNode, env: Environment): void {
    const func = (args: unknown[]) => {
      const localEnv = new Environment(env);
      for (let i = 0; i < node.params.length; i++) {
        localEnv.define(node.params[i].name, args[i] ?? undefined, true);
      }

      const prevFlow = this.currentFlow;
      this.currentFlow = undefined;

      try {
        this.executeBlock(node.body, localEnv);
        const flow = this.currentFlow;
        this.currentFlow = prevFlow;

        if (flow && (flow as ControlFlow).type === 'return') {
          return (flow as ControlFlow).value;
        }
        return undefined;
      } finally {
        this.currentFlow = prevFlow;
      }
    };

    env.define(node.name, func, false);
  }

  private executeLetDeclaration(node: AST.LetDeclarationNode, env: Environment): void {
    const value = this.evaluate(node.initializer, env);
    env.define(node.name, value, node.mutable);
  }

  private executeIfStatement(node: AST.IfStatement, env: Environment): unknown {
    const condition = this.evaluate(node.condition, env);
    if (this.isTruthy(condition)) {
      return this.executeBlock(node.consequent, env);
    } else if (node.alternate) {
      return this.executeBlock(node.alternate, env);
    }
    return undefined;
  }

  private executeForStatement(node: AST.ForStatement, env: Environment): void {
    const iterable = this.evaluate(node.iterable, env);
    const items = this.toIterable(iterable);
    const localEnv = new Environment(env);

    for (const item of items) {
      localEnv.define(node.variable, item, true);
      this.executeBlock(node.body, localEnv);

      if (this.currentFlow?.type === 'break') {
        this.currentFlow = undefined;
        break;
      }
      if (this.currentFlow?.type === 'continue') {
        this.currentFlow = undefined;
        continue;
      }
      if (this.currentFlow?.type === 'return') {
        break;
      }
    }
  }

  private executeWhileStatement(node: AST.WhileStatement, env: Environment): void {
    while (this.isTruthy(this.evaluate(node.condition, env))) {
      this.executeBlock(node.body, env);

      if (this.currentFlow?.type === 'break') {
        this.currentFlow = undefined;
        break;
      }
      if (this.currentFlow?.type === 'continue') {
        this.currentFlow = undefined;
        continue;
      }
      if (this.currentFlow?.type === 'return') {
        break;
      }
    }
  }

  private executeReturnStatement(node: AST.ReturnStatement, env: Environment): void {
    const value = node.value ? this.evaluate(node.value, env) : undefined;
    this.currentFlow = { type: 'return', value };
  }

  private executeBlock(statements: AST.ASTNode[], env: Environment): unknown {
    let result: unknown;
    for (const stmt of statements) {
      result = this.executeNode(stmt, env);
      if (this.currentFlow) break;
    }
    return result;
  }

  // ========================================================================
  // EXPRESSION EVALUATION
  // ========================================================================

  private evaluate(expr: AST.Expression, env: Environment): unknown {
    try {
      switch (expr.kind) {
        case 'NumberLiteral':
          return (expr as AST.NumberLiteral).value;

        case 'StringLiteral':
          return (expr as AST.StringLiteral).value;

        case 'BooleanLiteral':
          return (expr as AST.BooleanLiteral).value;

        case 'NullLiteral':
          return null;

        case 'Identifier':
          return env.get((expr as AST.Identifier).name);

        case 'ArrayLiteral':
          return (expr as AST.ArrayLiteral).elements.map(el => this.evaluate(el, env));

        case 'ObjectLiteral': {
          const obj: Record<string, unknown> = {};
          for (const prop of (expr as AST.ObjectLiteral).properties) {
            obj[prop.key] = this.evaluate(prop.value, env);
          }
          return obj;
        }

        case 'BinaryExpression':
          return this.evaluateBinary(expr as AST.BinaryExpression, env);

        case 'UnaryExpression':
          return this.evaluateUnary(expr as AST.UnaryExpression, env);

        case 'CallExpression':
          return this.evaluateCall(expr as AST.CallExpression, env);

        case 'MemberExpression':
          return this.evaluateMember(expr as AST.MemberExpression, env);

        case 'PipeExpression':
          return this.evaluatePipe(expr as AST.PipeExpression, env);

        case 'ConditionalExpression':
          return this.evaluateConditional(expr as AST.ConditionalExpression, env);

        case 'ArrowFunction':
          return this.evaluateArrowFunction(expr as AST.ArrowFunction, env);

        case 'BreedExpression':
          return this.evaluateBreed(expr as AST.BreedExpression, env);

        case 'MutateExpression':
          return this.evaluateMutate(expr as AST.MutateExpression, env);

        case 'ComposeExpression':
          return this.evaluateCompose(expr as AST.ComposeExpression, env);

        case 'EvolveExpression':
          return this.evaluateEvolve(expr as AST.EvolveExpression, env);

        default:
          throw new RuntimeError(`Unknown expression kind: ${(expr as any).kind}`);
      }
    } catch (err) {
      if (err instanceof RuntimeError && !err.location) {
        err.location = expr.location;
      }
      throw err;
    }
  }

  private evaluateBinary(expr: AST.BinaryExpression, env: Environment): unknown {
    // Short-circuit operators: evaluate right lazily
    if (expr.operator === 'and') {
      const left = this.evaluate(expr.left, env);
      return this.isTruthy(left) ? this.evaluate(expr.right, env) : left;
    }
    if (expr.operator === 'or') {
      const left = this.evaluate(expr.left, env);
      return this.isTruthy(left) ? left : this.evaluate(expr.right, env);
    }

    const left = this.evaluate(expr.left, env);
    const right = this.evaluate(expr.right, env);

    switch (expr.operator) {
      case '+':
        if (typeof left === 'string' || typeof right === 'string') {
          return String(left) + String(right);
        }
        return (left as number) + (right as number);
      case '-':
        return (left as number) - (right as number);
      case '*':
        return (left as number) * (right as number);
      case '/':
        return (left as number) / (right as number);
      case '%':
        return (left as number) % (right as number);
      case '**':
        return Math.pow(left as number, right as number);
      case '==':
        return left === right;
      case '!=':
        return left !== right;
      case '<':
        return (left as number) < (right as number);
      case '>':
        return (left as number) > (right as number);
      case '<=':
        return (left as number) <= (right as number);
      case '>=':
        return (left as number) >= (right as number);
      default:
        throw new RuntimeError(`Unknown operator: ${expr.operator}`);
    }
  }

  private evaluateUnary(expr: AST.UnaryExpression, env: Environment): unknown {
    const operand = this.evaluate(expr.operand, env);

    switch (expr.operator) {
      case '-':
        return -(operand as number);
      case '!':
      case 'not':
        return !this.isTruthy(operand);
      default:
        throw new RuntimeError(`Unknown unary operator: ${expr.operator}`);
    }
  }

  private evaluateCall(expr: AST.CallExpression, env: Environment): unknown {
    const callee = this.evaluate(expr.callee, env);
    const args = expr.args.map(arg => this.evaluate(arg, env));

    if (typeof callee !== 'function') {
      throw new RuntimeError(`Not a function: ${typeof callee}`);
    }

    return callee(...args);
  }

  private evaluateMember(expr: AST.MemberExpression, env: Environment): unknown {
    const object = this.evaluate(expr.object, env);

    if (object === null || object === undefined) {
      throw new RuntimeError(`Cannot access property of ${object}`);
    }

    const prop = expr.computed
      ? String(this.evaluate(expr.property as AST.Expression, env))
      : expr.property as string;

    return (object as any)[prop];
  }

  private evaluatePipe(expr: AST.PipeExpression, env: Environment): unknown {
    const left = this.evaluate(expr.left, env);

    // The right side should be a call expression with left as first arg
    if (expr.right.kind === 'CallExpression') {
      const callExpr = expr.right as AST.CallExpression;
      const callee = this.evaluate(callExpr.callee, env);
      const args = [left, ...callExpr.args.map(arg => this.evaluate(arg, env))];

      if (typeof callee !== 'function') {
        throw new RuntimeError(`Not a function in pipe`);
      }

      return (callee as any)(...args);
    }

    throw new RuntimeError(`Right side of pipe must be a function call`);
  }

  private evaluateConditional(expr: AST.ConditionalExpression, env: Environment): unknown {
    const condition = this.evaluate(expr.condition, env);
    if (this.isTruthy(condition)) {
      return this.evaluate(expr.consequent, env);
    } else {
      return this.evaluate(expr.alternate, env);
    }
  }

  private evaluateArrowFunction(expr: AST.ArrowFunction, env: Environment): Function {
    return (...args: unknown[]) => {
      const localEnv = new Environment(env);
      for (let i = 0; i < expr.params.length; i++) {
        localEnv.define(expr.params[i].name, args[i] ?? undefined, true);
      }

      if (expr.isBlock) {
        const prevFlow = this.currentFlow;
        this.currentFlow = undefined;
        try {
          this.executeBlock(expr.body as AST.ASTNode[], localEnv);
          const flow = this.currentFlow;
          this.currentFlow = prevFlow;
          return flow && (flow as ControlFlow).type === 'return' ? (flow as ControlFlow).value : undefined;
        } finally {
          this.currentFlow = prevFlow;
        }
      } else {
        return this.evaluate(expr.body as AST.Expression, localEnv);
      }
    };
  }

  private evaluateBreed(expr: AST.BreedExpression, env: Environment): UniversalSeed {
    const parentA = this.evaluate(expr.parentA, env) as UniversalSeed;
    const parentB = this.evaluate(expr.parentB, env) as UniversalSeed;

    const dominance = expr.dominance ? (this.evaluate(expr.dominance, env) as number) : 0.5;
    const strategy = expr.strategy ?? 'uniform';

    const rng = new DeterministicRNG(`${parentA.$hash}-${parentB.$hash}`);
    const child = crossover(parentA, parentB, { strategy: strategy as any }, rng);

    return child;
  }

  private evaluateMutate(expr: AST.MutateExpression, env: Environment): UniversalSeed {
    const seed = this.evaluate(expr.seed, env) as UniversalSeed;
    const rate = expr.rate ? (this.evaluate(expr.rate, env) as number) : 0.1;
    const intensity = expr.intensity ? (this.evaluate(expr.intensity, env) as number) : 0.5;

    const rng = new DeterministicRNG(`${seed.$hash}-mutation`);
    const mutated = mutateOperator(seed, { rate, intensity }, rng);

    return mutated;
  }

  private evaluateCompose(expr: AST.ComposeExpression, env: Environment): UniversalSeed {
    const base = this.evaluate(expr.base, env) as UniversalSeed;
    const overlay = this.evaluate(expr.overlay, env) as UniversalSeed;

    // Simple composition: merge genes from overlay over base
    const composedGenes: GeneMap = { ...base.genes };
    for (const [key, gene] of Object.entries(overlay.genes)) {
      composedGenes[key] = gene;
    }

    const composedName = `${base.$name}_${overlay.$name}_composed`;
    const composed = createSeed(base.$domain, composedName, composedGenes);

    return composed;
  }

  private evaluateEvolve(expr: AST.EvolveExpression, env: Environment): UniversalSeed {
    const seed = this.evaluate(expr.seed, env) as UniversalSeed;
    const populationSize = expr.population ? (this.evaluate(expr.population, env) as number) : 10;
    const generations = expr.generations ? (this.evaluate(expr.generations, env) as number) : 5;

    const rng = new DeterministicRNG(`${seed.$hash}-evolve`);

    // Simple fitness heuristic: sum of normalized scalar gene values
    const simpleFitness = (s: UniversalSeed): number => {
      let sum = 0;
      let count = 0;
      for (const gene of Object.values(s.genes)) {
        if (gene.type === 'scalar') {
          const range = gene.max - gene.min;
          sum += range > 0 ? (gene.value - gene.min) / range : 0.5;
          count++;
        }
      }
      return count > 0 ? sum / count : 0.5;
    };

    // Initialize population by mutating the seed
    let pop: UniversalSeed[] = [seed];
    for (let i = 1; i < populationSize; i++) {
      pop.push(mutateOperator(seed, { rate: 0.5, intensity: 0.3 }, rng));
    }

    // Evolve: each generation, mutate all, keep the best
    for (let gen = 0; gen < generations; gen++) {
      const candidates: UniversalSeed[] = [];
      for (const individual of pop) {
        candidates.push(individual);
        candidates.push(mutateOperator(individual, { rate: 0.3, intensity: 0.2 }, rng));
      }

      // Sort by fitness descending and keep top populationSize
      candidates.sort((a, b) => simpleFitness(b) - simpleFitness(a));
      pop = candidates.slice(0, populationSize);
    }

    // Return the fittest
    pop.sort((a, b) => simpleFitness(b) - simpleFitness(a));
    return pop[0];
  }

  // ========================================================================
  // HELPER FUNCTIONS
  // ========================================================================

  private isTruthy(value: unknown): boolean {
    if (value === null || value === undefined || value === false) {
      return false;
    }
    if (value === 0 || value === '' || (Array.isArray(value) && value.length === 0)) {
      return false;
    }
    return true;
  }

  private toIterable(value: unknown): unknown[] {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return value.split('');
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value);
    }
    throw new RuntimeError(`Value is not iterable: ${typeof value}`);
  }

  private valueToGene(
    name: string,
    value: unknown,
    type: string,
    constraints?: Record<string, AST.Expression>,
    env?: Environment
  ): Gene {
    const constraintValues: Record<string, unknown> = {};
    if (constraints && env) {
      for (const [key, expr] of Object.entries(constraints)) {
        constraintValues[key] = this.evaluate(expr, env);
      }
    }

    // If no explicit type but value suggests a type, infer it
    if (type === 'scalar') {
      if (typeof value === 'string') {
        // String values should be categorical
        const options = Array.isArray(constraintValues.options)
          ? (constraintValues.options as string[])
          : [value];
        return categorical(value, options);
      } else if (typeof value === 'number') {
        const min = typeof constraintValues.min === 'number' ? constraintValues.min : 0;
        const max = typeof constraintValues.max === 'number' ? constraintValues.max : 100;
        return scalar(value, min, max);
      } else if (Array.isArray(value)) {
        return vector(value as number[]);
      }
    }

    switch (type) {
      case 'categorical': {
        const options = Array.isArray(constraintValues.options)
          ? (constraintValues.options as string[])
          : [String(value)];
        return categorical(String(value), options);
      }

      case 'vector': {
        const arr = Array.isArray(value) ? (value as number[]) : [value as number];
        return vector(arr);
      }

      default:
        // Fallback: try to infer from value
        if (typeof value === 'string') {
          return categorical(value, [value]);
        }
        return scalar(typeof value === 'number' ? value : 0, 0, 100);
    }
  }

  // ========================================================================
  // STANDARD LIBRARY
  // ========================================================================

  private loadStdlib(env: Environment): void {
    // Math functions
    env.define('sin', Math.sin, false);
    env.define('cos', Math.cos, false);
    env.define('tan', Math.tan, false);
    env.define('sqrt', Math.sqrt, false);
    env.define('abs', Math.abs, false);
    env.define('floor', Math.floor, false);
    env.define('ceil', Math.ceil, false);
    env.define('round', Math.round, false);
    env.define('min', (...args: number[]) => Math.min(...args), false);
    env.define('max', (...args: number[]) => Math.max(...args), false);
    env.define('pow', Math.pow, false);

    // Utility functions
    env.define('clamp', (value: number, min: number, max: number) => {
      return Math.max(min, Math.min(max, value));
    }, false);

    env.define('mix', (a: number, b: number, t: number) => {
      return a * (1 - t) + b * t;
    }, false);

    env.define('random', () => Math.random(), false);

    env.define('randomInt', (min: number, max: number) => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }, false);

    // Array functions
    env.define('length', (arr: any) => {
      return Array.isArray(arr) ? arr.length : String(arr).length;
    }, false);

    env.define('push', (arr: any[], ...items: unknown[]) => {
      arr.push(...items);
      return arr;
    }, false);

    env.define('pop', (arr: any[]) => arr.pop(), false);

    env.define('map', (arr: any[], fn: Function) => {
      return arr.map((item, idx) => fn(item, idx));
    }, false);

    env.define('filter', (arr: any[], fn: Function) => {
      return arr.filter((item, idx) => fn(item, idx));
    }, false);

    env.define('reduce', (arr: any[], fn: Function, initial: unknown) => {
      return arr.reduce((acc, item, idx) => fn(acc, item, idx), initial);
    }, false);

    env.define('join', (arr: any[], sep: string = ',') => {
      return arr.join(sep);
    }, false);

    // String functions
    env.define('toUpper', (str: string) => str.toUpperCase(), false);
    env.define('toLower', (str: string) => str.toLowerCase(), false);
    env.define('trim', (str: string) => str.trim(), false);
    env.define('charAt', (str: string, idx: number) => str[idx] ?? '', false);
    env.define('substring', (str: string, start: number, end?: number) => {
      return str.substring(start, end);
    }, false);

    // Type checking
    env.define('typeof', (val: unknown) => typeof val, false);
    env.define('isArray', Array.isArray, false);
    env.define('isNull', (val: unknown) => val === null, false);
    env.define('isUndefined', (val: unknown) => val === undefined, false);
  }
}
