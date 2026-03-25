/**
 * game-renderer.ts — Playable Game Runtime
 * Takes FullGame engine output and renders a playable tile-based game in a Canvas element.
 * Handles input, physics, collision, entities, items, and game rules.
 */

import { UniversalSeed } from '../kernel/seed.js';
import { registry } from '../engines/engine.js';

// ============================================================================
// TYPES — matches FullGame engine output format
// ============================================================================

export interface TileMapData {
  width: number;
  height: number;
  tiles: number[][];
  tileTypes: Record<number, { name: string; solid: boolean; color: string }>;
}

export interface EntityData {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  behavior: string;
  spriteId?: string;
}

export interface ItemData {
  id: string;
  type: string;
  x: number;
  y: number;
  value: number;
}

export interface GameRules {
  winConditions: string[];
  loseConditions: string[];
  scoring: Record<string, number>;
  interactions: Array<{ trigger: string; action: string; target: string }>;
}

export interface GameUILayout {
  healthBar: { x: number; y: number; width: number; height: number };
  scoreDisplay: { x: number; y: number };
  minimap?: { x: number; y: number; width: number; height: number };
  inventory?: { x: number; y: number };
}

export interface GameSpecification {
  gameType: string;
  title: string;
  description: string;
  difficulty: number;
  world: TileMapData;
  entities: EntityData[];
  items: ItemData[];
  rules: GameRules;
  music: unknown;
  ui: GameUILayout;
  palette: string[];
}

export interface GameRendererOptions {
  container: HTMLElement;
  tileSize?: number;
  viewportTilesX?: number;
  viewportTilesY?: number;
  onScore?: (score: number) => void;
  onGameOver?: (won: boolean) => void;
}

// ============================================================================
// RUNTIME STATE
// ============================================================================

interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  grounded: boolean;
  facing: number; // 1 = right, -1 = left
}

interface EnemyState {
  id: string;
  x: number;
  y: number;
  vx: number;
  width: number;
  height: number;
  health: number;
  behavior: string;
  direction: number;
  alive: boolean;
}

interface CollectibleState {
  id: string;
  x: number;
  y: number;
  type: string;
  value: number;
  collected: boolean;
}

// ============================================================================
// GAME RENDERER
// ============================================================================

export class GameRenderer {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx2d: CanvasRenderingContext2D;
  private tileSize: number;
  private viewportW: number;
  private viewportH: number;
  private options: GameRendererOptions;

  private spec: GameSpecification | null = null;
  private player: PlayerState | null = null;
  private enemies: EnemyState[] = [];
  private collectibles: CollectibleState[] = [];
  private score: number = 0;
  private gameOver: boolean = false;
  private gameWon: boolean = false;

  private keys: Set<string> = new Set();
  private cameraX: number = 0;
  private cameraY: number = 0;
  private animFrame: number = 0;
  private running: boolean = false;
  private gravity: number = 0.5;
  private friction: number = 0.85;

  private keydownHandler: (e: KeyboardEvent) => void;
  private keyupHandler: (e: KeyboardEvent) => void;

  constructor(options: GameRendererOptions) {
    this.container = options.container;
    this.tileSize = options.tileSize ?? 32;
    this.viewportW = (options.viewportTilesX ?? 20) * this.tileSize;
    this.viewportH = (options.viewportTilesY ?? 15) * this.tileSize;
    this.options = options;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.viewportW;
    this.canvas.height = this.viewportH;
    this.canvas.style.display = 'block';
    this.canvas.style.borderRadius = '8px';
    this.canvas.style.background = '#000';
    this.canvas.tabIndex = 0;
    this.container.appendChild(this.canvas);

    this.ctx2d = this.canvas.getContext('2d')!;

    this.keydownHandler = (e: KeyboardEvent) => {
      this.keys.add(e.key);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
    };
    this.keyupHandler = (e: KeyboardEvent) => this.keys.delete(e.key);
  }

  /**
   * Load a game from a seed.
   */
  loadSeed(seed: UniversalSeed): boolean {
    const engine = registry.get('fullgame') ?? registry.get('game');
    if (!engine) return false;

    const result = engine.generate(seed);
    if (!result.success) return false;

    const spec = (result.artifacts.get('gameSpec') ?? result.artifacts.get('gameWorldData')) as GameSpecification | undefined;
    if (spec) {
      this.loadGame(spec);
      return true;
    }
    return false;
  }

  /**
   * Load a game specification directly.
   */
  loadGame(spec: GameSpecification): void {
    this.spec = spec;
    this.score = 0;
    this.gameOver = false;
    this.gameWon = false;

    // Physics
    this.gravity = 0.5 * (spec.difficulty ?? 0.5 + 0.5);
    this.friction = 0.85;

    // Find player spawn
    const playerEntity = spec.entities.find(e => e.type === 'player_spawn' || e.type === 'player');
    const px = playerEntity ? playerEntity.x * this.tileSize : this.tileSize * 2;
    const py = playerEntity ? playerEntity.y * this.tileSize : this.tileSize * 2;

    this.player = {
      x: px, y: py,
      vx: 0, vy: 0,
      width: this.tileSize * 0.8,
      height: this.tileSize * 0.9,
      health: 100, maxHealth: 100,
      grounded: false,
      facing: 1,
    };

    // Initialize enemies
    this.enemies = spec.entities
      .filter(e => e.type === 'enemy')
      .map(e => ({
        id: e.id,
        x: e.x * this.tileSize,
        y: e.y * this.tileSize,
        vx: 1,
        width: this.tileSize * 0.7,
        height: this.tileSize * 0.7,
        health: 1,
        behavior: e.behavior ?? 'patrol',
        direction: 1,
        alive: true,
      }));

    // Initialize collectibles
    this.collectibles = spec.items.map(item => ({
      id: item.id,
      x: item.x * this.tileSize,
      y: item.y * this.tileSize,
      type: item.type,
      value: item.value,
      collected: false,
    }));
  }

  /**
   * Start the game loop.
   */
  start(): void {
    if (this.running || !this.spec) return;
    this.running = true;

    this.canvas.focus();
    document.addEventListener('keydown', this.keydownHandler);
    document.addEventListener('keyup', this.keyupHandler);

    const loop = () => {
      if (!this.running) return;
      this.update();
      this.render();
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  /**
   * Stop the game loop.
   */
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.animFrame);
    document.removeEventListener('keydown', this.keydownHandler);
    document.removeEventListener('keyup', this.keyupHandler);
  }

  // ========================================================================
  // GAME LOOP
  // ========================================================================

  private update(): void {
    if (!this.spec || !this.player || this.gameOver) return;

    const p = this.player;
    const speed = 4;
    const jumpForce = -10;

    // Input
    if (this.keys.has('ArrowLeft') || this.keys.has('a')) {
      p.vx = -speed;
      p.facing = -1;
    } else if (this.keys.has('ArrowRight') || this.keys.has('d')) {
      p.vx = speed;
      p.facing = 1;
    } else {
      p.vx *= this.friction;
    }

    if ((this.keys.has('ArrowUp') || this.keys.has('w') || this.keys.has(' ')) && p.grounded) {
      p.vy = jumpForce;
      p.grounded = false;
    }

    // Gravity
    p.vy += this.gravity;

    // Move X
    p.x += p.vx;
    this.resolveCollisionX(p);

    // Move Y
    p.y += p.vy;
    p.grounded = false;
    this.resolveCollisionY(p);

    // Update enemies
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      this.updateEnemy(enemy);

      // Player-enemy collision
      if (this.overlaps(p.x, p.y, p.width, p.height, enemy.x, enemy.y, enemy.width, enemy.height)) {
        if (p.vy > 0 && p.y + p.height - enemy.y < 10) {
          // Stomp
          enemy.alive = false;
          p.vy = jumpForce * 0.6;
          this.score += this.spec.rules.scoring['enemy_kill'] ?? 100;
          this.options.onScore?.(this.score);
        } else {
          // Take damage
          p.health -= 20;
          p.vx = -p.facing * 5;
          p.vy = -5;
          if (p.health <= 0) {
            this.gameOver = true;
            this.gameWon = false;
            this.options.onGameOver?.(false);
          }
        }
      }
    }

    // Collectibles
    for (const item of this.collectibles) {
      if (item.collected) continue;
      if (this.overlaps(p.x, p.y, p.width, p.height, item.x, item.y, this.tileSize * 0.6, this.tileSize * 0.6)) {
        item.collected = true;
        this.score += item.value;
        this.options.onScore?.(this.score);
      }
    }

    // Win condition: all collectibles
    const allCollected = this.collectibles.length > 0 && this.collectibles.every(c => c.collected);
    if (allCollected) {
      this.gameOver = true;
      this.gameWon = true;
      this.options.onGameOver?.(true);
    }

    // Fall off map
    if (p.y > this.spec.world.height * this.tileSize + 200) {
      this.gameOver = true;
      this.gameWon = false;
      this.options.onGameOver?.(false);
    }

    // Camera follow
    this.cameraX = p.x - this.viewportW / 2 + p.width / 2;
    this.cameraY = p.y - this.viewportH / 2 + p.height / 2;
    this.cameraX = Math.max(0, Math.min(this.spec.world.width * this.tileSize - this.viewportW, this.cameraX));
    this.cameraY = Math.max(0, Math.min(this.spec.world.height * this.tileSize - this.viewportH, this.cameraY));
  }

  private updateEnemy(enemy: EnemyState): void {
    if (enemy.behavior === 'patrol' || enemy.behavior === 'pace') {
      enemy.x += enemy.vx * enemy.direction;
      // Reverse on wall or edge
      const tileAhead = this.getTile(
        Math.floor((enemy.x + (enemy.direction > 0 ? enemy.width : 0)) / this.tileSize),
        Math.floor((enemy.y + enemy.height / 2) / this.tileSize)
      );
      const tileBelow = this.getTile(
        Math.floor((enemy.x + enemy.width / 2) / this.tileSize) + enemy.direction,
        Math.floor((enemy.y + enemy.height) / this.tileSize) + 1
      );
      if (tileAhead?.solid || !tileBelow || !tileBelow.solid) {
        enemy.direction *= -1;
      }
    }
  }

  private getTile(tx: number, ty: number): { name: string; solid: boolean; color: string } | null {
    if (!this.spec) return null;
    const w = this.spec.world;
    if (tx < 0 || ty < 0 || tx >= w.width || ty >= w.height) return null;
    const tileId = w.tiles[ty]?.[tx] ?? 0;
    return w.tileTypes[tileId] ?? null;
  }

  private isSolid(px: number, py: number): boolean {
    const tile = this.getTile(Math.floor(px / this.tileSize), Math.floor(py / this.tileSize));
    return tile?.solid ?? false;
  }

  private resolveCollisionX(p: PlayerState): void {
    if (p.vx > 0) {
      if (this.isSolid(p.x + p.width, p.y + 2) || this.isSolid(p.x + p.width, p.y + p.height - 2)) {
        p.x = Math.floor((p.x + p.width) / this.tileSize) * this.tileSize - p.width;
        p.vx = 0;
      }
    } else if (p.vx < 0) {
      if (this.isSolid(p.x, p.y + 2) || this.isSolid(p.x, p.y + p.height - 2)) {
        p.x = Math.ceil(p.x / this.tileSize) * this.tileSize;
        p.vx = 0;
      }
    }
  }

  private resolveCollisionY(p: PlayerState): void {
    if (p.vy > 0) {
      if (this.isSolid(p.x + 2, p.y + p.height) || this.isSolid(p.x + p.width - 2, p.y + p.height)) {
        p.y = Math.floor((p.y + p.height) / this.tileSize) * this.tileSize - p.height;
        p.vy = 0;
        p.grounded = true;
      }
    } else if (p.vy < 0) {
      if (this.isSolid(p.x + 2, p.y) || this.isSolid(p.x + p.width - 2, p.y)) {
        p.y = Math.ceil(p.y / this.tileSize) * this.tileSize;
        p.vy = 0;
      }
    }
  }

  private overlaps(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // ========================================================================
  // RENDERING
  // ========================================================================

  private render(): void {
    if (!this.spec || !this.player) return;
    const ctx = this.ctx2d;
    const ts = this.tileSize;

    ctx.clearRect(0, 0, this.viewportW, this.viewportH);

    // Sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, this.viewportH);
    gradient.addColorStop(0, this.spec.palette?.[0] ?? '#1a1a2e');
    gradient.addColorStop(1, this.spec.palette?.[1] ?? '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.viewportW, this.viewportH);

    ctx.save();
    ctx.translate(-this.cameraX, -this.cameraY);

    // Tiles
    const startCol = Math.max(0, Math.floor(this.cameraX / ts));
    const endCol = Math.min(this.spec.world.width, Math.ceil((this.cameraX + this.viewportW) / ts) + 1);
    const startRow = Math.max(0, Math.floor(this.cameraY / ts));
    const endRow = Math.min(this.spec.world.height, Math.ceil((this.cameraY + this.viewportH) / ts) + 1);

    for (let y = startRow; y < endRow; y++) {
      for (let x = startCol; x < endCol; x++) {
        const tileId = this.spec.world.tiles[y]?.[x] ?? 0;
        const tileType = this.spec.world.tileTypes[tileId];
        if (tileType && tileType.name !== 'air') {
          ctx.fillStyle = tileType.color;
          ctx.fillRect(x * ts, y * ts, ts, ts);
          // Tile border for depth
          ctx.strokeStyle = 'rgba(0,0,0,0.15)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x * ts, y * ts, ts, ts);
        }
      }
    }

    // Collectibles
    for (const item of this.collectibles) {
      if (item.collected) continue;
      const size = ts * 0.5;
      const bob = Math.sin(Date.now() / 300 + item.x) * 3;
      ctx.fillStyle = item.type === 'gem' ? '#e74c3c' : item.type === 'key' ? '#f39c12' : '#f1c40f';
      ctx.beginPath();
      ctx.arc(item.x + size / 2, item.y + size / 2 + bob, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Enemies
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      ctx.fillStyle = this.spec.palette?.[3] ?? '#e74c3c';
      ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
      // Eyes
      ctx.fillStyle = '#fff';
      const eyeX = enemy.direction > 0 ? enemy.x + enemy.width * 0.6 : enemy.x + enemy.width * 0.2;
      ctx.beginPath();
      ctx.arc(eyeX, enemy.y + enemy.height * 0.3, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player
    const p = this.player;
    ctx.fillStyle = this.spec.palette?.[2] ?? '#3498db';
    ctx.fillRect(p.x, p.y, p.width, p.height);
    // Eyes
    ctx.fillStyle = '#fff';
    const pEyeX = p.facing > 0 ? p.x + p.width * 0.65 : p.x + p.width * 0.2;
    ctx.beginPath();
    ctx.arc(pEyeX, p.y + p.height * 0.25, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(pEyeX + p.facing, p.y + p.height * 0.25, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // HUD
    this.renderHUD(ctx);

    // Game over overlay
    if (this.gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, this.viewportW, this.viewportH);
      ctx.fillStyle = this.gameWon ? '#2ecc71' : '#e74c3c';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.gameWon ? 'YOU WIN!' : 'GAME OVER', this.viewportW / 2, this.viewportH / 2 - 10);
      ctx.fillStyle = '#fff';
      ctx.font = '16px monospace';
      ctx.fillText(`Score: ${this.score}`, this.viewportW / 2, this.viewportH / 2 + 25);
      ctx.fillText('Press R to restart', this.viewportW / 2, this.viewportH / 2 + 50);

      if (this.keys.has('r')) {
        this.loadGame(this.spec!);
        this.keys.delete('r');
      }
    }
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    if (!this.player) return;

    // Health bar
    const hbW = 120, hbH = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(10, 10, hbW, hbH);
    const healthPct = this.player.health / this.player.maxHealth;
    ctx.fillStyle = healthPct > 0.5 ? '#2ecc71' : healthPct > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(10, 10, hbW * healthPct, hbH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, hbW, hbH);

    // Score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this.score}`, 10, 38);

    // Title
    if (this.spec?.title) {
      ctx.textAlign = 'right';
      ctx.font = '12px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(this.spec.title, this.viewportW - 10, 20);
    }
  }

  getScore(): number {
    return this.score;
  }

  isGameOver(): boolean {
    return this.gameOver;
  }

  restart(): void {
    if (this.spec) this.loadGame(this.spec);
  }

  destroy(): void {
    this.stop();
    this.canvas.remove();
  }
}
