/**
 * compiler.ts — GSPL-to-JavaScript Compiler
 * Generates JavaScript code from AST for faster execution and eventual WASM compilation.
 */

import * as AST from './ast.js';
import { SourceLocation } from './tokens.js';

export interface CompilationResult {
  code: string;
  sourceMap?: string;
  errors: CompileError[];
  timing: { compileMs: number };
}

export class CompileError extends Error {
  constructor(message: string, public location?: SourceLocation) {
    super(location ? `[${location.line}:${location.column}] ${message}` : message);
  }
}

export class Compiler {
  private output: string[] = [];
  private indent: number = 0;
  private errors: CompileError[] = [];
  private seedNames: Set<string> = new Set();
  private functionNames: Set<string> = new Set();

  compile(program: AST.ProgramNode): CompilationResult {
    const startTime = Date.now();
    this.output = [];
    this.errors = [];
    this.seedNames.clear();
    this.functionNames.clear();

    try {
      this.emitHeader();
      this.emitProgram(program);
      this.emitFooter();
    } catch (err) {
      if (err instanceof CompileError) {
        this.errors.push(err);
      } else {
        this.errors.push(new CompileError(String(err)));
      }
    }

    const code = this.output.join('\n');
    const timing = { compileMs: Date.now() - startTime };

    return {
      code,
      errors: this.errors,
      timing,
    };
  }

  private emitHeader(): void {
    this.emitLine('// GSPL Compiled Output');
    this.emitLine("import { createSeed, computeHash } from '@paradigm/kernel';");
    this.emitLine("import { scalar, categorical, vector, struct, array, graph, expression } from '@paradigm/kernel/genes';");
    this.emitLine("import { crossover, mutate as __kernelMutate__ } from '@paradigm/kernel/operators';");
    this.emitLine("import { DeterministicRNG } from '@paradigm/kernel/rng';");
    this.emitLine('');
    this.emitLine('const __seeds__ = [];');
    this.emitLine('const __stdlib__ = {');
    this.pushIndent();
    this.emitStdlib();
    this.popIndent();
    this.emitLine('};');
    this.emitLine('');
  }

  private emitStdlib(): void {
    this.emitLine('sin: Math.sin,');
    this.emitLine('cos: Math.cos,');
    this.emitLine('tan: Math.tan,');
    this.emitLine('sqrt: Math.sqrt,');
    this.emitLine('abs: Math.abs,');
    this.emitLine('floor: Math.floor,');
    this.emitLine('ceil: Math.ceil,');
    this.emitLine('round: Math.round,');
    this.emitLine('min: (...args) => Math.min(...args),');
    this.emitLine('max: (...args) => Math.max(...args),');
    this.emitLine('pow: Math.pow,');
    this.emitLine('clamp: (value, min, max) => Math.max(min, Math.min(max, value)),');
    this.emitLine('mix: (a, b, t) => a * (1 - t) + b * t,');
    this.emitLine('random: () => Math.random(),');
    this.emitLine('randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,');
    this.emitLine('length: (arr) => Array.isArray(arr) ? arr.length : String(arr).length,');
    this.emitLine('push: (arr, ...items) => { arr.push(...items); return arr; },');
    this.emitLine('pop: (arr) => arr.pop(),');
    this.emitLine('map: (arr, fn) => arr.map((item, idx) => fn(item, idx)),');
    this.emitLine('filter: (arr, fn) => arr.filter((item, idx) => fn(item, idx)),');
    this.emitLine('reduce: (arr, fn, initial) => arr.reduce((acc, item, idx) => fn(acc, item, idx), initial),');
    this.emitLine('join: (arr, sep = ",") => arr.join(sep),');
    this.emitLine('toUpper: (str) => str.toUpperCase(),');
    this.emitLine('toLower: (str) => str.toLowerCase(),');
    this.emitLine('trim: (str) => str.trim(),');
    this.emitLine('charAt: (str, idx) => str[idx] ?? "",');
    this.emitLine('substring: (str, start, end) => str.substring(start, end),');
    this.emitLine('typeof: (val) => typeof val,');
    this.emitLine('isArray: Array.isArray,');
    this.emitLine('isNull: (val) => val === null,');
    this.emitLine('isUndefined: (val) => val === undefined,');
  }

  private emitFooter(): void {
    this.emitLine('');
    this.emitLine('export function __run__() {');
    this.pushIndent();
    this.emitLine('return __seeds__;');
    this.popIndent();
    this.emitLine('}');
  }

  private emitProgram(node: AST.ProgramNode): void {
    for (const statement of node.body) {
      this.emitStatement(statement);
    }
  }

  private emitStatement(node: AST.ASTNode): void {
    switch (node.kind) {
      case 'SeedDeclaration':
        this.emitSeedDeclaration(node as AST.SeedDeclarationNode);
        break;
      case 'FunctionDeclaration':
        this.emitFunctionDeclaration(node as AST.FunctionDeclarationNode);
        break;
      case 'LetDeclaration':
        this.emitLetDeclaration(node as AST.LetDeclarationNode);
        break;
      case 'ExpressionStatement':
        this.emitLine(`${this.emitExpression((node as AST.ExpressionStatement).expression)};`);
        break;
      case 'IfStatement':
        this.emitIfStatement(node as AST.IfStatement);
        break;
      case 'ForStatement':
        this.emitForStatement(node as AST.ForStatement);
        break;
      case 'WhileStatement':
        this.emitWhileStatement(node as AST.WhileStatement);
        break;
      case 'ReturnStatement':
        this.emitReturnStatement(node as AST.ReturnStatement);
        break;
      case 'Block':
        this.emitBlock((node as AST.BlockNode).body);
        break;
      case 'Import':
      case 'Export':
        break;
      default:
        throw new CompileError(`Unknown statement kind: ${(node as any).kind}`);
    }
  }

  private emitSeedDeclaration(node: AST.SeedDeclarationNode): void {
    this.seedNames.add(node.name);
    const geneCode = this.emitGeneBlock(node.genes);
    this.emitLine(
      `const ${node.name} = createSeed('${node.domain}', '${node.name}', ${geneCode});`
    );
    this.emitLine(`__seeds__.push(${node.name});`);
    this.emitLine('');
  }

  private emitGeneBlock(block: AST.GeneBlockNode): string {
    const genes: string[] = [];
    for (const prop of block.properties) {
      const value = this.emitExpression(prop.value);
      const geneCall = this.emitGeneFactory(prop.geneType, value, prop.constraints);
      genes.push(`${prop.name}: ${geneCall}`);
    }
    return `{ ${genes.join(', ')} }`;
  }

  private emitGeneFactory(
    geneType: string,
    value: string,
    constraints?: Record<string, AST.Expression>
  ): string {
    const constraintCode = constraints
      ? Object.entries(constraints)
          .map(([k, v]) => `${k}: ${this.emitExpression(v)}`)
          .join(', ')
      : '';

    switch (geneType) {
      case 'scalar':
        const scalarMin = constraints?.min ? this.emitExpression(constraints.min) : '0';
        const scalarMax = constraints?.max ? this.emitExpression(constraints.max) : '100';
        return `scalar(${value}, ${scalarMin}, ${scalarMax})`;
      case 'categorical':
        const catOptions = constraints?.options ? this.emitExpression(constraints.options) : `['${value}']`;
        return `categorical(${value}, ${catOptions})`;
      case 'vector':
        const vecMin = constraints?.min ? this.emitExpression(constraints.min) : 'undefined';
        const vecMax = constraints?.max ? this.emitExpression(constraints.max) : 'undefined';
        return `vector(${value}, { min: ${vecMin}, max: ${vecMax} })`;
      case 'struct':
        return `struct(${value})`;
      case 'array':
        const arrayMin = constraints?.minLength ? this.emitExpression(constraints.minLength) : '0';
        const arrayMax = constraints?.maxLength ? this.emitExpression(constraints.maxLength) : '100';
        const elemType = constraints?.elementType ? this.emitExpression(constraints.elementType) : '"scalar"';
        return `array(${value}, ${arrayMin}, ${arrayMax}, ${elemType})`;
      case 'graph':
        const maxNodes = constraints?.maxNodes ? this.emitExpression(constraints.maxNodes) : '100';
        const maxEdges = constraints?.maxEdges ? this.emitExpression(constraints.maxEdges) : '100';
        return `graph(${value}.nodes || [], ${value}.edges || [], ${maxNodes}, ${maxEdges})`;
      default:
        return `scalar(${value}, 0, 100)`;
    }
  }

  private emitFunctionDeclaration(node: AST.FunctionDeclarationNode): void {
    this.functionNames.add(node.name);
    const params = node.params.map(p => p.name).join(', ');
    this.emitLine(`function ${node.name}(${params}) {`);
    this.pushIndent();
    this.emitBlockStatements(node.body);
    this.popIndent();
    this.emitLine('}');
    this.emitLine('');
  }

  private emitLetDeclaration(node: AST.LetDeclarationNode): void {
    const kind = node.mutable ? 'let' : 'const';
    const value = this.emitExpression(node.initializer);
    this.emitLine(`${kind} ${node.name} = ${value};`);
  }

  private emitIfStatement(node: AST.IfStatement): void {
    const condition = this.emitExpression(node.condition);
    this.emitLine(`if (${condition}) {`);
    this.pushIndent();
    this.emitBlockStatements(node.consequent);
    this.popIndent();

    if (node.alternate) {
      this.emitLine('} else {');
      this.pushIndent();
      this.emitBlockStatements(node.alternate);
      this.popIndent();
    }

    this.emitLine('}');
  }

  private emitForStatement(node: AST.ForStatement): void {
    const iterable = this.emitExpression(node.iterable);
    this.emitLine(`for (const ${node.variable} of ${iterable}) {`);
    this.pushIndent();
    this.emitBlockStatements(node.body);
    this.popIndent();
    this.emitLine('}');
  }

  private emitWhileStatement(node: AST.WhileStatement): void {
    const condition = this.emitExpression(node.condition);
    this.emitLine(`while (${condition}) {`);
    this.pushIndent();
    this.emitBlockStatements(node.body);
    this.popIndent();
    this.emitLine('}');
  }

  private emitReturnStatement(node: AST.ReturnStatement): void {
    if (node.value) {
      const value = this.emitExpression(node.value);
      this.emitLine(`return ${value};`);
    } else {
      this.emitLine('return;');
    }
  }

  private emitBlockStatements(statements: AST.ASTNode[]): void {
    for (const stmt of statements) {
      this.emitStatement(stmt);
    }
  }

  private emitBlock(body: AST.ASTNode[]): void {
    this.emitLine('{');
    this.pushIndent();
    this.emitBlockStatements(body);
    this.popIndent();
    this.emitLine('}');
  }

  private emitExpression(expr: AST.Expression): string {
    switch (expr.kind) {
      case 'NumberLiteral':
        return String((expr as AST.NumberLiteral).value);
      case 'StringLiteral':
        return JSON.stringify((expr as AST.StringLiteral).value);
      case 'BooleanLiteral':
        return String((expr as AST.BooleanLiteral).value);
      case 'NullLiteral':
        return 'null';
      case 'Identifier':
        return (expr as AST.Identifier).name;
      case 'ArrayLiteral': {
        const elements = (expr as AST.ArrayLiteral).elements.map(e => this.emitExpression(e));
        return `[${elements.join(', ')}]`;
      }
      case 'ObjectLiteral': {
        const props = (expr as AST.ObjectLiteral).properties.map(
          p => `${p.key}: ${this.emitExpression(p.value)}`
        );
        return `{ ${props.join(', ')} }`;
      }
      case 'BinaryExpression':
        return this.emitBinaryExpression(expr as AST.BinaryExpression);
      case 'UnaryExpression': {
        const unary = expr as AST.UnaryExpression;
        const operand = this.emitExpression(unary.operand);
        return `${unary.operator}${operand}`;
      }
      case 'CallExpression':
        return this.emitCallExpression(expr as AST.CallExpression);
      case 'MemberExpression': {
        const member = expr as AST.MemberExpression;
        const obj = this.emitExpression(member.object);
        if (member.computed) {
          return `${obj}[${this.emitExpression(member.property as AST.Expression)}]`;
        }
        return `${obj}.${member.property as string}`;
      }
      case 'PipeExpression': {
        const pipe = expr as AST.PipeExpression;
        const left = this.emitExpression(pipe.left);
        if (pipe.right.kind === 'CallExpression') {
          const call = pipe.right as AST.CallExpression;
          const callee = this.emitExpression(call.callee);
          const args = call.args.map(a => this.emitExpression(a));
          return `${callee}(${left}, ${args.join(', ')})`;
        }
        throw new CompileError('Right side of pipe must be a function call');
      }
      case 'ConditionalExpression': {
        const cond = expr as AST.ConditionalExpression;
        const condition = this.emitExpression(cond.condition);
        const consequent = this.emitExpression(cond.consequent);
        const alternate = this.emitExpression(cond.alternate);
        return `(${condition} ? ${consequent} : ${alternate})`;
      }
      case 'ArrowFunction': {
        const arrow = expr as AST.ArrowFunction;
        const params = arrow.params.map(p => p.name).join(', ');
        if (arrow.isBlock) {
          const body = (arrow.body as AST.ASTNode[])
            .map(stmt => {
              const prev = this.output.length;
              this.emitStatement(stmt);
              const lines = this.output.slice(prev).join('\n');
              return lines;
            })
            .join('\n');
          return `(${params}) => { ${body} }`;
        }
        const bodyExpr = this.emitExpression(arrow.body as AST.Expression);
        return `(${params}) => ${bodyExpr}`;
      }
      case 'BreedExpression':
        return this.emitBreedExpression(expr as AST.BreedExpression);
      case 'MutateExpression':
        return this.emitMutateExpression(expr as AST.MutateExpression);
      case 'ComposeExpression':
        return this.emitComposeExpression(expr as AST.ComposeExpression);
      case 'EvolveExpression':
        return this.emitEvolveExpression(expr as AST.EvolveExpression);
      default:
        throw new CompileError(`Unknown expression kind: ${(expr as any).kind}`);
    }
  }

  private emitBinaryExpression(expr: AST.BinaryExpression): string {
    const left = this.emitExpression(expr.left);
    const right = this.emitExpression(expr.right);
    const op = expr.operator;
    return `(${left} ${op} ${right})`;
  }

  private emitCallExpression(expr: AST.CallExpression): string {
    const callee = this.emitExpression(expr.callee);
    const args = expr.args.map(a => this.emitExpression(a)).join(', ');
    return `${callee}(${args})`;
  }

  private emitBreedExpression(expr: AST.BreedExpression): string {
    const parentA = this.emitExpression(expr.parentA);
    const parentB = this.emitExpression(expr.parentB);
    const strategy = expr.strategy ?? 'uniform';
    const rng = `new DeterministicRNG(\`\${${parentA}}.$hash-\${${parentB}}.$hash\`)`;
    return `crossover(${parentA}, ${parentB}, { strategy: '${strategy}' }, ${rng})`;
  }

  private emitMutateExpression(expr: AST.MutateExpression): string {
    const seed = this.emitExpression(expr.seed);
    const rate = expr.rate ? this.emitExpression(expr.rate) : '0.1';
    const intensity = expr.intensity ? this.emitExpression(expr.intensity) : '0.5';
    const rng = `new DeterministicRNG(\`\${${seed}}.$hash-mutation\`)`;
    return `__kernelMutate__(${seed}, { rate: ${rate}, intensity: ${intensity} }, ${rng})`;
  }

  private emitComposeExpression(expr: AST.ComposeExpression): string {
    const base = this.emitExpression(expr.base);
    const overlay = this.emitExpression(expr.overlay);
    const composedGenes = `Object.assign({}, ${base}.genes, ${overlay}.genes)`;
    return `createSeed(${base}.$domain, \`\${${base}}.$name_\${${overlay}}.$name_composed\`, ${composedGenes})`;
  }

  private emitEvolveExpression(expr: AST.EvolveExpression): string {
    const seed = this.emitExpression(expr.seed);
    const population = expr.population ? this.emitExpression(expr.population) : '10';
    const generations = expr.generations ? this.emitExpression(expr.generations) : '5';

    const varBest = `__best_${Date.now()}`;
    const code = [
      `(() => {`,
      `  let ${varBest} = ${seed};`,
      `  const __rng = new DeterministicRNG(\`\${${seed}}.$hash-evolve\`);`,
      `  for (let __gen = 0; __gen < ${generations}; __gen++) {`,
      `    for (let __i = 0; __i < ${population}; __i++) {`,
      `      const __mutated = __kernelMutate__(${varBest}, { rate: 0.2, intensity: 0.3 }, __rng);`,
      `      ${varBest} = __mutated;`,
      `    }`,
      `  }`,
      `  return ${varBest};`,
      `})()`,
    ].join('\n');

    return code;
  }

  private emit(code: string): void {
    this.output.push(code);
  }

  private emitLine(code: string): void {
    const indent = '  '.repeat(this.indent);
    this.output.push(indent + code);
  }

  private pushIndent(): void {
    this.indent++;
  }

  private popIndent(): void {
    this.indent--;
  }
}
