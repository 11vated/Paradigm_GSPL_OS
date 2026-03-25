/**
 * app-shell.ts — Desktop Application Shell
 * Provides file system integration, window management, and native features
 * for the GSPL Paradigm Engine desktop application.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface AppConfig {
  seedsDirectory: string;
  outputDirectory: string;
  recentFiles: string[];
  theme: 'dark' | 'light';
  windowBounds: { x: number; y: number; width: number; height: number };
}

const DEFAULT_CONFIG: AppConfig = {
  seedsDirectory: path.join(process.env.APPDATA || process.env.HOME || '.', 'GSPL', 'seeds'),
  outputDirectory: path.join(process.env.APPDATA || process.env.HOME || '.', 'GSPL', 'output'),
  recentFiles: [],
  theme: 'dark',
  windowBounds: { x: 100, y: 100, width: 1400, height: 900 },
};

export class AppShell {
  private config: AppConfig;
  private configPath: string;

  constructor(config?: Partial<AppConfig>) {
    this.configPath = path.join(
      process.env.APPDATA || process.env.HOME || '.',
      'GSPL',
      'config.json'
    );

    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const dirs = [
      this.config.seedsDirectory,
      this.config.outputDirectory,
      path.dirname(this.configPath),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Open and read a file from disk
   */
  openFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf-8', (err, data) => {
        if (err) reject(err);
        else {
          this.updateRecentFiles(filePath);
          resolve(data);
        }
      });
    });
  }

  /**
   * Save file to disk
   */
  saveFile(filePath: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFile(filePath, content, 'utf-8', (err) => {
        if (err) reject(err);
        else {
          this.updateRecentFiles(filePath);
          resolve();
        }
      });
    });
  }

  /**
   * List all seeds in a directory
   */
  listSeeds(directory: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      fs.readdir(directory, (err, files) => {
        if (err) reject(err);
        else {
          const seeds = files
            .filter(f => f.endsWith('.json'))
            .map(f => path.join(directory, f));
          resolve(seeds);
        }
      });
    });
  }

  /**
   * Import seed from file
   */
  importSeed(filePath: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const content = await this.openFile(filePath);
        const fileName = path.basename(filePath);
        const destPath = path.join(this.config.seedsDirectory, fileName);
        await this.saveFile(destPath, content);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Export seed to file
   */
  exportSeed(seed: unknown, filePath: string): Promise<void> {
    const seedData = typeof seed === 'string' ? seed : JSON.stringify(seed, null, 2);
    return this.saveFile(filePath, seedData);
  }

  /**
   * Load configuration from disk
   */
  loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(data) as AppConfig;
        this.config = { ...this.config, ...loaded };
      }
    } catch (err) {
      console.warn('Failed to load config:', err);
    }
    return this.config;
  }

  /**
   * Save configuration to disk
   */
  saveConfig(config: AppConfig): void {
    this.config = config;
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  }

  /**
   * Get current window bounds
   */
  getWindowBounds(): { x: number; y: number; width: number; height: number } {
    return this.config.windowBounds;
  }

  /**
   * Set window bounds
   */
  setWindowBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    this.config.windowBounds = bounds;
    this.saveConfig(this.config);
  }

  /**
   * Update recent files list
   */
  private updateRecentFiles(filePath: string): void {
    const recent = this.config.recentFiles.filter(f => f !== filePath);
    recent.unshift(filePath);
    this.config.recentFiles = recent.slice(0, 10);
  }

  /**
   * Get configuration
   */
  getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * Update theme
   */
  setTheme(theme: 'dark' | 'light'): void {
    this.config.theme = theme;
    this.saveConfig(this.config);
  }
}
