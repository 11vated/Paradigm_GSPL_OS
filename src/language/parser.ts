/**
 * parser.ts — Recursive Descent Parser for GSPL
 * Converts tokens into an Abstract Syntax Tree.
 */

import { Token, TokenType, SourceLocation } from './tokens.js';
import * as AST from './ast.js';

export class ParseError extends Error {
  constructor(message: string, public location: SourceLocation) {
    super(`[${location.line}:${location.column}] ${message}`);
  }
}

export class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private errors: ParseError[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): AST.ProgramNode {
    const body: AST.ASTNode[] = [];
    const location = this.current().location;

    while (!this.isAtEnd()) {
      this.skipNewlines();
      if (this.isAtEnd()) break;

      try {
        const node = this.parseDeclaration();
        if (node) body.push(node);
      } catch (err) {
        if (err instanceof ParseError) {
          this.errors.push(err);
        }
        this.synchronize();
      }

      this.skipNewlines();
    }

    if (this.errors.length > 0) {
      throw this.errors[0];
    }

    return {
      kind: 'Program',
      body,
      location,
    };
  }

  // ========================================================================
  // DECLARATIONS
  // ========================================================================

  private parseDeclaration(): AST.ASTNode | null {
    this.skipNewlines();

    if (this.match(TokenType.SEED)) {
      return this.parseSeedDeclaration();
    }

    if (this.match(TokenType.FN)) {
      return this.parseFunctionDeclaration();
    }

    if (this.match(TokenType.LET, TokenType.CONST)) {
      return this.parseLetDeclaration();
    }

    if (this.match(TokenType.IMPORT)) {
      return this.parseImport();
    }

    if (this.match(TokenType.EXPORT)) {
      return this.parseExport();
    }

    return this.parseStatement();
  }

  private parseSeedDeclaration(): AST.SeedDeclarationNode {
    const location = this.previous().location;
    const name = this.expect(TokenType.IDENTIFIER, 'Expected seed name').value;

    let domain = 'custom';

    // Check for : domain syntax (seed name : domain { ... })
    if (this.match(TokenType.COLON)) {
      domain = this.expect(TokenType.IDENTIFIER, 'Expected domain name').value;
    }

    let extends_: string | undefined;
    if (this.match(TokenType.FROM)) {
      extends_ = this.expect(TokenType.IDENTIFIER, 'Expected parent seed name').value;
    }

    this.expect(TokenType.LBRACE, 'Expected { after seed name');
    this.skipNewlines();

    // Check if domain is specified inside the braces (legacy syntax)
    if (this.check(TokenType.DOMAIN)) {
      this.advance();
      this.expect(TokenType.COLON, 'Expected : after domain');
      domain = this.expect(TokenType.IDENTIFIER, 'Expected domain name').value;
      this.consumeStatementEnd();
      this.skipNewlines();
    }

    const genes = this.parseGeneBlock();
    this.skipNewlines();
    this.expect(TokenType.RBRACE, 'Expected } after seed declaration');

    return {
      kind: 'SeedDeclaration',
      name,
      domain,
      extends: extends_,
      genes,
      location,
    };
  }

  private parseGeneBlock(): AST.GeneBlockNode {
    const location = this.current().location;
    const properties: AST.GenePropertyNode[] = [];

    if (this.check(TokenType.GENES)) {
      this.advance();
      // Support both "genes:" and "genes {" syntax
      if (this.match(TokenType.COLON)) {
        // genes: { ... } syntax
      }
      this.skipNewlines();
      this.expect(TokenType.LBRACE, 'Expected { after genes');
      this.skipNewlines();

      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        if (this.check(TokenType.NEWLINE)) {
          this.advance();
          continue;
        }
        properties.push(this.parseGeneProperty());
        this.consumeStatementEnd();
        this.skipNewlines();
      }

      this.expect(TokenType.RBRACE, 'Expected } after genes block');
      this.skipNewlines();
    } else {
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        if (this.check(TokenType.NEWLINE)) {
          this.advance();
          continue;
        }
        properties.push(this.parseGeneProperty());
        this.consumeStatementEnd();
        this.skipNewlines();
      }
    }

    return {
      kind: 'GeneBlock',
      properties,
      location,
    };
  }

  private parseGeneProperty(): AST.GenePropertyNode {
    const location = this.current().location;
    const name = this.expect(TokenType.IDENTIFIER, 'Expected property name').value;

    let geneType = 'scalar';
    // Support both "name: type = value" and "name: value" syntax
    if (this.match(TokenType.COLON)) {
      // Peek ahead to see if this is a type specification or a value
      if (this.check(TokenType.IDENTIFIER)) {
        const nextPos = this.pos + 1;
        if (nextPos < this.tokens.length && this.tokens[nextPos].type === TokenType.ASSIGN) {
          // It's a type: name: type = value
          geneType = this.advance().value;
        } else if (nextPos < this.tokens.length && this.tokens[nextPos].type === TokenType.COLON) {
          // It's a type: name: type: constraints
          geneType = this.advance().value;
        }
        // Otherwise, it's just "name: value" so we stay at the value
      }
    } else {
      // If no colon, expect = for the assignment
      this.expect(TokenType.ASSIGN, 'Expected : or = in gene property');
    }

    // Check for both = and : as assignment operators
    if (!this.match(TokenType.ASSIGN)) {
      // We're in the value already, don't consume anything
    }
    const value = this.parseExpression();

    const constraints: Record<string, AST.Expression> = {};
    while (this.match(TokenType.COMMA)) {
      this.skipNewlines();
      if (this.check(TokenType.RBRACE)) {
        this.pos--;
        break;
      }
      const constraintName = this.expect(TokenType.IDENTIFIER, 'Expected constraint name').value;
      this.expect(TokenType.COLON, 'Expected : after constraint name');
      constraints[constraintName] = this.parseEquality();
    }

    return {
      kind: 'GeneProperty',
      name,
      geneType,
      value,
      constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
      location,
    };
  }

  private parseFunctionDeclaration(): AST.FunctionDeclarationNode {
    const location = this.previous().location;
    const name = this.expect(TokenType.IDENTIFIER, 'Expected function name').value;

    this.expect(TokenType.LPAREN, 'Expected ( after function name');
    const params = this.parseParameterList();
    this.expect(TokenType.RPAREN, 'Expected ) after parameters');

    let returnType: string | undefined;
    if (this.match(TokenType.ARROW)) {
      returnType = this.expect(TokenType.IDENTIFIER, 'Expected return type').value;
    }

    this.skipNewlines();
    this.expect(TokenType.LBRACE, 'Expected { before function body');
    const body = this.parseBlock();
    this.expect(TokenType.RBRACE, 'Expected } after function body');

    return {
      kind: 'FunctionDeclaration',
      name,
      params,
      body,
      returnType,
      location,
    };
  }

  private parseLetDeclaration(): AST.LetDeclarationNode {
    const isMutable = this.previous().type === TokenType.LET;
    const location = this.previous().location;
    const name = this.expect(TokenType.IDENTIFIER, 'Expected variable name').value;

    let typeAnnotation: string | undefined;
    if (this.match(TokenType.COLON)) {
      typeAnnotation = this.expect(TokenType.IDENTIFIER, 'Expected type annotation').value;
    }

    this.expect(TokenType.ASSIGN, 'Expected = in let declaration');
    const initializer = this.parseExpression();
    this.consumeStatementEnd();

    return {
      kind: 'LetDeclaration',
      name,
      mutable: isMutable,
      typeAnnotation,
      initializer,
      location,
    };
  }

  private parseImport(): AST.ImportNode {
    const location = this.previous().location;
    const names: Array<{ name: string; alias?: string }> = [];

    if (!this.check(TokenType.STRING)) {
      do {
        const name = this.expect(TokenType.IDENTIFIER, 'Expected import name').value;
        let alias: string | undefined;
        if (this.match(TokenType.AS)) {
          alias = this.expect(TokenType.IDENTIFIER, 'Expected alias').value;
        }
        names.push({ name, alias });
      } while (this.match(TokenType.COMMA));
    }

    this.expect(TokenType.FROM, 'Expected from in import statement');
    const source = this.expect(TokenType.STRING, 'Expected import source').value;
    this.consumeStatementEnd();

    return {
      kind: 'Import',
      names,
      source,
      location,
    };
  }

  private parseExport(): AST.ExportNode {
    const location = this.previous().location;

    if (this.match(TokenType.SEED, TokenType.FN, TokenType.LET, TokenType.CONST)) {
      this.pos--;
      const declaration = this.parseDeclaration();
      if (!declaration) {
        this.error('Expected declaration after export');
      }
      return {
        kind: 'Export',
        declaration: declaration!,
        location,
      };
    }

    this.error('Expected declaration after export');
  }

  // ========================================================================
  // STATEMENTS
  // ========================================================================

  private parseStatement(): AST.ASTNode {
    this.skipNewlines();

    if (this.match(TokenType.IF)) {
      return this.parseIfStatement();
    }

    if (this.match(TokenType.FOR)) {
      return this.parseForStatement();
    }

    if (this.match(TokenType.WHILE)) {
      return this.parseWhileStatement();
    }

    if (this.match(TokenType.RETURN)) {
      return this.parseReturnStatement();
    }

    if (this.check(TokenType.LBRACE)) {
      return this.parseBlockStatement();
    }

    return this.parseExpressionStatement();
  }

  private parseIfStatement(): AST.IfStatement {
    const location = this.previous().location;
    this.expect(TokenType.LPAREN, 'Expected ( after if');
    const condition = this.parseExpression();
    this.expect(TokenType.RPAREN, 'Expected ) after if condition');
    this.skipNewlines();

    const consequent = this.parseStatement();
    const consequentArray = this.isBlock(consequent)
      ? (consequent as AST.BlockNode).body
      : [consequent];

    let alternate: AST.ASTNode[] | undefined;
    if (this.match(TokenType.ELSE)) {
      this.skipNewlines();
      const altStatement = this.parseStatement();
      alternate = this.isBlock(altStatement)
        ? (altStatement as AST.BlockNode).body
        : [altStatement];
    }

    return {
      kind: 'IfStatement',
      condition,
      consequent: consequentArray,
      alternate,
      location,
    };
  }

  private parseForStatement(): AST.ForStatement {
    const location = this.previous().location;
    this.expect(TokenType.LPAREN, 'Expected ( after for');
    const variable = this.expect(TokenType.IDENTIFIER, 'Expected variable name').value;
    this.expect(TokenType.IN, 'Expected in in for loop');
    const iterable = this.parseExpression();
    this.expect(TokenType.RPAREN, 'Expected ) after for clause');
    this.skipNewlines();

    const statement = this.parseStatement();
    const body = this.isBlock(statement)
      ? (statement as AST.BlockNode).body
      : [statement];

    return {
      kind: 'ForStatement',
      variable,
      iterable,
      body,
      location,
    };
  }

  private parseWhileStatement(): AST.WhileStatement {
    const location = this.previous().location;
    this.expect(TokenType.LPAREN, 'Expected ( after while');
    const condition = this.parseExpression();
    this.expect(TokenType.RPAREN, 'Expected ) after while condition');
    this.skipNewlines();

    const statement = this.parseStatement();
    const body = this.isBlock(statement)
      ? (statement as AST.BlockNode).body
      : [statement];

    return {
      kind: 'WhileStatement',
      condition,
      body,
      location,
    };
  }

  private parseReturnStatement(): AST.ReturnStatement {
    const location = this.previous().location;
    let value: AST.Expression | undefined;

    if (!this.check(TokenType.SEMICOLON) &&
        !this.check(TokenType.NEWLINE) &&
        !this.check(TokenType.RBRACE) &&
        !this.isAtEnd()) {
      value = this.parseExpression();
    }

    this.consumeStatementEnd();
    return {
      kind: 'ReturnStatement',
      value,
      location,
    };
  }

  private parseBlockStatement(): AST.BlockNode {
    const location = this.current().location;
    this.expect(TokenType.LBRACE, 'Expected {');
    const body = this.parseBlock();
    this.expect(TokenType.RBRACE, 'Expected }');
    return {
      kind: 'Block',
      body,
      location,
    };
  }

  private parseBlock(): AST.ASTNode[] {
    const statements: AST.ASTNode[] = [];

    this.skipNewlines();
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const stmt = this.parseDeclaration();
      if (stmt) statements.push(stmt);
      this.skipNewlines();
    }

    return statements;
  }

  private parseExpressionStatement(): AST.ExpressionStatement {
    const expr = this.parseExpression();
    this.consumeStatementEnd();
    return {
      kind: 'ExpressionStatement',
      expression: expr,
      location: expr.location,
    };
  }

  // ========================================================================
  // EXPRESSIONS (Precedence Climbing)
  // ========================================================================

  private parseExpression(): AST.Expression {
    return this.parsePipe();
  }

  private parsePipe(): AST.Expression {
    let left = this.parseOr();

    while (this.match(TokenType.PIPE)) {
      const location = this.previous().location;
      const right = this.parseOr();
      left = {
        kind: 'PipeExpression',
        left,
        right,
        location,
      };
    }

    return left;
  }

  private parseOr(): AST.Expression {
    let left = this.parseAnd();

    while (this.match(TokenType.OR)) {
      const location = this.previous().location;
      const operator = this.previous().value;
      const right = this.parseAnd();
      left = {
        kind: 'BinaryExpression',
        operator,
        left,
        right,
        location,
      };
    }

    return left;
  }

  private parseAnd(): AST.Expression {
    let left = this.parseEquality();

    while (this.match(TokenType.AND)) {
      const location = this.previous().location;
      const operator = this.previous().value;
      const right = this.parseEquality();
      left = {
        kind: 'BinaryExpression',
        operator,
        left,
        right,
        location,
      };
    }

    return left;
  }

  private parseEquality(): AST.Expression {
    let left = this.parseComparison();

    while (this.match(TokenType.EQ, TokenType.NEQ)) {
      const location = this.previous().location;
      const operator = this.previous().value;
      const right = this.parseComparison();
      left = {
        kind: 'BinaryExpression',
        operator,
        left,
        right,
        location,
      };
    }

    return left;
  }

  private parseComparison(): AST.Expression {
    let left = this.parseAddition();

    while (this.match(TokenType.LT, TokenType.GT, TokenType.LTE, TokenType.GTE)) {
      const location = this.previous().location;
      const operator = this.previous().value;
      const right = this.parseAddition();
      left = {
        kind: 'BinaryExpression',
        operator,
        left,
        right,
        location,
      };
    }

    return left;
  }

  private parseAddition(): AST.Expression {
    let left = this.parseMultiplication();

    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const location = this.previous().location;
      const operator = this.previous().value;
      const right = this.parseMultiplication();
      left = {
        kind: 'BinaryExpression',
        operator,
        left,
        right,
        location,
      };
    }

    return left;
  }

  private parseMultiplication(): AST.Expression {
    let left = this.parsePower();

    while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
      const location = this.previous().location;
      const operator = this.previous().value;
      const right = this.parsePower();
      left = {
        kind: 'BinaryExpression',
        operator,
        left,
        right,
        location,
      };
    }

    return left;
  }

  private parsePower(): AST.Expression {
    let left = this.parseUnary();

    while (this.match(TokenType.POWER)) {
      const location = this.previous().location;
      const operator = this.previous().value;
      const right = this.parseUnary();
      left = {
        kind: 'BinaryExpression',
        operator,
        left,
        right,
        location,
      };
    }

    return left;
  }

  private parseUnary(): AST.Expression {
    if (this.match(TokenType.NOT, TokenType.MINUS)) {
      const location = this.previous().location;
      const operator = this.previous().value;
      const operand = this.parseUnary();
      return {
        kind: 'UnaryExpression',
        operator,
        operand,
        location,
      };
    }

    return this.parseCall();
  }

  private parseCall(): AST.Expression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.match(TokenType.LPAREN)) {
        const location = expr.location;
        const args = this.parseArgumentList();
        this.expect(TokenType.RPAREN, 'Expected ) after arguments');
        expr = {
          kind: 'CallExpression',
          callee: expr,
          args,
          location,
        };
      } else if (this.match(TokenType.DOT)) {
        const location = expr.location;
        const property = this.expect(TokenType.IDENTIFIER, 'Expected property name').value;
        expr = {
          kind: 'MemberExpression',
          object: expr,
          property,
          computed: false,
          location,
        };
      } else if (this.match(TokenType.LBRACKET)) {
        const location = expr.location;
        const indexExpr = this.parseExpression();
        this.expect(TokenType.RBRACKET, 'Expected ] after index');
        expr = {
          kind: 'MemberExpression',
          object: expr,
          property: indexExpr,
          computed: true,
          location,
        };
      } else {
        break;
      }
    }

    return expr;
  }

  private parsePrimary(): AST.Expression {
    const location = this.current().location;

    // Literals
    if (this.match(TokenType.NUMBER)) {
      return {
        kind: 'NumberLiteral',
        value: parseFloat(this.previous().value),
        location,
      };
    }

    if (this.match(TokenType.STRING)) {
      return {
        kind: 'StringLiteral',
        value: this.previous().value,
        location,
      };
    }

    if (this.match(TokenType.TRUE)) {
      return {
        kind: 'BooleanLiteral',
        value: true,
        location,
      };
    }

    if (this.match(TokenType.FALSE)) {
      return {
        kind: 'BooleanLiteral',
        value: false,
        location,
      };
    }

    if (this.match(TokenType.NULL)) {
      return {
        kind: 'NullLiteral',
        location,
      };
    }

    // Array
    if (this.match(TokenType.LBRACKET)) {
      const elements: AST.Expression[] = [];
      if (!this.check(TokenType.RBRACKET)) {
        do {
          elements.push(this.parseExpression());
        } while (this.match(TokenType.COMMA));
      }
      this.expect(TokenType.RBRACKET, 'Expected ] after array');
      return {
        kind: 'ArrayLiteral',
        elements,
        location,
      };
    }

    // Object
    if (this.match(TokenType.LBRACE)) {
      const properties: Array<{ key: string; value: AST.Expression }> = [];
      this.skipNewlines();
      if (!this.check(TokenType.RBRACE)) {
        do {
          this.skipNewlines();
          const key = this.expect(TokenType.IDENTIFIER, 'Expected property key').value;
          this.expect(TokenType.COLON, 'Expected : after property key');
          const value = this.parseExpression();
          properties.push({ key, value });
          this.skipNewlines();
        } while (this.match(TokenType.COMMA));
        this.skipNewlines();
      }
      this.expect(TokenType.RBRACE, 'Expected } after object');
      return {
        kind: 'ObjectLiteral',
        properties,
        location,
      };
    }

    // Parenthesized expression
    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseExpression();
      this.expect(TokenType.RPAREN, 'Expected ) after expression');
      return expr;
    }

    // Seed operations
    if (this.match(TokenType.BREED)) {
      this.expect(TokenType.LPAREN, 'Expected ( after breed');
      const parentA = this.parseExpression();
      this.expect(TokenType.COMMA, 'Expected , between breed parents');
      const parentB = this.parseExpression();

      let dominance: AST.Expression | undefined;
      let strategy: string | undefined;

      while (this.match(TokenType.COMMA)) {
        // Support both positional (breed(A, B, 0.6)) and named (breed(A, B, dominance: 0.6))
        if (this.check(TokenType.IDENTIFIER) && this.peekNext()?.type === TokenType.COLON) {
          const paramName = this.advance().value;
          this.advance(); // consume :
          const paramValue = this.parseExpression();
          if (paramName === 'dominance') dominance = paramValue;
          else if (paramName === 'strategy' && paramValue.kind === 'StringLiteral') {
            strategy = (paramValue as AST.StringLiteral).value;
          }
        } else {
          // Positional: third arg is dominance
          if (!dominance) {
            dominance = this.parseExpression();
          } else {
            this.parseExpression(); // skip extra positional args
          }
        }
      }

      this.expect(TokenType.RPAREN, 'Expected ) after breed');
      return {
        kind: 'BreedExpression',
        parentA,
        parentB,
        dominance,
        strategy,
        location,
      };
    }

    if (this.match(TokenType.MUTATE)) {
      this.expect(TokenType.LPAREN, 'Expected ( after mutate');
      const seed = this.parseExpression();

      let rate: AST.Expression | undefined;
      let intensity: AST.Expression | undefined;

      let positionalIndex = 0;
      while (this.match(TokenType.COMMA)) {
        if (this.check(TokenType.IDENTIFIER) && this.peekNext()?.type === TokenType.COLON) {
          const paramName = this.advance().value;
          this.advance();
          const paramValue = this.parseExpression();
          if (paramName === 'rate') rate = paramValue;
          else if (paramName === 'intensity') intensity = paramValue;
        } else {
          const val = this.parseExpression();
          if (positionalIndex === 0) rate = val;
          else if (positionalIndex === 1) intensity = val;
          positionalIndex++;
        }
      }

      this.expect(TokenType.RPAREN, 'Expected ) after mutate');
      return {
        kind: 'MutateExpression',
        seed,
        rate,
        intensity,
        location,
      };
    }

    if (this.match(TokenType.COMPOSE)) {
      this.expect(TokenType.LPAREN, 'Expected ( after compose');
      const base = this.parseExpression();
      this.expect(TokenType.COMMA, 'Expected , between compose arguments');
      const overlay = this.parseExpression();

      let layers: string[] | undefined;
      if (this.match(TokenType.COMMA)) {
        const layersParam = this.expect(TokenType.IDENTIFIER, 'Expected parameter name').value;
        this.expect(TokenType.COLON, 'Expected : after parameter name');
        if (this.match(TokenType.LBRACKET)) {
          const layerList: string[] = [];
          do {
            layerList.push(
              this.expect(TokenType.IDENTIFIER, 'Expected layer name').value
            );
          } while (this.match(TokenType.COMMA));
          this.expect(TokenType.RBRACKET, 'Expected ] after layers');
          layers = layerList;
        }
      }

      this.expect(TokenType.RPAREN, 'Expected ) after compose');
      return {
        kind: 'ComposeExpression',
        base,
        overlay,
        layers,
        location,
      };
    }

    if (this.match(TokenType.EVOLVE)) {
      this.expect(TokenType.LPAREN, 'Expected ( after evolve');
      const seed = this.parseExpression();

      let population: AST.Expression | undefined;
      let generations: AST.Expression | undefined;
      let fitnessRef: string | undefined;

      let evolvePositional = 0;
      while (this.match(TokenType.COMMA)) {
        if (this.check(TokenType.IDENTIFIER) && this.peekNext()?.type === TokenType.COLON) {
          const paramName = this.advance().value;
          this.advance();
          const paramValue = this.parseExpression();
          if (paramName === 'population') population = paramValue;
          else if (paramName === 'generations') generations = paramValue;
          else if (paramName === 'fitness' && paramValue.kind === 'StringLiteral') {
            fitnessRef = (paramValue as AST.StringLiteral).value;
          }
        } else {
          const val = this.parseExpression();
          if (evolvePositional === 0) generations = val;
          else if (evolvePositional === 1) population = val;
          evolvePositional++;
        }
      }

      this.expect(TokenType.RPAREN, 'Expected ) after evolve');
      return {
        kind: 'EvolveExpression',
        seed,
        population,
        generations,
        fitnessRef,
        location,
      };
    }

    // Identifier or arrow function
    if (this.match(TokenType.IDENTIFIER)) {
      const name = this.previous().value;
      const idLocation = this.previous().location;

      // Check if this is an arrow function
      if (this.match(TokenType.ARROW)) {
        const params = [{ name, typeAnnotation: undefined }];
        const bodyIsBlock = this.check(TokenType.LBRACE);

        if (bodyIsBlock) {
          this.expect(TokenType.LBRACE, 'Expected {');
          const body = this.parseBlock();
          this.expect(TokenType.RBRACE, 'Expected }');
          return {
            kind: 'ArrowFunction',
            params,
            body,
            isBlock: true,
            location: idLocation,
          };
        } else {
          const body = this.parseExpression();
          return {
            kind: 'ArrowFunction',
            params,
            body,
            isBlock: false,
            location: idLocation,
          };
        }
      }

      return {
        kind: 'Identifier',
        name,
        location: idLocation,
      };
    }

    this.error('Expected expression');
  }

  // ========================================================================
  // UTILITY PARSING FUNCTIONS
  // ========================================================================

  private parseParameterList(): Array<{ name: string; typeAnnotation?: string }> {
    const params: Array<{ name: string; typeAnnotation?: string }> = [];

    if (!this.check(TokenType.RPAREN)) {
      do {
        const name = this.expect(TokenType.IDENTIFIER, 'Expected parameter name').value;
        let typeAnnotation: string | undefined;
        if (this.match(TokenType.COLON)) {
          typeAnnotation = this.expect(TokenType.IDENTIFIER, 'Expected type annotation').value;
        }
        params.push({ name, typeAnnotation });
      } while (this.match(TokenType.COMMA));
    }

    return params;
  }

  private parseArgumentList(): AST.Expression[] {
    const args: AST.Expression[] = [];

    if (!this.check(TokenType.RPAREN)) {
      do {
        args.push(this.parseExpression());
      } while (this.match(TokenType.COMMA));
    }

    return args;
  }

  private consumeStatementEnd(): void {
    if (this.match(TokenType.SEMICOLON, TokenType.NEWLINE)) {
      return;
    }
    if (this.check(TokenType.RBRACE) || this.isAtEnd()) {
      return;
    }
  }

  private skipNewlines(): void {
    while (this.match(TokenType.NEWLINE)) {
      // consume
    }
  }

  private isBlock(node: AST.ASTNode): boolean {
    return node.kind === 'Block';
  }

  // ========================================================================
  // TOKEN MANAGEMENT
  // ========================================================================

  private current(): Token {
    return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1];
  }

  private peekNext(): Token | undefined {
    return this.tokens[this.pos + 1];
  }

  private previous(): Token {
    return this.tokens[Math.max(0, this.pos - 1)];
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.pos++;
    return this.previous();
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.current().type === type;
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private expect(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    this.error(message);
  }

  private isAtEnd(): boolean {
    return this.current().type === TokenType.EOF;
  }

  private error(message: string): never {
    const error = new ParseError(message, this.current().location);
    throw error;
  }

  private synchronize(): void {
    this.advance();

    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.SEMICOLON) return;
      if (this.previous().type === TokenType.NEWLINE) return;

      switch (this.current().type) {
        case TokenType.SEED:
        case TokenType.FN:
        case TokenType.LET:
        case TokenType.CONST:
        case TokenType.IF:
        case TokenType.FOR:
        case TokenType.WHILE:
        case TokenType.RETURN:
          return;
      }

      this.advance();
    }
  }
}
