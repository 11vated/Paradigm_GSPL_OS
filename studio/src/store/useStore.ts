/**
 * useStore.ts — Zustand store for Paradigm Studio state
 */

import { create } from 'zustand';
import { createSeed, computeHash, cloneSeed, UniversalSeed, SeedDomain } from '@engine/kernel/seed';
import { scalar, GeneMap, Gene, ScalarGene } from '@engine/kernel/genes';
import { mutate, crossover } from '@engine/kernel/operators';
import { DeterministicRNG } from '@engine/kernel/rng';
import { registry } from '@engine/engines/engine';
import '@engine/engines/index';

export type ViewMode = 'single' | 'grid' | 'split';

export interface StudioState {
  // Current seed
  seed: UniversalSeed | null;
  domain: SeedDomain;
  seedName: string;

  // Evolution
  population: UniversalSeed[];
  generation: number;
  history: UniversalSeed[];

  // UI state
  viewMode: ViewMode;
  selectedPanel: 'editor' | 'viewport' | 'evolution';
  isGenerating: boolean;
  lastGenerateMs: number;

  // Artifacts from last generation
  artifacts: Map<string, unknown>;

  // Playback state
  audioPlaying: boolean;
  gamePlaying: boolean;
  gameScore: number;

  // Actions
  createNewSeed: (name: string, domain: SeedDomain) => void;
  updateGene: (key: string, value: number) => void;
  mutateSeed: (rate?: number, intensity?: number) => void;
  breedSeeds: (other: UniversalSeed) => void;
  evolveSeed: (generations: number, populationSize: number) => void;
  generateArtifacts: () => void;
  setDomain: (domain: SeedDomain) => void;
  setViewMode: (mode: ViewMode) => void;
  selectFromPopulation: (index: number) => void;
  randomizeSeed: () => void;
  setAudioPlaying: (playing: boolean) => void;
  setGamePlaying: (playing: boolean) => void;
  setGameScore: (score: number) => void;
}

function getDefaultGenes(domain: SeedDomain): GeneMap {
  const engine = registry.get(domain);
  if (engine) return engine.defaultGenes();

  // Fallback generic genes
  return {
    complexity: scalar(0.5, 0, 1),
    density: scalar(0.5, 0, 1),
    energy: scalar(0.5, 0, 1),
    style: scalar(0.5, 0, 1),
  };
}

export const useStore = create<StudioState>((set, get) => ({
  seed: null,
  domain: 'visual2d',
  seedName: 'Untitled',
  population: [],
  generation: 0,
  history: [],
  viewMode: 'single',
  selectedPanel: 'editor',
  isGenerating: false,
  lastGenerateMs: 0,
  artifacts: new Map(),
  audioPlaying: false,
  gamePlaying: false,
  gameScore: 0,

  createNewSeed: (name: string, domain: SeedDomain) => {
    const genes = getDefaultGenes(domain);
    const seed = createSeed(domain, name, genes);
    set({
      seed,
      domain,
      seedName: name,
      generation: 0,
      population: [seed],
      history: [seed],
      artifacts: new Map(),
    });
    // Auto-generate
    get().generateArtifacts();
  },

  updateGene: (key: string, value: number) => {
    const { seed } = get();
    if (!seed) return;

    const gene = seed.genes[key];
    if (!gene || gene.type !== 'scalar') return;

    const updated = cloneSeed(seed);
    const g = updated.genes[key] as ScalarGene;
    g.value = Math.max(g.min, Math.min(g.max, value));
    updated.$hash = computeHash(updated);

    set({ seed: updated });
    get().generateArtifacts();
  },

  mutateSeed: (rate = 0.3, intensity = 0.3) => {
    const { seed, generation, history } = get();
    if (!seed) return;

    const rng = new DeterministicRNG(`mutate_${seed.$hash}_${Date.now()}`);
    const mutated = mutate(seed, { rate, intensity }, rng);

    set({
      seed: mutated,
      generation: generation + 1,
      history: [...history, mutated],
    });
    get().generateArtifacts();
  },

  breedSeeds: (other: UniversalSeed) => {
    const { seed, generation, history } = get();
    if (!seed) return;

    const rng = new DeterministicRNG(`breed_${seed.$hash}_${other.$hash}`);
    const child = crossover(seed, other, { strategy: 'blend', dominance: 0.5 }, rng);

    set({
      seed: child,
      generation: generation + 1,
      history: [...history, child],
    });
    get().generateArtifacts();
  },

  evolveSeed: (generations: number, populationSize: number) => {
    const { seed, history } = get();
    if (!seed) return;

    set({ isGenerating: true });

    const rng = new DeterministicRNG(`evolve_${seed.$hash}_${Date.now()}`);
    let pop: UniversalSeed[] = [seed];

    // Fill initial population
    for (let i = 1; i < populationSize; i++) {
      pop.push(mutate(seed, { rate: 0.5, intensity: 0.4 }, rng));
    }

    // Evolve
    for (let g = 0; g < generations; g++) {
      const next: UniversalSeed[] = [];
      // Keep top half
      next.push(...pop.slice(0, Math.ceil(pop.length / 2)));
      // Fill rest with mutations of top seeds
      while (next.length < populationSize) {
        const parent = pop[rng.nextInt(0, Math.min(3, pop.length - 1))];
        next.push(mutate(parent, { rate: 0.3, intensity: 0.2 }, rng));
      }
      pop = next;
    }

    const best = pop[0];
    set({
      seed: best,
      population: pop.slice(0, 12),
      generation: get().generation + generations,
      history: [...history, best],
      isGenerating: false,
    });
    get().generateArtifacts();
  },

  generateArtifacts: () => {
    const { seed } = get();
    if (!seed) return;

    const engine = registry.get(seed.$domain);
    if (!engine) return;

    set({ isGenerating: true });
    const start = Date.now();
    const result = engine.generate(seed);
    const ms = Date.now() - start;

    if (result.success) {
      set({ artifacts: result.artifacts, isGenerating: false, lastGenerateMs: ms });
    } else {
      set({ isGenerating: false });
    }
  },

  setDomain: (domain: SeedDomain) => {
    set({ domain });
  },

  setViewMode: (mode: ViewMode) => {
    set({ viewMode: mode });
  },

  selectFromPopulation: (index: number) => {
    const { population, history } = get();
    const selected = population[index];
    if (!selected) return;

    set({
      seed: selected,
      history: [...history, selected],
    });
    get().generateArtifacts();
  },

  setAudioPlaying: (playing: boolean) => set({ audioPlaying: playing }),
  setGamePlaying: (playing: boolean) => set({ gamePlaying: playing }),
  setGameScore: (score: number) => set({ gameScore: score }),

  randomizeSeed: () => {
    const { seed } = get();
    if (!seed) return;

    const rng = new DeterministicRNG(`random_${Date.now()}`);
    const randomized = cloneSeed(seed);

    for (const [key, gene] of Object.entries(randomized.genes)) {
      if (gene.type === 'scalar') {
        const g = gene as ScalarGene;
        g.value = g.min + rng.next() * (g.max - g.min);
      }
    }
    randomized.$hash = computeHash(randomized);

    set({
      seed: randomized,
      generation: get().generation + 1,
      history: [...get().history, randomized],
    });
    get().generateArtifacts();
  },
}));
