/**
 * lexer.ts — Tokenizer for GSPL
 * Converts source code into tokens for the parser.
 */

import { Token, TokenType, SourceLocation, KEYWORDS } from './tokens.js';

export class LexerError extends Error {
  constructor(message: string, public location: SourceLocation) {
    super(`[${location.line}:${location.column}] ${message}`);
  }
}

export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private file?: string;
  private tokens: Token[] = [];

  constructor(source: string, file?: string) {
    this.source = source;
    this.file = file;
  }

  tokenize(): Token[] {
    while (!this.isAtEnd()) {
      this.skipWhitespace();
      if (this.isAtEnd()) break;

      const startPos = this.pos;
      const startLine = this.line;
      const startColumn = this.column;

      const char = this.peek();

      // Comments
      if (char === '/' && this.peekNext() === '/') {
        this.advance();
        this.advance();
        let comment = '';
        while (!this.isAtEnd() && this.peek() !== '\n') {
          comment += this.advance();
        }
        // Skip comments, don't add to tokens
        continue;
      }

      if (char === '/' && this.peekNext() === '*') {
        this.advance();
        this.advance();
        while (!this.isAtEnd()) {
          if (this.peek() === '*' && this.peekNext() === '/') {
            this.advance();
            this.advance();
            break;
          }
          if (this.peek() === '\n') {
            this.line++;
            this.column = 1;
          } else {
            this.column++;
          }
          this.pos++;
        }
        continue;
      }

      // Newlines
      if (char === '\n') {
        this.tokens.push(
          this.makeToken(TokenType.NEWLINE, '\n', startLine, startColumn)
        );
        this.advance();
        this.line++;
        this.column = 1;
        continue;
      }

      // Strings
      if (char === '"') {
        this.tokens.push(this.readString());
        continue;
      }

      // Numbers
      if (this.isDigit(char)) {
        this.tokens.push(this.readNumber());
        continue;
      }

      // Identifiers and keywords
      if (this.isIdentifierStart(char)) {
        this.tokens.push(this.readIdentifierOrKeyword());
        continue;
      }

      // Multi-character operators
      if (char === '=' && this.peekNext() === '=') {
        this.tokens.push(this.makeToken(TokenType.EQ, '==', startLine, startColumn));
        this.advance();
        this.advance();
        continue;
      }

      if (char === '!' && this.peekNext() === '=') {
        this.tokens.push(this.makeToken(TokenType.NEQ, '!=', startLine, startColumn));
        this.advance();
        this.advance();
        continue;
      }

      if (char === '<' && this.peekNext() === '=') {
        this.tokens.push(this.makeToken(TokenType.LTE, '<=', startLine, startColumn));
        this.advance();
        this.advance();
        continue;
      }

      if (char === '>' && this.peekNext() === '=') {
        this.tokens.push(this.makeToken(TokenType.GTE, '>=', startLine, startColumn));
        this.advance();
        this.advance();
        continue;
      }

      if (char === '*' && this.peekNext() === '*') {
        this.tokens.push(this.makeToken(TokenType.POWER, '**', startLine, startColumn));
        this.advance();
        this.advance();
        continue;
      }

      if (char === '=' && this.peekNext() === '>') {
        this.tokens.push(this.makeToken(TokenType.ARROW, '=>', startLine, startColumn));
        this.advance();
        this.advance();
        continue;
      }

      if (char === '|' && this.peekNext() === '>') {
        this.tokens.push(this.makeToken(TokenType.PIPE, '|>', startLine, startColumn));
        this.advance();
        this.advance();
        continue;
      }

      if (char === '.' && this.peekNext() === '.' && this.peekAhead(2) !== '.') {
        this.tokens.push(this.makeToken(TokenType.DOTDOT, '..', startLine, startColumn));
        this.advance();
        this.advance();
        continue;
      }

      if (char === '.' && this.peekNext() === '.' && this.peekAhead(2) === '.') {
        this.tokens.push(this.makeToken(TokenType.SPREAD, '...', startLine, startColumn));
        this.advance();
        this.advance();
        this.advance();
        continue;
      }

      // Single-character tokens
      const singleCharTokens: Record<string, TokenType> = {
        '+': TokenType.PLUS,
        '-': TokenType.MINUS,
        '*': TokenType.STAR,
        '/': TokenType.SLASH,
        '%': TokenType.PERCENT,
        '<': TokenType.LT,
        '>': TokenType.GT,
        '!': TokenType.NOT,
        '=': TokenType.ASSIGN,
        '.': TokenType.DOT,
        '(': TokenType.LPAREN,
        ')': TokenType.RPAREN,
        '{': TokenType.LBRACE,
        '}': TokenType.RBRACE,
        '[': TokenType.LBRACKET,
        ']': TokenType.RBRACKET,
        ',': TokenType.COMMA,
        ':': TokenType.COLON,
        ';': TokenType.SEMICOLON,
        '@': TokenType.AT,
      };

      if (singleCharTokens[char]) {
        this.tokens.push(
          this.makeToken(singleCharTokens[char], char, startLine, startColumn)
        );
        this.advance();
        continue;
      }

      this.error(`Unexpected character: '${char}'`);
    }

    this.tokens.push(
      this.makeToken(TokenType.EOF, '', this.line, this.column)
    );
    return this.tokens;
  }

  private advance(): string {
    const char = this.source[this.pos];
    this.pos++;
    this.column++;
    return char;
  }

  private peek(): string {
    return this.source[this.pos] ?? '';
  }

  private peekNext(): string {
    return this.source[this.pos + 1] ?? '';
  }

  private peekAhead(n: number): string {
    return this.source[this.pos + n] ?? '';
  }

  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isIdentifierStart(char: string): boolean {
    return (char >= 'a' && char <= 'z') ||
           (char >= 'A' && char <= 'Z') ||
           char === '_' ||
           char === '$';
  }

  private isIdentifierChar(char: string): boolean {
    return this.isIdentifierStart(char) || this.isDigit(char);
  }

  private skipWhitespace(): void {
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance();
      } else {
        break;
      }
    }
  }

  private readString(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    this.advance(); // consume opening quote

    let value = '';
    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === '\\') {
        this.advance();
        const escaped = this.peek();
        switch (escaped) {
          case 'n':
            value += '\n';
            break;
          case 't':
            value += '\t';
            break;
          case 'r':
            value += '\r';
            break;
          case '\\':
            value += '\\';
            break;
          case '"':
            value += '"';
            break;
          default:
            value += escaped;
        }
        this.advance();
      } else {
        if (this.peek() === '\n') {
          this.line++;
          this.column = 1;
        } else {
          this.column++;
        }
        value += this.source[this.pos];
        this.pos++;
      }
    }

    if (this.isAtEnd()) {
      this.error('Unterminated string');
    }

    this.advance(); // consume closing quote
    return this.makeToken(TokenType.STRING, value, startLine, startColumn);
  }

  private readNumber(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';

    // Integer part
    while (!this.isAtEnd() && this.isDigit(this.peek())) {
      value += this.advance();
    }

    // Decimal part
    if (!this.isAtEnd() && this.peek() === '.' && this.isDigit(this.peekNext())) {
      value += this.advance(); // consume '.'
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        value += this.advance();
      }
    }

    // Exponent part
    if (!this.isAtEnd() && (this.peek() === 'e' || this.peek() === 'E')) {
      value += this.advance(); // consume 'e'
      if (!this.isAtEnd() && (this.peek() === '+' || this.peek() === '-')) {
        value += this.advance();
      }
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        value += this.advance();
      }
    }

    return this.makeToken(TokenType.NUMBER, value, startLine, startColumn);
  }

  private readIdentifierOrKeyword(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';

    while (!this.isAtEnd() && this.isIdentifierChar(this.peek())) {
      value += this.advance();
    }

    const tokenType = KEYWORDS[value] ?? TokenType.IDENTIFIER;
    return this.makeToken(tokenType, value, startLine, startColumn);
  }

  private makeToken(
    type: TokenType,
    value: string,
    line: number,
    column: number
  ): Token {
    return {
      type,
      value,
      location: {
        line,
        column,
        offset: this.pos - value.length,
        file: this.file,
      },
    };
  }

  private error(message: string): never {
    throw new LexerError(message, {
      line: this.line,
      column: this.column,
      offset: this.pos,
      file: this.file,
    });
  }
}
