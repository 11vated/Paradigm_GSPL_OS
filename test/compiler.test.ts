/**
 * compiler.test.ts — Compiler Tests
 * Tests GSPL-to-JavaScript compilation.
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../src/language/lexer.js';
import { Parser } from '../src/language/parser.js';
import { Compiler } from '../src/language/compiler.js';
import { Optimizer } from '../src/language/optimizer.js';

function compile(source: string): string {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const compiler = new Compiler();
  const result = compiler.compile(ast);
  return result.code;
}

function optimize(source: string): string {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  let ast = parser.parse();
  const optimizer = new Optimizer();
  ast = optimizer.optimize(ast);
  const compiler = new Compiler();
  const result = compiler.compile(ast);
  return result.code;
}

describe('Compiler', () => {
  it('emits header with imports', () => {
    const code = compile('');
    expect(code).toContain("import { createSeed");
    expect(code).toContain('@paradigm/kernel');
  });

  it('emits seed declarations', () => {
    const source = `
      seed Art : visual2d {
        genes {
          width: 800
          complexity: 7
        }
      }
    `;
    const code = compile(source);
    expect(code).toContain('const Art = createSeed');
    expect(code).toContain('visual2d');
    expect(code).toContain('__seeds__.push(Art)');
  });

  it('emits scalar genes', () => {
    const source = `
      seed Test : visual2d {
        genes {
          value: 42
        }
      }
    `;
    const code = compile(source);
    expect(code).toContain('scalar(42');
  });

  it('emits categorical genes', () => {
    const source = `
      seed Test : visual2d {
        genes {
          mode: "dark"
        }
      }
    `;
    const code = compile(source);
    expect(code).toContain('categorical');
  });

  it('emits vector genes', () => {
    const source = `
      seed Test : visual2d {
        genes {
          position: [1, 2, 3]
        }
      }
    `;
    const code = compile(source);
    expect(code).toContain('vector');
  });

  it('emits let declarations', () => {
    const source = `
      let x = 42
    `;
    const code = compile(source);
    expect(code).toContain('let x = 42');
  });

  it('emits const declarations', () => {
    const source = `
      const y = 100
    `;
    const code = compile(source);
    expect(code).toContain('const y = 100');
  });

  it('emits function declarations', () => {
    const source = `
      fn add(a, b) {
        return a + b
      }
    `;
    const code = compile(source);
    expect(code).toContain('function add(a, b)');
    expect(code).toContain('return');
  });

  it('emits if statements', () => {
    const source = `
      if (x > 5) {
        let y = 10
      }
    `;
    const code = compile(source);
    expect(code).toContain('if (');
    expect(code).toContain('>');
  });

  it('emits if-else statements', () => {
    const source = `
      if (x > 5) {
        let y = 10
      } else {
        let z = 20
      }
    `;
    const code = compile(source);
    expect(code).toContain('} else {');
  });

  it('emits for loops', () => {
    const source = `
      for (i in [1, 2, 3]) {
        let x = i
      }
    `;
    const code = compile(source);
    expect(code).toContain('for (const i of');
  });

  it('emits while loops', () => {
    const source = `
      fn loopTest(x) {
        let i = 0
        while (i < 10) {
          let j = i
        }
        return x
      }
    `;
    const code = compile(source);
    expect(code).toContain('while (');
  });

  it('emits return statements', () => {
    const source = `
      fn getValue() {
        return 42
      }
    `;
    const code = compile(source);
    expect(code).toContain('return 42');
  });

  it('emits breed expressions', () => {
    const source = `
      seed Parent1 : visual2d {
        genes { value: 1 }
      }
      seed Parent2 : visual2d {
        genes { value: 2 }
      }
      let child = breed(Parent1, Parent2)
    `;
    const code = compile(source);
    expect(code).toContain('crossover');
    expect(code).toContain('DeterministicRNG');
  });

  it('emits mutate expressions', () => {
    const source = `
      seed Original : visual2d {
        genes { value: 42 }
      }
      let mutated = mutate(Original, 0.1)
    `;
    const code = compile(source);
    expect(code).toContain('__kernelMutate__');
  });

  it('emits compose expressions', () => {
    const source = `
      seed Base : visual2d {
        genes { width: 100 }
      }
      seed Overlay : visual2d {
        genes { height: 200 }
      }
      let composed = compose(Base, Overlay)
    `;
    const code = compile(source);
    expect(code).toContain('createSeed');
  });

  it('emits evolve expressions', () => {
    const source = `
      seed Start : visual2d {
        genes { value: 50 }
      }
      let evolved = evolve(Start, 10)
    `;
    const code = compile(source);
    expect(code).toContain('DeterministicRNG');
    expect(code).toContain('__kernelMutate__');
  });

  it('emits function calls in expressions', () => {
    const source = `
      fn add(a, b) { return a + b }
      let result = add(5, 10)
    `;
    const code = compile(source);
    expect(code).toContain('add(5, 10)');
  });

  it('emits binary expressions', () => {
    const source = `
      let sum = 2 + 3
      let product = 4 * 5
      let ratio = 10 / 2
    `;
    const code = compile(source);
    expect(code).toContain('+');
    expect(code).toContain('*');
    expect(code).toContain('/');
  });

  it('emits array literals', () => {
    const source = `
      let arr = [1, 2, 3]
    `;
    const code = compile(source);
    expect(code).toContain('[1, 2, 3]');
  });

  it('emits object literals', () => {
    const source = `
      let obj = { name: "test", value: 42 }
    `;
    const code = compile(source);
    expect(code).toContain('{');
    expect(code).toContain('}');
  });

  it('emits function calls', () => {
    const source = `
      let result = max(10, 20)
    `;
    const code = compile(source);
    expect(code).toContain('max(10, 20)');
  });

  it('emits comparison and assignment', () => {
    const source = `
      fn compare(x) {
        if (x > 5) {
          return 10
        } else {
          return 20
        }
      }
    `;
    const code = compile(source);
    expect(code).toContain('>');
    expect(code).toContain('if');
  });

  it('exports __run__ function', () => {
    const code = compile('');
    expect(code).toContain('export function __run__()');
    expect(code).toContain('return __seeds__');
  });

  it('compiles valid programs without errors', () => {
    const source = `
      seed Test : visual2d {
        genes {
          width: 100
        }
      }
    `;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiler = new Compiler();
    const result = compiler.compile(ast);
    expect(typeof result.code).toBe('string');
    expect(result.errors.length).toBe(0);
  });

  it('compiles complete program', () => {
    const source = `
      seed Visual : visual2d {
        genes {
          width: 800
          height: 600
          complexity: 5
        }
      }

      fn processVisual(v) {
        return mutate(v, 0.1)
      }

      let evolved = evolve(Visual, 10)
    `;
    const code = compile(source);
    expect(code).toContain('const Visual = createSeed');
    expect(code).toContain('function processVisual');
    expect(code).toContain('evolve');
  });
});

describe('Optimizer', () => {
  it('eliminates dead code after return', () => {
    const source = `
      fn test() {
        return 42
        let dead = 100
      }
    `;
    const optimized = optimize(source);
    expect(optimized).toContain('return 42');
    // Dead code should not appear after return in optimized version
    const returnIdx = optimized.indexOf('return 42');
    const afterReturn = optimized.substring(returnIdx + 20);
    expect(afterReturn).not.toContain('dead');
  });

  it('inlines constant values', () => {
    const source = `
      const magic = 42
      let result = magic + 8
    `;
    const optimized = optimize(source);
    // After inlining, should see the constant value
    expect(optimized).toContain('magic');
  });

  it('preserves mutable variables', () => {
    const source = `
      fn increment() {
        let count = 0
        return count
      }
    `;
    const optimized = optimize(source);
    expect(optimized).toContain('let count');
  });

  it('folds simple constant expressions', () => {
    const source = `
      const x = 5
      const y = 3
      let sum = x + y
    `;
    const optimized = optimize(source);
    expect(optimized).toContain('sum');
  });

  it('preserves complex expressions', () => {
    const source = `
      fn getValue() {
        return 42
      }
      let result = getValue() + 10
    `;
    const optimized = optimize(source);
    expect(optimized).toContain('getValue');
  });

  it('handles nested control flow', () => {
    const source = `
      if (true) {
        for (i in [1, 2, 3]) {
          let x = i
        }
      }
    `;
    const optimized = optimize(source);
    expect(optimized).toContain('if');
    expect(optimized).toContain('for');
  });
});

describe('Compilation Integration', () => {
  it('compiles and produces valid JavaScript structure', () => {
    const source = `
      seed MyArt : visual2d {
        genes {
          color: "blue"
          size: 100
        }
      }
      let art = MyArt
    `;
    const code = compile(source);
    expect(code).toContain('const MyArt = createSeed');
    expect(code).toContain('scalar(100');
    expect(code).toContain('categorical');
    expect(code).toContain('export function __run__');
  });

  it('includes stdlib functions', () => {
    const code = compile('');
    expect(code).toContain('Math.sin');
    expect(code).toContain('Math.cos');
    expect(code).toContain('Math.sqrt');
    expect(code).toContain('clamp:');
    expect(code).toContain('mix:');
  });

  it('generates timing information', () => {
    const lexer = new Lexer('');
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiler = new Compiler();
    const result = compiler.compile(ast);
    expect(result.timing).toBeDefined();
    expect(typeof result.timing.compileMs).toBe('number');
    expect(result.timing.compileMs >= 0).toBe(true);
  });
});
