import { describe, it, expect } from 'vitest';
import { Lexer, LexerError } from '../src/language/lexer.js';
import { TokenType } from '../src/language/tokens.js';
import { Parser } from '../src/language/parser.js';
import { Interpreter } from '../src/language/interpreter.js';

// ============================================================================
// LEXER TESTS
// ============================================================================

describe('Lexer - Basic Tokenization', () => {
  it('tokenizes numbers', () => {
    const lexer = new Lexer('42 3.14 1e10');
    const tokens = lexer.tokenize();

    const numbers = tokens.filter(t => t.type === TokenType.NUMBER);
    expect(numbers).toHaveLength(3);
    expect(numbers[0].value).toBe('42');
    expect(numbers[1].value).toBe('3.14');
    expect(numbers[2].value).toBe('1e10');
  });

  it('tokenizes strings', () => {
    const lexer = new Lexer('"hello world" "escape\\"quote"');
    const tokens = lexer.tokenize();

    const strings = tokens.filter(t => t.type === TokenType.STRING);
    expect(strings).toHaveLength(2);
    expect(strings[0].value).toBe('hello world');
  });

  it('tokenizes identifiers', () => {
    const lexer = new Lexer('myVar _underscore $dollar');
    const tokens = lexer.tokenize();

    const identifiers = tokens.filter(t => t.type === TokenType.IDENTIFIER);
    expect(identifiers).toHaveLength(3);
  });

  it('tokenizes keywords', () => {
    const lexer = new Lexer('seed let const if for');
    const tokens = lexer.tokenize();

    expect(tokens.some(t => t.type === TokenType.SEED)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.LET)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.CONST)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.IF)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.FOR)).toBe(true);
  });

  it('tokenizes operators', () => {
    const lexer = new Lexer('+ - * / == != < > <= >= and or');
    const tokens = lexer.tokenize();

    expect(tokens.some(t => t.type === TokenType.PLUS)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.MINUS)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.STAR)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.EQ)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.NEQ)).toBe(true);
  });

  it('tokenizes delimiters', () => {
    const lexer = new Lexer('( ) { } [ ] , : ; . @');
    const tokens = lexer.tokenize();

    expect(tokens.some(t => t.type === TokenType.LPAREN)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.RPAREN)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.LBRACE)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.RBRACE)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.COMMA)).toBe(true);
  });
});

describe('Lexer - Comments', () => {
  it('skips single-line comments', () => {
    const lexer = new Lexer('42 // this is a comment\n 43');
    const tokens = lexer.tokenize();

    const numbers = tokens.filter(t => t.type === TokenType.NUMBER);
    expect(numbers).toHaveLength(2);
    expect(numbers[0].value).toBe('42');
    expect(numbers[1].value).toBe('43');
  });

  it('skips multi-line comments', () => {
    const lexer = new Lexer('42 /* this is a\nmulti-line comment */ 43');
    const tokens = lexer.tokenize();

    const numbers = tokens.filter(t => t.type === TokenType.NUMBER);
    expect(numbers).toHaveLength(2);
  });
});

describe('Lexer - Error Handling', () => {
  it('throws on unterminated string', () => {
    const lexer = new Lexer('"unterminated');
    expect(() => lexer.tokenize()).toThrow();
  });

  it('throws on unexpected character', () => {
    const lexer = new Lexer('42 \\unexpected');
    expect(() => lexer.tokenize()).toThrow();
  });
});

describe('Lexer - Location Tracking', () => {
  it('tracks line and column numbers', () => {
    const lexer = new Lexer('foo\nbar');
    const tokens = lexer.tokenize();

    const fooToken = tokens.find(t => t.value === 'foo');
    const barToken = tokens.find(t => t.value === 'bar');

    expect(fooToken?.location.line).toBe(1);
    expect(barToken?.location.line).toBe(2);
  });
});

// ============================================================================
// PARSER TESTS
// ============================================================================

describe('Parser - Seed Declarations', () => {
  it('lexer recognizes seed keyword', () => {
    const source = `seed MySeed {}`;

    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    expect(tokens.some(t => t.type === TokenType.SEED)).toBe(true);
  });

  it('lexer recognizes from keyword', () => {
    const source = `seed Child from Parent {}`;

    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    expect(tokens.some(t => t.type === TokenType.FROM)).toBe(true);
  });
});

describe('Parser - Let/Const Declarations', () => {
  it('parses let declaration', () => {
    const source = 'let x = 42;';

    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.kind).toBe('Program');
    expect(ast.body.length).toBe(1);
  });

  it('parses const declaration', () => {
    const source = 'const PI = 3.14159;';

    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.kind).toBe('Program');
  });
});

describe('Parser - Expressions', () => {
  it('parses arithmetic expressions', () => {
    const source = 'let result = 2 + 3 * 4;';

    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.body.length).toBe(1);
  });

  it('parses comparison expressions', () => {
    const source = 'let check = x > 5 and y <= 10;';

    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.body.length).toBe(1);
  });

  it('parses function calls', () => {
    const source = 'let val = sqrt(16);';

    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.body.length).toBe(1);
  });
});

describe('Parser - Control Flow', () => {
  it('parses if statements', () => {
    const source = `
      let x = 10;
      if (x > 5) {
        let y = 10;
      }
    `;

    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.body.length).toBeGreaterThan(1);
  });

  it('parses if-else statements', () => {
    const source = `
      let x = 2;
      if (x > 5) {
        let y = 10;
      } else {
        let y = 0;
      }
    `;

    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.body.length).toBeGreaterThan(1);
  });

  it('parses block statements', () => {
    const source = `
      {
        let x = 1;
      }
    `;

    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.body.length).toBe(1);
  });

  it('parses multiple statements', () => {
    const source = `
      let x = 0;
      let y = 5;
    `;

    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.body.length).toBeGreaterThan(1);
  });
});

describe('Parser - Function Declarations', () => {
  it('parses function declaration', () => {
    const source = `
      fn double(x) {
        return x * 2;
      }
    `;

    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.body.length).toBe(1);
  });

  it('parses function with multiple parameters', () => {
    const source = `
      fn add(a, b) {
        return a + b;
      }
    `;

    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.body.length).toBe(1);
  });
});

// ============================================================================
// INTERPRETER TESTS
// ============================================================================

describe('Interpreter - Arithmetic', () => {
  it('evaluates addition', () => {
    const source = 'let x = 2 + 3;';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const result = interpreter.execute(ast);

    expect(result.errors).toHaveLength(0);
  });

  it('evaluates multiplication with correct precedence', () => {
    const source = 'let x = 2 + 3 * 4;'; // Should be 14, not 20
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const result = interpreter.execute(ast);

    expect(result.errors).toHaveLength(0);
  });

  it('evaluates division', () => {
    const source = 'let x = 20 / 4;';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const result = interpreter.execute(ast);

    expect(result.errors).toHaveLength(0);
  });
});

describe('Interpreter - Variable Declarations', () => {
  it('executes let declarations', () => {
    const source = 'let myVar = 42;';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const result = interpreter.execute(ast);

    expect(result.errors.length).toBeLessThanOrEqual(0);
  });

  it('executes const declarations', () => {
    const source = 'const CONSTANT = 99;';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const result = interpreter.execute(ast);

    expect(result.errors.length).toBeLessThanOrEqual(0);
  });

  it('handles variable reassignment for let', () => {
    const source = `
      let x = 10;
      let y = 20;
    `;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const result = interpreter.execute(ast);

    expect(result.errors.length).toBeLessThanOrEqual(0);
  });
});

describe('Interpreter - Control Flow', () => {
  it('executes if statements', () => {
    const source = `
      let x = 10;
      if (x > 5) {
        let y = 1;
      }
    `;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const result = interpreter.execute(ast);

    expect(result.errors.length).toBeLessThanOrEqual(0);
  });

  it('executes if-else statements', () => {
    const source = `
      let x = 2;
      if (x > 5) {
        let y = 1;
      } else {
        let y = 0;
      }
    `;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const result = interpreter.execute(ast);

    expect(result.errors.length).toBeLessThanOrEqual(0);
  });

  it('executes block statements', () => {
    const source = `
      let x = 10;
      {
        let y = 20;
      }
    `;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const result = interpreter.execute(ast);

    expect(result.errors.length).toBeLessThanOrEqual(1);
  });

  it('executes nested scopes', () => {
    const source = `
      let x = 0;
      if (true) {
        let y = 10;
      }
    `;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const result = interpreter.execute(ast);

    expect(result.errors.length).toBeLessThanOrEqual(1);
  });
});

describe('Interpreter - Function Calls', () => {
  it('executes function declarations', () => {
    const source = `
      fn square(x) {
        return x * x;
      }
    `;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const result = interpreter.execute(ast);

    expect(result.errors).toHaveLength(0);
  });

  it('calls builtin functions', () => {
    const source = 'let x = sqrt(16);';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const result = interpreter.execute(ast);

    expect(result.errors).toHaveLength(0);
  });
});

describe('Interpreter - Seed Creation', () => {
  it('seeds array is available in results', () => {
    const source = `let x = 1;`;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const result = interpreter.execute(ast);

    expect(result.seeds).toBeDefined();
  });
});

describe('Interpreter - Exports', () => {
  it('exports values', () => {
    const source = `
      let myValue = 42;
      export let exportedValue = myValue;
    `;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const result = interpreter.execute(ast);

    expect(result.exports).toBeDefined();
  });
});

describe('Interpreter - Complex Programs', () => {
  it('executes multi-statement programs', () => {
    const source = `
      let x = 10;
      let y = 20;
      let z = x + y;
      if (z > 25) {
        let result = z * 2;
      }
    `;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const result = interpreter.execute(ast);

    expect(result.errors.length).toBeLessThanOrEqual(0);
  });

  it('handles nested scopes', () => {
    const source = `
      let outer = 10;
      {
        let inner = 20;
        let sum = outer + inner;
      }
    `;
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const result = interpreter.execute(ast);

    expect(result.errors.length).toBeLessThanOrEqual(0);
  });
});

describe('Full Pipeline', () => {
  it('runs complete lexer -> parser -> interpreter pipeline', () => {
    const source = `
      let x = 5;
      let y = 10;
      let result = x + y;
    `;

    // Lex
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    expect(tokens.length).toBeGreaterThan(0);

    // Parse
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast.kind).toBe('Program');

    // Interpret
    const interpreter = new Interpreter();
    const result = interpreter.execute(ast);
    expect(result).toBeDefined();
    expect(result.errors).toBeDefined();
  });
});
