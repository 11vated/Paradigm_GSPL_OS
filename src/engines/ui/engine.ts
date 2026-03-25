/**
 * ui/engine.ts — UI Component Generation Engine
 * Generates complete UI layouts, component trees, and styling from seeds.
 * Outputs self-contained HTML with embedded CSS.
 */

import {
  UniversalSeed,
  type SeedDomain,
  type FitnessVector,
  type GeneMap,
} from '../../kernel/seed.js';
import {
  scalar,
  categorical,
  vector,
  struct,
} from '../../kernel/genes.js';
import { DeterministicRNG } from '../../kernel/rng.js';
import {
  DomainEngine,
  type DevelopmentalStage,
  type DevelopmentalContext,
} from '../engine.js';

// ============================================================================
// UI TYPES
// ============================================================================

export interface UIComponent {
  type: string;
  tag: string;
  classes: string[];
  content?: string;
  children?: UIComponent[];
  attributes?: Record<string, string>;
}

export interface UITheme {
  colors: {
    primary: [number, number, number];
    secondary: [number, number, number];
    accent: [number, number, number];
    background: [number, number, number];
    text: [number, number, number];
  };
  typography: {
    baseFontSize: number;
    fontFamily: string;
  };
  spacing: {
    baseUnit: number;
  };
  borders: {
    borderRadius: number;
  };
  shadows: {
    elevation: number[];
  };
}

export interface UILayout {
  theme: UITheme;
  rootComponent: UIComponent;
  css: string;
}

// ============================================================================
// UI ENGINE CLASS
// ============================================================================

export class UIEngine extends DomainEngine {
  readonly domain: SeedDomain = 'ui';
  readonly name = 'UI Component Generation Engine';
  readonly version = '1.0.0';

  defaultGenes(): GeneMap {
    return {
      type: categorical('landing-page', [
        'landing-page',
        'dashboard',
        'form',
        'card',
        'navigation',
        'profile',
        'gallery',
      ]),
      theme: categorical('light', ['light', 'dark', 'glass', 'brutalist', 'minimal', 'playful']),
      colorScheme: struct({
        primary: vector([59, 130, 246], { mutable: true }),
        secondary: vector([139, 92, 246], { mutable: true }),
        accent: vector([236, 72, 153], { mutable: true }),
        background: vector([255, 255, 255], { mutable: true }),
        text: vector([31, 41, 55], { mutable: true }),
      }),
      borderRadius: scalar(8, 0, 24, { mutable: true }),
      spacing: scalar(16, 4, 32, { mutable: true }),
      fontSize: scalar(16, 12, 20, { mutable: true }),
      columns: scalar(2, 1, 4, { mutable: true }),
      density: scalar(0.5, 0, 1, { mutable: true }),
      interactivity: scalar(0.5, 0, 1, { mutable: true }),
      elevation: scalar(2, 0, 4, { mutable: true }),
      animationLevel: categorical('subtle', [
        'none',
        'subtle',
        'moderate',
        'expressive',
      ]),
      contentAmount: scalar(5, 1, 10, { mutable: true }),
      imageAspectRatio: categorical('16:9', ['1:1', '4:3', '16:9', '3:2']),
    };
  }

  stages(): DevelopmentalStage[] {
    return [
      { name: 'Layout', description: 'Generate CSS Grid/Flexbox structure', execute: (ctx) => this.stageLayout(ctx) },
      { name: 'Components', description: 'Instantiate UI components', execute: (ctx) => this.stageComponents(ctx) },
      { name: 'Content', description: 'Generate placeholder content', execute: (ctx) => this.stageContent(ctx) },
      { name: 'Styling', description: 'Apply theme and styles', execute: (ctx) => this.stageStyling(ctx) },
      { name: 'Interaction', description: 'Add hover states and transitions', execute: (ctx) => this.stageInteraction(ctx) },
      { name: 'Export', description: 'Output as self-contained HTML', execute: (ctx) => this.stageExport(ctx) },
    ];
  }

  evaluate(seed: UniversalSeed): FitnessVector {
    return {
      scores: {
        components: (seed.genes.contentAmount as any).value,
        interactivity: (seed.genes.interactivity as any).value,
      },
      aggregate: 0.8,
      evaluatedAt: Date.now(),
    };
  }

  // ============================================================================
  // DEVELOPMENTAL STAGES
  // ============================================================================

  private stageLayout(ctx: DevelopmentalContext): DevelopmentalContext {
    const type = (ctx.seed.genes.type as any).value;
    const columns = Math.floor((ctx.seed.genes.columns as any).value);

    const layout: Record<string, unknown> = {
      type,
      columns,
      gridGap: (ctx.seed.genes.spacing as any).value,
    };

    ctx.artifacts.set('layout', layout);
    ctx.parameters.type = type;
    ctx.parameters.columns = columns;

    return ctx;
  }

  private stageComponents(ctx: DevelopmentalContext): DevelopmentalContext {
    const type = ctx.parameters.type as string;
    const contentAmount = Math.floor((ctx.seed.genes.contentAmount as any).value);
    const interactivity = (ctx.seed.genes.interactivity as any).value;

    let root: UIComponent;

    if (type === 'landing-page') {
      root = this.generateLandingPage(ctx.rng, contentAmount);
    } else if (type === 'dashboard') {
      root = this.generateDashboard(ctx.rng, contentAmount);
    } else if (type === 'form') {
      root = this.generateForm(ctx.rng, contentAmount);
    } else if (type === 'card') {
      root = this.generateCard(ctx.rng);
    } else if (type === 'gallery') {
      root = this.generateGallery(ctx.rng, contentAmount);
    } else if (type === 'profile') {
      root = this.generateProfile(ctx.rng, contentAmount);
    } else {
      root = this.generateNavigation(ctx.rng, contentAmount);
    }

    ctx.artifacts.set('componentTree', root);
    ctx.parameters.interactivity = interactivity;

    return ctx;
  }

  private stageContent(ctx: DevelopmentalContext): DevelopmentalContext {
    const componentTree = ctx.artifacts.get('componentTree') as UIComponent;
    this.injectPlaceholderContent(componentTree, ctx.rng);
    ctx.artifacts.set('componentTree', componentTree);
    return ctx;
  }

  private stageStyling(ctx: DevelopmentalContext): DevelopmentalContext {
    const theme = (ctx.seed.genes.theme as any).value;
    const colorSchemeGene = (ctx.seed.genes.colorScheme as any).value;
    const borderRadius = Math.floor((ctx.seed.genes.borderRadius as any).value);
    const spacing = Math.floor((ctx.seed.genes.spacing as any).value);
    const fontSize = Math.floor((ctx.seed.genes.fontSize as any).value);
    const elevation = Math.floor((ctx.seed.genes.elevation as any).value);

    const uiTheme: UITheme = {
      colors: {
        primary: colorSchemeGene.primary.value,
        secondary: colorSchemeGene.secondary.value,
        accent: colorSchemeGene.accent.value,
        background: colorSchemeGene.background.value,
        text: colorSchemeGene.text.value,
      },
      typography: {
        baseFontSize: fontSize,
        fontFamily: this.getFontFamily(theme),
      },
      spacing: {
        baseUnit: spacing,
      },
      borders: {
        borderRadius,
      },
      shadows: {
        elevation: this.getShadowElevations(elevation),
      },
    };

    ctx.artifacts.set('theme', uiTheme);

    return ctx;
  }

  private stageInteraction(ctx: DevelopmentalContext): DevelopmentalContext {
    const animationLevel = (ctx.seed.genes.animationLevel as any).value;
    const componentTree = ctx.artifacts.get('componentTree') as UIComponent;

    // Add interaction classes
    this.addInteractionClasses(componentTree, animationLevel);

    ctx.artifacts.set('componentTree', componentTree);

    return ctx;
  }

  private stageExport(ctx: DevelopmentalContext): DevelopmentalContext {
    const componentTree = ctx.artifacts.get('componentTree') as UIComponent;
    const theme = ctx.artifacts.get('theme') as UITheme;
    const animationLevel = (ctx.seed.genes.animationLevel as any).value;

    const css = this.generateCSS(theme, animationLevel);
    const html = this.componentToHTML(componentTree);

    const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated UI</title>
  <style>
${css}
  </style>
</head>
<body>
${html}
</body>
</html>`;

    ctx.artifacts.set('htmlOutput', fullHTML);

    return ctx;
  }

  // ============================================================================
  // COMPONENT GENERATORS
  // ============================================================================

  private generateLandingPage(rng: DeterministicRNG, contentAmount: number): UIComponent {
    return {
      type: 'page',
      tag: 'div',
      classes: ['landing-page'],
      children: [
        {
          type: 'hero',
          tag: 'section',
          classes: ['hero'],
          children: [
            {
              type: 'heading',
              tag: 'h1',
              classes: ['hero-title'],
              content: 'Welcome to Our Platform',
            },
            {
              type: 'paragraph',
              tag: 'p',
              classes: ['hero-subtitle'],
              content: 'Build amazing things with our tools',
            },
            {
              type: 'button',
              tag: 'button',
              classes: ['btn', 'btn-primary', 'btn-lg'],
              content: 'Get Started',
            },
          ],
        },
        {
          type: 'features',
          tag: 'section',
          classes: ['features'],
          children: Array.from({ length: Math.min(contentAmount, 6) }, (_, i) => ({
            type: 'feature-card',
            tag: 'div',
            classes: ['feature-card'],
            children: [
              {
                type: 'feature-icon',
                tag: 'div',
                classes: ['feature-icon'],
                content: '⭐',
              },
              {
                type: 'feature-title',
                tag: 'h3',
                classes: ['feature-title'],
                content: `Feature ${i + 1}`,
              },
              {
                type: 'feature-desc',
                tag: 'p',
                classes: ['feature-desc'],
                content: 'Description of amazing feature',
              },
            ],
          })),
        },
        {
          type: 'cta',
          tag: 'section',
          classes: ['cta'],
          children: [
            {
              type: 'cta-text',
              tag: 'h2',
              classes: ['cta-text'],
              content: 'Ready to get started?',
            },
            {
              type: 'cta-button',
              tag: 'button',
              classes: ['btn', 'btn-accent', 'btn-lg'],
              content: 'Sign Up Now',
            },
          ],
        },
        {
          type: 'footer',
          tag: 'footer',
          classes: ['footer'],
          children: [
            {
              type: 'footer-text',
              tag: 'p',
              classes: ['footer-text'],
              content: '© 2026 Generated by GSPL Paradigm Engine',
            },
          ],
        },
      ],
    };
  }

  private generateDashboard(rng: DeterministicRNG, contentAmount: number): UIComponent {
    return {
      type: 'dashboard',
      tag: 'div',
      classes: ['dashboard'],
      children: [
        {
          type: 'sidebar',
          tag: 'aside',
          classes: ['sidebar'],
          children: [
            {
              type: 'nav',
              tag: 'nav',
              classes: ['sidebar-nav'],
              children: Array.from({ length: 5 }, (_, i) => ({
                type: 'nav-item',
                tag: 'a',
                classes: ['nav-item', i === 0 ? 'active' : ''],
                content: `Menu ${i + 1}`,
                attributes: { href: '#' },
              })),
            },
          ],
        },
        {
          type: 'main-content',
          tag: 'main',
          classes: ['main-content'],
          children: [
            {
              type: 'header',
              tag: 'header',
              classes: ['dashboard-header'],
              children: [
                {
                  type: 'title',
                  tag: 'h1',
                  classes: ['page-title'],
                  content: 'Dashboard',
                },
              ],
            },
            {
              type: 'stats-grid',
              tag: 'div',
              classes: ['stats-grid'],
              children: Array.from({ length: Math.min(contentAmount, 4) }, (_, i) => ({
                type: 'stat-card',
                tag: 'div',
                classes: ['stat-card'],
                children: [
                  {
                    type: 'stat-value',
                    tag: 'div',
                    classes: ['stat-value'],
                    content: `${Math.floor(Math.random() * 1000)}`,
                  },
                  {
                    type: 'stat-label',
                    tag: 'div',
                    classes: ['stat-label'],
                    content: `Metric ${i + 1}`,
                  },
                ],
              })),
            },
            {
              type: 'content-grid',
              tag: 'div',
              classes: ['content-grid'],
              children: Array.from({ length: Math.min(contentAmount, 3) }, (_, i) => ({
                type: 'content-card',
                tag: 'div',
                classes: ['content-card'],
                children: [
                  {
                    type: 'card-title',
                    tag: 'h2',
                    classes: ['card-title'],
                    content: `Card ${i + 1}`,
                  },
                  {
                    type: 'card-content',
                    tag: 'p',
                    classes: ['card-content'],
                    content: 'Card content goes here',
                  },
                ],
              })),
            },
          ],
        },
      ],
    };
  }

  private generateForm(rng: DeterministicRNG, contentAmount: number): UIComponent {
    const fieldCount = Math.min(contentAmount, 6);
    const formChildren: UIComponent[] = [];

    for (let i = 0; i < fieldCount; i++) {
      formChildren.push({
        type: 'form-group',
        tag: 'div',
        classes: ['form-group'],
        children: [
          {
            type: 'label',
            tag: 'label',
            classes: ['form-label'],
            content: `Field ${i + 1}`,
            attributes: { for: `field-${i}` },
          },
          {
            type: 'input',
            tag: 'input',
            classes: ['form-input'],
            attributes: {
              type: i === fieldCount - 1 ? 'textarea' : 'text',
              id: `field-${i}`,
              placeholder: `Enter ${['name', 'email', 'subject', 'message'][i] || 'value'}`,
            },
          },
        ],
      });
    }

    formChildren.push({
      type: 'submit-group',
      tag: 'div',
      classes: ['form-group'],
      children: [
        {
          type: 'submit-button',
          tag: 'button',
          classes: ['btn', 'btn-primary', 'btn-block'],
          content: 'Submit',
          attributes: { type: 'submit' },
        },
      ],
    });

    return {
      type: 'form',
      tag: 'div',
      classes: ['form-container'],
      children: [
        {
          type: 'form-title',
          tag: 'h1',
          classes: ['form-title'],
          content: 'Contact Form',
        },
        {
          type: 'form',
          tag: 'form',
          classes: ['form'],
          children: formChildren,
        },
      ],
    };
  }

  private generateCard(rng: DeterministicRNG): UIComponent {
    return {
      type: 'card',
      tag: 'div',
      classes: ['card'],
      children: [
        {
          type: 'card-image',
          tag: 'div',
          classes: ['card-image'],
          content: '[Image Placeholder]',
        },
        {
          type: 'card-body',
          tag: 'div',
          classes: ['card-body'],
          children: [
            {
              type: 'card-title',
              tag: 'h3',
              classes: ['card-title'],
              content: 'Card Title',
            },
            {
              type: 'card-text',
              tag: 'p',
              classes: ['card-text'],
              content: 'This is a card description with important information.',
            },
            {
              type: 'card-tags',
              tag: 'div',
              classes: ['card-tags'],
              children: ['Tag 1', 'Tag 2', 'Tag 3'].map(tag => ({
                type: 'tag',
                tag: 'span',
                classes: ['tag'],
                content: tag,
              })),
            },
            {
              type: 'card-action',
              tag: 'button',
              classes: ['btn', 'btn-secondary'],
              content: 'Learn More',
            },
          ],
        },
      ],
    };
  }

  private generateGallery(rng: DeterministicRNG, contentAmount: number): UIComponent {
    return {
      type: 'gallery',
      tag: 'div',
      classes: ['gallery'],
      children: [
        {
          type: 'gallery-title',
          tag: 'h1',
          classes: ['gallery-title'],
          content: 'Image Gallery',
        },
        {
          type: 'gallery-grid',
          tag: 'div',
          classes: ['gallery-grid'],
          children: Array.from({ length: Math.min(contentAmount, 12) }, (_, i) => ({
            type: 'gallery-item',
            tag: 'div',
            classes: ['gallery-item'],
            children: [
              {
                type: 'gallery-image',
                tag: 'div',
                classes: ['gallery-image'],
                content: `[Image ${i + 1}]`,
              },
              {
                type: 'gallery-caption',
                tag: 'p',
                classes: ['gallery-caption'],
                content: `Gallery Item ${i + 1}`,
              },
            ],
          })),
        },
      ],
    };
  }

  private generateProfile(rng: DeterministicRNG, contentAmount: number): UIComponent {
    return {
      type: 'profile',
      tag: 'div',
      classes: ['profile'],
      children: [
        {
          type: 'profile-header',
          tag: 'div',
          classes: ['profile-header'],
          children: [
            {
              type: 'profile-avatar',
              tag: 'div',
              classes: ['profile-avatar'],
              content: '👤',
            },
            {
              type: 'profile-info',
              tag: 'div',
              classes: ['profile-info'],
              children: [
                {
                  type: 'profile-name',
                  tag: 'h1',
                  classes: ['profile-name'],
                  content: 'John Doe',
                },
                {
                  type: 'profile-title',
                  tag: 'p',
                  classes: ['profile-title'],
                  content: 'Professional Designer',
                },
              ],
            },
          ],
        },
        {
          type: 'profile-bio',
          tag: 'p',
          classes: ['profile-bio'],
          content: 'A brief biography or description goes here.',
        },
        {
          type: 'profile-stats',
          tag: 'div',
          classes: ['profile-stats'],
          children: Array.from({ length: 3 }, (_, i) => ({
            type: 'stat',
            tag: 'div',
            classes: ['profile-stat'],
            children: [
              {
                type: 'stat-number',
                tag: 'div',
                classes: ['stat-number'],
                content: `${i * 100 + 50}`,
              },
              {
                type: 'stat-name',
                tag: 'div',
                classes: ['stat-name'],
                content: ['Followers', 'Posts', 'Following'][i],
              },
            ],
          })),
        },
      ],
    };
  }

  private generateNavigation(rng: DeterministicRNG, contentAmount: number): UIComponent {
    return {
      type: 'navigation',
      tag: 'nav',
      classes: ['navigation'],
      children: [
        {
          type: 'nav-brand',
          tag: 'div',
          classes: ['nav-brand'],
          content: 'Brand',
        },
        {
          type: 'nav-menu',
          tag: 'ul',
          classes: ['nav-menu'],
          children: Array.from({ length: Math.min(contentAmount, 5) }, (_, i) => ({
            type: 'nav-item',
            tag: 'li',
            classes: ['nav-item'],
            children: [
              {
                type: 'nav-link',
                tag: 'a',
                classes: ['nav-link'],
                content: `Menu ${i + 1}`,
                attributes: { href: '#' },
              },
            ],
          })),
        },
      ],
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private injectPlaceholderContent(component: UIComponent, rng: DeterministicRNG): void {
    if (!component.content && component.children) {
      for (const child of component.children) {
        this.injectPlaceholderContent(child, rng);
      }
    }
  }

  private addInteractionClasses(component: UIComponent, animationLevel: string): void {
    if (component.tag === 'button' || component.tag === 'a') {
      component.classes.push('interactive');
      if (animationLevel !== 'none') {
        component.classes.push(`animate-${animationLevel}`);
      }
    }
    if (component.children) {
      for (const child of component.children) {
        this.addInteractionClasses(child, animationLevel);
      }
    }
  }

  private getFontFamily(theme: string): string {
    const families: Record<string, string> = {
      light: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      dark: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      glass: "'Segoe UI', sans-serif",
      brutalist: "'Courier New', monospace",
      minimal: "'Helvetica Neue', Arial, sans-serif",
      playful: "'Comic Sans MS', 'Trebuchet MS', sans-serif",
    };
    return families[theme] || families.light;
  }

  private getShadowElevations(elevation: number): number[] {
    const shadows: Record<number, number[]> = {
      0: [],
      1: [0, 1, 3, 0],
      2: [0, 4, 6, 0],
      3: [0, 10, 15, 0],
      4: [0, 20, 25, 0],
    };
    return shadows[Math.min(elevation, 4)] || shadows[2];
  }

  private rgbToString(rgb: [number, number, number]): string {
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }

  private generateCSS(theme: UITheme, animationLevel: string): string {
    const primaryColor = this.rgbToString(theme.colors.primary);
    const secondaryColor = this.rgbToString(theme.colors.secondary);
    const accentColor = this.rgbToString(theme.colors.accent);
    const backgroundColor = this.rgbToString(theme.colors.background);
    const textColor = this.rgbToString(theme.colors.text);
    const baseFontSize = theme.typography.baseFontSize;
    const baseSpacing = theme.spacing.baseUnit;
    const borderRadius = theme.borders.borderRadius;

    const animationCSS =
      animationLevel === 'none'
        ? ''
        : `
    .interactive {
      transition: all ${animationLevel === 'subtle' ? '0.2s' : animationLevel === 'moderate' ? '0.3s' : '0.5s'} ease;
    }
    .interactive:hover {
      transform: ${animationLevel === 'expressive' ? 'scale(1.05)' : 'translateY(-2px)'};
    }
    `;

    return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      font-family: ${theme.typography.fontFamily};
      font-size: ${baseFontSize}px;
      color: ${textColor};
      background-color: ${backgroundColor};
      line-height: 1.6;
    }

    :root {
      --color-primary: ${primaryColor};
      --color-secondary: ${secondaryColor};
      --color-accent: ${accentColor};
      --color-bg: ${backgroundColor};
      --color-text: ${textColor};
      --spacing: ${baseSpacing}px;
      --radius: ${borderRadius}px;
    }

    h1, h2, h3, h4, h5, h6 {
      font-weight: 600;
      line-height: 1.2;
      margin-bottom: calc(var(--spacing) * 0.5);
    }

    h1 { font-size: calc(${baseFontSize}px * 2); }
    h2 { font-size: calc(${baseFontSize}px * 1.5); }
    h3 { font-size: calc(${baseFontSize}px * 1.25); }

    p { margin-bottom: var(--spacing); }

    a {
      color: var(--color-primary);
      text-decoration: none;
    }

    button, .btn {
      padding: calc(var(--spacing) * 0.5) var(--spacing);
      border: none;
      border-radius: var(--radius);
      font-size: ${baseFontSize}px;
      cursor: pointer;
      font-weight: 500;
    }

    .btn-primary {
      background-color: var(--color-primary);
      color: white;
    }

    .btn-secondary {
      background-color: var(--color-secondary);
      color: white;
    }

    .btn-accent {
      background-color: var(--color-accent);
      color: white;
    }

    .btn-lg {
      padding: var(--spacing) calc(var(--spacing) * 1.5);
      font-size: calc(${baseFontSize}px * 1.1);
    }

    .btn-block {
      width: 100%;
    }

    input, textarea, select {
      width: 100%;
      padding: calc(var(--spacing) * 0.5);
      border: 1px solid #ddd;
      border-radius: var(--radius);
      font-size: ${baseFontSize}px;
      margin-bottom: var(--spacing);
    }

    .form-group {
      margin-bottom: var(--spacing);
    }

    .form-label {
      display: block;
      margin-bottom: calc(var(--spacing) * 0.25);
      font-weight: 500;
    }

    .card {
      background: white;
      border-radius: var(--radius);
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .card-body {
      padding: var(--spacing);
    }

    .card-title {
      font-size: calc(${baseFontSize}px * 1.2);
      margin-bottom: calc(var(--spacing) * 0.5);
    }

    .hero {
      padding: calc(var(--spacing) * 3);
      text-align: center;
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
      color: white;
    }

    .hero-title {
      font-size: calc(${baseFontSize}px * 2.5);
      margin-bottom: var(--spacing);
    }

    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: var(--spacing);
      padding: calc(var(--spacing) * 2);
    }

    .feature-card {
      padding: var(--spacing);
      border-radius: var(--radius);
      background: white;
      text-align: center;
    }

    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--spacing);
      padding: calc(var(--spacing) * 2);
    }

    .gallery-item {
      cursor: pointer;
    }

    .gallery-image {
      width: 100%;
      aspect-ratio: 1;
      background: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius);
    }

    .dashboard {
      display: grid;
      grid-template-columns: 250px 1fr;
      height: 100vh;
    }

    .sidebar {
      background: #f8f9fa;
      padding: var(--spacing);
      border-right: 1px solid #ddd;
    }

    .nav-item {
      display: block;
      padding: calc(var(--spacing) * 0.5);
      margin-bottom: calc(var(--spacing) * 0.5);
      color: var(--color-text);
      cursor: pointer;
    }

    .nav-item.active {
      background-color: var(--color-primary);
      color: white;
      border-radius: var(--radius);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--spacing);
      margin-bottom: var(--spacing);
    }

    .stat-card {
      padding: var(--spacing);
      background: white;
      border-radius: var(--radius);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .stat-value {
      font-size: calc(${baseFontSize}px * 2);
      font-weight: bold;
      color: var(--color-primary);
    }

    .footer {
      padding: var(--spacing);
      text-align: center;
      border-top: 1px solid #ddd;
      margin-top: var(--spacing);
    }

    ${animationCSS}
    `;
  }

  private componentToHTML(component: UIComponent, depth: number = 0): string {
    const indent = '  '.repeat(depth);
    const classList = component.classes.filter((c) => c).join(' ');
    const classAttr = classList ? ` class="${classList}"` : '';
    const attrs = component.attributes
      ? Object.entries(component.attributes)
          .map(([k, v]) => (v !== undefined ? ` ${k}="${v}"` : ''))
          .join('')
      : '';

    if (component.tag === 'input' || component.tag === 'br') {
      return `${indent}<${component.tag}${classAttr}${attrs} />`;
    }

    let content = component.content || '';
    let childrenHTML = '';

    if (component.children && component.children.length > 0) {
      childrenHTML = component.children
        .map((child) => this.componentToHTML(child, depth + 1))
        .join('\n');
    }

    if (childrenHTML) {
      return `${indent}<${component.tag}${classAttr}${attrs}>\n${childrenHTML}\n${indent}</${component.tag}>`;
    } else if (content) {
      return `${indent}<${component.tag}${classAttr}${attrs}>${content}</${component.tag}>`;
    } else {
      return `${indent}<${component.tag}${classAttr}${attrs}></${component.tag}>`;
    }
  }
}
