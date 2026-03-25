/**
 * audio-renderer.ts — Audio Runtime
 * Takes Audio engine output (music data with notes, chords, rhythm) and plays it
 * using the Web Audio API. No external dependencies — pure Web Audio synthesis.
 */

import { UniversalSeed } from '../kernel/seed.js';
import { registry } from '../engines/engine.js';

// ============================================================================
// TYPES — matches Audio engine output format
// ============================================================================

export interface MusicNote {
  time: string;
  note: string;
  duration: string;
  velocity: number;
}

export interface InstrumentSpec {
  type: string;
  oscillator?: { type: string };
  envelope?: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
}

export interface MusicTrack {
  name: string;
  instrument: InstrumentSpec;
  notes: MusicNote[];
}

export interface MusicData {
  metadata: {
    tempo: number;
    key: string;
    scale: string;
    bars: number;
    timeSignature: string;
  };
  tracks: MusicTrack[];
  effects: {
    reverb?: { decay?: number; wet?: number };
    delay?: { time?: string; wet?: number; feedback?: number };
  };
}

export interface AudioRendererOptions {
  onPlayStateChange?: (playing: boolean) => void;
  onProgress?: (currentTime: number, totalTime: number) => void;
  volume?: number;
}

// ============================================================================
// NOTE FREQUENCY TABLE
// ============================================================================

const NOTE_FREQUENCIES: Record<string, number> = {};
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// Also support flat notation
const FLAT_MAP: Record<string, string> = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

for (let octave = 0; octave <= 8; octave++) {
  for (let i = 0; i < NOTE_NAMES.length; i++) {
    const noteNum = (octave + 1) * 12 + i; // MIDI number
    const freq = 440 * Math.pow(2, (noteNum - 69) / 12);
    NOTE_FREQUENCIES[`${NOTE_NAMES[i]}${octave}`] = freq;
  }
}
// Add flat aliases
for (const [flat, sharp] of Object.entries(FLAT_MAP)) {
  for (let octave = 0; octave <= 8; octave++) {
    NOTE_FREQUENCIES[`${flat}${octave}`] = NOTE_FREQUENCIES[`${sharp}${octave}`];
  }
}

function noteToFreq(note: string): number {
  return NOTE_FREQUENCIES[note] ?? 440;
}

// ============================================================================
// DURATION PARSING (Tone.js notation → seconds)
// ============================================================================

function durationToSeconds(dur: string, tempo: number): number {
  const beatDuration = 60 / tempo;
  switch (dur) {
    case '1n': return beatDuration * 4;
    case '2n': return beatDuration * 2;
    case '4n': return beatDuration;
    case '8n': return beatDuration / 2;
    case '16n': return beatDuration / 4;
    case '32n': return beatDuration / 8;
    case '2t': return beatDuration * 2 * (2 / 3);
    case '4t': return beatDuration * (2 / 3);
    case '8t': return beatDuration / 2 * (2 / 3);
    default: {
      const parsed = parseFloat(dur);
      return isNaN(parsed) ? beatDuration : parsed;
    }
  }
}

// ============================================================================
// TIME PARSING (bar:beat:sixteenth → seconds)
// ============================================================================

function timeToSeconds(time: string, tempo: number): number {
  const beatDuration = 60 / tempo;
  const parts = time.split(':').map(Number);
  if (parts.length === 3) {
    const [bar, beat, sixteenth] = parts;
    return (bar * 4 + beat + sixteenth / 4) * beatDuration;
  } else if (parts.length === 2) {
    const [bar, beat] = parts;
    return (bar * 4 + beat) * beatDuration;
  }
  return parseFloat(time) || 0;
}

// ============================================================================
// AUDIO RENDERER
// ============================================================================

export class AudioRenderer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private scheduledNodes: AudioScheduledSourceNode[] = [];
  private playing: boolean = false;
  private startTime: number = 0;
  private totalDuration: number = 0;
  private progressTimer: number | null = null;
  private options: AudioRendererOptions;
  private musicData: MusicData | null = null;

  constructor(options: AudioRendererOptions = {}) {
    this.options = options;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.options.volume ?? 0.5;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Load music data from a seed by running it through the Audio engine.
   */
  loadSeed(seed: UniversalSeed): MusicData | null {
    const engine = registry.get('audio');
    if (!engine) return null;

    const result = engine.generate(seed);
    if (!result.success) return null;

    const music = result.artifacts.get('music') as MusicData | undefined;
    if (music) {
      this.musicData = music;
    }
    return music ?? null;
  }

  /**
   * Load raw music data directly.
   */
  loadMusic(music: MusicData): void {
    this.musicData = music;
  }

  /**
   * Play the loaded music.
   */
  play(): void {
    if (!this.musicData) return;
    this.stop();

    const ctx = this.ensureContext();
    const music = this.musicData;
    const tempo = music.metadata.tempo;

    // Create reverb if specified
    if (music.effects.reverb && music.effects.reverb.wet && music.effects.reverb.wet > 0) {
      this.setupReverb(ctx, music.effects.reverb.decay ?? 2, music.effects.reverb.wet ?? 0.3);
    }

    // Schedule all notes
    const now = ctx.currentTime + 0.1;
    this.startTime = now;
    let maxEndTime = 0;

    for (const track of music.tracks) {
      const oscType = this.getOscillatorType(track.instrument);
      const envelope = track.instrument.envelope ?? { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 };

      for (const note of track.notes) {
        const startSec = timeToSeconds(note.time, tempo);
        const durSec = durationToSeconds(note.duration, tempo);
        const freq = noteToFreq(note.note);
        const velocity = note.velocity;

        const endTime = startSec + durSec + envelope.release;
        if (endTime > maxEndTime) maxEndTime = endTime;

        this.scheduleNote(ctx, freq, now + startSec, durSec, velocity, oscType, envelope);
      }
    }

    this.totalDuration = maxEndTime;
    this.playing = true;
    this.options.onPlayStateChange?.(true);

    // Progress tracking
    if (this.options.onProgress) {
      this.progressTimer = window.setInterval(() => {
        if (!this.ctx || !this.playing) return;
        const elapsed = this.ctx.currentTime - this.startTime;
        this.options.onProgress!(elapsed, this.totalDuration);
        if (elapsed >= this.totalDuration) {
          this.stop();
        }
      }, 100);
    } else {
      // Auto-stop
      setTimeout(() => this.stop(), maxEndTime * 1000 + 500);
    }
  }

  private scheduleNote(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    velocity: number,
    oscType: OscillatorType,
    envelope: { attack: number; decay: number; sustain: number; release: number }
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = oscType;
    osc.frequency.value = freq;

    const vol = velocity * 0.3;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + envelope.attack);
    gain.gain.linearRampToValueAtTime(vol * envelope.sustain, startTime + envelope.attack + envelope.decay);
    gain.gain.setValueAtTime(vol * envelope.sustain, startTime + duration);
    gain.gain.linearRampToValueAtTime(0, startTime + duration + envelope.release);

    osc.connect(gain);

    if (this.convolver && this.masterGain) {
      const dry = ctx.createGain();
      dry.gain.value = 0.7;
      gain.connect(dry);
      dry.connect(this.masterGain);

      const wet = ctx.createGain();
      wet.gain.value = 0.3;
      gain.connect(wet);
      wet.connect(this.convolver);
    } else if (this.masterGain) {
      gain.connect(this.masterGain);
    }

    osc.start(startTime);
    osc.stop(startTime + duration + envelope.release + 0.1);
    this.scheduledNodes.push(osc);
  }

  private getOscillatorType(instrument: InstrumentSpec): OscillatorType {
    const type = instrument.oscillator?.type ?? instrument.type ?? 'sine';
    const valid: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];
    if (valid.includes(type as OscillatorType)) return type as OscillatorType;

    // Map common instrument names to waveforms
    const mapping: Record<string, OscillatorType> = {
      piano: 'triangle',
      synth: 'sawtooth',
      bass: 'sine',
      lead: 'square',
      pad: 'sine',
      strings: 'triangle',
      organ: 'square',
      pluck: 'triangle',
    };
    return mapping[type] ?? 'sine';
  }

  private setupReverb(ctx: AudioContext, decay: number, wet: number): void {
    if (!this.masterGain) return;
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * Math.min(decay, 5);
    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }

    this.convolver = ctx.createConvolver();
    this.convolver.buffer = impulse;

    const wetGain = ctx.createGain();
    wetGain.gain.value = wet;
    this.convolver.connect(wetGain);
    wetGain.connect(this.masterGain);
  }

  /**
   * Stop playback and clean up.
   */
  stop(): void {
    for (const node of this.scheduledNodes) {
      try { node.stop(); } catch { /* already stopped */ }
    }
    this.scheduledNodes = [];
    this.convolver = null;

    if (this.progressTimer !== null) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }

    this.playing = false;
    this.options.onPlayStateChange?.(false);
  }

  /**
   * Set master volume (0-1).
   */
  setVolume(vol: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, vol));
    }
    this.options.volume = vol;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getMusicData(): MusicData | null {
    return this.musicData;
  }

  getTotalDuration(): number {
    return this.totalDuration;
  }

  destroy(): void {
    this.stop();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
    }
    this.ctx = null;
    this.masterGain = null;
  }
}
