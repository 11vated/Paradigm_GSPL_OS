/**
 * templates.ts — Project Scaffolding Templates
 * Templates for `paradigm init` and `paradigm new` commands.
 */

// ============================================================================
// INIT TEMPLATE
// ============================================================================

export function getInitPackageJson(name: string): string {
  return JSON.stringify({
    name,
    version: '0.1.0',
    type: 'module',
    scripts: {
      build: 'paradigm run src/main.gspl --output dist',
      dev: 'paradigm watch src/main.gspl --output dist',
      serve: 'paradigm serve dist',
    },
    dependencies: {
      '@paradigm/gspl-engine': '^1.0.0',
    },
  }, null, 2);
}

export function getInitMainGspl(name: string): string {
  return `// ${name} — Main Seed
// Run: paradigm run src/main.gspl

seed ${name} : visual2d {
  genes: {
    width: scalar = 512, min: 128, max: 1024
    height: scalar = 512, min: 128, max: 1024
    complexity: scalar = 0.5, min: 0, max: 1
    symmetry: scalar = 0.5, min: 0, max: 1
    colorHue: scalar = 200, min: 0, max: 360
    saturation: scalar = 0.7, min: 0, max: 1
    density: scalar = 0.5, min: 0, max: 1
    style: scalar = 0.5, min: 0, max: 1
  }
}

// Try mutating:
// let variant = mutate(${name}, rate: 0.3, intensity: 0.5)

// Try evolving:
// let evolved = evolve(${name}, generations: 10, population: 20)
`;
}

export function getInitGitignore(): string {
  return `node_modules/
dist/
output/
*.js.map
.env
.DS_Store
`;
}

// ============================================================================
// DOMAIN SEED TEMPLATES
// ============================================================================

const DOMAIN_TEMPLATES: Record<string, (name: string) => string> = {
  visual2d: (name) => `// ${name} — Visual 2D Seed
// Generates SVG artwork with shapes, colors, and symmetry.

seed ${name} : visual2d {
  genes: {
    width: scalar = 512, min: 128, max: 1024
    height: scalar = 512, min: 128, max: 1024
    complexity: scalar = 0.6, min: 0, max: 1
    symmetry: scalar = 0.5, min: 0, max: 1
    colorHue: scalar = 180, min: 0, max: 360
    saturation: scalar = 0.8, min: 0, max: 1
    brightness: scalar = 0.7, min: 0, max: 1
    density: scalar = 0.5, min: 0, max: 1
    style: scalar = 0.5, min: 0, max: 1
  }
}
`,

  audio: (name) => `// ${name} — Audio Seed
// Generates music with melody, harmony, and rhythm.

seed ${name} : audio {
  genes: {
    tempo: scalar = 120, min: 60, max: 200
    key: scalar = 0, min: 0, max: 11
    scale: scalar = 0, min: 0, max: 6
    density: scalar = 0.5, min: 0, max: 1
    complexity: scalar = 0.5, min: 0, max: 1
    energy: scalar = 0.6, min: 0, max: 1
    mood: scalar = 0.5, min: 0, max: 1
    bars: scalar = 8, min: 4, max: 32
    swing: scalar = 0, min: 0, max: 1
  }
}
`,

  fullgame: (name) => `// ${name} — Full Game Seed
// Generates a complete playable game with world, entities, items, and rules.

seed ${name} : fullgame {
  genes: {
    width: scalar = 40, min: 20, max: 80
    height: scalar = 20, min: 10, max: 40
    difficulty: scalar = 0.5, min: 0, max: 1
    enemyCount: scalar = 5, min: 1, max: 20
    itemCount: scalar = 10, min: 3, max: 30
    complexity: scalar = 0.5, min: 0, max: 1
    gameType: scalar = 0, min: 0, max: 5
    colorfulness: scalar = 0.7, min: 0, max: 1
  }
}
`,

  game: (name) => `// ${name} — Game Level Seed
// Generates a game world with terrain, entities, and physics.

seed ${name} : game {
  genes: {
    width: scalar = 30, min: 10, max: 100
    height: scalar = 20, min: 10, max: 50
    difficulty: scalar = 0.5, min: 0, max: 1
    density: scalar = 0.4, min: 0, max: 1
    complexity: scalar = 0.5, min: 0, max: 1
    genre: scalar = 0, min: 0, max: 5
  }
}
`,

  animation: (name) => `// ${name} — Animation Seed
// Generates keyframe animations, skeletal rigs, or sprite sheets.

seed ${name} : animation {
  genes: {
    duration: scalar = 2, min: 0.5, max: 10
    fps: scalar = 24, min: 12, max: 60
    complexity: scalar = 0.5, min: 0, max: 1
    energy: scalar = 0.5, min: 0, max: 1
    style: scalar = 0, min: 0, max: 4
    looping: scalar = 1, min: 0, max: 1
    smoothness: scalar = 0.7, min: 0, max: 1
  }
}
`,

  geometry3d: (name) => `// ${name} — 3D Geometry Seed
// Generates 3D meshes via marching cubes with SDF primitives.

seed ${name} : geometry3d {
  genes: {
    shape: scalar = 0, min: 0, max: 4
    scale: scalar = 1, min: 0.1, max: 3
    detail: scalar = 0.5, min: 0, max: 1
    deformation: scalar = 0.3, min: 0, max: 1
    roughness: scalar = 0.5, min: 0, max: 1
    metallic: scalar = 0.1, min: 0, max: 1
    colorR: scalar = 0.6, min: 0, max: 1
    colorG: scalar = 0.7, min: 0, max: 1
    colorB: scalar = 0.9, min: 0, max: 1
  }
}
`,

  sprite: (name) => `// ${name} — Sprite Seed
// Generates animated sprite sheets with character designs.

seed ${name} : sprite {
  genes: {
    size: scalar = 64, min: 16, max: 128
    complexity: scalar = 0.5, min: 0, max: 1
    colorfulness: scalar = 0.7, min: 0, max: 1
    style: scalar = 0, min: 0, max: 5
    animation: scalar = 0, min: 0, max: 5
    frameCount: scalar = 8, min: 2, max: 16
  }
}
`,

  ui: (name) => `// ${name} — UI Seed
// Generates complete HTML+CSS user interfaces.

seed ${name} : ui {
  genes: {
    theme: scalar = 0, min: 0, max: 5
    complexity: scalar = 0.5, min: 0, max: 1
    colorfulness: scalar = 0.6, min: 0, max: 1
    spacing: scalar = 0.5, min: 0, max: 1
    roundness: scalar = 0.5, min: 0, max: 1
    elevation: scalar = 0.3, min: 0, max: 1
  }
}
`,

  procedural: (name) => `// ${name} — Procedural Terrain Seed
// Generates terrain heightmaps, biomes, and features.

seed ${name} : procedural {
  genes: {
    width: scalar = 128, min: 32, max: 512
    height: scalar = 128, min: 32, max: 512
    roughness: scalar = 0.5, min: 0, max: 1
    elevation: scalar = 0.5, min: 0, max: 1
    moisture: scalar = 0.5, min: 0, max: 1
    complexity: scalar = 0.5, min: 0, max: 1
    type: scalar = 0, min: 0, max: 5
  }
}
`,
};

export function getDomainTemplate(domain: string, name: string): string | null {
  const template = DOMAIN_TEMPLATES[domain];
  return template ? template(name) : null;
}

export function getAvailableDomains(): string[] {
  return Object.keys(DOMAIN_TEMPLATES);
}
