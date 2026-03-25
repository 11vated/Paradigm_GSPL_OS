/**
 * tokens.ts — Token Types for GSPL
 * Defines all token types used by the lexer and parser.
 */

export enum TokenType {
  // Literals
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  BOOLEAN = 'BOOLEAN',
  IDENTIFIER = 'IDENTIFIER',

  // Keywords
  SEED = 'SEED',
  DOMAIN = 'DOMAIN',
  GENES = 'GENES',
  EVOLVE = 'EVOLVE',
  BREED = 'BREED',
  COMPOSE = 'COMPOSE',
  MUTATE = 'MUTATE',
  FN = 'FN',
  LET = 'LET',
  CONST = 'CONST',
  IF = 'IF',
  ELSE = 'ELSE',
  FOR = 'FOR',
  IN = 'IN',
  WHILE = 'WHILE',
  RETURN = 'RETURN',
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',
  FROM = 'FROM',
  AS = 'AS',
  TRUE = 'TRUE',
  FALSE = 'FALSE',
  NULL = 'NULL',

  // Operators
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  STAR = 'STAR',
  SLASH = 'SLASH',
  PERCENT = 'PERCENT',
  POWER = 'POWER',
  EQ = 'EQ',
  NEQ = 'NEQ',
  LT = 'LT',
  GT = 'GT',
  LTE = 'LTE',
  GTE = 'GTE',
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  ASSIGN = 'ASSIGN',
  ARROW = 'ARROW',
  PIPE = 'PIPE',
  DOT = 'DOT',
  DOTDOT = 'DOTDOT',
  SPREAD = 'SPREAD',

  // Delimiters
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  COMMA = 'COMMA',
  COLON = 'COLON',
  SEMICOLON = 'SEMICOLON',
  AT = 'AT',

  // Special
  NEWLINE = 'NEWLINE',
  EOF = 'EOF',
  COMMENT = 'COMMENT',
}

export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
  file?: string;
}

export interface Token {
  type: TokenType;
  value: string;
  location: SourceLocation;
}

export const KEYWORDS: Record<string, TokenType> = {
  seed: TokenType.SEED,
  domain: TokenType.DOMAIN,
  genes: TokenType.GENES,
  evolve: TokenType.EVOLVE,
  breed: TokenType.BREED,
  compose: TokenType.COMPOSE,
  mutate: TokenType.MUTATE,
  fn: TokenType.FN,
  let: TokenType.LET,
  const: TokenType.CONST,
  if: TokenType.IF,
  else: TokenType.ELSE,
  for: TokenType.FOR,
  in: TokenType.IN,
  while: TokenType.WHILE,
  return: TokenType.RETURN,
  import: TokenType.IMPORT,
  export: TokenType.EXPORT,
  from: TokenType.FROM,
  as: TokenType.AS,
  true: TokenType.TRUE,
  false: TokenType.FALSE,
  null: TokenType.NULL,
  and: TokenType.AND,
  or: TokenType.OR,
  not: TokenType.NOT,
};
