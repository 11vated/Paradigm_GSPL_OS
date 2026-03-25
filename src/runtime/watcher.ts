/**
 * watcher.ts — File Watch Mode
 * Watches .gspl files for changes and re-runs the pipeline automatically.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Pipeline, PipelineConfig } from './pipeline.js';

export interface WatchOptions {
  file: string;
  outputDir: string;
  quality?: number;
  seed?: string;
  verbose?: boolean;
  debounceMs?: number;
}

export function watch(options: WatchOptions): void {
  const { file, outputDir, quality, seed, verbose, debounceMs = 300 } = options;

  const absFile = path.resolve(file);
  if (!fs.existsSync(absFile)) {
    console.error(`\x1b[31mFile not found: ${absFile}\x1b[0m`);
    process.exit(1);
  }

  console.log(`\x1b[36m● Watching\x1b[0m ${path.basename(absFile)}`);
  console.log(`\x1b[90m  Output: ${path.resolve(outputDir)}\x1b[0m`);
  console.log(`\x1b[90m  Press Ctrl+C to stop\x1b[0m\n`);

  // Initial run
  runPipeline(absFile, outputDir, quality, seed, verbose);

  // Watch for changes
  let timer: ReturnType<typeof setTimeout> | null = null;

  fs.watch(absFile, (eventType) => {
    if (eventType !== 'change') return;

    // Debounce
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`\x1b[33m↻\x1b[0m Change detected — rebuilding...`);
      runPipeline(absFile, outputDir, quality, seed, verbose);
    }, debounceMs);
  });
}

function runPipeline(
  file: string,
  outputDir: string,
  quality?: number,
  seed?: string,
  verbose?: boolean
): void {
  const startTime = Date.now();

  try {
    const source = fs.readFileSync(file, 'utf-8');

    const config: PipelineConfig = {
      source,
      file: path.basename(file),
      outputDir,
      quality: quality ?? 1.0,
      seed: seed ?? 'paradigm',
      verbose: verbose ?? false,
    };

    const pipeline = new Pipeline(config);
    const result = pipeline.run();

    if (result.errors.length > 0) {
      for (const err of result.errors) {
        console.log(`  \x1b[31m✗\x1b[0m ${err}`);
      }
    }

    // Write artifacts
    const outDir = path.resolve(outputDir);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    let artifactCount = 0;
    for (const entry of result.artifacts) {
      const seedDir = path.join(outDir, entry.seed.$name);
      if (!fs.existsSync(seedDir)) {
        fs.mkdirSync(seedDir, { recursive: true });
      }

      for (const artifact of entry.artifacts) {
        const ext = getExtension(artifact.type);
        const filePath = path.join(seedDir, `${artifact.name}${ext}`);
        const content = typeof artifact.data === 'string'
          ? artifact.data
          : JSON.stringify(artifact.data, null, 2);
        fs.writeFileSync(filePath, content, 'utf-8');
        artifactCount++;
      }
    }

    const ms = Date.now() - startTime;
    console.log(`  \x1b[32m✓\x1b[0m ${result.seeds.length} seed(s), ${artifactCount} artifact(s) — ${ms}ms`);
  } catch (err) {
    console.log(`  \x1b[31m✗\x1b[0m ${err instanceof Error ? err.message : String(err)}`);
  }
}

function getExtension(type: string): string {
  const extensions: Record<string, string> = {
    svg: '.svg',
    html: '.html',
    json: '.json',
    obj: '.obj',
    midi: '.mid',
    audio: '.json',
    animation: '.json',
    game: '.json',
    mesh: '.json',
    unknown: '.dat',
  };
  return extensions[type] ?? '.json';
}
