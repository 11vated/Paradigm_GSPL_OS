/**
 * index.ts — GSPL Language Core Barrel Export
 * Exports all language components and provides the main run() function.
 */

export * from './tokens.js';
export * from './ast.js';
export { Lexer, LexerError } from './lexer.js';
export { Parser, ParseError } from './parser.js';
export { Interpreter, RuntimeError, Environment } from './interpreter.js';
export { Compiler, CompileError, type CompilationResult } from './compiler.js';
export { Optimizer } from './optimizer.js';
export type { ExecutionResult } from './interpreter.js';

import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { Interpreter } from './interpreter.js';
import { Compiler } from './compiler.js';
import { Optimizer } from './optimizer.js';
import type { ExecutionResult } from './interpreter.js';

/**
 * Run GSPL source code and return execution result.
 *
 * @param source The GSPL source code to execute
 * @param file Optional filename for error reporting
 * @returns Execution result with seeds, exports, errors, and timing
 */
export function run(source: string, file?: string): ExecutionResult {
  const parseStart = Date.now();

  // Lex
  const lexer = new Lexer(source, file);
  const tokens = lexer.tokenize();

  // Parse
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const parseMs = Date.now() - parseStart;

  // Interpret
  const executeStart = Date.now();
  const interpreter = new Interpreter();
  const result = interpreter.execute(ast);

  // Update timing
  result.timing.parseMs = parseMs;

  return result;
}

/**
 * Compile GSPL source code to JavaScript.
 *
 * @param source The GSPL source code to compile
 * @param file Optional filename for error reporting
 * @returns Compiled JavaScript code with source map and errors
 */
export function compile(source: string, file?: string): ReturnType<Compiler['compile']> {
  const lexer = new Lexer(source, file);
  const tokens = lexer.tokenize();

  const parser = new Parser(tokens);
  const ast = parser.parse();

  const compiler = new Compiler();
  return compiler.compile(ast);
}

/**
 * Optimize and compile GSPL source code to JavaScript.
 *
 * @param source The GSPL source code to optimize and compile
 * @param file Optional filename for error reporting
 * @returns Compiled JavaScript code with optimizations applied
 */
export function compileOptimized(source: string, file?: string): ReturnType<Compiler['compile']> {
  const lexer = new Lexer(source, file);
  const tokens = lexer.tokenize();

  const parser = new Parser(tokens);
  let ast = parser.parse();

  // Optimize
  const optimizer = new Optimizer();
  ast = optimizer.optimize(ast);

  // Compile
  const compiler = new Compiler();
  return compiler.compile(ast);
}
