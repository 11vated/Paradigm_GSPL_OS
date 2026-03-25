import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Shuffle, GitBranch, Layers, Music, Gamepad2, Box, Layout, Mountain, Sparkles, Save, Trash2, ChevronDown } from "lucide-react";

// ============================================================================
// DETERMINISTIC RNG
// ============================================================================

class SimpleRNG {
  constructor(seed = 42) {
    this.seed = seed;
    this.m = 2147483647;
    this.a = 16807;
    this.q = 127773;
    this.r = 2836;
    this.current = Math.abs(seed % (this.m - 1)) + 1;
  }

  next() {
    const hi = Math.floor(this.current / this.q);
    const lo = this.current % this.q;
    this.current = this.a * lo - this.r * hi;
    if (this.current <= 0) this.current += this.m;
    return this.current / this.m;
  }

  nextInt(max) {
    return Math.floor(this.next() * max);
  }

  nextGaussian() {
    const u1 = this.next();
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  nextBool(p = 0.5) {
    return this.next() < p;
  }

  nextRange(min, max) {
    return min + this.next() * (max - min);
  }
}

// ============================================================================
// GENE SYSTEM
// ============================================================================

function createScalar(value, min, max) {
  return { type: "scalar", value, min, max };
}

function createCategorical(value, options) {
  return { type: "categorical", value, options };
}

function mutateGenes(genes, rate, rng) {
  const mutated = { ...genes };
  Object.entries(mutated).forEach(([key, gene]) => {
    if (rng.next() < rate) {
      if (gene.type === "scalar") {
        const magnitude = (gene.max - gene.min) * 0.15;
        mutated[key] = {
          ...gene,
          value: Math.max(
            gene.min,
            Math.min(gene.max, gene.value + rng.nextGaussian() * magnitude)
          ),
        };
      } else if (gene.type === "categorical") {
        mutated[key] = {
          ...gene,
          value: gene.options[rng.nextInt(gene.options.length)],
        };
      }
    }
  });
  return mutated;
}

function breedGenes(genesA, genesB, dominance, rng) {
  const child = {};
  Object.keys(genesA).forEach((key) => {
    const geneA = genesA[key];
    const geneB = genesB[key];
    if (geneA.type === "scalar") {
      const blend = dominance * geneA.value + (1 - dominance) * geneB.value;
      child[key] = { ...geneA, value: blend };
    } else {
      child[key] = {
        ...geneA,
        value: rng.next() < dominance ? geneA.value : geneB.value,
      };
    }
  });
  return child;
}

function hashGenes(genes) {
  let hash = 0;
  Object.entries(genes).forEach(([key, gene]) => {
    const val =
      gene.type === "scalar"
        ? Math.floor(gene.value * 10000)
        : gene.options.indexOf(gene.value);
    hash = (hash << 5) - hash + val + key.charCodeAt(0);
    hash = hash & hash;
  });
  return Math.abs(hash).toString(16).substring(0, 8);
}

// ============================================================================
// DOMAIN TEMPLATES
// ============================================================================

const TEMPLATES = {
  visual2d: {
    width: createScalar(600, 100, 1200),
    height: createScalar(600, 100, 1200),
    complexity: createScalar(7, 1, 15),
    symmetry: createCategorical("radial", ["none", "bilateral", "radial"]),
    style: createCategorical("organic", [
      "geometric",
      "organic",
      "fractal",
      "minimal",
    ]),
    density: createScalar(0.5, 0, 1),
    curvature: createScalar(0.6, 0, 1),
    colorHarmony: createCategorical("complementary", [
      "complementary",
      "analogous",
      "triadic",
      "split",
    ]),
    palette: createScalar(0.5, 0, 1),
  },
  audio: {
    tempo: createScalar(120, 60, 200),
    scale: createCategorical("major", [
      "major",
      "minor",
      "pentatonic",
      "blues",
    ]),
    density: createScalar(0.6, 0.1, 1),
    complexity: createScalar(5, 1, 10),
    bars: createScalar(8, 4, 16),
    key: createCategorical("C", [
      "C",
      "G",
      "D",
      "A",
      "E",
      "B",
      "F",
      "Bb",
    ]),
  },
  animation: {
    type: createCategorical("morph", ["morph", "rotate", "bounce", "spiral"]),
    duration: createScalar(2, 0.5, 5),
    fps: createScalar(24, 12, 60),
    easing: createCategorical("ease-in-out", [
      "linear",
      "ease-in-out",
      "bounce",
      "elastic",
    ]),
    complexity: createScalar(5, 1, 10),
    frameCount: createScalar(24, 12, 60),
  },
  procedural: {
    type: createCategorical("island", ["island", "mountain", "cave", "crater"]),
    width: createScalar(32, 16, 64),
    height: createScalar(32, 16, 64),
    octaves: createScalar(4, 1, 8),
    persistence: createScalar(0.5, 0.1, 0.9),
    threshold: createScalar(0.4, 0, 1),
  },
  game: {
    type: createCategorical("dungeon", ["dungeon", "arena", "maze", "cavern"]),
    width: createScalar(16, 8, 32),
    height: createScalar(16, 8, 32),
    entityCount: createScalar(8, 1, 20),
    difficulty: createScalar(5, 1, 10),
  },
  geometry3d: {
    shape: createCategorical("icosphere", [
      "icosphere",
      "torus",
      "klein",
      "trefoil",
    ]),
    subdivisions: createScalar(2, 0, 4),
    deformation: createScalar(0.3, 0, 1),
    twist: createScalar(0.2, 0, 1),
    taper: createScalar(0.5, 0, 1),
  },
  ui: {
    type: createCategorical("dashboard", [
      "dashboard",
      "form",
      "gallery",
      "timeline",
    ]),
    columns: createScalar(3, 1, 6),
    spacing: createScalar(2, 1, 5),
    theme: createCategorical("dark", ["dark", "light", "neon", "minimal"]),
    componentCount: createScalar(6, 3, 12),
  },
};

// ============================================================================
// GENERATORS
// ============================================================================

function generateVisual2D(genes, seed) {
  const rng = new SimpleRNG(seed);
  const { width, height, complexity, symmetry, style, density, curvature, colorHarmony, palette } = genes;

  const w = Math.round(width.value);
  const h = Math.round(height.value);
  const complexityVal = Math.round(complexity.value);

  const baseHue = rng.next() * 360;
  const colors = generatePalette(baseHue, colorHarmony.value, palette.value);

  let shapes = [];
  for (let i = 0; i < complexityVal; i++) {
    const cx = rng.nextRange(0, w);
    const cy = rng.nextRange(0, h);
    const r = rng.nextRange(10, Math.min(w, h) * 0.3);
    const color = colors[i % colors.length];
    const opacity = rng.nextRange(0.3, 0.9);

    if (style.value === "geometric") {
      const sides = rng.nextInt(3) + 3;
      shapes.push({
        type: "polygon",
        cx,
        cy,
        r,
        sides,
        color,
        opacity,
      });
    } else if (style.value === "organic") {
      const points = generateBlobPoints(cx, cy, r, 8 + rng.nextInt(4), curvature.value);
      shapes.push({
        type: "path",
        points,
        color,
        opacity,
      });
    } else if (style.value === "fractal") {
      shapes.push({
        type: "spiral",
        cx,
        cy,
        r,
        turns: rng.nextInt(5) + 2,
        color,
        opacity,
      });
    } else {
      shapes.push({
        type: "circle",
        cx,
        cy,
        r,
        color,
        opacity,
      });
    }
  }

  // Apply symmetry
  if (symmetry.value !== "none") {
    const newShapes = [...shapes];
    shapes.forEach((shape) => {
      if (symmetry.value === "radial") {
        for (let a = 1; a < 4; a++) {
          const angle = (a * Math.PI * 2) / 4;
          const rotated = rotateShape(shape, w / 2, h / 2, angle);
          newShapes.push(rotated);
        }
      } else if (symmetry.value === "bilateral") {
        newShapes.push(mirrorShape(shape, w / 2));
      }
    });
    shapes = newShapes;
  }

  return renderSVG(shapes, w, h);
}

function generatePalette(baseHue, harmony, spread) {
  const colors = [];
  const offsets =
    harmony === "complementary"
      ? [0, 180]
      : harmony === "analogous"
        ? [-30, 0, 30]
        : harmony === "triadic"
          ? [0, 120, 240]
          : [0, 150, 210];

  offsets.forEach((offset) => {
    const h = (baseHue + offset) % 360;
    const s = 50 + spread * 30;
    const l = 50 + (Math.random() - 0.5) * 20;
    colors.push(`hsl(${h}, ${s}%, ${l}%)`);
  });
  return colors;
}

function generateBlobPoints(cx, cy, r, count, curvature) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const radius = r * (0.5 + curvature * 0.5 + Math.random() * 0.3);
    points.push([
      cx + Math.cos(angle) * radius,
      cy + Math.sin(angle) * radius,
    ]);
  }
  return points;
}

function rotateShape(shape, cx, cy, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  if (shape.type === "circle" || shape.type === "polygon") {
    const x = shape.cx - cx;
    const y = shape.cy - cy;
    return {
      ...shape,
      cx: cx + x * cos - y * sin,
      cy: cy + x * sin + y * cos,
    };
  }
  return shape;
}

function mirrorShape(shape, centerX) {
  if (shape.type === "circle" || shape.type === "polygon") {
    return {
      ...shape,
      cx: 2 * centerX - shape.cx,
    };
  }
  return shape;
}

function renderSVG(shapes, width, height) {
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#0a0a0f"/>`;

  shapes.forEach((shape) => {
    if (shape.type === "circle") {
      svg += `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}" fill="${shape.color}" opacity="${shape.opacity}"/>`;
    } else if (shape.type === "polygon") {
      const points = generatePolygonPoints(
        shape.cx,
        shape.cy,
        shape.r,
        shape.sides
      );
      svg += `<polygon points="${points}" fill="${shape.color}" opacity="${shape.opacity}"/>`;
    } else if (shape.type === "path" && shape.points) {
      const pathData = `M ${shape.points.map((p) => `${p[0]},${p[1]}`).join(" L")} Z`;
      svg += `<path d="${pathData}" fill="${shape.color}" opacity="${shape.opacity}"/>`;
    } else if (shape.type === "spiral") {
      const pathData = generateSpiralPath(
        shape.cx,
        shape.cy,
        shape.r,
        shape.turns
      );
      svg += `<path d="${pathData}" fill="none" stroke="${shape.color}" stroke-width="2" opacity="${shape.opacity}"/>`;
    }
  });

  svg += `</svg>`;
  return svg;
}

function generatePolygonPoints(cx, cy, r, sides) {
  const points = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  return points.map((p) => `${p[0]},${p[1]}`).join(" ");
}

function generateSpiralPath(cx, cy, r, turns) {
  let path = "";
  for (let i = 0; i <= turns * 100; i++) {
    const t = i / 100;
    const angle = t * Math.PI * 2;
    const radius = (t / turns) * r;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    path += (i === 0 ? "M" : "L") + `${x},${y}`;
  }
  return path;
}

function generateAudio(genes, seed) {
  const rng = new SimpleRNG(seed);
  const { tempo, scale, density, complexity, bars, key } = genes;

  const tempoVal = Math.round(tempo.value);
  const barCount = Math.round(bars.value);
  const densityVal = density.value;
  const complexityVal = Math.round(complexity.value);

  const scaleNotes = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 2, 4, 7, 9],
    blues: [0, 3, 5, 6, 7, 10],
  };

  const notes = scaleNotes[scale.value] || scaleNotes.major;
  const keyOffset = ["C", "G", "D", "A", "E", "B", "F", "Bb"].indexOf(
    key.value
  );

  const events = [];
  for (let bar = 0; bar < barCount; bar++) {
    for (let beat = 0; beat < 4; beat++) {
      if (rng.next() < densityVal) {
        const noteOffset = notes[rng.nextInt(notes.length)];
        const octave = 3 + rng.nextInt(2);
        const pitch = 12 + keyOffset * 7 + noteOffset + octave * 12;
        const velocity = 60 + rng.nextInt(40);
        const duration = [0.25, 0.5, 1][rng.nextInt(3)];
        events.push({
          time: bar * 4 + beat,
          pitch,
          velocity,
          duration,
        });
      }
    }
  }

  return { tempo: tempoVal, events, bars: barCount };
}

function generateAnimation(genes, seed) {
  const rng = new SimpleRNG(seed);
  const { type, frameCount } = genes;

  const frames = [];
  const count = Math.round(frameCount.value);
  for (let i = 0; i < count; i++) {
    const progress = i / count;
    frames.push({
      rotation: type.value === "rotate" ? progress * 360 : 0,
      scale:
        type.value === "morph"
          ? 1 + Math.sin(progress * Math.PI) * 0.3
          : type.value === "bounce"
            ? 1 + (Math.sin(progress * Math.PI * 2) * 0.2)
            : 1,
      offsetY: type.value === "bounce" ? Math.abs(Math.sin(progress * Math.PI)) * 50 : 0,
    });
  }
  return frames;
}

function generateProcedural(genes, seed) {
  const rng = new SimpleRNG(seed);
  const { width, height, octaves: octavesGene, persistence, threshold } = genes;

  const w = Math.round(width.value);
  const h = Math.round(height.value);
  const octaves = Math.round(octavesGene.value);

  const grid = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      let value = 0;
      let amplitude = 1;
      let frequency = 1;
      for (let o = 0; o < octaves; o++) {
        const nx = x * frequency * 0.1;
        const ny = y * frequency * 0.1;
        value += perlin(nx, ny, seed + o) * amplitude;
        amplitude *= persistence.value;
        frequency *= 2;
      }
      row.push(Math.max(0, Math.min(1, value * 0.5 + 0.5)));
    }
    grid.push(row);
  }
  return grid;
}

function perlin(x, y, seed) {
  const rng = new SimpleRNG(seed + Math.floor(x) + Math.floor(y) * 73);
  return rng.nextGaussian() * 0.3;
}

function generateGame(genes, seed) {
  const rng = new SimpleRNG(seed);
  const { width, height, entityCount, difficulty } = genes;

  const w = Math.round(width.value);
  const h = Math.round(height.value);
  const count = Math.round(entityCount.value);

  const grid = Array(h)
    .fill(null)
    .map(() => Array(w).fill(0));

  for (let i = 0; i < count; i++) {
    const x = rng.nextInt(w);
    const y = rng.nextInt(h);
    grid[y][x] = 1 + rng.nextInt(3);
  }

  return grid;
}

function generateGeometry3D(genes, seed) {
  const rng = new SimpleRNG(seed);
  const { shape, subdivisions, deformation, twist } = genes;
  return {
    shape: shape.value,
    subdivisions: Math.round(subdivisions.value),
    deformation: deformation.value,
    twist: twist.value,
  };
}

function generateUI(genes, seed) {
  const rng = new SimpleRNG(seed);
  const { type, columns, componentCount } = genes;
  return {
    type: type.value,
    columns: Math.round(columns.value),
    components: Math.round(componentCount.value),
  };
}

// ============================================================================
// RENDERERS
// ============================================================================

function PianoRollRenderer({ audioData }) {
  if (!audioData?.events) return null;
  const width = 600;
  const height = 200;
  const maxTime = audioData.bars * 4;
  const minPitch = 12;
  const maxPitch = 84;

  return (
    <svg width={width} height={height} className="bg-gray-900 rounded">
      <defs>
        <linearGradient id="pianoGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#00ff88" />
          <stop offset="100%" stopColor="#7b61ff" />
        </linearGradient>
      </defs>
      {audioData.events.map((event, idx) => (
        <rect
          key={idx}
          x={(event.time / maxTime) * width}
          y={
            height -
            ((event.pitch - minPitch) / (maxPitch - minPitch)) * height
          }
          width={Math.max(2, (event.duration / maxTime) * width)}
          height={8}
          fill="url(#pianoGrad)"
          opacity={event.velocity / 100}
        />
      ))}
    </svg>
  );
}

function MapRenderer({ grid }) {
  if (!grid) return null;
  const cellSize = Math.max(4, Math.min(15, 300 / grid[0]?.length || 10));
  const colors = {
    0: "#1a3a52",
    0.3: "#2d5016",
    0.6: "#8b6f47",
    1: "#ffffff",
  };

  const getColor = (val) => {
    if (val < 0.3) return colors[0];
    if (val < 0.6) return colors[0.3];
    if (val < 0.9) return colors[0.6];
    return colors[1];
  };

  return (
    <svg
      width={Math.min(400, (grid[0]?.length || 10) * cellSize)}
      height={Math.min(400, grid.length * cellSize)}
      className="bg-gray-900 rounded"
    >
      {grid.map((row, y) =>
        row.map((val, x) => (
          <rect
            key={`${x}-${y}`}
            x={x * cellSize}
            y={y * cellSize}
            width={cellSize}
            height={cellSize}
            fill={getColor(val)}
          />
        ))
      )}
    </svg>
  );
}

function AnimationRenderer({ frames }) {
  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(
      () => setFrameIdx((i) => (i + 1) % frames.length),
      100
    );
    return () => clearInterval(interval);
  }, [frames.length]);

  const frame = frames[frameIdx];
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="w-32 h-32 bg-gradient-to-r from-green-400 to-purple-500 rounded-lg"
        style={{
          transform: `rotate(${frame.rotation}deg) scale(${frame.scale}) translateY(${frame.offsetY}px)`,
          transition: "transform 0.1s linear",
        }}
      />
      <div className="text-xs text-gray-400">
        Frame {frameIdx + 1} / {frames.length}
      </div>
    </div>
  );
}

function Geometry3DRenderer({ geo }) {
  if (!geo) return null;
  const style = {
    perspective: "1000px",
    transform: "rotateX(20deg) rotateY(30deg)",
  };
  return (
    <div style={style} className="w-full h-48 flex items-center justify-center">
      <div
        className="w-24 h-24 border-2 border-emerald-400"
        style={{
          transform: `rotateX(${geo.twist * 45}deg) rotateZ(${geo.deformation * 45}deg)`,
          background: "linear-gradient(135deg, #00ff8866, #7b61ff66)",
        }}
      />
    </div>
  );
}

function UIRenderer({ ui }) {
  if (!ui) return null;
  return (
    <div className="grid gap-2 p-4" style={{ gridTemplateColumns: `repeat(${ui.columns}, 1fr)` }}>
      {Array.from({ length: ui.components }).map((_, i) => (
        <div
          key={i}
          className="bg-gradient-to-br from-emerald-500/20 to-purple-500/20 border border-emerald-400/30 rounded p-2 h-12"
        />
      ))}
    </div>
  );
}

// ============================================================================
// EVOLUTION ENGINE
// ============================================================================

class EvolutionEngine {
  constructor(template, populationSize = 10) {
    this.template = template;
    this.populationSize = populationSize;
    this.population = [];
    this.fitness = [];
    this.initPopulation();
  }

  initPopulation() {
    this.population = [];
    for (let i = 0; i < this.populationSize; i++) {
      this.population.push(this.mutateGenes(this.template, 1));
    }
  }

  mutateGenes(genes, rate) {
    const rng = new SimpleRNG(Math.random() * 1000000);
    return mutateGenes(genes, rate, rng);
  }

  evolve(generations, fitnessFunc) {
    const history = [];
    for (let gen = 0; gen < generations; gen++) {
      this.fitness = this.population.map((genes, idx) =>
        fitnessFunc(genes, idx)
      );
      const best = this.population.reduce((best, genes, idx) => {
        if (!best || this.fitness[idx] > this.fitness[this.population.indexOf(best)]) {
          return genes;
        }
        return best;
      });
      history.push({ generation: gen, bestFitness: Math.max(...this.fitness), best });

      const sorted = this.population
        .map((genes, idx) => ({ genes, fitness: this.fitness[idx] }))
        .sort((a, b) => b.fitness - a.fitness);

      const newPopulation = [];
      for (let i = 0; i < this.populationSize; i++) {
        const parent1 = sorted[i % Math.ceil(this.populationSize / 3)].genes;
        const parent2 = sorted[(i + 1) % Math.ceil(this.populationSize / 3)].genes;
        const rng = new SimpleRNG(gen * 1000 + i);
        const child = breedGenes(parent1, parent2, 0.5, rng);
        newPopulation.push(this.mutateGenes(child, 0.2));
      }
      this.population = newPopulation;
    }
    return history;
  }

  getPopulation() {
    return this.population;
  }

  getBest() {
    const best = this.fitness.indexOf(Math.max(...this.fitness));
    return this.population[best];
  }
}

// ============================================================================
// SEED LIBRARY
// ============================================================================

class SeedLibrary {
  constructor() {
    this.seeds = {};
  }

  store(seed) {
    const hash = hashGenes(seed.genes);
    this.seeds[hash] = {
      hash,
      genes: seed.genes,
      domain: seed.domain,
      timestamp: Date.now(),
      name: seed.name || `Seed ${hash.substring(0, 4)}`,
    };
    return hash;
  }

  list() {
    return Object.values(this.seeds).sort((a, b) => b.timestamp - a.timestamp);
  }

  get(hash) {
    return this.seeds[hash];
  }

  remove(hash) {
    delete this.seeds[hash];
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CreationCanvas() {
  const [domain, setDomain] = useState("visual2d");
  const [genes, setGenes] = useState(JSON.parse(JSON.stringify(TEMPLATES.visual2d)));
  const [generatedOutput, setGeneratedOutput] = useState(null);
  const [seedHash, setSeedHash] = useState("");
  const [library] = useState(new SeedLibrary());
  const [libraryList, setLibraryList] = useState([]);
  const [selectedTab, setSelectedTab] = useState("preview");
  const [populationSize, setPopulationSize] = useState(10);
  const [generations, setGenerations] = useState(20);
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolutionProgress, setEvolutionProgress] = useState(0);
  const [population, setPopulation] = useState([]);
  const [breedSlot1, setBreedSlot1] = useState(null);
  const [breedSlot2, setBreedSlot2] = useState(null);
  const [breedDominance, setBreedDominance] = useState(0.5);
  const [generationCount, setGenerationCount] = useState(0);
  const domainIcons = {
    visual2d: Layers,
    audio: Music,
    animation: Sparkles,
    procedural: Mountain,
    game: Gamepad2,
    geometry3d: Box,
    ui: Layout,
  };

  // Generate output
  const generate = useCallback(() => {
    const seed = Math.random() * 1000000;
    let output;

    switch (domain) {
      case "visual2d":
        output = generateVisual2D(genes, seed);
        break;
      case "audio":
        output = generateAudio(genes, seed);
        break;
      case "animation":
        output = generateAnimation(genes, seed);
        break;
      case "procedural":
        output = generateProcedural(genes, seed);
        break;
      case "game":
        output = generateGame(genes, seed);
        break;
      case "geometry3d":
        output = generateGeometry3D(genes, seed);
        break;
      case "ui":
        output = generateUI(genes, seed);
        break;
      default:
        output = null;
    }

    setGeneratedOutput(output);
    const hash = hashGenes(genes);
    setSeedHash(hash);
    setGenerationCount((c) => c + 1);
  }, [domain, genes]);

  // Change domain
  const changeDomain = useCallback((newDomain) => {
    setDomain(newDomain);
    setGenes(JSON.parse(JSON.stringify(TEMPLATES[newDomain])));
    setSelectedTab("preview");
  }, []);

  // Update gene
  const updateGene = useCallback((key, value) => {
    setGenes((g) => ({
      ...g,
      [key]: { ...g[key], value },
    }));
  }, []);

  // Mutate
  const mutate = useCallback(() => {
    const rng = new SimpleRNG(Math.random() * 1000000);
    setGenes((g) => mutateGenes(g, 0.4, rng));
  }, []);

  // Randomize
  const randomize = useCallback(() => {
    const rng = new SimpleRNG(Math.random() * 1000000);
    setGenes((g) => mutateGenes(g, 1, rng));
  }, []);

  // Save to library
  const saveSeed = useCallback(() => {
    library.store({ genes, domain, name: `${domain}-${seedHash}` });
    setLibraryList(library.list());
  }, [genes, domain, seedHash, library]);

  // Load from library
  const loadSeed = useCallback((seed) => {
    setGenes(JSON.parse(JSON.stringify(seed.genes)));
    setDomain(seed.domain);
    setGenerationCount((c) => c + 1);
  }, []);

  // Delete from library
  const deleteSeed = useCallback((hash) => {
    library.remove(hash);
    setLibraryList(library.list());
  }, [library]);

  // Evolve
  const evolvePopulation = useCallback(async () => {
    setIsEvolving(true);
    setEvolutionProgress(0);

    const engine = new EvolutionEngine(genes, populationSize);
    const fitnessFunc = (g) => Math.random();

    for (let gen = 0; gen < generations; gen++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      setEvolutionProgress(((gen + 1) / generations) * 100);

      engine.fitness = engine.population.map(() => Math.random());
      const sorted = engine.population
        .map((genes, idx) => ({ genes, fitness: engine.fitness[idx] }))
        .sort((a, b) => b.fitness - a.fitness);

      const newPopulation = [];
      for (let i = 0; i < populationSize; i++) {
        const parent1 = sorted[i % Math.ceil(populationSize / 3)].genes;
        const parent2 = sorted[(i + 1) % Math.ceil(populationSize / 3)].genes;
        const rng = new SimpleRNG(gen * 1000 + i);
        const child = breedGenes(parent1, parent2, 0.5, rng);
        newPopulation.push(mutateGenes(child, 0.2, rng));
      }
      engine.population = newPopulation;
    }

    setPopulation(engine.population.slice(0, 6));
    setGenes(engine.getBest());
    setIsEvolving(false);
  }, [genes, populationSize, generations]);

  // Breed
  const breed = useCallback(() => {
    if (!breedSlot1 || !breedSlot2) return;
    const rng = new SimpleRNG(Math.random() * 1000000);
    const child = breedGenes(breedSlot1.genes, breedSlot2.genes, breedDominance, rng);
    setGenes(child);
  }, [breedSlot1, breedSlot2, breedDominance]);

  // Auto-generate on mount
  useEffect(() => {
    generate();
  }, [generate]);

  const DomainIcon = domainIcons[domain];

  return (
    <div className="flex h-screen bg-[#0a0a0f] text-gray-100 font-mono overflow-hidden">
      {/* LEFT PANEL */}
      <div className="w-[30%] bg-[#0a0a0f] border-r border-emerald-500/20 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-emerald-500/20">
          <div className="flex items-center gap-2 mb-3">
            <DomainIcon size={16} className="text-emerald-400" />
            <label className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Domain
            </label>
          </div>
          <select
            value={domain}
            onChange={(e) => changeDomain(e.target.value)}
            className="w-full bg-[#13131a] border border-emerald-500/30 rounded px-2 py-1 text-sm text-emerald-400 focus:border-emerald-400 focus:outline-none"
          >
            {Object.keys(TEMPLATES).map((d) => (
              <option key={d} value={d}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* GENE CONTROLS */}
        <div className="p-4 border-b border-emerald-500/20 flex-1 overflow-y-auto">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
            Genes
          </div>
          <div className="space-y-3">
            {Object.entries(genes).map(([key, gene]) => (
              <div key={key} className="bg-[#13131a]/50 border border-emerald-500/20 rounded p-2">
                <div className="text-xs text-gray-400 mb-1 capitalize">{key}</div>
                {gene.type === "scalar" ? (
                  <div>
                    <input
                      type="range"
                      min={gene.min}
                      max={gene.max}
                      step={(gene.max - gene.min) / 100}
                      value={gene.value}
                      onChange={(e) => updateGene(key, parseFloat(e.target.value))}
                      className="w-full h-1 bg-emerald-900 rounded appearance-none cursor-pointer"
                    />
                    <div className="text-xs text-emerald-400 mt-1">
                      {gene.value.toFixed(2)}
                    </div>
                  </div>
                ) : (
                  <select
                    value={gene.value}
                    onChange={(e) => updateGene(key, e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-emerald-500/20 rounded px-1 py-1 text-xs text-emerald-400"
                  >
                    {gene.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="p-4 border-t border-emerald-500/20 space-y-2">
          <button
            onClick={generate}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2 rounded text-sm transition-colors"
          >
            <Play size={14} className="inline mr-1" />
            Generate
          </button>
          <button
            onClick={mutate}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded text-sm transition-colors"
          >
            <Shuffle size={14} className="inline mr-1" />
            Mutate
          </button>
          <button
            onClick={randomize}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 rounded text-sm transition-colors"
          >
            <Sparkles size={14} className="inline mr-1" />
            Randomize
          </button>
          <button
            onClick={saveSeed}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 rounded text-sm transition-colors"
          >
            <Save size={14} className="inline mr-1" />
            Save Seed
          </button>
        </div>
      </div>

      {/* CENTER PANEL */}
      <div className="w-[50%] bg-[#0a0a0f] border-r border-emerald-500/20 flex flex-col">
        {/* TABS */}
        <div className="flex border-b border-emerald-500/20 bg-[#13131a]/50">
          {["preview", "output", "json"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`flex-1 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                selectedTab === tab
                  ? "text-emerald-400 border-b-2 border-emerald-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab === "preview" ? "Preview" : tab === "output" ? "Raw" : "JSON"}
            </button>
          ))}
        </div>

        {/* PREVIEW AREA */}
        <div className="flex-1 p-6 overflow-auto flex flex-col items-center justify-center">
          {selectedTab === "preview" && (
            <>
              {domain === "visual2d" && generatedOutput && (
                <div
                  dangerouslySetInnerHTML={{ __html: generatedOutput }}
                  className="max-w-full max-h-full"
                />
              )}
              {domain === "audio" && (
                <PianoRollRenderer audioData={generatedOutput} />
              )}
              {domain === "animation" && (
                <AnimationRenderer frames={generatedOutput || []} />
              )}
              {domain === "procedural" && (
                <MapRenderer grid={generatedOutput} />
              )}
              {domain === "game" && <MapRenderer grid={generatedOutput} />}
              {domain === "geometry3d" && (
                <Geometry3DRenderer geo={generatedOutput} />
              )}
              {domain === "ui" && <UIRenderer ui={generatedOutput} />}
            </>
          )}

          {selectedTab === "output" && (
            <pre className="text-xs text-gray-400 bg-[#13131a] p-4 rounded w-full h-full overflow-auto">
              {JSON.stringify(generatedOutput, null, 2).substring(0, 1000)}
            </pre>
          )}

          {selectedTab === "json" && (
            <pre className="text-xs text-gray-400 bg-[#13131a] p-4 rounded w-full h-full overflow-auto">
              {JSON.stringify(genes, null, 2)}
            </pre>
          )}
        </div>

        {/* STATUS BAR */}
        <div className="bg-[#13131a] border-t border-emerald-500/20 px-4 py-2 text-xs text-gray-500 flex justify-between">
          <div>
            <span className="text-emerald-400">Hash:</span> {seedHash}
          </div>
          <div>
            <span className="text-emerald-400">Gen:</span> {generationCount}
          </div>
          <div>
            <span className="text-emerald-400">Domain:</span> {domain}
          </div>
          <div>
            <span className="text-emerald-400">Genes:</span> {Object.keys(genes).length}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-[20%] bg-[#0a0a0f] border-l border-emerald-500/20 flex flex-col overflow-y-auto">
        {/* EVOLUTION */}
        <div className="p-4 border-b border-emerald-500/20">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
            Evolution
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <label className="text-xs text-gray-500">Population</label>
              <input
                type="number"
                min="2"
                max="50"
                value={populationSize}
                onChange={(e) => setPopulationSize(parseInt(e.target.value))}
                className="w-full bg-[#13131a] border border-emerald-500/20 rounded px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Generations</label>
              <input
                type="number"
                min="1"
                max="100"
                value={generations}
                onChange={(e) => setGenerations(parseInt(e.target.value))}
                className="w-full bg-[#13131a] border border-emerald-500/20 rounded px-2 py-1 text-xs"
              />
            </div>
            <button
              onClick={evolvePopulation}
              disabled={isEvolving}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white font-bold py-2 rounded text-xs transition-colors"
            >
              {isEvolving ? "Evolving..." : "Evolve"}
            </button>
            {isEvolving && (
              <div className="w-full bg-gray-800 rounded h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{ width: `${evolutionProgress}%` }}
                />
              </div>
            )}
          </div>

          {/* POPULATION GALLERY */}
          {population.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {population.map((genes, idx) => (
                <button
                  key={idx}
                  onClick={() => setGenes(JSON.parse(JSON.stringify(genes)))}
                  className="aspect-square bg-gradient-to-br from-emerald-500/30 to-purple-500/30 border border-emerald-400/30 rounded hover:border-emerald-400 transition-colors text-xs"
                >
                  #{idx + 1}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* BREEDING */}
        <div className="p-4 border-b border-emerald-500/20">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
            Breed
          </div>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <button
                className="bg-[#13131a] border border-dashed border-emerald-500/30 rounded p-2 text-xs hover:border-emerald-400 transition-colors"
                onClick={() =>
                  setBreedSlot1(
                    breedSlot1 ? null : { genes: JSON.parse(JSON.stringify(genes)) }
                  )
                }
              >
                {breedSlot1 ? "✓ Slot 1" : "Slot 1"}
              </button>
              <button
                className="bg-[#13131a] border border-dashed border-emerald-500/30 rounded p-2 text-xs hover:border-emerald-400 transition-colors"
                onClick={() =>
                  setBreedSlot2(
                    breedSlot2 ? null : { genes: JSON.parse(JSON.stringify(genes)) }
                  )
                }
              >
                {breedSlot2 ? "✓ Slot 2" : "Slot 2"}
              </button>
            </div>
            <div>
              <label className="text-xs text-gray-500">Dominance</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={breedDominance}
                onChange={(e) => setBreedDominance(parseFloat(e.target.value))}
                className="w-full h-1 bg-purple-900 rounded"
              />
              <div className="text-xs text-purple-400 mt-1">
                {(breedDominance * 100).toFixed(0)}%
              </div>
            </div>
            <button
              onClick={breed}
              disabled={!breedSlot1 || !breedSlot2}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white font-bold py-2 rounded text-xs transition-colors"
            >
              <GitBranch size={12} className="inline mr-1" />
              Breed
            </button>
          </div>
        </div>

        {/* SEED LIBRARY */}
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
            Library ({libraryList.length})
          </div>
          <div className="space-y-2">
            {libraryList.map((seed) => (
              <div
                key={seed.hash}
                className="bg-[#13131a] border border-emerald-500/20 rounded p-2 text-xs hover:border-emerald-400 transition-colors group"
              >
                <button
                  onClick={() => loadSeed(seed)}
                  className="w-full text-left font-mono"
                >
                  <div className="text-emerald-400">{seed.name}</div>
                  <div className="text-gray-500 text-xs">{seed.domain}</div>
                </button>
                <button
                  onClick={() => deleteSeed(seed.hash)}
                  className="opacity-0 group-hover:opacity-100 absolute right-2 top-2 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
