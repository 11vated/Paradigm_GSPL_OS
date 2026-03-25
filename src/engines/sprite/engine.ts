/**
 * sprite/engine.ts — Advanced Sprite Generation Engine
 * Generates complete sprite sheets with characters, items, and tilesets as SVG.
 * Developmental stages: Skeleton → Silhouette → Detail → Color → Animation → Export
 */

import {
  DomainEngine,
  DevelopmentalStage,
  DevelopmentalContext,
  GenerationResult,
} from '../engine.js';
import { UniversalSeed, FitnessVector, GeneMap } from '../../kernel/seed.js';
import { scalar, categorical } from '../../kernel/genes.js';

interface SpriteFrame {
  svg: string;
  frameIndex: number;
  width: number;
  height: number;
}

interface SpriteMetadata {
  frameCount: number;
  width: number;
  height: number;
  animationFrames: Array<{
    index: number;
    duration: number;
    label: string;
  }>;
  colors: string[];
  hitbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class SpriteEngine extends DomainEngine {
  readonly domain = 'sprite';
  readonly name = 'Sprite Generation Engine';
  readonly version = '1.0.0';

  defaultGenes(): GeneMap {
    return {
      spriteType: categorical('character', ['character', 'item', 'tile', 'icon', 'particle']),
      size: scalar(32, 8, 256),
      frameCount: scalar(4, 1, 32),
      direction: categorical('front', ['front', 'side', 'top-down', 'isometric']),
      colorPalette: categorical('fantasy', ['retro', 'pastel', 'neon', 'earth', 'monochrome', 'fantasy']),
      complexity: scalar(5, 1, 10),
      bodyType: categorical('humanoid', ['humanoid', 'creature', 'mech', 'blob', 'geometric', 'plant']),
      headRatio: scalar(0.25, 0.15, 0.45),
      limbStyle: categorical('normal', ['normal', 'stubby', 'long', 'tentacle', 'wings']),
      armorLevel: scalar(0.3, 0, 1),
      expression: categorical('neutral', ['neutral', 'happy', 'angry', 'sad', 'determined']),
      animationType: categorical('idle', ['idle', 'walk', 'run', 'attack', 'death', 'jump']),
      outlineWeight: scalar(1, 0, 3),
      shading: categorical('flat', ['flat', 'cel', 'gradient', 'pixel']),
    };
  }

  evaluate(seed: UniversalSeed): FitnessVector {
    const complexity = this.getGeneValue('complexity', seed.genes, 5) as number;
    const frameCount = this.getGeneValue('frameCount', seed.genes, 4) as number;

    return {
      scores: {
        complexity: Math.min(complexity / 10, 1),
        detail: Math.min(frameCount / 32, 1),
      },
      aggregate: 0.75,
      evaluatedAt: Date.now(),
    };
  }

  stages(): DevelopmentalStage[] {
    return [
      this.stageSkeletonBuilder(),
      this.stageSilhouette(),
      this.stageDetail(),
      this.stageColor(),
      this.stageAnimation(),
      this.stageExport(),
    ];
  }

  private stageSkeletonBuilder(): DevelopmentalStage {
    return {
      name: 'Skeleton',
      description: 'Build body proportions and skeleton points',
      execute: (ctx: DevelopmentalContext) => {
        const bodyType = this.getGeneValue('bodyType', ctx.seed.genes, 'humanoid') as string;
        const headRatio = this.getGeneValue('headRatio', ctx.seed.genes, 0.25) as number;
        const direction = this.getGeneValue('direction', ctx.seed.genes, 'front') as string;
        const size = this.getGeneValue('size', ctx.seed.genes, 32) as number;

        const skeleton = this.buildSkeleton(bodyType, headRatio, direction, size);
        ctx.artifacts.set('skeleton', skeleton);
        ctx.parameters.size = size;
        ctx.parameters.bodyType = bodyType;
        ctx.parameters.direction = direction;

        return ctx;
      },
    };
  }

  private buildSkeleton(
    bodyType: string,
    headRatio: number,
    direction: string,
    size: number
  ): Record<string, { x: number; y: number }> {
    const skeleton: Record<string, { x: number; y: number }> = {};

    const bodyHeight = size * 0.7;
    const headHeight = size * headRatio;
    const torsoHeight = bodyHeight - headHeight;

    const centerX = size / 2;
    const topY = size * 0.1;

    skeleton.head = { x: centerX, y: topY + headHeight / 2 };
    skeleton.torso = { x: centerX, y: topY + headHeight + torsoHeight / 2 };

    if (bodyType === 'humanoid') {
      const shoulderOffsetX = size * 0.15;
      skeleton.leftShoulder = { x: centerX - shoulderOffsetX, y: topY + headHeight };
      skeleton.rightShoulder = { x: centerX + shoulderOffsetX, y: topY + headHeight };
      skeleton.leftElbow = { x: centerX - shoulderOffsetX - size * 0.1, y: topY + headHeight + size * 0.15 };
      skeleton.rightElbow = { x: centerX + shoulderOffsetX + size * 0.1, y: topY + headHeight + size * 0.15 };
      skeleton.leftWrist = { x: centerX - shoulderOffsetX - size * 0.15, y: topY + headHeight + size * 0.3 };
      skeleton.rightWrist = { x: centerX + shoulderOffsetX + size * 0.15, y: topY + headHeight + size * 0.3 };

      skeleton.leftHip = { x: centerX - size * 0.12, y: topY + headHeight + torsoHeight };
      skeleton.rightHip = { x: centerX + size * 0.12, y: topY + headHeight + torsoHeight };
      skeleton.leftKnee = { x: centerX - size * 0.12, y: topY + headHeight + torsoHeight + size * 0.2 };
      skeleton.rightKnee = { x: centerX + size * 0.12, y: topY + headHeight + torsoHeight + size * 0.2 };
      skeleton.leftFoot = { x: centerX - size * 0.12, y: size - size * 0.1 };
      skeleton.rightFoot = { x: centerX + size * 0.12, y: size - size * 0.1 };
    } else if (bodyType === 'creature') {
      skeleton.leftFront = { x: centerX - size * 0.15, y: topY + headHeight + torsoHeight };
      skeleton.rightFront = { x: centerX + size * 0.15, y: topY + headHeight + torsoHeight };
      skeleton.leftBack = { x: centerX - size * 0.1, y: topY + headHeight + torsoHeight + size * 0.2 };
      skeleton.rightBack = { x: centerX + size * 0.1, y: topY + headHeight + torsoHeight + size * 0.2 };
    } else if (bodyType === 'mech') {
      const legOffsetX = size * 0.18;
      skeleton.leftLegTop = { x: centerX - legOffsetX, y: topY + headHeight + torsoHeight };
      skeleton.rightLegTop = { x: centerX + legOffsetX, y: topY + headHeight + torsoHeight };
      skeleton.leftLegBottom = { x: centerX - legOffsetX, y: topY + headHeight + torsoHeight + size * 0.25 };
      skeleton.rightLegBottom = { x: centerX + legOffsetX, y: topY + headHeight + torsoHeight + size * 0.25 };
    }

    return skeleton;
  }

  private stageSilhouette(): DevelopmentalStage {
    return {
      name: 'Silhouette',
      description: 'Generate body shapes from skeleton',
      execute: (ctx: DevelopmentalContext) => {
        const skeleton = ctx.artifacts.get('skeleton') as Record<string, { x: number; y: number }>;
        const bodyType = ctx.parameters.bodyType as string;
        const size = ctx.parameters.size as number;
        const limbStyle = this.getGeneValue('limbStyle', ctx.seed.genes, 'normal') as string;

        const shapes = this.generateBodyShapes(skeleton, bodyType, size, limbStyle);
        ctx.artifacts.set('shapes', shapes);

        return ctx;
      },
    };
  }

  private generateBodyShapes(
    skeleton: Record<string, { x: number; y: number }>,
    bodyType: string,
    size: number,
    limbStyle: string
  ): Array<{ type: string; x: number; y: number; width: number; height: number; rotation?: number }> {
    const shapes: Array<{ type: string; x: number; y: number; width: number; height: number; rotation?: number }> = [];

    const headRadius = size * 0.15;
    shapes.push({
      type: 'circle',
      x: skeleton.head.x,
      y: skeleton.head.y,
      width: headRadius * 2,
      height: headRadius * 2,
    });

    const torsoWidth = size * 0.2;
    const torsoHeight = size * 0.35;
    shapes.push({
      type: 'rect',
      x: skeleton.torso.x - torsoWidth / 2,
      y: skeleton.torso.y - torsoHeight / 2,
      width: torsoWidth,
      height: torsoHeight,
    });

    if (bodyType === 'humanoid') {
      const limbWidth = limbStyle === 'stubby' ? size * 0.08 : limbStyle === 'long' ? size * 0.06 : size * 0.08;
      const armLength = limbStyle === 'stubby' ? size * 0.25 : limbStyle === 'long' ? size * 0.4 : size * 0.3;

      shapes.push({
        type: 'rect',
        x: skeleton.leftShoulder.x - limbWidth / 2,
        y: skeleton.leftShoulder.y,
        width: limbWidth,
        height: armLength,
      });

      shapes.push({
        type: 'rect',
        x: skeleton.rightShoulder.x - limbWidth / 2,
        y: skeleton.rightShoulder.y,
        width: limbWidth,
        height: armLength,
      });

      const legWidth = size * 0.12;
      const legHeight = size * 0.35;

      shapes.push({
        type: 'rect',
        x: skeleton.leftHip.x - legWidth / 2,
        y: skeleton.leftHip.y,
        width: legWidth,
        height: legHeight,
      });

      shapes.push({
        type: 'rect',
        x: skeleton.rightHip.x - legWidth / 2,
        y: skeleton.rightHip.y,
        width: legWidth,
        height: legHeight,
      });
    } else if (bodyType === 'blob') {
      const blobRadius = size * 0.2;
      shapes.push({
        type: 'circle',
        x: skeleton.torso.x,
        y: skeleton.torso.y + size * 0.1,
        width: blobRadius * 2,
        height: blobRadius * 2,
      });
    }

    return shapes;
  }

  private stageDetail(): DevelopmentalStage {
    return {
      name: 'Detail',
      description: 'Add features: eyes, expression, armor',
      execute: (ctx: DevelopmentalContext) => {
        const shapes = ctx.artifacts.get('shapes') as Array<any>;
        const complexity = this.getGeneValue('complexity', ctx.seed.genes, 5) as number;
        const armorLevel = this.getGeneValue('armorLevel', ctx.seed.genes, 0.3) as number;
        const expression = this.getGeneValue('expression', ctx.seed.genes, 'neutral') as string;
        const size = ctx.parameters.size as number;
        const skeleton = ctx.artifacts.get('skeleton') as Record<string, { x: number; y: number }>;

        const features = this.generateFeatures(skeleton, size, complexity, expression, armorLevel);
        ctx.artifacts.set('features', features);

        return ctx;
      },
    };
  }

  private generateFeatures(
    skeleton: Record<string, { x: number; y: number }>,
    size: number,
    complexity: number,
    expression: string,
    armorLevel: number
  ): Array<{ type: string; x: number; y: number; size?: number; char?: string }> {
    const features: Array<{ type: string; x: number; y: number; size?: number; char?: string }> = [];

    const eyeRadius = size * 0.035;
    const eyeSpacing = size * 0.06;
    const eyeY = skeleton.head.y - size * 0.04;

    features.push({
      type: 'eye',
      x: skeleton.head.x - eyeSpacing,
      y: eyeY,
      size: eyeRadius,
    });

    features.push({
      type: 'eye',
      x: skeleton.head.x + eyeSpacing,
      y: eyeY,
      size: eyeRadius,
    });

    if (expression === 'happy') {
      features.push({
        type: 'smile',
        x: skeleton.head.x,
        y: skeleton.head.y + size * 0.04,
        size: size * 0.03,
      });
    } else if (expression === 'angry') {
      features.push({
        type: 'frown',
        x: skeleton.head.x,
        y: skeleton.head.y + size * 0.05,
        size: size * 0.03,
      });
    }

    if (armorLevel > 0.3 && complexity > 4) {
      features.push({
        type: 'armor',
        x: skeleton.torso.x,
        y: skeleton.torso.y,
        size: size * 0.2,
      });
    }

    if (armorLevel > 0.6 && complexity > 6) {
      features.push({
        type: 'helmet',
        x: skeleton.head.x,
        y: skeleton.head.y - size * 0.08,
        size: size * 0.12,
      });
    }

    return features;
  }

  private stageColor(): DevelopmentalStage {
    return {
      name: 'Color',
      description: 'Apply color palette',
      execute: (ctx: DevelopmentalContext) => {
        const palette = this.getGeneValue('colorPalette', ctx.seed.genes, 'fantasy') as string;
        const colors = this.generatePalette(palette, ctx.rng);

        ctx.artifacts.set('palette', colors);
        ctx.parameters.colors = colors;

        return ctx;
      },
    };
  }

  private generatePalette(paletteType: string, rng: any): string[] {
    const palettes: Record<string, string[]> = {
      retro: ['#FF6B6B', '#FFA500', '#FFD700', '#4ECDC4', '#44AF69', '#2C3E50'],
      pastel: ['#FFB3BA', '#FFCCCB', '#FFFFCC', '#CCFFCC', '#CCCCFF', '#FFCCFF'],
      neon: ['#FF006E', '#FB5607', '#FFBE0B', '#8338EC', '#3A86FF', '#06FFA5'],
      earth: ['#8B4513', '#D2B48C', '#8FBC8F', '#A0522D', '#DEB887', '#696969'],
      monochrome: ['#FFFFFF', '#CCCCCC', '#999999', '#666666', '#333333', '#000000'],
      fantasy: ['#9B59B6', '#E74C3C', '#F39C12', '#16A085', '#3498DB', '#ECF0F1'],
    };

    return palettes[paletteType] || palettes.fantasy;
  }

  private stageAnimation(): DevelopmentalStage {
    return {
      name: 'Animation',
      description: 'Generate animation frames',
      execute: (ctx: DevelopmentalContext) => {
        const frameCount = this.getGeneValue('frameCount', ctx.seed.genes, 4) as number;
        const animationType = this.getGeneValue('animationType', ctx.seed.genes, 'idle') as string;
        const skeleton = ctx.artifacts.get('skeleton') as Record<string, { x: number; y: number }>;
        const bodyType = ctx.parameters.bodyType as string;
        const size = ctx.parameters.size as number;

        const frames = this.generateAnimationFrames(
          frameCount,
          animationType,
          skeleton,
          bodyType,
          size,
          ctx.rng
        );

        ctx.artifacts.set('animationFrames', frames);

        return ctx;
      },
    };
  }

  private generateAnimationFrames(
    frameCount: number,
    animationType: string,
    skeleton: Record<string, { x: number; y: number }>,
    bodyType: string,
    size: number,
    rng: any
  ): Array<{ index: number; variations: Record<string, number> }> {
    const frames: Array<{ index: number; variations: Record<string, number> }> = [];

    for (let i = 0; i < frameCount; i++) {
      const t = frameCount > 1 ? i / (frameCount - 1) : 0;
      const variations: Record<string, number> = {};

      if (animationType === 'walk' && bodyType === 'humanoid') {
        variations.leftLegOffset = Math.sin(t * Math.PI * 2) * (size * 0.08);
        variations.rightLegOffset = Math.sin((t + 0.5) * Math.PI * 2) * (size * 0.08);
        variations.bodyBob = Math.abs(Math.sin(t * Math.PI * 2)) * (size * 0.02);
      } else if (animationType === 'idle') {
        variations.bodySway = Math.sin(t * Math.PI * 2) * (size * 0.01);
        variations.armSway = Math.sin((t + 0.25) * Math.PI * 2) * (size * 0.02);
      } else if (animationType === 'attack') {
        variations.armRotation = t < 0.5 ? (t / 0.5) * 45 : ((1 - t) / 0.5) * 45;
        variations.bodyTilt = t < 0.5 ? (t / 0.5) * 10 : 0;
      } else if (animationType === 'jump') {
        const jumpPeak = 0.5;
        variations.bodyOffset = t < jumpPeak ? (t / jumpPeak) * (size * 0.25) : ((1 - t) / (1 - jumpPeak)) * (size * 0.25);
      } else if (animationType === 'run') {
        variations.leftLegOffset = Math.sin(t * Math.PI * 2) * (size * 0.15);
        variations.rightLegOffset = Math.sin((t + 0.5) * Math.PI * 2) * (size * 0.15);
        variations.bodyBob = Math.abs(Math.sin(t * Math.PI * 2)) * (size * 0.04);
      }

      frames.push({ index: i, variations });
    }

    return frames;
  }

  private stageExport(): DevelopmentalStage {
    return {
      name: 'Export',
      description: 'Assemble SVG sprite sheet',
      execute: (ctx: DevelopmentalContext) => {
        const skeleton = ctx.artifacts.get('skeleton') as Record<string, { x: number; y: number }>;
        const shapes = ctx.artifacts.get('shapes') as Array<any>;
        const features = ctx.artifacts.get('features') as Array<any>;
        const colors = ctx.artifacts.get('palette') as string[];
        const animationFrames = ctx.artifacts.get('animationFrames') as Array<any>;
        const size = ctx.parameters.size as number;
        const shading = this.getGeneValue('shading', ctx.seed.genes, 'flat') as string;
        const outlineWeight = this.getGeneValue('outlineWeight', ctx.seed.genes, 1) as number;

        const frames: SpriteFrame[] = [];
        for (const animFrame of animationFrames) {
          const frameSvg = this.renderFrame(
            shapes,
            features,
            colors,
            size,
            outlineWeight,
            shading,
            animFrame.variations
          );

          frames.push({
            svg: frameSvg,
            frameIndex: animFrame.index,
            width: size,
            height: size,
          });
        }

        const spriteSheet = this.createSpriteSheet(frames, size);
        const metadata = this.createMetadata(animationFrames.length, size, colors);

        ctx.artifacts.set('spriteSheet', spriteSheet);
        ctx.artifacts.set('frames', frames);
        ctx.artifacts.set('metadata', metadata);

        return ctx;
      },
    };
  }

  private renderFrame(
    shapes: Array<any>,
    features: Array<any>,
    colors: string[],
    size: number,
    outlineWeight: number,
    shading: string,
    variations: Record<string, number>
  ): string {
    const width = size;
    const height = size;

    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

    const bgColor = '#F5F5F5';
    svg += `<rect width="${width}" height="${height}" fill="${bgColor}"/>`;

    const baseColor = colors[0];
    const shadeColor = this.lightenColor(baseColor, -20);
    const highlightColor = this.lightenColor(baseColor, 20);

    for (const shape of shapes) {
      const x = shape.x + (variations[`${shape.type}Offset`] || 0);
      const y = shape.y + (variations.bodySway || 0);

      if (shape.type === 'circle') {
        const radius = shape.width / 2;
        const fill = shading === 'gradient' ? this.createGradient('grad1', baseColor, shadeColor) : baseColor;

        svg += `<defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${highlightColor};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${shadeColor};stop-opacity:1" />
          </linearGradient>
        </defs>`;

        svg += `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="#000" stroke-width="${outlineWeight}"/>`;
      } else if (shape.type === 'rect') {
        const fill = shading === 'gradient' ? 'url(#grad1)' : baseColor;
        svg += `<rect x="${x}" y="${y}" width="${shape.width}" height="${shape.height}" fill="${fill}" stroke="#000" stroke-width="${outlineWeight}"/>`;
      }
    }

    for (const feature of features) {
      if (feature.type === 'eye') {
        svg += `<circle cx="${feature.x}" cy="${feature.y}" r="${feature.size}" fill="#FFFFFF" stroke="#000" stroke-width="${outlineWeight}"/>`;
        svg += `<circle cx="${feature.x}" cy="${feature.y}" r="${feature.size * 0.5}" fill="#000"/>`;
      } else if (feature.type === 'smile') {
        svg += `<path d="M ${feature.x - feature.size} ${feature.y} Q ${feature.x} ${feature.y + feature.size} ${feature.x + feature.size} ${feature.y}" stroke="#000" stroke-width="${outlineWeight}" fill="none"/>`;
      } else if (feature.type === 'frown') {
        svg += `<path d="M ${feature.x - feature.size} ${feature.y} Q ${feature.x} ${feature.y - feature.size} ${feature.x + feature.size} ${feature.y}" stroke="#000" stroke-width="${outlineWeight}" fill="none"/>`;
      } else if (feature.type === 'armor') {
        svg += `<rect x="${feature.x - feature.size / 2}" y="${feature.y - feature.size / 2}" width="${feature.size}" height="${feature.size}" fill="${colors[3]}" stroke="#000" stroke-width="${outlineWeight}"/>`;
      } else if (feature.type === 'helmet') {
        svg += `<circle cx="${feature.x}" cy="${feature.y}" r="${feature.size}" fill="${colors[2]}" stroke="#000" stroke-width="${outlineWeight}"/>`;
      }
    }

    svg += '</svg>';
    return svg;
  }

  private createSpriteSheet(frames: SpriteFrame[], size: number): string {
    const cols = Math.ceil(Math.sqrt(frames.length));
    const rows = Math.ceil(frames.length / cols);
    const sheetWidth = cols * size;
    const sheetHeight = rows * size;

    let svg = `<svg width="${sheetWidth}" height="${sheetHeight}" viewBox="0 0 ${sheetWidth} ${sheetHeight}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="${sheetWidth}" height="${sheetHeight}" fill="#FFFFFF"/>`;

    for (let i = 0; i < frames.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * size;
      const y = row * size;

      svg += `<g transform="translate(${x}, ${y})">`;
      svg += frames[i].svg.replace(/<svg[^>]*>|<\/svg>/g, '');
      svg += '</g>';
    }

    svg += '</svg>';
    return svg;
  }

  private createMetadata(frameCount: number, size: number, colors: string[]): SpriteMetadata {
    const frames: Array<{
      index: number;
      duration: number;
      label: string;
    }> = [];

    for (let i = 0; i < frameCount; i++) {
      frames.push({
        index: i,
        duration: 100,
        label: `frame_${i}`,
      });
    }

    return {
      frameCount,
      width: size,
      height: size,
      animationFrames: frames,
      colors,
      hitbox: {
        x: size * 0.15,
        y: size * 0.1,
        width: size * 0.7,
        height: size * 0.8,
      },
    };
  }

  private lightenColor(color: string, amount: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount));
    return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).substring(1);
  }

  private createGradient(id: string, color1: string, color2: string): string {
    return `url(#${id})`;
  }
}
