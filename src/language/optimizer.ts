/**
 * optimizer.ts — Basic AST Optimizer
 * Performs simple optimization passes on the AST before compilation.
 */

import * as AST from './ast.js';

export class Optimizer {
  optimize(program: AST.ProgramNode): AST.ProgramNode {
    return {
      ...program,
      body: this.optimizeBody(program.body),
    };
  }

  private optimizeBody(body: AST.ASTNode[]): AST.ASTNode[] {
    let result = body;
    result = this.eliminateDeadCode(result);
    result = this.inlineConstants(result);
    return result;
  }

  /**
   * Constant folding: evaluate simple binary expressions at compile time
   * e.g., 2 + 3 → 5
   */
  private foldConstants(expr: AST.Expression): AST.Expression {
    if (expr.kind !== 'BinaryExpression') {
      return expr;
    }

    const binary = expr as AST.BinaryExpression;
    const left = this.foldConstants(binary.left);
    const right = this.foldConstants(binary.right);

    // Only fold if both sides are literals
    if (left.kind !== 'NumberLiteral' || right.kind !== 'NumberLiteral') {
      return {
        ...binary,
        left,
        right,
      };
    }

    const leftVal = (left as AST.NumberLiteral).value;
    const rightVal = (right as AST.NumberLiteral).value;
    let result: number;

    switch (binary.operator) {
      case '+':
        result = leftVal + rightVal;
        break;
      case '-':
        result = leftVal - rightVal;
        break;
      case '*':
        result = leftVal * rightVal;
        break;
      case '/':
        if (rightVal === 0) return expr;
        result = leftVal / rightVal;
        break;
      case '%':
        if (rightVal === 0) return expr;
        result = leftVal % rightVal;
        break;
      case '**':
        result = Math.pow(leftVal, rightVal);
        break;
      default:
        return {
          ...binary,
          left,
          right,
        };
    }

    return {
      kind: 'NumberLiteral',
      value: result,
      location: binary.location,
    };
  }

  /**
   * Dead code elimination: remove unreachable statements after return
   */
  private eliminateDeadCode(body: AST.ASTNode[]): AST.ASTNode[] {
    const result: AST.ASTNode[] = [];

    for (const node of body) {
      result.push(node);

      // If this is a return statement, everything after it is dead
      if (node.kind === 'ReturnStatement') {
        break;
      }
    }

    return result;
  }

  /**
   * Inline simple constants: replace uses of constant variables with their values
   * const x = 5; ... x ... → ... 5 ...
   */
  private inlineConstants(body: AST.ASTNode[]): AST.ASTNode[] {
    const constants: Map<string, AST.Expression> = new Map();

    const result: AST.ASTNode[] = [];

    for (const node of body) {
      // Collect constant declarations
      if (
        node.kind === 'LetDeclaration' &&
        !(node as AST.LetDeclarationNode).mutable &&
        this.isSimpleConstant((node as AST.LetDeclarationNode).initializer)
      ) {
        const letNode = node as AST.LetDeclarationNode;
        constants.set(letNode.name, letNode.initializer);
      }

      // Inline constants in the rest of the body
      result.push(this.inlineExpressionsInNode(node, constants));
    }

    return result;
  }

  private isSimpleConstant(expr: AST.Expression): boolean {
    switch (expr.kind) {
      case 'NumberLiteral':
      case 'StringLiteral':
      case 'BooleanLiteral':
      case 'NullLiteral':
        return true;
      default:
        return false;
    }
  }

  private inlineExpressionsInNode(node: AST.ASTNode, constants: Map<string, AST.Expression>): AST.ASTNode {
    switch (node.kind) {
      case 'LetDeclaration': {
        const letNode = node as AST.LetDeclarationNode;
        return {
          ...letNode,
          initializer: this.inlineExpression(letNode.initializer, constants),
        };
      }

      case 'ExpressionStatement': {
        const exprNode = node as AST.ExpressionStatement;
        return {
          ...exprNode,
          expression: this.inlineExpression(exprNode.expression, constants),
        };
      }

      case 'IfStatement': {
        const ifNode = node as AST.IfStatement;
        return {
          ...ifNode,
          condition: this.inlineExpression(ifNode.condition, constants),
          consequent: this.inlineBody(ifNode.consequent, constants),
          alternate: ifNode.alternate ? this.inlineBody(ifNode.alternate, constants) : undefined,
        };
      }

      case 'ForStatement': {
        const forNode = node as AST.ForStatement;
        return {
          ...forNode,
          iterable: this.inlineExpression(forNode.iterable, constants),
          body: this.inlineBody(forNode.body, constants),
        };
      }

      case 'WhileStatement': {
        const whileNode = node as AST.WhileStatement;
        return {
          ...whileNode,
          condition: this.inlineExpression(whileNode.condition, constants),
          body: this.inlineBody(whileNode.body, constants),
        };
      }

      case 'ReturnStatement': {
        const retNode = node as AST.ReturnStatement;
        return {
          ...retNode,
          value: retNode.value ? this.inlineExpression(retNode.value, constants) : undefined,
        };
      }

      case 'Block': {
        const blockNode = node as AST.BlockNode;
        return {
          ...blockNode,
          body: this.inlineBody(blockNode.body, constants),
        };
      }

      default:
        return node;
    }
  }

  private inlineBody(body: AST.ASTNode[], constants: Map<string, AST.Expression>): AST.ASTNode[] {
    return body.map(node => this.inlineExpressionsInNode(node, constants));
  }

  private inlineExpression(expr: AST.Expression, constants: Map<string, AST.Expression>): AST.Expression {
    switch (expr.kind) {
      case 'Identifier': {
        const id = expr as AST.Identifier;
        const constant = constants.get(id.name);
        if (constant) {
          return this.inlineExpression(constant, constants);
        }
        return expr;
      }

      case 'BinaryExpression': {
        const binary = expr as AST.BinaryExpression;
        const left = this.inlineExpression(binary.left, constants);
        const right = this.inlineExpression(binary.right, constants);
        const folded = this.foldConstants({
          ...binary,
          left,
          right,
        });
        return folded;
      }

      case 'UnaryExpression': {
        const unary = expr as AST.UnaryExpression;
        return {
          ...unary,
          operand: this.inlineExpression(unary.operand, constants),
        };
      }

      case 'CallExpression': {
        const call = expr as AST.CallExpression;
        return {
          ...call,
          callee: this.inlineExpression(call.callee, constants),
          args: call.args.map(a => this.inlineExpression(a, constants)),
        };
      }

      case 'MemberExpression': {
        const member = expr as AST.MemberExpression;
        return {
          ...member,
          object: this.inlineExpression(member.object, constants),
          property: member.computed && typeof member.property !== 'string'
            ? this.inlineExpression(member.property as AST.Expression, constants)
            : member.property,
        };
      }

      case 'ArrayLiteral': {
        const array = expr as AST.ArrayLiteral;
        return {
          ...array,
          elements: array.elements.map(e => this.inlineExpression(e, constants)),
        };
      }

      case 'ObjectLiteral': {
        const obj = expr as AST.ObjectLiteral;
        return {
          ...obj,
          properties: obj.properties.map(p => ({
            ...p,
            value: this.inlineExpression(p.value, constants),
          })),
        };
      }

      case 'PipeExpression': {
        const pipe = expr as AST.PipeExpression;
        return {
          ...pipe,
          left: this.inlineExpression(pipe.left, constants),
          right: this.inlineExpression(pipe.right, constants),
        };
      }

      case 'ConditionalExpression': {
        const cond = expr as AST.ConditionalExpression;
        return {
          ...cond,
          condition: this.inlineExpression(cond.condition, constants),
          consequent: this.inlineExpression(cond.consequent, constants),
          alternate: this.inlineExpression(cond.alternate, constants),
        };
      }

      case 'BreedExpression': {
        const breed = expr as AST.BreedExpression;
        return {
          ...breed,
          parentA: this.inlineExpression(breed.parentA, constants),
          parentB: this.inlineExpression(breed.parentB, constants),
          dominance: breed.dominance ? this.inlineExpression(breed.dominance, constants) : undefined,
        };
      }

      case 'MutateExpression': {
        const mutate = expr as AST.MutateExpression;
        return {
          ...mutate,
          seed: this.inlineExpression(mutate.seed, constants),
          rate: mutate.rate ? this.inlineExpression(mutate.rate, constants) : undefined,
          intensity: mutate.intensity ? this.inlineExpression(mutate.intensity, constants) : undefined,
        };
      }

      case 'ComposeExpression': {
        const compose = expr as AST.ComposeExpression;
        return {
          ...compose,
          base: this.inlineExpression(compose.base, constants),
          overlay: this.inlineExpression(compose.overlay, constants),
        };
      }

      case 'EvolveExpression': {
        const evolve = expr as AST.EvolveExpression;
        return {
          ...evolve,
          seed: this.inlineExpression(evolve.seed, constants),
          population: evolve.population ? this.inlineExpression(evolve.population, constants) : undefined,
          generations: evolve.generations ? this.inlineExpression(evolve.generations, constants) : undefined,
        };
      }

      default:
        return expr;
    }
  }
}
