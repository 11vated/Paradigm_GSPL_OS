# Paradigm GSPL Engine

A genetic operating system for digital creation. Every digital artifact — art, music, games, 3D models, UI — is encoded as a **seed** (a genetic blueprint) that can be bred, mutated, evolved, and composed across domains.

## Quick Start

```bash
# Install
npm install

# Create a new seed file
npx paradigm new visual2d dragon

# Run it
npx paradigm run dragon.gspl --output ./dist --verbose

# Or start the interactive REPL
npx paradigm repl

# Or launch the Creation Studio
cd studio && npm install && npm run dev
```

## What This Is

Paradigm treats creation as evolution. Instead of designing artifacts manually, you:

1. **Define seeds** with genetic parameters (genes)
2. **Generate** artifacts through domain-specific engines
3. **Mutate** seeds to explore variations
4. **Breed** two seeds to combine traits
5. **Evolve** populations to optimize for fitness
6. **Compose** across domains (a game's terrain influences its music)

Every artifact has **lineage** — you can trace any creation back to its parents and ancestors.

## Architecture

```
src/
  kernel/          — Seeds, genes (7 types), genetic operators, seed algebra
  language/        — GSPL lexer, parser, AST, interpreter, compiler, optimizer
  engines/         — 9 domain engines (visual2d, audio, game, animation, 3D, etc.)
  evolution/       — Population GA, fitness, MAP-Elites quality-diversity
  renderers/       — Browser renderers (SVG, Web Audio, Canvas2D game, WebGL 3D)
  intelligence/    — 8 AI sub-agents for seed design assistance
  composition/     — Cross-domain seed composition with gene bindings
  marketplace/     — Seed packaging (.gseed), registry, REST API
  runtime/         — Pipeline, CLI, REPL, watch mode, dev server
  library/         — Seed versioning and repository
studio/            — React + Vite creation studio
```

## The Language (GSPL)

```gspl
seed Dragon : visual2d {
  genes: {
    complexity: scalar = 0.7, min: 0, max: 1
    hue: scalar = 15, min: 0, max: 360
    symmetry: scalar = 0.8, min: 0, max: 1
  }
}

let baby = mutate(Dragon, rate: 0.3, intensity: 0.5)
let evolved = evolve(Dragon, generations: 20, population: 50)
let hybrid = breed(Dragon, baby, dominance: 0.6)
```

## 9 Domain Engines

| Domain | Generates |
|--------|-----------|
| `visual2d` | SVG artwork with shapes, colors, symmetry |
| `audio` | Music with melody, harmony, rhythm, effects |
| `fullgame` | Complete playable games with tiles, entities, rules |
| `game` | Game worlds with terrain and entities |
| `animation` | Keyframes, skeletal, particles, sprite sheets |
| `geometry3d` | 3D meshes via marching cubes |
| `sprite` | Animated sprite sheets |
| `ui` | Complete HTML+CSS interfaces |
| `procedural` | Terrain heightmaps with biomes |

## CLI Commands

```bash
paradigm run <file.gspl>       # Execute and generate artifacts
paradigm inspect <file.gspl>   # Show seed details
paradigm evolve <file.gspl>    # Evolve for N generations
paradigm init [name]           # Scaffold new project
paradigm new <domain> [name]   # Create domain seed file
paradigm repl                  # Interactive REPL
paradigm watch <file.gspl>     # Auto-regenerate on file change
paradigm serve [dir]           # Dev server for artifacts
paradigm publish <file.gspl>   # Package as .gseed
paradigm search [query]        # Search marketplace
paradigm marketplace           # Start marketplace API
paradigm list-engines          # Show registered engines
```

## Programmatic API

```typescript
import { createSeed, scalar, mutate, crossover, registry } from '@paradigm/gspl-engine';

// Create a seed
const seed = createSeed('visual2d', 'MyArt', {
  complexity: scalar(0.7, 0, 1),
  hue: scalar(200, 0, 360),
});

// Mutate it
const variant = mutate(seed, { rate: 0.3, intensity: 0.5 });

// Generate artifacts
const engine = registry.get('visual2d');
const result = engine.generate(seed);
const svg = result.artifacts.get('svg'); // SVG string
```

## Creation Studio

The studio is a React app that lets you visually create, mutate, evolve, and compose seeds.

```bash
cd studio
npm install
npm run dev
# Open http://localhost:5173
```

Features:
- Gene sliders for real-time parameter editing
- Domain switching (visual, audio, game, 3D, animation)
- Audio playback via Web Audio API
- Playable games in the viewport
- Evolution theater with population grid and lineage history

## Marketplace

Package and share seeds:

```bash
# Package a seed
paradigm publish dragon.gspl --publisher "YourName" --tags art,dragon

# Start the marketplace server
paradigm marketplace --port 4444

# Search
curl http://localhost:4444/api/v1/packages?q=dragon
```

## Gene Types

| Type | Description |
|------|-------------|
| `scalar` | Numeric value with min/max bounds |
| `categorical` | One of a fixed set of options |
| `vector` | N-dimensional numeric array |
| `expression` | Mathematical expression string |
| `struct` | Nested gene map |
| `array` | Variable-length gene list |
| `graph` | Nodes and edges with gene data |

## Tests

```bash
npm test            # Run all tests
npm run test:watch  # Watch mode
```

## License

MIT

## Author

Kahlil Stephens — 11vatedTech
