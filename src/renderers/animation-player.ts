/**
 * animation-player.ts — Animation Playback Runtime
 * Takes Animation engine output (keyframes, sprite sheets, particle data)
 * and plays them back in a Canvas element with frame-accurate timing.
 */

import { UniversalSeed } from '../kernel/seed.js';
import { registry } from '../engines/engine.js';

// ============================================================================
// TYPES — matches Animation engine output format
// ============================================================================

export interface KeyframeData {
  time: number;
  properties: Record<string, number>;
  easing: string;
}

export interface KeyframeAnimation {
  type: 'keyframe';
  duration: number;
  fps: number;
  looping: string;
  keyframes: KeyframeData[];
}

export interface BoneData {
  id: string;
  parent?: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface BoneKeyframe {
  time: number;
  boneId: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

export interface SkeletalAnimation {
  type: 'skeletal';
  bones: BoneData[];
  keyframes: BoneKeyframe[];
  duration: number;
  fps: number;
}

export interface ParticleAnimation {
  type: 'particle';
  emitter: {
    rate: number;
    lifetime: number;
    shape: string;
    velocity: [number, number];
    acceleration: [number, number];
  };
  particle: {
    size: number;
    color: [number, number, number];
    opacity: number;
  };
  duration: number;
}

export interface SpriteSheetAnimation {
  type: 'sprite-sheet';
  frames: Array<{
    index: number;
    x: number;
    y: number;
    width: number;
    height: number;
    duration: number;
  }>;
  svg: string;
  cols: number;
  rows: number;
  frameSize: number;
  duration: number;
}

export type AnimationData = KeyframeAnimation | SkeletalAnimation | ParticleAnimation | SpriteSheetAnimation;

export interface AnimationPlayerOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
  loop?: boolean;
  autoplay?: boolean;
  onFrame?: (frame: number, total: number) => void;
  onComplete?: () => void;
}

// ============================================================================
// PARTICLE STATE
// ============================================================================

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

// ============================================================================
// ANIMATION PLAYER
// ============================================================================

export class AnimationPlayer {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private loop: boolean;
  private options: AnimationPlayerOptions;

  private animData: AnimationData | null = null;
  private playing: boolean = false;
  private startTime: number = 0;
  private frameId: number = 0;
  private particles: Particle[] = [];
  private spriteImage: HTMLImageElement | null = null;

  constructor(options: AnimationPlayerOptions) {
    this.container = options.container;
    this.width = options.width ?? 256;
    this.height = options.height ?? 256;
    this.loop = options.loop ?? true;
    this.options = options;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.display = 'block';
    this.canvas.style.borderRadius = '8px';
    this.canvas.style.background = '#111';
    this.container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Load animation from a seed.
   */
  loadSeed(seed: UniversalSeed): boolean {
    const engine = registry.get('animation');
    if (!engine) return false;

    const result = engine.generate(seed);
    if (!result.success) return false;

    const anim = (result.artifacts.get('animation') ?? result.artifacts.get('frameData')) as AnimationData | undefined;
    if (anim) {
      this.loadAnimation(anim);
      if (this.options.autoplay) this.play();
      return true;
    }
    return false;
  }

  /**
   * Load animation data directly.
   */
  loadAnimation(data: AnimationData): void {
    this.stop();
    this.animData = data;
    this.particles = [];

    if (data.type === 'sprite-sheet' && data.svg) {
      this.loadSpriteSheet(data.svg);
    }
  }

  private loadSpriteSheet(svg: string): void {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    this.spriteImage = new Image();
    this.spriteImage.onload = () => URL.revokeObjectURL(url);
    this.spriteImage.src = url;
  }

  play(): void {
    if (!this.animData || this.playing) return;
    this.playing = true;
    this.startTime = performance.now();
    this.tick();
  }

  stop(): void {
    this.playing = false;
    cancelAnimationFrame(this.frameId);
  }

  private tick(): void {
    if (!this.playing || !this.animData) return;

    const elapsed = (performance.now() - this.startTime) / 1000;
    const duration = this.animData.duration || 2;

    let t = elapsed / duration;
    if (t >= 1) {
      if (this.loop) {
        this.startTime = performance.now();
        t = 0;
        this.particles = [];
      } else {
        this.playing = false;
        this.options.onComplete?.();
        return;
      }
    }

    this.renderFrame(t);

    const fps = ('fps' in this.animData) ? this.animData.fps : 30;
    const totalFrames = Math.ceil(duration * fps);
    const currentFrame = Math.floor(t * totalFrames);
    this.options.onFrame?.(currentFrame, totalFrames);

    this.frameId = requestAnimationFrame(() => this.tick());
  }

  private renderFrame(t: number): void {
    if (!this.animData) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    switch (this.animData.type) {
      case 'keyframe':
        this.renderKeyframe(ctx, this.animData, t);
        break;
      case 'skeletal':
        this.renderSkeletal(ctx, this.animData, t);
        break;
      case 'particle':
        this.renderParticle(ctx, this.animData, t);
        break;
      case 'sprite-sheet':
        this.renderSpriteSheet(ctx, this.animData, t);
        break;
    }
  }

  private renderKeyframe(ctx: CanvasRenderingContext2D, anim: KeyframeAnimation, t: number): void {
    const kfs = anim.keyframes;
    if (kfs.length === 0) return;

    // Interpolate between keyframes
    const time = t * anim.duration;
    let prevKf = kfs[0];
    let nextKf = kfs[kfs.length - 1];

    for (let i = 0; i < kfs.length - 1; i++) {
      if (kfs[i].time <= time && kfs[i + 1].time >= time) {
        prevKf = kfs[i];
        nextKf = kfs[i + 1];
        break;
      }
    }

    const segT = nextKf.time === prevKf.time ? 0 :
      (time - prevKf.time) / (nextKf.time - prevKf.time);
    const easedT = this.ease(segT, prevKf.easing);

    // Interpolate properties
    const props: Record<string, number> = {};
    for (const key of Object.keys(prevKf.properties)) {
      const a = prevKf.properties[key] ?? 0;
      const b = nextKf.properties[key] ?? a;
      props[key] = a + (b - a) * easedT;
    }

    // Render: draw a shape using the interpolated properties
    const cx = this.width / 2 + (props['x'] ?? 0);
    const cy = this.height / 2 + (props['y'] ?? 0);
    const size = (props['scale'] ?? 1) * 40;
    const rotation = (props['rotation'] ?? 0) * Math.PI / 180;
    const opacity = props['opacity'] ?? 1;
    const r = Math.floor((props['r'] ?? 100));
    const g = Math.floor((props['g'] ?? 150));
    const b = Math.floor((props['b'] ?? 255));

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }

  private renderSkeletal(ctx: CanvasRenderingContext2D, anim: SkeletalAnimation, t: number): void {
    const time = t * anim.duration;
    const bonePositions: Map<string, { x: number; y: number; rot: number }> = new Map();

    for (const bone of anim.bones) {
      let x = bone.position[0] * 50 + this.width / 2;
      let y = bone.position[1] * 50 + this.height / 2;
      let rot = bone.rotation[2] ?? 0;

      // Find applicable keyframes for this bone
      const boneKfs = anim.keyframes.filter(kf => kf.boneId === bone.id);
      if (boneKfs.length > 0) {
        let prev = boneKfs[0];
        let next = boneKfs[boneKfs.length - 1];
        for (let i = 0; i < boneKfs.length - 1; i++) {
          if (boneKfs[i].time <= time && boneKfs[i + 1].time >= time) {
            prev = boneKfs[i]; next = boneKfs[i + 1]; break;
          }
        }
        const segT = next.time === prev.time ? 0 : (time - prev.time) / (next.time - prev.time);
        if (prev.position && next.position) {
          x = (prev.position[0] + (next.position[0] - prev.position[0]) * segT) * 50 + this.width / 2;
          y = (prev.position[1] + (next.position[1] - prev.position[1]) * segT) * 50 + this.height / 2;
        }
        if (prev.rotation && next.rotation) {
          rot = prev.rotation[2] + (next.rotation[2] - prev.rotation[2]) * segT;
        }
      }

      bonePositions.set(bone.id, { x, y, rot });
    }

    // Draw bones as connected lines
    ctx.strokeStyle = '#4af';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const bone of anim.bones) {
      const pos = bonePositions.get(bone.id);
      if (!pos) continue;
      if (bone.parent) {
        const parentPos = bonePositions.get(bone.parent);
        if (parentPos) {
          ctx.beginPath();
          ctx.moveTo(parentPos.x, parentPos.y);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        }
      }
      // Joint
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderParticle(ctx: CanvasRenderingContext2D, anim: ParticleAnimation, t: number): void {
    const dt = 1 / 60;
    const emitter = anim.emitter;
    const pSpec = anim.particle;

    // Spawn particles
    const spawnRate = emitter.rate * dt;
    const spawnCount = Math.floor(spawnRate) + (Math.random() < (spawnRate % 1) ? 1 : 0);
    for (let i = 0; i < spawnCount; i++) {
      this.particles.push({
        x: this.width / 2 + (Math.random() - 0.5) * 20,
        y: this.height / 2 + (Math.random() - 0.5) * 20,
        vx: emitter.velocity[0] + (Math.random() - 0.5) * 30,
        vy: emitter.velocity[1] + (Math.random() - 0.5) * 30,
        life: emitter.lifetime,
        maxLife: emitter.lifetime,
        size: pSpec.size * (0.5 + Math.random()),
      });
    }

    // Update and render particles
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx += emitter.acceleration[0] * dt;
      p.vy += emitter.acceleration[1] * dt;
      p.life -= dt;

      if (p.life <= 0) continue;
      alive.push(p);

      const lifeRatio = p.life / p.maxLife;
      ctx.globalAlpha = lifeRatio * pSpec.opacity;
      ctx.fillStyle = `rgb(${pSpec.color[0]},${pSpec.color[1]},${pSpec.color[2]})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * lifeRatio, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.particles = alive;
  }

  private renderSpriteSheet(ctx: CanvasRenderingContext2D, anim: SpriteSheetAnimation, t: number): void {
    if (!this.spriteImage?.complete || anim.frames.length === 0) return;

    const frameIdx = Math.floor(t * anim.frames.length) % anim.frames.length;
    const frame = anim.frames[frameIdx];

    ctx.drawImage(
      this.spriteImage,
      frame.x, frame.y, frame.width, frame.height,
      (this.width - frame.width) / 2,
      (this.height - frame.height) / 2,
      frame.width, frame.height
    );
  }

  private ease(t: number, easing: string): number {
    switch (easing) {
      case 'ease-in': return t * t;
      case 'ease-out': return t * (2 - t);
      case 'ease-in-out': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      case 'bounce': {
        const n = 7.5625;
        const d = 2.75;
        let tt = t;
        if (tt < 1 / d) return n * tt * tt;
        if (tt < 2 / d) { tt -= 1.5 / d; return n * tt * tt + 0.75; }
        if (tt < 2.5 / d) { tt -= 2.25 / d; return n * tt * tt + 0.9375; }
        tt -= 2.625 / d; return n * tt * tt + 0.984375;
      }
      case 'elastic': return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
      default: return t; // linear
    }
  }

  isPlaying(): boolean {
    return this.playing;
  }

  destroy(): void {
    this.stop();
    this.canvas.remove();
  }
}
