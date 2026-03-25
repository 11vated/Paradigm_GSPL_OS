#!/usr/bin/env node
/**
 * cli-entry.ts — CLI Entry Point
 * Executable entry point for the Paradigm GSPL Engine CLI
 */

import { cli } from './runtime/cli.js';

cli(process.argv);
