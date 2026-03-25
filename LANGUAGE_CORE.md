# GSPL Language Core

## Overview

The GSPL Language Core is a minimalist, powerful generative seed programming language designed specifically for the Paradigm Engine. Unlike traditional programming languages with 70+ token types, GSPL focuses on **declarative seed creation, composition, and evolution**.

## Architecture

The language implementation consists of five production-quality TypeScript modules:

### 1. **tokens.ts** — Token Definitions
- Defines 40+ token types across literals, keywords, operators, and delimiters
- Includes a `KEYWORDS` map for identifier classification
- `SourceLocation` tracking for precise error reporting (line, column, offset, file)

### 2. **lexer.ts** — Tokenizer
- Fast, single-pass lexer implementing all GSPL tokens
- Features:
  - Literal parsing: integers, floats, scientific notation (1e-3), strings with escapes
  - Comment support: `//` single-line and `/* */` multi-line
  - Multi-character operators: `==`, `!=`, `<=`, `>=`, `**`, `=>`, `|>`, `..`, `...`
  - Proper line/column tracking with newline awareness
  - Meaningful error messages with location context

### 3. **ast.ts** — Abstract Syntax Tree
- 25+ AST node types covering all language constructs
- **Declaration nodes**: Seed, Function, Let/Const, Import/Export
- **Statement nodes**: If, For, While, Return, Block
- **Expression types**: Literals, Binary/Unary ops, Calls, Members, Pipes
- **Seed operations**: Breed, Mutate, Compose, Evolve
- All nodes include `SourceLocation` for error reporting

### 4. **parser.ts** — Recursive Descent Parser
- Converts token stream to AST with full error recovery
- **Expression precedence** (lowest to highest):
  1. Pipe (`|>`)
  2. Logical OR (`or`)
  3. Logical AND (`and`)
  4. Equality (`==`, `!=`)
  5. Comparison (`<`, `>`, `<=`, `>=`)
  6. Addition/Subtraction (`+`, `-`)
  7. Multiplication/Division (`*`, `/`, `%`)
  8. Power (`**`)
  9. Unary (`!`, `-`)
  10. Call/Member (`()`, `.`, `[]`)
- **Error recovery**: Synchronizes to statement boundaries on parse errors
- **Seed syntax** fully supported:
  ```
  seed MyArtifact {
    domain: visual2d
    genes: {
      x: scalar = 50, min: 0, max: 100
      color: categorical = "red", options: ["red", "blue"]
    }
  }

  breed(parentA, parentB, dominance: 0.7, strategy: "uniform")
  mutate(seed, rate: 0.1, intensity: 0.5)
  compose(base, overlay, layers: ["color", "shape"])
  evolve(seed, population: 50, generations: 100)
  ```

### 5. **interpreter.ts** — Direct AST Interpreter
- Executes the AST to produce seeds and values
- Features:
  - **Environment-based scoping** with lexical scoping support
  - **Seed operations** call the kernel operators directly
  - **Control flow**: if/else, for..in loops, while loops, early returns
  - **Standard library** with 30+ built-in functions:
    - Math: sin, cos, sqrt, abs, pow, clamp, mix, random
    - Array: map, filter, reduce, push, pop, join
    - String: toUpper, toLower, trim, substring
    - Type checking: typeof, isArray, isNull, isUndefined

## Language Features

### Core Syntax

**Seed Declarations**
```gspl
seed MyVisual {
  domain: visual2d
  extends: ParentSeed
  genes: {
    x: scalar = 50, min: 0, max: 100
    y: scalar = 50, min: 0, max: 100
  }
}
```

**Variables & Functions**
```gspl
let mutable = 5
const immutable = 10

fn fibonacci(n) {
  if (n <= 1) return n
  return fibonacci(n - 1) + fibonacci(n - 2)
}

fn arrow = (x, y) => x + y
```

**Control Flow**
```gspl
if (condition) {
  // consequent
} else {
  // alternate
}

for (item in array) {
  // loop
}

while (condition) {
  // loop
}
```

**Seed Operations**
```gspl
// Breeding (crossover)
let child = breed(parentA, parentB, dominance: 0.6, strategy: "uniform")

// Mutation
let mutant = mutate(seed, rate: 0.15, intensity: 0.4)

// Composition (layer merging)
let composed = compose(baseLayer, overlayLayer)

// Evolution (population-based optimization)
let evolved = evolve(seed, population: 100, generations: 50)
```

**Expressions & Operators**
```gspl
let sum = 1 + 2 * 3           // arithmetic
let comp = a == b and c < d   // logical
let piped = data |> transform(scale: 2) |> filter(x > 10)
let ternary = condition ? trueValue : falseValue
```

### Type System
- **Dynamic typing** at runtime
- Gene types in seed properties: `scalar`, `categorical`, `vector`, `expression`, `struct`, `array`, `graph`
- Type annotations in function parameters (parsed but not enforced)

### Error Handling
- Lexer errors with location context
- Parser errors with synchronization
- Runtime errors with stack traces and locations
- All errors include line:column information

## Integration with Kernel

The interpreter directly calls kernel functions:
- `createSeed(domain, name, geneMap)` — Create new seeds
- `crossover(parentA, parentB, options, rng)` — Breed operation
- `mutate(seed, options, rng)` — Mutation operation
- Gene factory functions: `scalar()`, `categorical()`, `vector()`
- `DeterministicRNG` for reproducible randomness

## API

### Main Entry Point
```typescript
import { run } from '@language/index.js';

const result = run(sourceCode, 'filename.gspl');

// result contains:
// - seeds: UniversalSeed[] — all created seeds
// - exports: Record<string, unknown> — exported values
// - errors: RuntimeError[] — any execution errors
// - timing: { parseMs, executeMs, totalMs }
```

### Exports
```typescript
export { Lexer, LexerError } from './lexer.js';
export { Parser, ParseError } from './parser.js';
export { Interpreter, RuntimeError, Environment, ExecutionResult } from './interpreter.js';
export * from './tokens.js';
export * from './ast.js';
```

## File Locations

All files in `/src/language/`:
- `tokens.ts` — Token definitions (2.2 KB)
- `lexer.ts` — Tokenizer (9.2 KB)
- `ast.ts` — AST node types (6.2 KB)
- `parser.ts` — Parser (28 KB)
- `interpreter.ts` — Interpreter (23 KB)
- `index.ts` — Barrel export (1.3 KB)

**Total**: 70 KB of production TypeScript code

## Quality Standards

✓ Full TypeScript strict mode compliance
✓ No `any` types
✓ Complete error handling with locations
✓ Proper lexical scoping and environments
✓ Direct kernel integration
✓ Comprehensive standard library
✓ Fast single-pass lexing
✓ Efficient recursive descent parsing
✓ Clean, readable AST structure

## Example Program

```gspl
// Create a base visual seed
seed BaseVisual {
  domain: visual2d
  genes: {
    x: scalar = 50, min: 0, max: 100
    y: scalar = 50, min: 0, max: 100
    size: scalar = 20, min: 5, max: 50
    color: categorical = "blue", options: ["red", "blue", "green"]
  }
}

// Utility function
fn mix(a, b, t) {
  return a * (1 - t) + b * t
}

// Create a variation
let variant1 = mutate(BaseVisual, rate: 0.2, intensity: 0.5)
let variant2 = mutate(BaseVisual, rate: 0.1, intensity: 0.3)

// Breed them
let offspring = breed(variant1, variant2, dominance: 0.5)

// Compose with base
let final = compose(offspring, BaseVisual)
```

## Next Steps

1. **Compiler**: Add TypeScript emission for faster execution
2. **Optimization**: JIT compilation for hot code paths
3. **Debugging**: Source map support and debugger integration
4. **Module System**: Full import/export with module resolution
5. **Type Checking**: Optional static type analysis
6. **Async**: Promise and async/await support for long-running evolution
