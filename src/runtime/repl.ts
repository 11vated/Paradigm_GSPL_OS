/**
 * repl.ts — Interactive GSPL REPL
 * Read-Eval-Print Loop for exploring seeds interactively.
 */

import * as readline from 'readline';
import { Lexer } from '../language/lexer.js';
import { Parser } from '../language/parser.js';
import { Interpreter, Environment } from '../language/interpreter.js';
import { UniversalSeed, seedToJSON } from '../kernel/seed.js';
import { mutate } from '../kernel/operators.js';
import { DeterministicRNG } from '../kernel/rng.js';
import { registry } from '../engines/engine.js';
import '../engines/index.js';

export function startRepl(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\x1b[35mgspl>\x1b[0m ',
  });

  const interpreter = new Interpreter();
  const seeds: Map<string, UniversalSeed> = new Map();
  let lineBuffer = '';

  console.log('\x1b[36m╔══════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[36m║\x1b[0m  \x1b[1mParadigm GSPL REPL\x1b[0m v1.0.0              \x1b[36m║\x1b[0m');
  console.log('\x1b[36m║\x1b[0m  Type GSPL code or :help for commands    \x1b[36m║\x1b[0m');
  console.log('\x1b[36m╚══════════════════════════════════════════╝\x1b[0m');
  console.log('');

  rl.prompt();

  rl.on('line', (line: string) => {
    const trimmed = line.trim();

    // Meta commands
    if (trimmed.startsWith(':')) {
      handleCommand(trimmed, seeds, interpreter);
      rl.prompt();
      return;
    }

    // Empty line
    if (!trimmed) {
      rl.prompt();
      return;
    }

    // Accumulate multi-line input (if line ends with {, keep reading)
    lineBuffer += (lineBuffer ? '\n' : '') + line;
    const openBraces = (lineBuffer.match(/\{/g) || []).length;
    const closeBraces = (lineBuffer.match(/\}/g) || []).length;

    if (openBraces > closeBraces) {
      // Still inside a block — prompt for more
      rl.setPrompt('\x1b[90m  ...\x1b[0m ');
      rl.prompt();
      return;
    }

    // Execute
    const source = lineBuffer;
    lineBuffer = '';
    rl.setPrompt('\x1b[35mgspl>\x1b[0m ');

    try {
      const lexer = new Lexer(source, '<repl>');
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      const result = interpreter.execute(ast);

      // Collect seeds
      for (const seed of result.seeds) {
        seeds.set(seed.$name, seed);
      }

      // Show results
      if (result.seeds.length > 0) {
        for (const seed of result.seeds) {
          console.log(`\x1b[32m✓\x1b[0m Seed \x1b[1m${seed.$name}\x1b[0m [${seed.$domain}] — ${Object.keys(seed.genes).length} genes, gen ${seed.$lineage.generation}`);
        }
      }

      if (result.errors.length > 0) {
        for (const err of result.errors) {
          console.log(`\x1b[31m✗\x1b[0m ${err.message}`);
        }
      }

      // Show exports
      for (const [key, value] of Object.entries(result.exports)) {
        console.log(`\x1b[33m→\x1b[0m ${key} = ${formatValue(value)}`);
      }
    } catch (err) {
      console.log(`\x1b[31m✗\x1b[0m ${err instanceof Error ? err.message : String(err)}`);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\n\x1b[90mGoodbye.\x1b[0m');
    process.exit(0);
  });
}

function handleCommand(cmd: string, seeds: Map<string, UniversalSeed>, interpreter: Interpreter): void {
  const parts = cmd.split(/\s+/);
  const command = parts[0];

  switch (command) {
    case ':help':
      console.log('\n\x1b[1mCommands:\x1b[0m');
      console.log('  :seeds                  List all created seeds');
      console.log('  :inspect <name>         Show seed details');
      console.log('  :genes <name>           Show gene values');
      console.log('  :mutate <name> [rate]   Mutate a seed');
      console.log('  :evolve <name> [gens]   Evolve a seed');
      console.log('  :json <name>            Export seed as JSON');
      console.log('  :generate <name>        Run domain engine on seed');
      console.log('  :engines                List registered engines');
      console.log('  :clear                  Clear screen');
      console.log('  :quit                   Exit REPL');
      console.log('');
      break;

    case ':seeds': {
      if (seeds.size === 0) {
        console.log('\x1b[90mNo seeds created yet. Try: seed MyCritter : visual2d { genes: { ... } }\x1b[0m');
      } else {
        console.log(`\n\x1b[1m${seeds.size} seed(s):\x1b[0m`);
        for (const [name, seed] of seeds) {
          console.log(`  \x1b[36m${name}\x1b[0m [${seed.$domain}] gen:${seed.$lineage.generation} genes:${Object.keys(seed.genes).length} hash:${seed.$hash.substring(0, 8)}`);
        }
        console.log('');
      }
      break;
    }

    case ':inspect': {
      const name = parts[1];
      const seed = name ? seeds.get(name) : undefined;
      if (!seed) {
        console.log(`\x1b[31mSeed "${name}" not found. Use :seeds to list.\x1b[0m`);
      } else {
        console.log(`\n\x1b[1m${seed.$name}\x1b[0m`);
        console.log(`  Domain:     ${seed.$domain}`);
        console.log(`  Hash:       ${seed.$hash}`);
        console.log(`  Generation: ${seed.$lineage.generation}`);
        console.log(`  Parents:    ${seed.$lineage.parents.length > 0 ? seed.$lineage.parents.join(', ') : 'none (de novo)'}`);
        console.log(`  Genes:      ${Object.keys(seed.genes).length}`);
        console.log(`  Author:     ${seed.$metadata.author}`);
        console.log(`  Created:    ${new Date(seed.$metadata.created).toISOString()}`);
        if (seed.$fitness) {
          console.log(`  Fitness:    ${seed.$fitness.aggregate.toFixed(4)}`);
        }
        console.log('');
      }
      break;
    }

    case ':genes': {
      const name = parts[1];
      const seed = name ? seeds.get(name) : undefined;
      if (!seed) {
        console.log(`\x1b[31mSeed "${name}" not found.\x1b[0m`);
      } else {
        console.log(`\n\x1b[1mGenes of ${seed.$name}:\x1b[0m`);
        for (const [key, gene] of Object.entries(seed.genes)) {
          const val = 'value' in gene ? gene.value : '(complex)';
          const type = gene.type;
          const mut = gene.mutable ? '✓' : '✗';
          console.log(`  \x1b[36m${key}\x1b[0m: ${type} = \x1b[33m${typeof val === 'number' ? (val as number).toFixed(4) : val}\x1b[0m  mutable:${mut}`);
        }
        console.log('');
      }
      break;
    }

    case ':mutate': {
      const name = parts[1];
      const rate = parseFloat(parts[2] || '0.3');
      const seed = name ? seeds.get(name) : undefined;
      if (!seed) {
        console.log(`\x1b[31mSeed "${name}" not found.\x1b[0m`);
      } else {
        const rng = new DeterministicRNG(`repl_mutate_${Date.now()}`);
        const mutated = mutate(seed, { rate, intensity: 0.3 }, rng);
        const newName = mutated.$name;
        seeds.set(newName, mutated);
        console.log(`\x1b[32m✓\x1b[0m Mutated → \x1b[1m${newName}\x1b[0m (rate: ${rate}, gen: ${mutated.$lineage.generation})`);
      }
      break;
    }

    case ':evolve': {
      const name = parts[1];
      const gens = parseInt(parts[2] || '10');
      const seed = name ? seeds.get(name) : undefined;
      if (!seed) {
        console.log(`\x1b[31mSeed "${name}" not found.\x1b[0m`);
      } else {
        const rng = new DeterministicRNG(`repl_evolve_${Date.now()}`);
        let best = seed;
        for (let g = 0; g < gens; g++) {
          const candidate = mutate(best, { rate: 0.2, intensity: 0.3 }, rng);
          best = candidate;
        }
        seeds.set(best.$name, best);
        console.log(`\x1b[32m✓\x1b[0m Evolved ${gens} generations → \x1b[1m${best.$name}\x1b[0m (gen: ${best.$lineage.generation})`);
      }
      break;
    }

    case ':json': {
      const name = parts[1];
      const seed = name ? seeds.get(name) : undefined;
      if (!seed) {
        console.log(`\x1b[31mSeed "${name}" not found.\x1b[0m`);
      } else {
        console.log(seedToJSON(seed));
      }
      break;
    }

    case ':generate': {
      const name = parts[1];
      const seed = name ? seeds.get(name) : undefined;
      if (!seed) {
        console.log(`\x1b[31mSeed "${name}" not found.\x1b[0m`);
      } else {
        const engine = registry.get(seed.$domain);
        if (!engine) {
          console.log(`\x1b[31mNo engine for domain "${seed.$domain}".\x1b[0m`);
        } else {
          const start = Date.now();
          const result = engine.generate(seed);
          const ms = Date.now() - start;
          if (result.success) {
            console.log(`\x1b[32m✓\x1b[0m Generated ${result.artifacts.size} artifact(s) in ${ms}ms`);
            for (const [key, data] of result.artifacts) {
              const size = typeof data === 'string' ? data.length : JSON.stringify(data).length;
              console.log(`  \x1b[36m${key}\x1b[0m: ${typeof data} (${formatBytes(size)})`);
            }
          } else {
            console.log(`\x1b[31m✗\x1b[0m Generation failed: ${result.errors.join(', ')}`);
          }
        }
      }
      break;
    }

    case ':engines': {
      const engines = registry.list();
      console.log(`\n\x1b[1m${engines.length} engine(s) registered:\x1b[0m`);
      for (const e of engines) {
        console.log(`  \x1b[36m${e.domain}\x1b[0m — ${e.name} v${e.version}`);
      }
      console.log('');
      break;
    }

    case ':clear':
      console.clear();
      break;

    case ':quit':
    case ':exit':
    case ':q':
      process.exit(0);
      break;

    default:
      console.log(`\x1b[31mUnknown command: ${command}. Type :help for available commands.\x1b[0m`);
  }
}

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object' && '$gst' in (value as Record<string, unknown>)) {
    const seed = value as UniversalSeed;
    return `Seed<${seed.$name}:${seed.$domain}>`;
  }
  return typeof value;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
