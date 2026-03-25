/**
 * cli.ts — Command Line Interface
 * Simple but functional CLI for executing GSPL files, inspecting seeds, and running evolution.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Pipeline, PipelineConfig, PipelineResult } from './pipeline.js';
import { validateSeed, seedToJSON } from '../kernel/seed.js';
import { DeterministicRNG } from '../kernel/rng.js';
import { startRepl } from './repl.js';
import { watch } from './watcher.js';
import { startServer } from './server.js';
import { getInitPackageJson, getInitMainGspl, getInitGitignore, getDomainTemplate, getAvailableDomains } from './templates.js';
import { registry } from '../engines/engine.js';
import { startMarketplaceAPI } from '../marketplace/api.js';
import { MarketplaceRegistry } from '../marketplace/registry.js';
import { packageSeed, serializePackage, deserializePackage } from '../marketplace/seed-package.js';
import '../engines/index.js';

// ============================================================================
// PACKAGE VERSION
// ============================================================================

const PACKAGE_VERSION = '1.0.0';

// ============================================================================
// CLI COMMAND DISPATCHER
// ============================================================================

export function cli(args: string[]): void {
  // Remove node and script path from args
  const command = args[2];
  const rest = args.slice(3);

  try {
    switch (command) {
      case 'run':
        handleRun(rest);
        break;

      case 'inspect':
        handleInspect(rest);
        break;

      case 'evolve':
        handleEvolve(rest);
        break;

      case 'init':
        handleInit(rest);
        break;

      case 'new':
        handleNew(rest);
        break;

      case 'repl':
        startRepl();
        break;

      case 'watch':
        handleWatch(rest);
        break;

      case 'serve':
        handleServe(rest);
        break;

      case 'marketplace':
        handleMarketplace(rest);
        break;

      case 'publish':
        handlePublish(rest);
        break;

      case 'search':
        handleSearch(rest);
        break;

      case 'list-engines':
      case 'engines':
        handleListEngines();
        break;

      case 'version':
        handleVersion();
        break;

      case 'help':
      case '--help':
      case '-h':
        handleHelp();
        break;

      default:
        if (!command) {
          handleHelp();
        } else {
          console.error(`Unknown command: ${command}`);
          console.error('Use "paradigm help" for usage information');
          process.exit(1);
        }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exit(1);
  }
}

// ============================================================================
// COMMAND: run
// ============================================================================

/**
 * paradigm run <file.gspl> [options]
 * Execute a GSPL file and generate artifacts
 */
function handleRun(args: string[]): void {
  if (args.length === 0) {
    console.error('Usage: paradigm run <file.gspl> [options]');
    console.error('Options:');
    console.error('  --output <dir>     Output directory for artifacts');
    console.error('  --quality <0-1>    Generation quality level');
    console.error('  --seed <string>    RNG seed for determinism');
    console.error('  --verbose          Enable verbose logging');
    process.exit(1);
  }

  const file = args[0];
  const options = parseOptions(args.slice(1));

  // Read file
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  const source = fs.readFileSync(file, 'utf-8');

  // Build config
  const config: PipelineConfig = {
    source,
    file,
    outputDir: typeof options.output === 'string' ? options.output : undefined,
    quality: typeof options.quality === 'string' ? parseFloat(options.quality) : 1.0,
    seed: typeof options.seed === 'string' ? options.seed : undefined,
    verbose: options.verbose === true,
  };

  // Run pipeline
  const startTime = Date.now();
  const result = new Pipeline(config).run();
  const elapsed = Date.now() - startTime;

  // Report results
  console.log(`\n✓ Pipeline completed in ${elapsed}ms`);
  console.log(`  Lexing: ${result.timing.lexMs}ms`);
  console.log(`  Parsing: ${result.timing.parseMs}ms`);
  console.log(`  Interpretation: ${result.timing.interpretMs}ms`);
  console.log(`  Generation: ${result.timing.generateMs}ms`);
  console.log(`\nResults:`);
  console.log(`  Seeds produced: ${result.seeds.length}`);

  for (const { seed, artifacts } of result.artifacts) {
    console.log(`  Seed "${seed.$name}": ${artifacts.length} artifact(s)`);
    for (const art of artifacts) {
      const sizeKb = art.sizeBytes ? (art.sizeBytes / 1024).toFixed(2) : '?';
      console.log(`    - ${art.type}: ${sizeKb}KB`);
    }
  }

  if (result.errors.length > 0) {
    console.log(`\nWarnings (${result.errors.length}):`);
    for (const err of result.errors) {
      console.log(`  - ${err}`);
    }
  }

  // Write artifacts if output dir specified
  if (options.output && typeof options.output === 'string') {
    writeArtifacts(result, options.output);
  }

  process.exit(result.errors.length > 0 ? 1 : 0);
}

// ============================================================================
// COMMAND: inspect
// ============================================================================

/**
 * paradigm inspect <file.gspl>
 * Show seed details without generating artifacts
 */
function handleInspect(args: string[]): void {
  if (args.length === 0) {
    console.error('Usage: paradigm inspect <file.gspl> [options]');
    console.error('Options:');
    console.error('  --seed <string>    RNG seed');
    console.error('  --verbose          Verbose output');
    process.exit(1);
  }

  const file = args[0];
  const options = parseOptions(args.slice(1));

  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  const source = fs.readFileSync(file, 'utf-8');

  const config: PipelineConfig = {
    source,
    file,
    seed: typeof options.seed === 'string' ? options.seed : undefined,
    verbose: options.verbose === true,
  };

  const compileResult = new Pipeline(config).compile();
  const result = compileResult as any;

  console.log(`\n✓ Compilation successful\n`);
  console.log(`Seeds (${result.seeds.length}):`);

  for (const seed of result.seeds) {
    console.log(`\n  ${seed.$name}`);
    console.log(`    Domain: ${seed.$domain}`);
    console.log(`    Hash: ${seed.$hash}`);
    console.log(`    Generation: ${seed.$lineage.generation}`);
    console.log(`    Genes: ${Object.keys(seed.genes).length}`);

    // Validate
    const errors = validateSeed(seed);
    if (errors.length > 0) {
      console.log(`    Validation errors: ${errors.length}`);
      for (const err of errors) {
        console.log(`      - ${err}`);
      }
    }

    // Show genes
    if (options.verbose) {
      console.log(`    Gene details:`);
      for (const [key, geneData] of Object.entries(seed.genes)) {
        const gene = geneData as any;
        if (gene.type === 'scalar') {
          console.log(`      ${key}: ${gene.type} = ${gene.value} [${gene.min}, ${gene.max}]`);
        } else if (gene.type === 'categorical') {
          console.log(`      ${key}: ${gene.type} = ${gene.value} (${gene.options.join('|')})`);
        } else {
          console.log(`      ${key}: ${gene.type}`);
        }
      }
    }

    // Show fitness if present
    if (seed.$fitness) {
      console.log(`    Fitness: ${seed.$fitness.aggregate.toFixed(4)}`);
    }

    // Show metadata
    console.log(`    Author: ${seed.$metadata.author}`);
    console.log(`    License: ${seed.$metadata.license}`);
    if (seed.$metadata.tags.length > 0) {
      console.log(`    Tags: ${seed.$metadata.tags.join(', ')}`);
    }
  }

  if (result.execution.errors.length > 0) {
    console.log(`\nExecution errors (${result.execution.errors.length}):`);
    for (const err of result.execution.errors) {
      console.log(`  - ${err.message}`);
    }
  }

  process.exit(result.execution.errors.length > 0 ? 1 : 0);
}

// ============================================================================
// COMMAND: evolve
// ============================================================================

/**
 * paradigm evolve <file.gspl> -g N [options]
 * Evolve seeds for N generations
 */
function handleEvolve(args: string[]): void {
  if (args.length === 0) {
    console.error('Usage: paradigm evolve <file.gspl> -g <generations> [options]');
    console.error('Options:');
    console.error('  -g, --generations <N>  Number of generations');
    console.error('  --seed <string>        RNG seed');
    console.error('  --verbose              Verbose output');
    process.exit(1);
  }

  const file = args[0];
  const options = parseOptions(args.slice(1));
  const genStr = typeof options.g === 'string' ? options.g : (typeof options.generations === 'string' ? options.generations : '0');
  const generations = parseInt(genStr, 10);

  if (!generations || generations <= 0) {
    console.error('Error: --generations must be a positive integer');
    process.exit(1);
  }

  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  const source = fs.readFileSync(file, 'utf-8');

  const config: PipelineConfig = {
    source,
    file,
    evolve: true,
    evolutionGenerations: generations,
    seed: typeof options.seed === 'string' ? options.seed : undefined,
    verbose: options.verbose === true,
  };

  console.log(`\nEvolving for ${generations} generation(s)...\n`);

  const startTime = Date.now();
  const result = new Pipeline(config).run();
  const elapsed = Date.now() - startTime;

  console.log(`\n✓ Evolution completed in ${elapsed}ms\n`);
  console.log(`Final population: ${result.seeds.length} seeds`);

  // Show best seeds
  const sorted = [...result.seeds]
    .filter(s => s.$fitness !== undefined)
    .sort((a, b) => (b.$fitness?.aggregate ?? 0) - (a.$fitness?.aggregate ?? 0))
    .slice(0, 5);

  if (sorted.length > 0) {
    console.log(`\nTop seeds:`);
    for (let i = 0; i < sorted.length; i++) {
      const seed = sorted[i];
      const fitness = seed.$fitness?.aggregate ?? 0;
      console.log(`  ${i + 1}. ${seed.$name}: fitness=${fitness.toFixed(4)}`);
    }
  }

  process.exit(result.errors.length > 0 ? 1 : 0);
}

// ============================================================================
// COMMAND: init
// ============================================================================

function handleInit(args: string[]): void {
  const name = args[0] || 'my-paradigm-project';
  const dir = path.resolve(name);

  if (fs.existsSync(dir)) {
    console.error(`Directory already exists: ${dir}`);
    process.exit(1);
  }

  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });

  fs.writeFileSync(path.join(dir, 'package.json'), getInitPackageJson(name), 'utf-8');
  fs.writeFileSync(path.join(dir, 'src', 'main.gspl'), getInitMainGspl(name), 'utf-8');
  fs.writeFileSync(path.join(dir, '.gitignore'), getInitGitignore(), 'utf-8');

  console.log(`\n\x1b[32m✓\x1b[0m Created project \x1b[1m${name}\x1b[0m\n`);
  console.log(`  ${name}/`);
  console.log(`    package.json`);
  console.log(`    .gitignore`);
  console.log(`    src/`);
  console.log(`      main.gspl`);
  console.log(`\n  Next steps:`);
  console.log(`    cd ${name}`);
  console.log(`    paradigm run src/main.gspl --output dist`);
  console.log(`    paradigm repl\n`);
  process.exit(0);
}

// ============================================================================
// COMMAND: new
// ============================================================================

function handleNew(args: string[]): void {
  const domain = args[0];
  const name = args[1] || domain;

  if (!domain) {
    console.error('Usage: paradigm new <domain> [name]');
    console.error(`\nAvailable domains: ${getAvailableDomains().join(', ')}`);
    process.exit(1);
  }

  const template = getDomainTemplate(domain, name || domain);
  if (!template) {
    console.error(`Unknown domain: ${domain}`);
    console.error(`Available: ${getAvailableDomains().join(', ')}`);
    process.exit(1);
  }

  const filename = `${name || domain}.gspl`;
  if (fs.existsSync(filename)) {
    console.error(`File already exists: ${filename}`);
    process.exit(1);
  }

  fs.writeFileSync(filename, template, 'utf-8');
  console.log(`\x1b[32m✓\x1b[0m Created \x1b[1m${filename}\x1b[0m (${domain} domain)`);
  process.exit(0);
}

// ============================================================================
// COMMAND: watch
// ============================================================================

function handleWatch(args: string[]): void {
  if (args.length === 0) {
    console.error('Usage: paradigm watch <file.gspl> [options]');
    console.error('Options: --output DIR, --quality 0-1, --seed SEED, --verbose');
    process.exit(1);
  }

  const file = args[0];
  const options = parseOptions(args.slice(1));

  watch({
    file,
    outputDir: typeof options.output === 'string' ? options.output : './output',
    quality: typeof options.quality === 'string' ? parseFloat(options.quality) : undefined,
    seed: typeof options.seed === 'string' ? options.seed : undefined,
    verbose: options.verbose === true,
  });
}

// ============================================================================
// COMMAND: serve
// ============================================================================

function handleServe(args: string[]): void {
  const dir = args[0] || './output';
  const options = parseOptions(args.slice(1));
  const port = typeof options.port === 'string' ? parseInt(options.port, 10) : 3333;

  startServer({ dir, port });
}

// ============================================================================
// COMMAND: marketplace
// ============================================================================

function handleMarketplace(args: string[]): void {
  const options = parseOptions(args);
  const port = typeof options.port === 'string' ? parseInt(options.port, 10) : 4444;
  const dataDir = typeof options.data === 'string' ? options.data : '.paradigm/marketplace';

  startMarketplaceAPI({ port, dataDir });
}

// ============================================================================
// COMMAND: publish
// ============================================================================

function handlePublish(args: string[]): void {
  if (args.length === 0) {
    console.error('Usage: paradigm publish <file.gspl> [options]');
    console.error('Options:');
    console.error('  --publisher <name>      Your publisher name');
    console.error('  --description <text>    Package description');
    console.error('  --tags <t1,t2,...>      Comma-separated tags');
    console.error('  --registry <url>        Marketplace URL (default: http://localhost:4444)');
    process.exit(1);
  }

  const file = args[0];
  const options = parseOptions(args.slice(1));

  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  const source = fs.readFileSync(file, 'utf-8');
  const config: PipelineConfig = { source, file };
  const result = new Pipeline(config).compile();

  if (result.seeds.length === 0) {
    console.error('No seeds found in file');
    process.exit(1);
  }

  const publisher = typeof options.publisher === 'string' ? options.publisher : 'anonymous';
  const description = typeof options.description === 'string' ? options.description : `Seed from ${path.basename(file)}`;
  const tags = typeof options.tags === 'string' ? options.tags.split(',') : [];

  for (const seed of result.seeds) {
    const pkg = packageSeed(seed, { publisher, description, tags });
    const json = serializePackage(pkg);
    const outFile = `${seed.$name}.gseed`;
    fs.writeFileSync(outFile, json, 'utf-8');
    console.log(`\x1b[32m✓\x1b[0m Packaged \x1b[1m${seed.$name}\x1b[0m → ${outFile} (${(json.length / 1024).toFixed(1)}KB)`);
    console.log(`  Hash: ${pkg.$packageHash}`);
    console.log(`  Domain: ${seed.$domain}`);
    console.log(`  Genes: ${Object.keys(seed.genes).length}`);
  }

  process.exit(0);
}

// ============================================================================
// COMMAND: search
// ============================================================================

function handleSearch(args: string[]): void {
  const query = args[0] || '';
  const options = parseOptions(args.slice(1));
  const dataDir = typeof options.data === 'string' ? options.data : '.paradigm/marketplace';

  const reg = new MarketplaceRegistry(`${dataDir}/registry.json`);
  const result = reg.search({
    text: query || undefined,
    domain: typeof options.domain === 'string' ? options.domain as any : undefined,
    sortBy: typeof options.sort === 'string' ? options.sort as any : 'newest',
    limit: typeof options.limit === 'string' ? parseInt(options.limit) : 20,
  });

  if (result.packages.length === 0) {
    console.log(`\x1b[90mNo packages found${query ? ` for "${query}"` : ''}.\x1b[0m`);
    process.exit(0);
  }

  console.log(`\n\x1b[1m${result.total} package(s) found:\x1b[0m\n`);
  for (const pkg of result.packages) {
    const stars = pkg.stats.stars > 0 ? ` ★${pkg.stats.stars}` : '';
    const dl = pkg.stats.downloads > 0 ? ` ↓${pkg.stats.downloads}` : '';
    console.log(`  \x1b[36m${pkg.seed.$name}\x1b[0m \x1b[90mv${pkg.publication.version}\x1b[0m [${pkg.seed.$domain}]${stars}${dl}`);
    console.log(`    \x1b[90m${pkg.publication.description}\x1b[0m`);
    if (pkg.publication.tags.length > 0) {
      console.log(`    \x1b[90mtags: ${pkg.publication.tags.join(', ')}\x1b[0m`);
    }
  }
  console.log('');
  process.exit(0);
}

// ============================================================================
// COMMAND: list-engines
// ============================================================================

function handleListEngines(): void {
  const engines = registry.list();
  console.log(`\n\x1b[1mRegistered Engines (${engines.length}):\x1b[0m\n`);
  for (const e of engines) {
    console.log(`  \x1b[36m${e.domain.padEnd(14)}\x1b[0m ${e.name} v${e.version}`);
  }
  console.log('');
  process.exit(0);
}

// ============================================================================
// COMMAND: version
// ============================================================================

function handleVersion(): void {
  console.log(`Paradigm GSPL Engine v${PACKAGE_VERSION}`);
  process.exit(0);
}

// ============================================================================
// COMMAND: help
// ============================================================================

function handleHelp(): void {
  console.log(`
\x1b[1mParadigm GSPL Engine\x1b[0m v${PACKAGE_VERSION}

\x1b[1mUsage:\x1b[0m
  paradigm <command> [arguments] [options]

\x1b[1mCommands:\x1b[0m
  \x1b[36mrun\x1b[0m <file.gspl>          Execute a GSPL file and generate artifacts
                           Options: --output DIR, --quality 0-1, --seed SEED, --verbose

  \x1b[36minspect\x1b[0m <file.gspl>      Show seed details without generating
                           Options: --seed SEED, --verbose

  \x1b[36mevolve\x1b[0m <file.gspl>       Evolve seeds for N generations
                           Options: -g/--generations N, --seed SEED, --verbose

  \x1b[36minit\x1b[0m [name]              Scaffold a new GSPL project

  \x1b[36mnew\x1b[0m <domain> [name]      Create a seed file for a domain
                           Domains: visual2d, audio, fullgame, animation, geometry3d,
                                    sprite, ui, game, procedural

  \x1b[36mrepl\x1b[0m                     Start interactive GSPL REPL

  \x1b[36mwatch\x1b[0m <file.gspl>        Watch file and regenerate on change
                           Options: --output DIR, --quality 0-1, --seed SEED

  \x1b[36mserve\x1b[0m [dir]              Start dev server for generated artifacts
                           Options: --port N (default: 3333)

  \x1b[36mlist-engines\x1b[0m             Show all registered domain engines

  \x1b[36mpublish\x1b[0m <file.gspl>      Package seed(s) as .gseed files
                           Options: --publisher NAME, --description TEXT, --tags a,b,c

  \x1b[36msearch\x1b[0m [query]           Search the seed marketplace
                           Options: --domain DOMAIN, --sort newest|popular|stars

  \x1b[36mmarketplace\x1b[0m              Start marketplace API server
                           Options: --port N (default: 4444), --data DIR

  \x1b[36mversion\x1b[0m                  Show version
  \x1b[36mhelp\x1b[0m                     Show this help message

\x1b[1mExamples:\x1b[0m
  paradigm init my-art
  paradigm new visual2d dragon
  paradigm run dragon.gspl --output ./dist
  paradigm watch dragon.gspl --output ./dist
  paradigm serve ./dist
  paradigm repl
  paradigm evolve population.gspl -g 50
  paradigm publish dragon.gspl --publisher "Kahlil" --tags art,dragon
  paradigm marketplace --port 4444
  paradigm search dragon --domain visual2d

`);
  process.exit(0);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

interface ParsedOptions {
  [key: string]: string | boolean | undefined;
}

/**
 * Parse command-line options
 */
function parseOptions(args: string[]): ParsedOptions {
  const options: ParsedOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith('-')) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith('-')) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    }
  }

  return options;
}

/**
 * Write artifacts to disk
 */
function writeArtifacts(result: PipelineResult, outputDir: string): void {
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write seeds as JSON
  const seedsDir = path.join(outputDir, 'seeds');
  if (!fs.existsSync(seedsDir)) {
    fs.mkdirSync(seedsDir, { recursive: true });
  }

  for (const seed of result.seeds) {
    const safeName = seed.$name.slice(0, 100);
    const seedFile = path.join(seedsDir, `${safeName}.json`);
    fs.writeFileSync(seedFile, seedToJSON(seed), 'utf-8');
  }

  // Write artifacts
  for (const { seed, artifacts } of result.artifacts) {
    const seedArtifactDir = path.join(outputDir, 'artifacts', seed.$name.slice(0, 100));
    if (!fs.existsSync(seedArtifactDir)) {
      fs.mkdirSync(seedArtifactDir, { recursive: true });
    }

    for (const art of artifacts) {
      const ext = getFileExtension(art.type);
      const filename = `${art.name}${ext}`;
      const filepath = path.join(seedArtifactDir, filename);

      if (typeof art.data === 'string') {
        fs.writeFileSync(filepath, art.data, 'utf-8');
      } else {
        fs.writeFileSync(filepath, JSON.stringify(art.data, null, 2), 'utf-8');
      }
    }
  }

  console.log(`\nArtifacts written to: ${outputDir}`);
}

/**
 * Get file extension for artifact type
 */
function getFileExtension(type: string): string {
  const mapping: Record<string, string> = {
    'image': '.png',
    'svg': '.svg',
    'json': '.json',
    'model': '.obj',
    'audio': '.wav',
    'shader': '.glsl',
    'html': '.html',
  };
  return mapping[type] ?? '.dat';
}
