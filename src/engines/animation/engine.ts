/**
 * animation/engine.ts — Animation Generation Engine
 * Generates animation data (keyframes, sprite sheets, skeletal animations) from seeds.
 * Pipeline: Skeleton → Motion → Timing → Render → Export
 */

import {
  DomainEngine,
  DevelopmentalStage,
  DevelopmentalContext,
} from '../engine.js';
import {
  UniversalSeed,
  SeedDomain,
  FitnessVector,
  GeneMap,
  createSeed,
} from '../../kernel/seed.js';
import { scalar, categorical, struct, vector } from '../../kernel/genes.js';
import { DeterministicRNG } from '../../kernel/rng.js';

// ============================================================================
// ANIMATION GENE SCHEMA
// ============================================================================

const ANIMATION_GENES = {
  type: categorical('keyframe', [
    'keyframe',
    'skeletal',
    'particle',
    'procedural',
    'sprite-sheet',
  ]),
  duration: scalar(1, 0.1, 30),
  fps: scalar(24, 12, 60),
  easing: categorical('linear', [
    'linear',
    'ease-in',
    'ease-out',
    'ease-in-out',
    'bounce',
    'elastic',
    'spring',
  ]),
  looping: categorical('loop', ['none', 'loop', 'ping-pong']),
  complexity: scalar(5, 1, 10),
  amplitude: scalar(1, 0, 2),
  frequency: scalar(1, 0.1, 5),
  phaseOffset: scalar(0, 0, 6.28),
  palette: struct({
    primary: vector([1, 0, 0], {
      min: [0, 0, 0],
      max: [1, 1, 1],
    }),
    secondary: vector([0, 1, 0], {
      min: [0, 0, 0],
      max: [1, 1, 1],
    }),
  }),
  spriteSize: scalar(64, 16, 256),
  frameCount: scalar(16, 2, 64),
};

// ============================================================================
// ANIMATION TYPES
// ============================================================================

interface Keyframe {
  time: number;
  properties: Record<string, number>;
  easing: string;
}

interface Bone {
  id: string;
  parent?: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

interface BoneTransformKeyframe {
  time: number;
  boneId: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

interface KeyframeAnimationData {
  type: 'keyframe';
  duration: number;
  fps: number;
  looping: string;
  keyframes: Keyframe[];
}

interface SkeletalAnimationData {
  type: 'skeletal';
  bones: Bone[];
  keyframes: BoneTransformKeyframe[];
  duration: number;
  fps: number;
}

interface ParticleAnimationData {
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

interface ProceduralAnimationData {
  type: 'procedural';
  expression: string;
  parameters: Record<string, number>;
  duration: number;
}

interface SpriteSheetFrame {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  duration: number;
}

interface SpriteSheetData {
  type: 'sprite-sheet';
  frames: SpriteSheetFrame[];
  svg: string;
  cols: number;
  rows: number;
  frameSize: number;
  duration: number;
}

type AnimationArtifact =
  | KeyframeAnimationData
  | SkeletalAnimationData
  | ParticleAnimationData
  | ProceduralAnimationData
  | SpriteSheetData;

// ============================================================================
// EASING FUNCTIONS
// ============================================================================

function easeLinear(t: number): number {
  return t;
}

function easeInQuad(t: number): number {
  return t * t;
}

function easeOutQuad(t: number): number {
  return t * (2 - t);
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function easeBounce(t: number): number {
  if (t < 0.363636) {
    return 7.5625 * t * t;
  } else if (t < 0.727272) {
    t -= 0.545454;
    return 7.5625 * t * t + 0.75;
  } else if (t < 0.909090) {
    t -= 0.818181;
    return 7.5625 * t * t + 0.9375;
  } else {
    t -= 0.954545;
    return 7.5625 * t * t + 0.984375;
  }
}

function easeElastic(t: number): number {
  const c5 = (2 * Math.PI) / 4.5;
  return t === 0
    ? 0
    : t === 1
      ? 1
      : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c5);
}

function easeSpring(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  return t === 0
    ? 0
    : t === 1
      ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

function getEasingFunction(easing: string): (t: number) => number {
  switch (easing) {
    case 'ease-in':
      return easeInQuad;
    case 'ease-out':
      return easeOutQuad;
    case 'ease-in-out':
      return easeInOutQuad;
    case 'bounce':
      return easeBounce;
    case 'elastic':
      return easeElastic;
    case 'spring':
      return easeSpring;
    case 'linear':
    default:
      return easeLinear;
  }
}

// ============================================================================
// ANIMATION ENGINE
// ============================================================================

export class AnimationEngine extends DomainEngine {
  readonly domain: SeedDomain = 'animation';
  readonly name = 'Animation Generator';
  readonly version = '1.0.0';

  defaultGenes(): GeneMap {
    return ANIMATION_GENES;
  }

  evaluate(seed: UniversalSeed): FitnessVector {
    // Simple fitness: prefer moderate complexity and duration
    const complexity = (seed.genes.complexity as any).value;
    const duration = (seed.genes.duration as any).value;

    const complexityScore = 1 - Math.abs(complexity - 5) / 10;
    const durationScore = Math.min(duration / 10, 1);

    return {
      scores: {
        complexity: complexityScore,
        duration: durationScore,
      },
      aggregate: (complexityScore + durationScore) / 2,
      evaluatedAt: Date.now(),
    };
  }

  stages(): DevelopmentalStage[] {
    return [
      {
        name: 'Skeleton',
        description: 'Build animation structure (bone hierarchy or channel setup)',
        execute: this.stageSkeleton.bind(this),
      },
      {
        name: 'Motion',
        description: 'Generate motion curves using easing and procedural noise',
        execute: this.stageMotion.bind(this),
      },
      {
        name: 'Timing',
        description: 'Apply timing, fps, and easing to create frame data',
        execute: this.stageTiming.bind(this),
      },
      {
        name: 'Render',
        description: 'Generate frame data (JSON or SVG)',
        execute: this.stageRender.bind(this),
      },
      {
        name: 'Export',
        description: 'Package as animation data',
        execute: this.stageExport.bind(this),
      },
    ];
  }

  // ========================================================================
  // STAGE: SKELETON
  // ========================================================================

  private stageSkeleton(context: DevelopmentalContext): DevelopmentalContext {
    const animationType = (context.seed.genes.type as any).value;
    const complexity = Math.round((context.seed.genes.complexity as any).value);

    const skeleton: Record<string, unknown> = {
      type: animationType,
      complexity,
    };

    if (animationType === 'skeletal') {
      const bones: Bone[] = [];
      const rootBone: Bone = {
        id: 'root',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      };
      bones.push(rootBone);

      for (let i = 1; i < complexity; i++) {
        const bone: Bone = {
          id: `bone_${i}`,
          parent: i === 1 ? 'root' : `bone_${Math.floor(i / 2)}`,
          position: [i * 0.5, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        };
        bones.push(bone);
      }

      skeleton.bones = bones;
    } else if (animationType === 'keyframe') {
      const channels = [];
      for (let i = 0; i < Math.min(complexity, 5); i++) {
        channels.push({
          name: `channel_${i}`,
          type: ['x', 'y', 'rotation', 'scale', 'opacity'][i],
        });
      }
      skeleton.channels = channels;
    } else if (animationType === 'particle') {
      skeleton.emitterShape = context.rng.pick(['circle', 'box', 'sphere']);
    }

    context.artifacts.set('skeleton', skeleton);
    context.parameters.skeleton = skeleton;

    return context;
  }

  // ========================================================================
  // STAGE: MOTION
  // ========================================================================

  private stageMotion(context: DevelopmentalContext): DevelopmentalContext {
    const animationType = (context.seed.genes.type as any).value;
    const frequency = (context.seed.genes.frequency as any).value;
    const amplitude = (context.seed.genes.amplitude as any).value;
    const phaseOffset = (context.seed.genes.phaseOffset as any).value;
    const duration = (context.seed.genes.duration as any).value;

    const curves: Array<{ channelIdx: number; curve: Array<{ time: number; value: number }> }> = [];

    // Generate procedural motion using layered sine waves
    const numSamples = 16;
    for (let channelIdx = 0; channelIdx < 3; channelIdx++) {
      const curve: Array<{ time: number; value: number }> = [];
      const freqScale = frequency * (channelIdx + 1);
      const phaseShift = phaseOffset + (channelIdx * Math.PI) / 2;

      for (let i = 0; i <= numSamples; i++) {
        const t = i / numSamples;
        const time = t * duration;

        // Layered sine wave
        const value =
          amplitude *
          (Math.sin(freqScale * time * 2 * Math.PI + phaseShift) +
            0.5 * Math.sin((freqScale * 2) * time * 2 * Math.PI) +
            0.25 * Math.sin((freqScale * 3) * time * 2 * Math.PI));

        curve.push({
          time,
          value: Math.max(-1, Math.min(1, value)),
        });
      }

      curves.push({ channelIdx, curve });
    }

    const motion = {
      type: animationType,
      curves,
    };

    context.artifacts.set('motion', motion);
    context.parameters.motion = motion;

    return context;
  }

  // ========================================================================
  // STAGE: TIMING
  // ========================================================================

  private stageTiming(context: DevelopmentalContext): DevelopmentalContext {
    const duration = (context.seed.genes.duration as any).value;
    const fps = (context.seed.genes.fps as any).value;
    const easing = (context.seed.genes.easing as any).value;

    const frameCount = Math.ceil((duration * fps) / 1000);
    const frameDuration = 1000 / fps;

    const timing = {
      duration,
      fps,
      frameCount,
      frameDuration,
      easing,
      frames: [] as Array<{ frameIndex: number; time: number; easedT: number }>,
    };

    const easeFn = getEasingFunction(easing);

    for (let i = 0; i < frameCount; i++) {
      const t = frameCount > 1 ? i / (frameCount - 1) : 0;
      timing.frames.push({
        frameIndex: i,
        time: i * frameDuration,
        easedT: easeFn(t),
      });
    }

    context.artifacts.set('timing', timing);
    context.parameters.timing = timing;

    return context;
  }

  // ========================================================================
  // STAGE: RENDER
  // ========================================================================

  private stageRender(context: DevelopmentalContext): DevelopmentalContext {
    const animationType = (context.seed.genes.type as any).value;
    const timing = context.parameters.timing as any;
    const motion = context.parameters.motion as any;

    if (animationType === 'keyframe') {
      this.renderKeyframeData(context, timing, motion);
    } else if (animationType === 'skeletal') {
      this.renderSkeletalData(context, timing, motion);
    } else if (animationType === 'particle') {
      this.renderParticleData(context);
    } else if (animationType === 'procedural') {
      this.renderProceduralData(context);
    } else if (animationType === 'sprite-sheet') {
      this.renderSpriteSheetData(context, timing);
    }

    return context;
  }

  private renderKeyframeData(
    context: DevelopmentalContext,
    timing: any,
    motion: any
  ): void {
    const easing = (context.seed.genes.easing as any).value;
    const keyframes: Keyframe[] = [];

    for (const frame of timing.frames) {
      const properties: Record<string, number> = {};

      const motionCurves = (motion.curves as Array<{ curve: Array<{ value: number }> }>) || [];
      for (let i = 0; i < Math.min(motionCurves.length, 3); i++) {
        const curve = motionCurves[i].curve;
        const idx = Math.floor(frame.easedT * (curve.length - 1));
        const value = curve[idx]?.value ?? 0;
        properties[`property_${i}`] = value;
      }

      keyframes.push({
        time: frame.time,
        properties,
        easing,
      });
    }

    const keyframeData: KeyframeAnimationData = {
      type: 'keyframe',
      duration: timing.duration,
      fps: timing.fps,
      looping: (context.seed.genes.looping as any).value,
      keyframes,
    };

    context.artifacts.set('frameData', keyframeData);
  }

  private renderSkeletalData(
    context: DevelopmentalContext,
    timing: any,
    motion: any
  ): void {
    const skeleton = context.parameters.skeleton as any;
    const bones = skeleton.bones || [];

    const keyframes: BoneTransformKeyframe[] = [];
    const motionCurves = (motion.curves as Array<{ curve: Array<{ value: number }> }>) || [];

    for (const frame of timing.frames) {
      for (const bone of bones) {
        const motionIdx = bones.indexOf(bone);
        const curveIdx = motionIdx % Math.max(motionCurves.length, 1);
        const curve = motionCurves[curveIdx]?.curve || [];
        const idx = Math.floor(frame.easedT * Math.max(curve.length - 1, 1));
        const value = curve[idx]?.value ?? 0;

        keyframes.push({
          time: frame.time,
          boneId: bone.id,
          position: [value * 0.5, value * 0.3, 0],
          rotation: [0, 0, value * Math.PI * 0.5],
          scale: [1 + value * 0.2, 1 + value * 0.2, 1],
        });
      }
    }

    const skeletalData: SkeletalAnimationData = {
      type: 'skeletal',
      bones,
      keyframes,
      duration: timing.duration,
      fps: timing.fps,
    };

    context.artifacts.set('frameData', skeletalData);
  }

  private renderParticleData(context: DevelopmentalContext): void {
    const duration = (context.seed.genes.duration as any).value;
    const amplitude = (context.seed.genes.amplitude as any).value;
    const frequency = (context.seed.genes.frequency as any).value;
    const primary = (context.seed.genes.palette as any).value.primary.value;

    const particleData: ParticleAnimationData = {
      type: 'particle',
      emitter: {
        rate: 10 * frequency,
        lifetime: duration / 1000,
        shape: 'circle',
        velocity: [amplitude * 50, 0],
        acceleration: [0, -9.8 * amplitude],
      },
      particle: {
        size: 4 * amplitude,
        color: [primary[0] * 255, primary[1] * 255, primary[2] * 255],
        opacity: 0.8,
      },
      duration,
    };

    context.artifacts.set('frameData', particleData);
  }

  private renderProceduralData(context: DevelopmentalContext): void {
    const frequency = (context.seed.genes.frequency as any).value;
    const amplitude = (context.seed.genes.amplitude as any).value;
    const phaseOffset = (context.seed.genes.phaseOffset as any).value;
    const duration = (context.seed.genes.duration as any).value;

    const proceduralData: ProceduralAnimationData = {
      type: 'procedural',
      expression: `sin(freq * t + phase) * amplitude`,
      parameters: {
        freq: frequency,
        amplitude,
        phase: phaseOffset,
        t: duration,
      },
      duration,
    };

    context.artifacts.set('frameData', proceduralData);
  }

  private renderSpriteSheetData(
    context: DevelopmentalContext,
    timing: any
  ): void {
    const frameCount = Math.round((context.seed.genes.frameCount as any).value);
    const spriteSize = (context.seed.genes.spriteSize as any).value;
    const primary = (context.seed.genes.palette as any).value.primary.value;
    const secondary = (context.seed.genes.palette as any).value.secondary.value;

    const cols = Math.ceil(Math.sqrt(frameCount));
    const rows = Math.ceil(frameCount / cols);

    const svgWidth = cols * spriteSize;
    const svgHeight = rows * spriteSize;

    let svg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;

    const frames: SpriteSheetFrame[] = [];

    for (let i = 0; i < frameCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * spriteSize;
      const y = row * spriteSize;

      // Frame background
      svg += `<rect x="${x}" y="${y}" width="${spriteSize}" height="${spriteSize}" fill="rgb(${Math.round(secondary[0] * 255)},${Math.round(secondary[1] * 255)},${Math.round(secondary[2] * 255)})" />`;

      // Animated circle
      const t = frameCount > 1 ? i / (frameCount - 1) : 0;
      const radius = (spriteSize * 0.3) * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
      const cx = x + spriteSize / 2;
      const cy = y + spriteSize / 2;
      const angle = t * Math.PI * 2;
      const offsetX = Math.cos(angle) * (spriteSize * 0.2);
      const offsetY = Math.sin(angle) * (spriteSize * 0.2);

      svg += `<circle cx="${cx + offsetX}" cy="${cy + offsetY}" r="${radius}" fill="rgb(${Math.round(primary[0] * 255)},${Math.round(primary[1] * 255)},${Math.round(primary[2] * 255)})" />`;

      frames.push({
        index: i,
        x,
        y,
        width: spriteSize,
        height: spriteSize,
        duration: timing.frameDuration,
      });
    }

    svg += `</svg>`;

    const spriteSheetData: SpriteSheetData = {
      type: 'sprite-sheet',
      frames,
      svg,
      cols,
      rows,
      frameSize: spriteSize,
      duration: timing.duration,
    };

    context.artifacts.set('frameData', spriteSheetData);
  }

  // ========================================================================
  // STAGE: EXPORT
  // ========================================================================

  private stageExport(context: DevelopmentalContext): DevelopmentalContext {
    const frameData = context.artifacts.get('frameData') as AnimationArtifact;

    const exported = {
      ...frameData,
      metadata: {
        seed: context.seed.$hash,
        domain: context.seed.$domain,
        generated: new Date().toISOString(),
      },
    };

    context.artifacts.set('animation', exported);

    return context;
  }
}
