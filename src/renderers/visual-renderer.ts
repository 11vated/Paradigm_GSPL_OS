/**
 * visual-renderer.ts — Live Visual2D Renderer
 * Takes Visual2D engine output (SVG string or shape data) and renders it into a DOM container.
 * Supports real-time updates for live mutation/evolution visualization.
 */

import { UniversalSeed } from '../kernel/seed.js';
import { registry } from '../engines/engine.js';

export interface VisualRendererOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
  background?: string;
  animate?: boolean;
}

export interface ShapeData {
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

export class VisualRenderer {
  private container: HTMLElement;
  private width: number;
  private height: number;
  private background: string;
  private svgElement: SVGSVGElement | null = null;
  private animate: boolean;
  private transitionDuration: number = 300;

  constructor(options: VisualRendererOptions) {
    this.container = options.container;
    this.width = options.width ?? 512;
    this.height = options.height ?? 512;
    this.background = options.background ?? '#111';
    this.animate = options.animate ?? true;
    this.init();
  }

  private init(): void {
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    this.container.style.background = this.background;
    this.container.style.borderRadius = '8px';
  }

  /**
   * Render a Visual2D seed by running it through the engine and displaying the SVG.
   */
  renderSeed(seed: UniversalSeed): void {
    const engine = registry.get('visual2d');
    if (!engine) throw new Error('Visual2D engine not registered');

    const result = engine.generate(seed);
    if (!result.success) {
      this.renderError(result.errors.join(', '));
      return;
    }

    const svg = result.artifacts.get('svg') as string | undefined;
    if (svg) {
      this.renderSVG(svg);
      return;
    }

    // Fallback: render from shapes data
    const shapes = result.artifacts.get('shapes') as ShapeData[] | undefined;
    const palette = result.artifacts.get('palette') as { colors: string[] } | undefined;
    if (shapes) {
      this.renderShapes(shapes, palette?.colors);
    }
  }

  /**
   * Render raw SVG markup into the container.
   */
  renderSVG(svgMarkup: string): void {
    if (this.animate && this.svgElement) {
      this.container.style.transition = `opacity ${this.transitionDuration}ms ease`;
      this.container.style.opacity = '0';
      setTimeout(() => {
        this.container.innerHTML = svgMarkup;
        this.svgElement = this.container.querySelector('svg');
        if (this.svgElement) {
          this.svgElement.setAttribute('width', String(this.width));
          this.svgElement.setAttribute('height', String(this.height));
          this.svgElement.style.display = 'block';
        }
        this.container.style.opacity = '1';
      }, this.transitionDuration);
    } else {
      this.container.innerHTML = svgMarkup;
      this.svgElement = this.container.querySelector('svg');
      if (this.svgElement) {
        this.svgElement.setAttribute('width', String(this.width));
        this.svgElement.setAttribute('height', String(this.height));
        this.svgElement.style.display = 'block';
      }
    }
  }

  /**
   * Render from shape data array (when SVG isn't pre-built).
   */
  renderShapes(shapes: ShapeData[], palette?: string[]): void {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', String(this.width));
    svg.setAttribute('height', String(this.height));
    svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    svg.setAttribute('xmlns', ns);

    // Background
    const bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('width', '100%');
    bg.setAttribute('height', '100%');
    bg.setAttribute('fill', this.background);
    svg.appendChild(bg);

    for (const shape of shapes) {
      const el = this.createSVGShape(shape, ns);
      if (el) svg.appendChild(el);
    }

    this.container.innerHTML = '';
    this.container.appendChild(svg);
    this.svgElement = svg;
  }

  private createSVGShape(shape: ShapeData, ns: string): Element | null {
    let el: Element;

    switch (shape.type) {
      case 'circle': {
        el = document.createElementNS(ns, 'circle');
        el.setAttribute('cx', String(shape.x));
        el.setAttribute('cy', String(shape.y));
        el.setAttribute('r', String(Math.min(shape.width, shape.height) / 2));
        break;
      }
      case 'rect':
      case 'rectangle': {
        el = document.createElementNS(ns, 'rect');
        el.setAttribute('x', String(shape.x - shape.width / 2));
        el.setAttribute('y', String(shape.y - shape.height / 2));
        el.setAttribute('width', String(shape.width));
        el.setAttribute('height', String(shape.height));
        break;
      }
      case 'ellipse': {
        el = document.createElementNS(ns, 'ellipse');
        el.setAttribute('cx', String(shape.x));
        el.setAttribute('cy', String(shape.y));
        el.setAttribute('rx', String(shape.width / 2));
        el.setAttribute('ry', String(shape.height / 2));
        break;
      }
      case 'triangle':
      case 'polygon': {
        el = document.createElementNS(ns, 'polygon');
        const cx = shape.x, cy = shape.y;
        const r = Math.min(shape.width, shape.height) / 2;
        const sides = shape.type === 'triangle' ? 3 : 6;
        const points: string[] = [];
        for (let i = 0; i < sides; i++) {
          const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
          points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
        }
        el.setAttribute('points', points.join(' '));
        break;
      }
      case 'line': {
        el = document.createElementNS(ns, 'line');
        el.setAttribute('x1', String(shape.x));
        el.setAttribute('y1', String(shape.y));
        el.setAttribute('x2', String(shape.x + shape.width));
        el.setAttribute('y2', String(shape.y + shape.height));
        el.setAttribute('stroke', shape.color);
        el.setAttribute('stroke-width', String(shape.strokeWidth ?? 2));
        el.setAttribute('opacity', String(shape.opacity));
        return el;
      }
      default: {
        el = document.createElementNS(ns, 'circle');
        el.setAttribute('cx', String(shape.x));
        el.setAttribute('cy', String(shape.y));
        el.setAttribute('r', String(Math.min(shape.width, shape.height) / 2));
        break;
      }
    }

    el.setAttribute('fill', shape.color);
    el.setAttribute('opacity', String(shape.opacity));

    if (shape.stroke) {
      el.setAttribute('stroke', shape.stroke);
      el.setAttribute('stroke-width', String(shape.strokeWidth ?? 1));
    }

    if (shape.rotation) {
      el.setAttribute('transform', `rotate(${shape.rotation} ${shape.x} ${shape.y})`);
    }

    return el;
  }

  /**
   * Export the current rendering as SVG string.
   */
  exportSVG(): string {
    if (!this.svgElement) return '';
    return new XMLSerializer().serializeToString(this.svgElement);
  }

  /**
   * Export the current rendering as a data URL (for download or embedding).
   */
  exportDataURL(): string {
    const svg = this.exportSVG();
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  }

  private renderError(message: string): void {
    this.container.innerHTML = `<div style="color:#f66;padding:16px;font-family:monospace;font-size:12px;">${message}</div>`;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.svgElement) {
      this.svgElement.setAttribute('width', String(width));
      this.svgElement.setAttribute('height', String(height));
    }
  }

  clear(): void {
    this.container.innerHTML = '';
    this.svgElement = null;
  }

  destroy(): void {
    this.clear();
  }
}
