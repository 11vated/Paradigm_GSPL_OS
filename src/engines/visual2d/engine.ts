/**
 * visual2d/engine.ts — 2D Visual Engine
 * Generates 2D images/sprites/logos from seeds via developmental pipeline.
 * Pipeline: Symmetry Breaking → Shape Genesis → Color Mapping → Detail Layering → Style Application
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
import { scalar, categorical } from '../../kernel/genes.js';

// ============================================================================
// GENE SCHEMA FOR VISUAL2D
// ============================================================================

const VISUAL2D_GENES = {
  // Composition
  width: scalar(256, 16, 4096),
  height: scalar(256, 16, 4096),
  symmetry: categorical('none', [
    'none',
    'bilateral',
    'radial',
    'translational',
    'rotational',
  ]),
  symmetryOrder: scalar(4, 1, 12),

  // Shape generation
  shapeCount: scalar(5, 1, 50),
  shapeComplexity: scalar(0.5, 0, 1),
  shapePrimitive: categorical('circle', [
    'circle',
    'rectangle',
    'triangle',
    'polygon',
    'ellipse',
    'line',
    'bezier',
  ]),

  // Color
  paletteHue: scalar(0.5, 0, 1),
  paletteSaturation: scalar(0.7, 0, 1),
  paletteBrightness: scalar(0.6, 0, 1),
  paletteHarmony: categorical('complementary', [
    'complementary',
    'analogous',
    'triadic',
    'split-complementary',
    'tetradic',
    'monochromatic',
  ]),
  colorCount: scalar(5, 2, 16),

  // Style
  style: categorical('vector', [
    'pixel',
    'vector',
    'painterly',
    'geometric',
    'organic',
    'minimal',
    'detailed',
  ]),
  lineWeight: scalar(2, 0.5, 10),
  fillOpacity: scalar(0.8, 0, 1),

  // Detail
  noiseScale: scalar(0.1, 0.01, 1),
  noiseOctaves: scalar(4, 1, 8),
  detailLevel: scalar(0.5, 0, 1),
};

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface ColorPalette {
  colors: string[];
  hue: number;
  saturation: number;
  brightness: number;
  harmony: string;
}

interface ShapeDefinition {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  opacity: number;
  stroke?: string;
  strokeWidth?: number;
}

// ============================================================================
// VISUAL2D ENGINE IMPLEMENTATION
// ============================================================================

export class Visual2DEngine extends DomainEngine {
  readonly domain: SeedDomain = 'visual2d';
  readonly name = 'Visual2D Engine';
  readonly version = '1.0.0';

  defaultGenes(): GeneMap {
    return VISUAL2D_GENES;
  }

  /**
   * Safely extract gene value with fallback to defaults
   * Handles both proper Gene objects and raw scalar values
   */
  protected getGeneValue(key: string, genes: GeneMap, defaultValue?: any): any {
    const gene = genes[key];
    if (!gene) {
      const defaultGene = this.defaultGenes()[key];
      return defaultGene ? (defaultGene as any).value : defaultValue;
    }
    // Handle both Gene objects with .value property and raw values
    const val = (gene as any).value !== undefined ? (gene as any).value : (gene as any);
    return val !== null && val !== undefined ? val : defaultValue;
  }

  stages(): DevelopmentalStage[] {
    return [
      {
        name: 'Symmetry Breaking',
        description: 'Establish base composition (symmetry type, grid, radial, etc.)',
        execute: this.stageSymmetryBreaking.bind(this),
      },
      {
        name: 'Shape Genesis',
        description: 'Generate primitive shapes from genes',
        execute: this.stageShapeGenesis.bind(this),
      },
      {
        name: 'Color Mapping',
        description: 'Apply color palette from genes',
        execute: this.stageColorMapping.bind(this),
      },
      {
        name: 'Detail Layering',
        description: 'Add textures, patterns, gradients',
        execute: this.stageDetailLayering.bind(this),
      },
      {
        name: 'Style Application',
        description: 'Apply rendering style (pixel art, vector, painterly, etc.)',
        execute: this.stageStyleApplication.bind(this),
      },
    ];
  }

  evaluate(seed: UniversalSeed): FitnessVector {
    // Simple fitness: reward diverse shapes and colors
    const shapeCount = (seed.genes.shapeCount as any).value ?? 0;
    const colorCount = (seed.genes.colorCount as any).value ?? 0;
    const complexity = (seed.genes.shapeComplexity as any).value ?? 0;

    const scores = {
      diversity: (shapeCount / 50) * 0.5,
      colorfulness: (colorCount / 16) * 0.3,
      complexity: complexity * 0.2,
    };

    const aggregate =
      scores.diversity + scores.colorfulness + scores.complexity;

    return {
      scores,
      aggregate: Math.min(1, aggregate),
      evaluatedAt: Date.now(),
    };
  }

  // ========================================================================
  // DEVELOPMENTAL STAGES
  // ========================================================================

  private stageSymmetryBreaking(
    context: DevelopmentalContext
  ): DevelopmentalContext {
    const genes = context.seed.genes;

    const width = this.getGeneValue('width', genes, 256);
    const height = this.getGeneValue('height', genes, 256);
    const symmetry = this.getGeneValue('symmetry', genes, 'none');
    const symmetryOrder = Math.round(this.getGeneValue('symmetryOrder', genes, 4));

    context.artifacts.set('width', width);
    context.artifacts.set('height', height);
    context.artifacts.set('symmetry', symmetry);
    context.artifacts.set('symmetryOrder', symmetryOrder);

    // Create grid based on symmetry
    const grid = {
      type: symmetry,
      order: symmetryOrder,
      cellWidth: symmetry === 'none' ? width : width / symmetryOrder,
      cellHeight: symmetry === 'none' ? height : height / symmetryOrder,
    };

    context.artifacts.set('grid', grid);
    return context;
  }

  private stageShapeGenesis(
    context: DevelopmentalContext
  ): DevelopmentalContext {
    const genes = context.seed.genes;
    const width = context.artifacts.get('width') as number;
    const height = context.artifacts.get('height') as number;
    const grid = context.artifacts.get('grid') as any;
    const shapeCount = Math.round(this.getGeneValue('shapeCount', genes, 5));
    const shapePrimitive = this.getGeneValue('shapePrimitive', genes, 'circle');
    const complexity = this.getGeneValue('shapeComplexity', genes, 0.5);

    const shapes: ShapeDefinition[] = [];
    const cellWidth = grid.cellWidth;
    const cellHeight = grid.cellHeight;

    for (let i = 0; i < shapeCount; i++) {
      const cellX = context.rng.nextInt(
        0,
        Math.ceil(width / cellWidth) - 1
      );
      const cellY = context.rng.nextInt(
        0,
        Math.ceil(height / cellHeight) - 1
      );

      const baseX = cellX * cellWidth + cellWidth * 0.5;
      const baseY = cellY * cellHeight + cellHeight * 0.5;

      const size =
        Math.min(cellWidth, cellHeight) *
        (0.3 + complexity * 0.6) *
        context.rng.nextFloat(0.5, 1.5);

      const shape: ShapeDefinition = {
        type: shapePrimitive,
        x: baseX,
        y: baseY,
        width: size,
        height: size,
        rotation: context.rng.nextFloat(0, 360),
        color: '#000000',
        opacity: 0.8,
        strokeWidth:
          1 + complexity * 3 + context.rng.nextFloat(-0.5, 0.5),
      };

      shapes.push(shape);
    }

    context.artifacts.set('shapes', shapes);
    return context;
  }

  private stageColorMapping(
    context: DevelopmentalContext
  ): DevelopmentalContext {
    const genes = context.seed.genes;
    const hue = this.getGeneValue('paletteHue', genes, 0.5);
    const saturation = this.getGeneValue('paletteSaturation', genes, 0.7);
    const brightness = this.getGeneValue('paletteBrightness', genes, 0.6);
    const harmony = this.getGeneValue('paletteHarmony', genes, 'complementary');
    const colorCount = Math.round(this.getGeneValue('colorCount', genes, 5));

    const palette = this.generateColorPalette(
      hue,
      saturation,
      brightness,
      harmony,
      colorCount
    );

    context.artifacts.set('palette', palette);

    // Apply colors to shapes
    const shapes = context.artifacts.get('shapes') as ShapeDefinition[];
    for (let i = 0; i < shapes.length; i++) {
      shapes[i].color = palette.colors[i % palette.colors.length];
      shapes[i].stroke =
        palette.colors[(i + 1) % palette.colors.length];
    }

    context.artifacts.set('shapes', shapes);
    return context;
  }

  private stageDetailLayering(
    context: DevelopmentalContext
  ): DevelopmentalContext {
    const genes = context.seed.genes;
    const detailLevel = this.getGeneValue('detailLevel', genes, 0.5);
    const noiseScale = this.getGeneValue('noiseScale', genes, 0.1);
    const noiseOctaves = Math.round(this.getGeneValue('noiseOctaves', genes, 4));

    // Create noise-based detail patterns
    const details = {
      noiseScale,
      noiseOctaves,
      detailLevel,
      gradients: this.generateGradients(context, detailLevel),
    };

    context.artifacts.set('details', details);
    return context;
  }

  private stageStyleApplication(
    context: DevelopmentalContext
  ): DevelopmentalContext {
    const genes = context.seed.genes;
    const style = this.getGeneValue('style', genes, 'vector');
    const lineWeight = this.getGeneValue('lineWeight', genes, 2);
    const fillOpacity = this.getGeneValue('fillOpacity', genes, 0.8);

    const width = context.artifacts.get('width') as number;
    const height = context.artifacts.get('height') as number;
    const shapes = context.artifacts.get('shapes') as ShapeDefinition[];
    const palette = context.artifacts.get('palette') as ColorPalette;

    // Apply style transformations
    for (const shape of shapes) {
      if (style === 'pixel') {
        shape.width = Math.round(shape.width / 8) * 8;
        shape.height = Math.round(shape.height / 8) * 8;
      } else if (style === 'minimal') {
        shape.opacity = 0.5;
        shape.strokeWidth = 1;
      } else if (style === 'painterly') {
        shape.width += context.rng.nextFloat(-2, 2);
        shape.height += context.rng.nextFloat(-2, 2);
      }
    }

    // Generate SVG
    const svg = this.generateSVG(
      width,
      height,
      shapes,
      palette,
      fillOpacity,
      style
    );

    context.artifacts.set('svg', svg);
    return context;
  }

  // ========================================================================
  // HELPER FUNCTIONS
  // ========================================================================

  private generateColorPalette(
    hue: number,
    saturation: number,
    brightness: number,
    harmony: string,
    colorCount: number
  ): ColorPalette {
    const colors: string[] = [];

    const hueAngles = this.getHarmonyAngles(harmony, colorCount);

    for (const angle of hueAngles) {
      const h = (hue + angle / 360) % 1;
      const s = saturation;
      const b = brightness;
      colors.push(this.hslToHex(h, s, b));
    }

    return {
      colors,
      hue,
      saturation,
      brightness,
      harmony,
    };
  }

  private getHarmonyAngles(harmony: string, count: number): number[] {
    const angles: number[] = [];

    switch (harmony) {
      case 'complementary':
        angles.push(0, 180);
        break;
      case 'analogous':
        for (let i = 0; i < count; i++) {
          angles.push((i * 30) % 360);
        }
        break;
      case 'triadic':
        angles.push(0, 120, 240);
        break;
      case 'split-complementary':
        angles.push(0, 150, 210);
        break;
      case 'tetradic':
        angles.push(0, 90, 180, 270);
        break;
      case 'monochromatic':
        for (let i = 0; i < count; i++) {
          angles.push(0);
        }
        break;
      default:
        angles.push(0);
    }

    return angles.slice(0, count);
  }

  private hslToHex(h: number, s: number, l: number): string {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hPrime = (h * 360) / 60;
    const x = c * (1 - Math.abs((hPrime % 2) - 1));
    let r = 0,
      g = 0,
      b = 0;

    if (hPrime >= 0 && hPrime < 1) {
      r = c;
      g = x;
    } else if (hPrime >= 1 && hPrime < 2) {
      r = x;
      g = c;
    } else if (hPrime >= 2 && hPrime < 3) {
      g = c;
      b = x;
    } else if (hPrime >= 3 && hPrime < 4) {
      g = x;
      b = c;
    } else if (hPrime >= 4 && hPrime < 5) {
      r = x;
      b = c;
    } else if (hPrime >= 5 && hPrime < 6) {
      r = c;
      b = x;
    }

    const m = l - c / 2;
    const toHex = (val: number) => {
      const hex = Math.round((val + m) * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  private generateGradients(
    context: DevelopmentalContext,
    detailLevel: number
  ): string[] {
    const gradients: string[] = [];
    const baseCount = Math.ceil(detailLevel * 5);

    for (let i = 0; i < baseCount; i++) {
      const id = `grad_${i}`;
      const color1 = context.rng.pick([
        '#ff0000',
        '#00ff00',
        '#0000ff',
      ]);
      const color2 = context.rng.pick([
        '#ffff00',
        '#00ffff',
        '#ff00ff',
      ]);
      gradients.push(`${id}:${color1}-${color2}`);
    }

    return gradients;
  }

  private generateSVG(
    width: number,
    height: number,
    shapes: ShapeDefinition[],
    palette: ColorPalette,
    fillOpacity: number,
    style: string
  ): string {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;

    // Background
    svg += `  <rect width="${width}" height="${height}" fill="#ffffff"/>\n`;

    // Render shapes
    for (const shape of shapes) {
      svg += this.renderShape(shape, fillOpacity, style);
    }

    svg += '</svg>';
    return svg;
  }

  private renderShape(
    shape: ShapeDefinition,
    fillOpacity: number,
    style: string
  ): string {
    const opacity = shape.opacity * fillOpacity;
    const rotate = shape.rotation !== 0 ? ` rotate(${shape.rotation} ${shape.x} ${shape.y})` : '';
    const stroke = shape.stroke ? ` stroke="${shape.stroke}" stroke-width="${shape.strokeWidth || 1}"` : '';

    let element = '';

    switch (shape.type) {
      case 'circle':
        element = `  <circle cx="${shape.x}" cy="${shape.y}" r="${shape.width / 2}" fill="${shape.color}" fill-opacity="${opacity}"${stroke} transform="${rotate}"/>\n`;
        break;

      case 'rectangle':
        element = `  <rect x="${shape.x - shape.width / 2}" y="${shape.y - shape.height / 2}" width="${shape.width}" height="${shape.height}" fill="${shape.color}" fill-opacity="${opacity}"${stroke} transform="${rotate}"/>\n`;
        break;

      case 'triangle':
        const size = shape.width / 2;
        const points = `${shape.x},${shape.y - size} ${shape.x + size},${shape.y + size} ${shape.x - size},${shape.y + size}`;
        element = `  <polygon points="${points}" fill="${shape.color}" fill-opacity="${opacity}"${stroke} transform="${rotate}"/>\n`;
        break;

      case 'polygon': {
        const sides = 6 + Math.floor(Math.random() * 4);
        const points = this.generatePolygonPoints(
          shape.x,
          shape.y,
          shape.width / 2,
          sides
        );
        element = `  <polygon points="${points}" fill="${shape.color}" fill-opacity="${opacity}"${stroke} transform="${rotate}"/>\n`;
        break;
      }

      case 'ellipse':
        element = `  <ellipse cx="${shape.x}" cy="${shape.y}" rx="${shape.width / 2}" ry="${shape.height / 3}" fill="${shape.color}" fill-opacity="${opacity}"${stroke} transform="${rotate}"/>\n`;
        break;

      case 'line':
        element = `  <line x1="${shape.x - shape.width / 2}" y1="${shape.y}" x2="${shape.x + shape.width / 2}" y2="${shape.y}" stroke="${shape.color}" stroke-width="${shape.strokeWidth || 2}" transform="${rotate}"/>\n`;
        break;

      case 'bezier':
        element = `  <path d="M ${shape.x - shape.width / 2} ${shape.y} Q ${shape.x} ${shape.y - shape.height / 2} ${shape.x + shape.width / 2} ${shape.y}" fill="none" stroke="${shape.color}" stroke-width="${shape.strokeWidth || 2}" transform="${rotate}"/>\n`;
        break;

      default:
        element = `  <circle cx="${shape.x}" cy="${shape.y}" r="${shape.width / 2}" fill="${shape.color}" fill-opacity="${opacity}"${stroke} transform="${rotate}"/>\n`;
    }

    return element;
  }

  private generatePolygonPoints(
    cx: number,
    cy: number,
    radius: number,
    sides: number
  ): string {
    const points: string[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  }
}
