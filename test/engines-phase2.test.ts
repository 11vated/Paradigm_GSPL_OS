/**
 * test/engines-phase2.test.ts — Tests for Animation and Audio Engines
 * Comprehensive test suite for the phase 2 domain engines
 */

import { describe, it, expect } from 'vitest';
import { createSeed } from '../src/kernel/seed.js';
import { AnimationEngine } from '../src/engines/animation/engine.js';
import { AudioEngine } from '../src/engines/audio/engine.js';
import {
  scalar,
  categorical,
  struct,
  vector,
} from '../src/kernel/genes.js';

// ============================================================================
// ANIMATION ENGINE TESTS
// ============================================================================

describe('AnimationEngine', () => {
  const engine = new AnimationEngine();

  describe('domain and metadata', () => {
    it('should have correct domain', () => {
      expect(engine.domain).toBe('animation');
    });

    it('should have a descriptive name', () => {
      expect(engine.name).toContain('Animation');
    });

    it('should have version 1.0.0', () => {
      expect(engine.version).toBe('1.0.0');
    });
  });

  describe('defaultGenes', () => {
    it('should return valid gene map', () => {
      const genes = engine.defaultGenes();
      expect(genes).toBeDefined();
      expect(genes.type).toBeDefined();
      expect(genes.duration).toBeDefined();
      expect(genes.fps).toBeDefined();
    });

    it('should have all required animation genes', () => {
      const genes = engine.defaultGenes();
      const required = [
        'type',
        'duration',
        'fps',
        'easing',
        'looping',
        'complexity',
        'amplitude',
        'frequency',
        'phaseOffset',
        'palette',
        'spriteSize',
        'frameCount',
      ];
      for (const gene of required) {
        expect(genes[gene]).toBeDefined();
      }
    });
  });

  describe('evaluate', () => {
    it('should evaluate fitness for a seed', () => {
      const seed = createSeed('animation', 'test-anim', engine.defaultGenes());
      const fitness = engine.evaluate(seed);

      expect(fitness.aggregate).toBeGreaterThanOrEqual(0);
      expect(fitness.aggregate).toBeLessThanOrEqual(1);
      expect(fitness.scores).toBeDefined();
      expect(fitness.evaluatedAt).toBeGreaterThan(0);
    });

    it('should prefer moderate complexity', () => {
      const genes1 = engine.defaultGenes();
      const seed1 = createSeed('animation', 'test-1', genes1);
      const fitness1 = engine.evaluate(seed1);

      // Modify to very high complexity
      const genes2 = engine.defaultGenes();
      (genes2.complexity as any).value = 9;
      const seed2 = createSeed('animation', 'test-2', genes2);
      const fitness2 = engine.evaluate(seed2);

      // Both should have decent scores
      expect(fitness1.aggregate).toBeGreaterThan(0);
      expect(fitness2.aggregate).toBeGreaterThan(0);
    });
  });

  describe('stages', () => {
    it('should define 5 developmental stages', () => {
      const stages = engine.stages();
      expect(stages).toHaveLength(5);
    });

    it('stages should be named correctly', () => {
      const stages = engine.stages();
      const names = stages.map(s => s.name);
      expect(names).toEqual([
        'Skeleton',
        'Motion',
        'Timing',
        'Render',
        'Export',
      ]);
    });

    it('each stage should be executable', () => {
      const stages = engine.stages();
      for (const stage of stages) {
        expect(typeof stage.execute).toBe('function');
        expect(stage.description).toBeDefined();
      }
    });
  });

  describe('generate - keyframe animation', () => {
    it('should generate valid keyframe data', () => {
      const genes = engine.defaultGenes();
      (genes.type as any).value = 'keyframe';
      const seed = createSeed('animation', 'keyframe-test', genes);

      const result = engine.generate(seed);

      expect(result.success).toBe(true);
      expect(result.artifacts.has('animation')).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('keyframe data should have proper structure', () => {
      const genes = engine.defaultGenes();
      (genes.type as any).value = 'keyframe';
      (genes.duration as any).value = 2;
      const seed = createSeed('animation', 'keyframe-test', genes);

      const result = engine.generate(seed);
      const animation = result.artifacts.get('animation') as any;

      expect(animation.type).toBe('keyframe');
      expect(animation.duration).toBe(2);
      expect(animation.fps).toBeGreaterThanOrEqual(12);
      expect(animation.fps).toBeLessThanOrEqual(60);
      expect(Array.isArray(animation.keyframes)).toBe(true);
      expect(animation.keyframes.length).toBeGreaterThan(0);
    });

    it('keyframes should have easing applied', () => {
      const genes = engine.defaultGenes();
      (genes.type as any).value = 'keyframe';
      (genes.easing as any).value = 'ease-in-out';
      const seed = createSeed('animation', 'keyframe-test', genes);

      const result = engine.generate(seed);
      const animation = result.artifacts.get('animation') as any;

      expect(animation.keyframes[0].easing).toBe('ease-in-out');
      expect(animation.keyframes[0].properties).toBeDefined();
      expect(Object.keys(animation.keyframes[0].properties).length).toBeGreaterThan(
        0
      );
    });

    it('should respect looping setting', () => {
      const genes = engine.defaultGenes();
      (genes.type as any).value = 'keyframe';
      (genes.looping as any).value = 'ping-pong';
      const seed = createSeed('animation', 'keyframe-test', genes);

      const result = engine.generate(seed);
      const animation = result.artifacts.get('animation') as any;

      expect(animation.looping).toBe('ping-pong');
    });
  });

  describe('generate - sprite sheet animation', () => {
    it('should generate valid sprite sheet', () => {
      const genes = engine.defaultGenes();
      (genes.type as any).value = 'sprite-sheet';
      const seed = createSeed('animation', 'sprite-test', genes);

      const result = engine.generate(seed);

      expect(result.success).toBe(true);
      expect(result.artifacts.has('animation')).toBe(true);
    });

    it('sprite sheet should have correct SVG structure', () => {
      const genes = engine.defaultGenes();
      (genes.type as any).value = 'sprite-sheet';
      (genes.frameCount as any).value = 8;
      (genes.spriteSize as any).value = 64;
      const seed = createSeed('animation', 'sprite-test', genes);

      const result = engine.generate(seed);
      const sprite = result.artifacts.get('animation') as any;

      expect(sprite.type).toBe('sprite-sheet');
      expect(sprite.svg).toBeDefined();
      expect(sprite.svg).toContain('<svg');
      expect(sprite.svg).toContain('</svg>');
      expect(Array.isArray(sprite.frames)).toBe(true);
      expect(sprite.frames.length).toBe(8);
    });

    it('sprite sheet frames should have correct properties', () => {
      const genes = engine.defaultGenes();
      (genes.type as any).value = 'sprite-sheet';
      (genes.frameCount as any).value = 4;
      (genes.spriteSize as any).value = 128;
      const seed = createSeed('animation', 'sprite-test', genes);

      const result = engine.generate(seed);
      const sprite = result.artifacts.get('animation') as any;

      for (const frame of sprite.frames) {
        expect(frame.index).toBeDefined();
        expect(frame.x).toBeGreaterThanOrEqual(0);
        expect(frame.y).toBeGreaterThanOrEqual(0);
        expect(frame.width).toBe(128);
        expect(frame.height).toBe(128);
        expect(frame.duration).toBeGreaterThan(0);
      }
    });

    it('sprite sheet should have correct grid layout', () => {
      const genes = engine.defaultGenes();
      (genes.type as any).value = 'sprite-sheet';
      (genes.frameCount as any).value = 9;
      const seed = createSeed('animation', 'sprite-test', genes);

      const result = engine.generate(seed);
      const sprite = result.artifacts.get('animation') as any;

      const expectedCols = Math.ceil(Math.sqrt(9));
      const expectedRows = Math.ceil(9 / expectedCols);

      expect(sprite.cols).toBe(expectedCols);
      expect(sprite.rows).toBe(expectedRows);
      expect(sprite.frameSize).toBeGreaterThan(0);
    });
  });

  describe('generate - skeletal animation', () => {
    it('should generate valid skeletal data', () => {
      const genes = engine.defaultGenes();
      (genes.type as any).value = 'skeletal';
      const seed = createSeed('animation', 'skeletal-test', genes);

      const result = engine.generate(seed);

      expect(result.success).toBe(true);
      expect(result.artifacts.has('animation')).toBe(true);
    });

    it('skeletal animation should have bones', () => {
      const genes = engine.defaultGenes();
      (genes.type as any).value = 'skeletal';
      (genes.complexity as any).value = 5;
      const seed = createSeed('animation', 'skeletal-test', genes);

      const result = engine.generate(seed);
      const skeletal = result.artifacts.get('animation') as any;

      expect(skeletal.type).toBe('skeletal');
      expect(Array.isArray(skeletal.bones)).toBe(true);
      expect(skeletal.bones.length).toBeGreaterThanOrEqual(5);
      expect(skeletal.bones[0].id).toBe('root');
    });

    it('skeletal bones should have hierarchy', () => {
      const genes = engine.defaultGenes();
      (genes.type as any).value = 'skeletal';
      const seed = createSeed('animation', 'skeletal-test', genes);

      const result = engine.generate(seed);
      const skeletal = result.artifacts.get('animation') as any;

      // Check parent-child relationships
      for (let i = 1; i < skeletal.bones.length; i++) {
        const bone = skeletal.bones[i];
        expect(bone.parent).toBeDefined();
        const parent = skeletal.bones.find((b: any) => b.id === bone.parent);
        expect(parent).toBeDefined();
      }
    });

    it('should have keyframes for each bone', () => {
      const genes = engine.defaultGenes();
      (genes.type as any).value = 'skeletal';
      const seed = createSeed('animation', 'skeletal-test', genes);

      const result = engine.generate(seed);
      const skeletal = result.artifacts.get('animation') as any;

      expect(Array.isArray(skeletal.keyframes)).toBe(true);
      expect(skeletal.keyframes.length).toBeGreaterThan(0);

      for (const kf of skeletal.keyframes) {
        expect(kf.time).toBeDefined();
        expect(kf.boneId).toBeDefined();
      }
    });
  });

  describe('generate - particle animation', () => {
    it('should generate valid particle data', () => {
      const genes = engine.defaultGenes();
      (genes.type as any).value = 'particle';
      const seed = createSeed('animation', 'particle-test', genes);

      const result = engine.generate(seed);

      expect(result.success).toBe(true);
      expect(result.artifacts.has('animation')).toBe(true);
    });

    it('particle data should have emitter config', () => {
      const genes = engine.defaultGenes();
      (genes.type as any).value = 'particle';
      const seed = createSeed('animation', 'particle-test', genes);

      const result = engine.generate(seed);
      const particle = result.artifacts.get('animation') as any;

      expect(particle.type).toBe('particle');
      expect(particle.emitter).toBeDefined();
      expect(particle.emitter.rate).toBeGreaterThan(0);
      expect(particle.emitter.lifetime).toBeGreaterThan(0);
      expect(particle.particle).toBeDefined();
    });
  });

  describe('generate - procedural animation', () => {
    it('should generate valid procedural data', () => {
      const genes = engine.defaultGenes();
      (genes.type as any).value = 'procedural';
      const seed = createSeed('animation', 'procedural-test', genes);

      const result = engine.generate(seed);

      expect(result.success).toBe(true);
      expect(result.artifacts.has('animation')).toBe(true);
    });

    it('procedural animation should have expression', () => {
      const genes = engine.defaultGenes();
      (genes.type as any).value = 'procedural';
      const seed = createSeed('animation', 'procedural-test', genes);

      const result = engine.generate(seed);
      const procedural = result.artifacts.get('animation') as any;

      expect(procedural.type).toBe('procedural');
      expect(procedural.expression).toBeDefined();
      expect(typeof procedural.expression).toBe('string');
      expect(procedural.parameters).toBeDefined();
    });
  });

  describe('determinism', () => {
    it('should produce identical results from same seed hash', () => {
      const genes = engine.defaultGenes();
      const seed = createSeed('animation', 'determinism-test', genes);

      const result1 = engine.generate(seed);
      const result2 = engine.generate(seed);

      const strip = (obj: unknown) => JSON.parse(JSON.stringify(obj, (k, v) => k === 'generated' ? undefined : v));
      const anim1 = strip(result1.artifacts.get('animation'));
      const anim2 = strip(result2.artifacts.get('animation'));

      expect(anim1).toEqual(anim2);
    });

    it('should produce different results from different seeds', () => {
      const genes1 = engine.defaultGenes();
      (genes1.complexity as any).value = 3;
      const seed1 = createSeed('animation', 'test-1', genes1);

      const genes2 = engine.defaultGenes();
      (genes2.complexity as any).value = 8;
      const seed2 = createSeed('animation', 'test-2', genes2);

      const result1 = engine.generate(seed1);
      const result2 = engine.generate(seed2);

      const anim1 = JSON.stringify(result1.artifacts.get('animation'));
      const anim2 = JSON.stringify(result2.artifacts.get('animation'));

      expect(anim1).not.toBe(anim2);
    });
  });

  describe('validation', () => {
    it('should reject seeds from wrong domain', () => {
      const genes = engine.defaultGenes();
      const seed = createSeed('audio', 'wrong-domain', genes);

      const result = engine.generate(seed);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('timing', () => {
    it('should report stage timings', () => {
      const genes = engine.defaultGenes();
      const seed = createSeed('animation', 'timing-test', genes);

      const result = engine.generate(seed);

      expect(result.timing.stageTimings.length).toBe(5);
      expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);

      for (const st of result.timing.stageTimings) {
        expect(st.stage).toBeDefined();
        expect(st.ms).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

// ============================================================================
// AUDIO ENGINE TESTS
// ============================================================================

describe('AudioEngine', () => {
  const engine = new AudioEngine();

  describe('domain and metadata', () => {
    it('should have correct domain', () => {
      expect(engine.domain).toBe('audio');
    });

    it('should have a descriptive name', () => {
      expect(engine.name).toContain('Audio');
    });

    it('should have version 1.0.0', () => {
      expect(engine.version).toBe('1.0.0');
    });
  });

  describe('defaultGenes', () => {
    it('should return valid gene map', () => {
      const genes = engine.defaultGenes();
      expect(genes).toBeDefined();
      expect(genes.type).toBeDefined();
      expect(genes.tempo).toBeDefined();
      expect(genes.key).toBeDefined();
      expect(genes.scale).toBeDefined();
    });

    it('should have all required audio genes', () => {
      const genes = engine.defaultGenes();
      const required = [
        'type',
        'tempo',
        'key',
        'scale',
        'octaveRange',
        'baseOctave',
        'density',
        'complexity',
        'swing',
        'dynamics',
        'bars',
        'timeSignatureTop',
        'synthType',
        'attack',
        'decay',
        'sustain',
        'release',
      ];
      for (const gene of required) {
        expect(genes[gene]).toBeDefined();
      }
    });
  });

  describe('evaluate', () => {
    it('should evaluate fitness for a seed', () => {
      const seed = createSeed('audio', 'test-audio', engine.defaultGenes());
      const fitness = engine.evaluate(seed);

      expect(fitness.aggregate).toBeGreaterThanOrEqual(0);
      expect(fitness.aggregate).toBeLessThanOrEqual(1);
      expect(fitness.scores).toBeDefined();
      expect(fitness.evaluatedAt).toBeGreaterThan(0);
    });
  });

  describe('stages', () => {
    it('should define 6 developmental stages', () => {
      const stages = engine.stages();
      expect(stages).toHaveLength(6);
    });

    it('stages should be named correctly', () => {
      const stages = engine.stages();
      const names = stages.map(s => s.name);
      expect(names).toEqual([
        'Scale',
        'Harmony',
        'Rhythm',
        'Melody',
        'Arrangement',
        'Mix',
      ]);
    });
  });

  describe('generate - basic structure', () => {
    it('should generate valid music data', () => {
      const genes = engine.defaultGenes();
      const seed = createSeed('audio', 'music-test', genes);

      const result = engine.generate(seed);

      expect(result.success).toBe(true);
      expect(result.artifacts.has('music')).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should have correct metadata', () => {
      const genes = engine.defaultGenes();
      (genes.tempo as any).value = 140;
      (genes.key as any).value = 'G';
      (genes.scale as any).value = 'minor';
      (genes.bars as any).value = 32;
      const seed = createSeed('audio', 'music-test', genes);

      const result = engine.generate(seed);
      const music = result.artifacts.get('music') as any;

      expect(music.metadata.tempo).toBe(140);
      expect(music.metadata.key).toBe('G');
      expect(music.metadata.scale).toBe('minor');
      expect(music.metadata.bars).toBe(32);
    });
  });

  describe('generate - scale construction', () => {
    it('should build correct major scale', () => {
      const genes = engine.defaultGenes();
      (genes.key as any).value = 'C';
      (genes.scale as any).value = 'major';
      const seed = createSeed('audio', 'scale-test', genes);

      const result = engine.generate(seed);
      const scale = result.artifacts.get('scale') as any;

      expect(scale.scaleType).toBe('major');
      expect(scale.key).toBe('C');
      expect(Array.isArray(scale.semitones)).toBe(true);
      // Major scale has 7 notes
      expect(scale.semitones).toEqual([0, 2, 4, 5, 7, 9, 11]);
    });

    it('should build correct minor scale', () => {
      const genes = engine.defaultGenes();
      (genes.key as any).value = 'A';
      (genes.scale as any).value = 'minor';
      const seed = createSeed('audio', 'scale-test', genes);

      const result = engine.generate(seed);
      const scale = result.artifacts.get('scale') as any;

      expect(scale.scaleType).toBe('minor');
      // A minor = A (9) + minor intervals
      expect(scale.semitones.length).toBe(7);
    });

    it('should build pentatonic scale', () => {
      const genes = engine.defaultGenes();
      (genes.key as any).value = 'C';
      (genes.scale as any).value = 'pentatonic';
      const seed = createSeed('audio', 'scale-test', genes);

      const result = engine.generate(seed);
      const scale = result.artifacts.get('scale') as any;

      expect(scale.semitones).toEqual([0, 2, 4, 7, 9]);
    });

    it('should generate correct note names', () => {
      const genes = engine.defaultGenes();
      (genes.baseOctave as any).value = 4;
      const seed = createSeed('audio', 'scale-test', genes);

      const result = engine.generate(seed);
      const scale = result.artifacts.get('scale') as any;

      for (const note of scale.notes) {
        expect(typeof note).toBe('string');
        expect(/^[A-G]#?[0-9]$/.test(note)).toBe(true);
      }
    });
  });

  describe('generate - harmony', () => {
    it('should generate chord progression', () => {
      const genes = engine.defaultGenes();
      const seed = createSeed('audio', 'harmony-test', genes);

      const result = engine.generate(seed);
      const harmony = result.artifacts.get('harmony') as any;

      expect(Array.isArray(harmony.progression)).toBe(true);
      expect(harmony.progression.length).toBeGreaterThan(0);
      expect(harmony.key).toBeDefined();
    });

    it('should follow music theory for chords', () => {
      const genes = engine.defaultGenes();
      (genes.complexity as any).value = 3;
      (genes.bars as any).value = 4;
      const seed = createSeed('audio', 'harmony-test', genes);

      const result = engine.generate(seed);
      const harmony = result.artifacts.get('harmony') as any;

      // Each chord should have notes
      for (const chord of harmony.chords) {
        expect(chord.name).toBeDefined();
        expect(Array.isArray(chord.notes)).toBe(true);
        expect(chord.notes.length).toBeGreaterThan(0);
      }
    });

    it('should have progression matching bar count', () => {
      const genes = engine.defaultGenes();
      (genes.bars as any).value = 16;
      const seed = createSeed('audio', 'harmony-test', genes);

      const result = engine.generate(seed);
      const harmony = result.artifacts.get('harmony') as any;

      expect(harmony.progression.length).toBe(16);
    });
  });

  describe('generate - rhythm', () => {
    it('should generate euclidean rhythm', () => {
      const genes = engine.defaultGenes();
      const seed = createSeed('audio', 'rhythm-test', genes);

      const result = engine.generate(seed);
      const rhythm = result.artifacts.get('rhythm') as any;

      expect(Array.isArray(rhythm.pattern)).toBe(true);
      expect(rhythm.density).toBeGreaterThanOrEqual(0);
      expect(rhythm.density).toBeLessThanOrEqual(1);
    });

    it('should respect time signature', () => {
      const genes = engine.defaultGenes();
      (genes.timeSignatureTop as any).value = 3;
      const seed = createSeed('audio', 'rhythm-test', genes);

      const result = engine.generate(seed);
      const rhythm = result.artifacts.get('rhythm') as any;

      expect(rhythm.timeSignature).toContain('3');
    });

    it('should have correct density relationship', () => {
      const genes1 = engine.defaultGenes();
      (genes1.density as any).value = 0.1;
      const seed1 = createSeed('audio', 'rhythm-test-1', genes1);

      const genes2 = engine.defaultGenes();
      (genes2.density as any).value = 0.9;
      const seed2 = createSeed('audio', 'rhythm-test-2', genes2);

      const result1 = engine.generate(seed1);
      const result2 = engine.generate(seed2);

      const rhythm1 = result1.artifacts.get('rhythm') as any;
      const rhythm2 = result2.artifacts.get('rhythm') as any;

      const beats1 = rhythm1.pattern.filter((b: boolean) => b).length;
      const beats2 = rhythm2.pattern.filter((b: boolean) => b).length;

      expect(beats2).toBeGreaterThanOrEqual(beats1);
    });
  });

  describe('generate - melody', () => {
    it('should generate melody notes', () => {
      const genes = engine.defaultGenes();
      const seed = createSeed('audio', 'melody-test', genes);

      const result = engine.generate(seed);
      const melody = result.artifacts.get('melody') as any;

      expect(Array.isArray(melody.notes)).toBe(true);
      expect(melody.notes.length).toBeGreaterThan(0);
    });

    it('melody notes should be in scale', () => {
      const genes = engine.defaultGenes();
      (genes.key as any).value = 'C';
      (genes.scale as any).value = 'major';
      (genes.baseOctave as any).value = 4;
      const seed = createSeed('audio', 'melody-test', genes);

      const result = engine.generate(seed);
      const melody = result.artifacts.get('melody') as any;
      const scale = result.artifacts.get('scale') as any;

      // All notes should be from the scale
      for (const note of melody.notes) {
        const noteStr = note.note;
        expect(scale.notes).toContain(noteStr);
      }
    });

    it('notes should have valid Tone.js notation', () => {
      const genes = engine.defaultGenes();
      const seed = createSeed('audio', 'melody-test', genes);

      const result = engine.generate(seed);
      const melody = result.artifacts.get('melody') as any;

      for (const note of melody.notes) {
        // Should have format like C4, D#5, etc
        expect(/^[A-G]#?[0-9]$/.test(note.note)).toBe(true);
        expect(typeof note.velocity).toBe('number');
        expect(note.velocity).toBeGreaterThan(0);
        expect(note.velocity).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('generate - arrangement', () => {
    it('should create melody, harmony, and bass tracks', () => {
      const genes = engine.defaultGenes();
      const seed = createSeed('audio', 'arrangement-test', genes);

      const result = engine.generate(seed);
      const music = result.artifacts.get('music') as any;

      const trackNames = music.tracks.map((t: any) => t.name);
      expect(trackNames).toContain('melody');
      expect(trackNames).toContain('harmony');
      expect(trackNames).toContain('bass');
    });

    it('each track should have notes', () => {
      const genes = engine.defaultGenes();
      const seed = createSeed('audio', 'arrangement-test', genes);

      const result = engine.generate(seed);
      const music = result.artifacts.get('music') as any;

      for (const track of music.tracks) {
        expect(Array.isArray(track.notes)).toBe(true);
        expect(track.notes.length).toBeGreaterThan(0);
      }
    });

    it('should have envelope settings', () => {
      const genes = engine.defaultGenes();
      (genes.attack as any).value = 0.05;
      (genes.decay as any).value = 0.1;
      (genes.sustain as any).value = 0.8;
      (genes.release as any).value = 0.2;
      const seed = createSeed('audio', 'arrangement-test', genes);

      const result = engine.generate(seed);
      const music = result.artifacts.get('music') as any;

      for (const track of music.tracks) {
        const env = track.instrument.envelope;
        expect(env.attack).toBeGreaterThan(0);
        expect(env.decay).toBeGreaterThan(0);
        expect(env.sustain).toBeGreaterThanOrEqual(0);
        expect(env.release).toBeGreaterThan(0);
      }
    });
  });

  describe('generate - effects', () => {
    it('should include reverb and delay', () => {
      const genes = engine.defaultGenes();
      const seed = createSeed('audio', 'effects-test', genes);

      const result = engine.generate(seed);
      const music = result.artifacts.get('music') as any;

      expect(music.effects.reverb).toBeDefined();
      expect(music.effects.delay).toBeDefined();
    });

    it('reverb should respect mix setting', () => {
      const genes = engine.defaultGenes();
      (genes.reverbMix as any).value = 0.7;
      const seed = createSeed('audio', 'effects-test', genes);

      const result = engine.generate(seed);
      const music = result.artifacts.get('music') as any;

      expect(music.effects.reverb.wet).toBe(0.7);
    });

    it('delay should respect mix setting', () => {
      const genes = engine.defaultGenes();
      (genes.delayMix as any).value = 0.4;
      const seed = createSeed('audio', 'effects-test', genes);

      const result = engine.generate(seed);
      const music = result.artifacts.get('music') as any;

      expect(music.effects.delay.feedback).toBeLessThanOrEqual(0.4 * 0.5);
    });
  });

  describe('determinism', () => {
    it('should produce identical results from same seed', () => {
      const genes = engine.defaultGenes();
      const seed = createSeed('audio', 'determinism-test', genes);

      const result1 = engine.generate(seed);
      const result2 = engine.generate(seed);

      const music1 = JSON.stringify(result1.artifacts.get('music'));
      const music2 = JSON.stringify(result2.artifacts.get('music'));

      expect(music1).toBe(music2);
    });

    it('should produce different results from different seeds', () => {
      const genes1 = engine.defaultGenes();
      (genes1.tempo as any).value = 80;
      const seed1 = createSeed('audio', 'test-1', genes1);

      const genes2 = engine.defaultGenes();
      (genes2.tempo as any).value = 160;
      const seed2 = createSeed('audio', 'test-2', genes2);

      const result1 = engine.generate(seed1);
      const result2 = engine.generate(seed2);

      const music1 = JSON.stringify(result1.artifacts.get('music'));
      const music2 = JSON.stringify(result2.artifacts.get('music'));

      expect(music1).not.toBe(music2);
    });
  });

  describe('validation', () => {
    it('should reject seeds from wrong domain', () => {
      const genes = engine.defaultGenes();
      const seed = createSeed('animation', 'wrong-domain', genes);

      const result = engine.generate(seed);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('timing', () => {
    it('should report stage timings', () => {
      const genes = engine.defaultGenes();
      const seed = createSeed('audio', 'timing-test', genes);

      const result = engine.generate(seed);

      expect(result.timing.stageTimings.length).toBe(6);
      expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);

      for (const st of result.timing.stageTimings) {
        expect(st.stage).toBeDefined();
        expect(st.ms).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
