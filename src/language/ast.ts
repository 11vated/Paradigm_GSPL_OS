/**
 * ast.ts — Abstract Syntax Tree for GSPL
 * Defines all node types for the GSPL language.
 */

import { SourceLocation } from './tokens.js';

// ============================================================================
// BASE NODE TYPES
// ============================================================================

export type ASTNode =
  | ProgramNode
  | SeedDeclarationNode
  | GeneBlockNode
  | GenePropertyNode
  | FunctionDeclarationNode
  | LetDeclarationNode
  | ExpressionStatement
  | IfStatement
  | ForStatement
  | WhileStatement
  | ReturnStatement
  | ImportNode
  | ExportNode
  | BlockNode;

// ============================================================================
// TOP-LEVEL NODES
// ============================================================================

export interface ProgramNode {
  kind: 'Program';
  body: ASTNode[];
  location: SourceLocation;
}

export interface SeedDeclarationNode {
  kind: 'SeedDeclaration';
  name: string;
  domain: string;
  extends?: string;
  genes: GeneBlockNode;
  location: SourceLocation;
}

export interface GeneBlockNode {
  kind: 'GeneBlock';
  properties: GenePropertyNode[];
  location: SourceLocation;
}

export interface GenePropertyNode {
  kind: 'GeneProperty';
  name: string;
  geneType: string;
  value: Expression;
  constraints?: Record<string, Expression>;
  location: SourceLocation;
}

export interface FunctionDeclarationNode {
  kind: 'FunctionDeclaration';
  name: string;
  params: Array<{ name: string; typeAnnotation?: string }>;
  body: ASTNode[];
  returnType?: string;
  location: SourceLocation;
}

export interface LetDeclarationNode {
  kind: 'LetDeclaration';
  name: string;
  mutable: boolean;
  typeAnnotation?: string;
  initializer: Expression;
  location: SourceLocation;
}

export interface ImportNode {
  kind: 'Import';
  names: Array<{ name: string; alias?: string }>;
  source: string;
  location: SourceLocation;
}

export interface ExportNode {
  kind: 'Export';
  declaration: ASTNode;
  location: SourceLocation;
}

// ============================================================================
// STATEMENT NODES
// ============================================================================

export interface ExpressionStatement {
  kind: 'ExpressionStatement';
  expression: Expression;
  location: SourceLocation;
}

export interface IfStatement {
  kind: 'IfStatement';
  condition: Expression;
  consequent: ASTNode[];
  alternate?: ASTNode[];
  location: SourceLocation;
}

export interface ForStatement {
  kind: 'ForStatement';
  variable: string;
  iterable: Expression;
  body: ASTNode[];
  location: SourceLocation;
}

export interface WhileStatement {
  kind: 'WhileStatement';
  condition: Expression;
  body: ASTNode[];
  location: SourceLocation;
}

export interface ReturnStatement {
  kind: 'ReturnStatement';
  value?: Expression;
  location: SourceLocation;
}

export interface BlockNode {
  kind: 'Block';
  body: ASTNode[];
  location: SourceLocation;
}

// ============================================================================
// EXPRESSION NODES
// ============================================================================

export type Expression =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | NullLiteral
  | ArrayLiteral
  | ObjectLiteral
  | Identifier
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | MemberExpression
  | PipeExpression
  | ConditionalExpression
  | ArrowFunction
  | BreedExpression
  | MutateExpression
  | ComposeExpression
  | EvolveExpression;

export interface NumberLiteral {
  kind: 'NumberLiteral';
  value: number;
  location: SourceLocation;
}

export interface StringLiteral {
  kind: 'StringLiteral';
  value: string;
  location: SourceLocation;
}

export interface BooleanLiteral {
  kind: 'BooleanLiteral';
  value: boolean;
  location: SourceLocation;
}

export interface NullLiteral {
  kind: 'NullLiteral';
  location: SourceLocation;
}

export interface ArrayLiteral {
  kind: 'ArrayLiteral';
  elements: Expression[];
  location: SourceLocation;
}

export interface ObjectLiteral {
  kind: 'ObjectLiteral';
  properties: Array<{ key: string; value: Expression }>;
  location: SourceLocation;
}

export interface Identifier {
  kind: 'Identifier';
  name: string;
  location: SourceLocation;
}

export interface BinaryExpression {
  kind: 'BinaryExpression';
  operator: string;
  left: Expression;
  right: Expression;
  location: SourceLocation;
}

export interface UnaryExpression {
  kind: 'UnaryExpression';
  operator: string;
  operand: Expression;
  location: SourceLocation;
}

export interface CallExpression {
  kind: 'CallExpression';
  callee: Expression;
  args: Expression[];
  location: SourceLocation;
}

export interface MemberExpression {
  kind: 'MemberExpression';
  object: Expression;
  property: string | Expression;
  computed: boolean;
  location: SourceLocation;
}

export interface PipeExpression {
  kind: 'PipeExpression';
  left: Expression;
  right: Expression;
  location: SourceLocation;
}

export interface ConditionalExpression {
  kind: 'ConditionalExpression';
  condition: Expression;
  consequent: Expression;
  alternate: Expression;
  location: SourceLocation;
}

export interface ArrowFunction {
  kind: 'ArrowFunction';
  params: Array<{ name: string; typeAnnotation?: string }>;
  body: Expression | ASTNode[];
  isBlock: boolean;
  location: SourceLocation;
}

// ============================================================================
// SEED-SPECIFIC EXPRESSIONS
// ============================================================================

export interface BreedExpression {
  kind: 'BreedExpression';
  parentA: Expression;
  parentB: Expression;
  dominance?: Expression;
  strategy?: string;
  location: SourceLocation;
}

export interface MutateExpression {
  kind: 'MutateExpression';
  seed: Expression;
  rate?: Expression;
  intensity?: Expression;
  location: SourceLocation;
}

export interface ComposeExpression {
  kind: 'ComposeExpression';
  base: Expression;
  overlay: Expression;
  layers?: string[];
  location: SourceLocation;
}

export interface EvolveExpression {
  kind: 'EvolveExpression';
  seed: Expression;
  population?: Expression;
  generations?: Expression;
  fitnessRef?: string;
  location: SourceLocation;
}
