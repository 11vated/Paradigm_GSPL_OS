/**
 * audio/engine.ts — Audio/Music Generation Engine
 * Generates structured musical data (MIDI-like, Tone.js-compatible) from seeds.
 * Pipeline: Scale → Harmony → Rhythm → Melody → Arrangement → Mix
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
import { DeterministicRNG } from '../../kernel/rng.js';

// ============================================================================
// AUDIO GENE SCHEMA
// ============================================================================

const AUDIO_GENES = {
  type: categorical('melody', [
    'melody',
    'rhythm',
    'ambient',
    'sfx',
    'chord-progression',
    'full-track',
  ]),
  tempo: scalar(120, 40, 200),
  key: categorical('C', [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ]),
  scale: categorical('major', [
    'major',
    'minor',
    'pentatonic',
    'blues',
    'dorian',
    'mixolydian',
    'chromatic',
  ]),
  octaveRange: scalar(2, 1, 4),
  baseOctave: scalar(4, 2, 6),
  density: scalar(0.5, 0, 1),
  complexity: scalar(5, 1, 10),
  swing: scalar(0.1, 0, 1),
  dynamics: scalar(0.5, 0, 1),
  bars: scalar(16, 4, 64),
  timeSignatureTop: scalar(4, 2, 7),
  timeSignatureBottom: categorical('4', ['4', '8']),
  synthType: categorical('sine', [
    'sine',
    'square',
    'sawtooth',
    'triangle',
    'fm',
    'am',
    'noise',
  ]),
  attack: scalar(0.01, 0.001, 2),
  decay: scalar(0.1, 0.01, 2),
  sustain: scalar(0.7, 0, 1),
  release: scalar(0.5, 0.01, 5),
  reverbMix: scalar(0.3, 0, 1),
  delayMix: scalar(0.2, 0, 0.8),
};

// ============================================================================
// AUDIO TYPES
// ============================================================================

interface MusicNote {
  time: string;
  note: string;
  duration: string;
  velocity: number;
}

interface Envelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

interface Oscillator {
  type: string;
}

interface Instrument {
  type: string;
  oscillator?: Oscillator;
  envelope?: Envelope;
}

interface Track {
  name: string;
  instrument: Instrument;
  notes: MusicNote[];
}

interface Effect {
  decay?: number;
  wet?: number;
  feedback?: number;
  time?: string;
}

interface EffectsConfig {
  reverb?: Effect;
  delay?: Effect;
}

interface MusicGenerationData {
  metadata: {
    tempo: number;
    key: string;
    scale: string;
    bars: number;
    timeSignature: string;
  };
  tracks: Track[];
  effects: EffectsConfig;
}

// ============================================================================
// MUSIC THEORY UTILITIES
// ============================================================================

const NOTE_SEMITONES: Record<string, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
};

const SEMITONE_NOTES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

// Scale intervals (in semitones from root)
const SCALE_INTERVALS: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

function getKeyRoot(key: string): number {
  return NOTE_SEMITONES[key] ?? 0;
}

function buildScale(key: string, scaleType: string): number[] {
  const intervals = SCALE_INTERVALS[scaleType] ?? SCALE_INTERVALS.major;
  const root = getKeyRoot(key);
  return intervals.map(interval => (root + interval) % 12);
}

function noteName(semitone: number, octave: number): string {
  const note = SEMITONE_NOTES[semitone % 12];
  return `${note}${octave}`;
}

// Chord progressions (Roman numeral analysis)
// I = 0, ii = 2, iii = 4, IV = 5, V = 7, vi = 9, vii° = 11
interface ChordDefinition {
  name: string;
  intervals: number[]; // scale degrees (0-indexed)
}

const COMMON_CHORDS: Record<string, ChordDefinition> = {
  I: { name: 'I', intervals: [0, 2, 4] }, // root, 3rd, 5th
  ii: { name: 'ii', intervals: [1, 3, 5] },
  iii: { name: 'iii', intervals: [2, 4, 6] },
  IV: { name: 'IV', intervals: [3, 5, 0] }, // F-A-C in C major (3rd, 5th, octave)
  V: { name: 'V', intervals: [4, 6, 1] }, // G-B-D in C major
  vi: { name: 'vi', intervals: [5, 0, 2] }, // A-C-E in C major
  vii: { name: 'vii°', intervals: [6, 1, 3] },
};

function generateChordProgression(
  complexity: number,
  bars: number,
  rng: DeterministicRNG
): string[] {
  const progressions: string[][] = [
    // Simple
    ['I', 'V', 'vi', 'IV'],
    ['I', 'IV', 'V', 'I'],
    ['I', 'vi', 'IV', 'V'],

    // Medium
    ['I', 'vi', 'IV', 'V', 'I', 'IV', 'I', 'V'],
    ['I', 'ii', 'V', 'I'],
    ['vi', 'IV', 'I', 'V'],

    // Jazz-influenced
    ['I', 'vi', 'ii', 'V'],
    ['I', 'iii', 'vi', 'ii', 'V', 'I'],
    ['ii', 'V', 'I', 'IV'],
  ];

  const progressionIdx = Math.min(
    Math.floor((complexity - 1) / 2),
    progressions.length - 1
  );
  const baseProgression = progressions[progressionIdx];

  const result: string[] = [];
  const repeats = Math.ceil(bars / baseProgression.length);
  for (let i = 0; i < repeats; i++) {
    result.push(...baseProgression);
  }

  return result.slice(0, bars);
}

// ============================================================================
// AUDIO ENGINE
// ============================================================================

export class AudioEngine extends DomainEngine {
  readonly domain: SeedDomain = 'audio';
  readonly name = 'Audio/Music Generator';
  readonly version = '1.0.0';

  defaultGenes(): GeneMap {
    return AUDIO_GENES;
  }

  evaluate(seed: UniversalSeed): FitnessVector {
    // Prefer moderate complexity and reasonable tempo
    const complexity = (seed.genes.complexity as any).value;
    const tempo = (seed.genes.tempo as any).value;
    const bars = (seed.genes.bars as any).value;

    const complexityScore = 1 - Math.abs(complexity - 5) / 10;
    const tempoScore = 1 - Math.abs(tempo - 120) / 100;
    const barsScore = Math.min(bars / 32, 1);

    return {
      scores: {
        complexity: complexityScore,
        tempo: tempoScore,
        bars: barsScore,
      },
      aggregate: (complexityScore + tempoScore + barsScore) / 3,
      evaluatedAt: Date.now(),
    };
  }

  stages(): DevelopmentalStage[] {
    return [
      {
        name: 'Scale',
        description: 'Build scale from key + mode',
        execute: this.stageScale.bind(this),
      },
      {
        name: 'Harmony',
        description: 'Generate chord progression using music theory',
        execute: this.stageHarmony.bind(this),
      },
      {
        name: 'Rhythm',
        description: 'Generate rhythmic patterns (euclidean/probabilistic)',
        execute: this.stageRhythm.bind(this),
      },
      {
        name: 'Melody',
        description: 'Generate melodic line using constrained random walk',
        execute: this.stageMelody.bind(this),
      },
      {
        name: 'Arrangement',
        description: 'Structure into sections with harmony and bass',
        execute: this.stageArrangement.bind(this),
      },
      {
        name: 'Mix',
        description: 'Apply synthesis params, effects, dynamics',
        execute: this.stageMix.bind(this),
      },
    ];
  }

  // ========================================================================
  // STAGE: SCALE
  // ========================================================================

  private stageScale(context: DevelopmentalContext): DevelopmentalContext {
    const key = (context.seed.genes.key as any).value;
    const scaleType = (context.seed.genes.scale as any).value;
    const octaveRange = (context.seed.genes.octaveRange as any).value;
    const baseOctave = (context.seed.genes.baseOctave as any).value;

    const scaleSemitones = buildScale(key, scaleType);
    const scaleNotes: string[] = [];

    for (let octave = baseOctave; octave < baseOctave + octaveRange; octave++) {
      for (const semitone of scaleSemitones) {
        scaleNotes.push(noteName(semitone, octave));
      }
    }

    context.artifacts.set('scale', {
      key,
      scaleType,
      semitones: scaleSemitones,
      notes: scaleNotes,
      baseOctave,
      octaveRange,
    });

    context.parameters.scaleNotes = scaleNotes;
    context.parameters.scaleSemitones = scaleSemitones;

    return context;
  }

  // ========================================================================
  // STAGE: HARMONY
  // ========================================================================

  private stageHarmony(context: DevelopmentalContext): DevelopmentalContext {
    const complexity = Math.round((context.seed.genes.complexity as any).value);
    const bars = (context.seed.genes.bars as any).value;
    const key = (context.seed.genes.key as any).value;
    const baseOctave = (context.seed.genes.baseOctave as any).value;
    const scaleSemitones = context.parameters.scaleSemitones as number[];

    // Generate chord progression
    const chordProgression = generateChordProgression(complexity, bars, context.rng);

    // Build chord notes
    const chords = [];
    for (const chordName of chordProgression) {
      const chordDef = COMMON_CHORDS[chordName];
      if (!chordDef) continue;

      const chordNotes = chordDef.intervals.map(scaleDegree => {
        const semitone = scaleSemitones[scaleDegree % scaleSemitones.length];
        return noteName(semitone, baseOctave);
      });

      chords.push({
        name: chordName,
        notes: chordNotes,
      });
    }

    context.artifacts.set('harmony', {
      progression: chordProgression,
      chords,
      key,
    });

    context.parameters.chords = chords;
    context.parameters.chordProgression = chordProgression;

    return context;
  }

  // ========================================================================
  // STAGE: RHYTHM
  // ========================================================================

  private stageRhythm(context: DevelopmentalContext): DevelopmentalContext {
    const density = (context.seed.genes.density as any).value;
    const timeSignatureTop = Math.round(
      (context.seed.genes.timeSignatureTop as any).value
    );
    const timeSignatureBottom = (context.seed.genes.timeSignatureBottom as any)
      .value;
    const swing = (context.seed.genes.swing as any).value;
    const bars = (context.seed.genes.bars as any).value;

    // Generate euclidean rhythm
    const totalSteps = timeSignatureTop * 4; // subdivisions per bar
    const beatCount = Math.ceil(density * totalSteps);
    const rhythm = this.euclideanRhythm(beatCount, totalSteps);

    // Generate note durations
    const beatDurations: string[] = [];
    const stepDuration = timeSignatureBottom === '4' ? '16n' : '32n';
    for (let i = 0; i < totalSteps; i++) {
      if (rhythm[i % rhythm.length]) {
        beatDurations.push(stepDuration);
      }
    }

    context.artifacts.set('rhythm', {
      pattern: rhythm,
      density,
      timeSignature: `${timeSignatureTop}/${timeSignatureBottom}`,
      swing,
      beats: beatDurations,
      stepsPerBar: totalSteps,
      totalBars: bars,
    });

    context.parameters.rhythm = rhythm;
    context.parameters.beatDurations = beatDurations;
    context.parameters.stepsPerBar = totalSteps;

    return context;
  }

  private euclideanRhythm(hits: number, steps: number): boolean[] {
    // Simplified euclidean rhythm distribution
    const result: boolean[] = new Array(steps).fill(false);
    if (hits === 0) return result;
    if (hits >= steps) return result.map(() => true);

    const spacing = steps / hits;
    for (let i = 0; i < hits; i++) {
      const idx = Math.round(i * spacing);
      if (idx < steps) {
        result[idx] = true;
      }
    }

    return result;
  }

  // ========================================================================
  // STAGE: MELODY
  // ========================================================================

  private stageMelody(context: DevelopmentalContext): DevelopmentalContext {
    const scaleNotes = context.parameters.scaleNotes as string[];
    const rhythm = context.parameters.rhythm as boolean[];
    const chords = context.parameters.chords as any[];
    const bars = (context.seed.genes.bars as any).value;
    const stepsPerBar = context.parameters.stepsPerBar as number;
    const dynamics = (context.seed.genes.dynamics as any).value;

    const melody: MusicNote[] = [];
    let currentNoteIdx = Math.floor(scaleNotes.length / 2);

    let stepCount = 0;
    let barCount = 0;
    let chordIdx = 0;

    for (let bar = 0; bar < bars; bar++) {
      for (let step = 0; step < stepsPerBar; step++) {
        if (rhythm[step % rhythm.length]) {
          // Markov chain constrained to scale
          const moveProbs = [0.1, 0.3, 0.3, 0.2, 0.1]; // stay, -1, +1, -2, +2
          const r = context.rng.next();

          let move = 0;
          if (r < moveProbs[0]) move = 0;
          else if (r < moveProbs[0] + moveProbs[1]) move = -1;
          else if (r < moveProbs[0] + moveProbs[1] + moveProbs[2]) move = 1;
          else if (r < moveProbs[0] + moveProbs[1] + moveProbs[2] + moveProbs[3])
            move = -2;
          else move = 2;

          currentNoteIdx = Math.max(
            0,
            Math.min(scaleNotes.length - 1, currentNoteIdx + move)
          );

          const velocity = 0.5 + dynamics * 0.5 * context.rng.next();
          const timeStr = `${bar}:${Math.floor(step / 4)}:${(step % 4) * 4}`;

          melody.push({
            time: timeStr,
            note: scaleNotes[currentNoteIdx],
            duration: '8n',
            velocity,
          });
        }

        if ((step + 1) % stepsPerBar === 0) {
          chordIdx = (chordIdx + 1) % chords.length;
        }

        stepCount++;
      }
    }

    context.artifacts.set('melody', {
      notes: melody,
      count: melody.length,
    });

    context.parameters.melodyNotes = melody;

    return context;
  }

  // ========================================================================
  // STAGE: ARRANGEMENT
  // ========================================================================

  private stageArrangement(context: DevelopmentalContext): DevelopmentalContext {
    const melodyNotes = context.parameters.melodyNotes as MusicNote[];
    const chords = context.parameters.chords as any[];
    const baseOctave = (context.seed.genes.baseOctave as any).value;
    const stepsPerBar = context.parameters.stepsPerBar as number;
    const bars = (context.seed.genes.bars as any).value;
    const swing = (context.seed.genes.swing as any).value;

    // Harmony track
    const harmonyNotes: MusicNote[] = [];
    let chordIdx = 0;

    for (let bar = 0; bar < bars; bar++) {
      const chord = chords[chordIdx % chords.length];
      const chordNote = chord.notes[0]; // Root note for now
      harmonyNotes.push({
        time: `${bar}:0:0`,
        note: chordNote,
        duration: '2n', // half note per bar
        velocity: 0.7,
      });
      chordIdx++;
    }

    // Bass track (lowest note of chord)
    const bassNotes: MusicNote[] = [];
    chordIdx = 0;

    for (let bar = 0; bar < bars; bar++) {
      const chord = chords[chordIdx % chords.length];
      const bassNote = chord.notes[0];
      // Lower octave
      const parts = bassNote.split(/(\d+)$/);
      const octave = Math.max(2, parseInt(parts[1]) - 1);
      const note = parts[0] + octave;

      bassNotes.push({
        time: `${bar}:0:0`,
        note,
        duration: '2n',
        velocity: 0.8,
      });
      chordIdx++;
    }

    context.artifacts.set('arrangement', {
      melody: melodyNotes,
      harmony: harmonyNotes,
      bass: bassNotes,
      swing,
    });

    context.parameters.arrangedTracks = {
      melody: melodyNotes,
      harmony: harmonyNotes,
      bass: bassNotes,
    };

    return context;
  }

  // ========================================================================
  // STAGE: MIX
  // ========================================================================

  private stageMix(context: DevelopmentalContext): DevelopmentalContext {
    const tempo = Math.round((context.seed.genes.tempo as any).value);
    const key = (context.seed.genes.key as any).value;
    const scaleType = (context.seed.genes.scale as any).value;
    const bars = (context.seed.genes.bars as any).value;
    const timeSignatureTop = Math.round(
      (context.seed.genes.timeSignatureTop as any).value
    );
    const timeSignatureBottom = (context.seed.genes.timeSignatureBottom as any)
      .value;
    const synthType = (context.seed.genes.synthType as any).value;
    const attack = (context.seed.genes.attack as any).value;
    const decay = (context.seed.genes.decay as any).value;
    const sustain = (context.seed.genes.sustain as any).value;
    const release = (context.seed.genes.release as any).value;
    const reverbMix = (context.seed.genes.reverbMix as any).value;
    const delayMix = (context.seed.genes.delayMix as any).value;

    const arrangedTracks = context.parameters.arrangedTracks as Record<
      string,
      MusicNote[]
    >;

    const envelope: Envelope = {
      attack,
      decay,
      sustain,
      release,
    };

    const tracks: Track[] = [
      {
        name: 'melody',
        instrument: {
          type: 'synth',
          oscillator: { type: synthType },
          envelope,
        },
        notes: arrangedTracks.melody,
      },
      {
        name: 'harmony',
        instrument: {
          type: 'synth',
          oscillator: { type: synthType },
          envelope: { ...envelope, attack: attack * 1.5 },
        },
        notes: arrangedTracks.harmony,
      },
      {
        name: 'bass',
        instrument: {
          type: 'synth',
          oscillator: { type: synthType },
          envelope: { ...envelope, release: release * 1.5 },
        },
        notes: arrangedTracks.bass,
      },
    ];

    const effects: EffectsConfig = {
      reverb: {
        decay: 2 + reverbMix * 2,
        wet: reverbMix,
      },
      delay: {
        time: '8n',
        feedback: delayMix * 0.5,
      },
    };

    const musicData: MusicGenerationData = {
      metadata: {
        tempo,
        key,
        scale: scaleType,
        bars,
        timeSignature: `${timeSignatureTop}/${timeSignatureBottom}`,
      },
      tracks,
      effects,
    };

    context.artifacts.set('music', musicData);

    return context;
  }
}
