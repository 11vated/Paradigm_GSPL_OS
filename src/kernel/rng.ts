/**
 * rng.ts — Deterministic Random Number Generator
 * A seeded PRNG that produces identical sequences given the same seed.
 * Uses xoshiro256** algorithm for high-quality random number generation.
 */

// ============================================================================
// HASH FUNCTION FOR STRING SEEDS
// ============================================================================

/**
 * FNV-1a 32-bit hash function for string seeds
 */
function fnv1a32(str: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // FNV prime (32-bit safe)
  }
  return hash;
}

/**
 * SplitMix64 - converts 32-bit seed to 64-bit state
 * Produces a 64-bit output from a 64-bit input
 */
function splitmix64(x: bigint): bigint {
  let z = x + BigInt('0x9e3779b97f4a7c15');
  z = (z ^ (z >> BigInt(30))) * BigInt('0xbf58476d1ce4e5b9');
  z = z ^ (z >> BigInt(27));
  return z;
}

// ============================================================================
// XOSHIRO256** RNG CLASS
// ============================================================================

export class DeterministicRNG {
  private state: bigint[] = [BigInt(0), BigInt(0), BigInt(0), BigInt(0)];

  constructor(seed: string | number) {
    this.initialize(seed);
  }

  private initialize(seed: string | number): void {
    let hashValue: bigint;

    if (typeof seed === 'number') {
      hashValue = BigInt(seed >>> 0);
    } else {
      const hash32 = fnv1a32(seed);
      hashValue = BigInt(hash32 >>> 0);
    }

    // Use SplitMix64 to expand single seed into 4 state values
    let sm = hashValue;
    this.state[0] = splitmix64(sm);
    sm += BigInt(1);
    this.state[1] = splitmix64(sm);
    sm += BigInt(1);
    this.state[2] = splitmix64(sm);
    sm += BigInt(1);
    this.state[3] = splitmix64(sm);
  }

  /**
   * Xoshiro256** algorithm - produces 64-bit integer
   */
  private xoshiro256ss(): bigint {
    const result = ((this.state[1] * BigInt(5)) << BigInt(7)) | ((this.state[1] * BigInt(5)) >> BigInt(57));
    const t = this.state[1] << BigInt(17);

    this.state[2] ^= this.state[0];
    this.state[3] ^= this.state[1];
    this.state[1] ^= this.state[2];
    this.state[0] ^= this.state[3];

    this.state[2] ^= t;
    this.state[3] = ((this.state[3] << BigInt(45)) | (this.state[3] >> BigInt(19)));

    return result;
  }

  /**
   * Returns a random number in [0, 1)
   */
  next(): number {
    const raw = this.xoshiro256ss();
    // Convert 64-bit to [0, 1) by dividing by 2^53
    const hi = Number((raw >> BigInt(11)) & BigInt('0x1fffff'));
    const lo = Number((raw >> BigInt(32)) & BigInt('0xffffffff'));
    return (hi * 4294967296 + lo) * (1.0 / 9007199254740992);
  }

  /**
   * Returns a random integer in [min, max]
   */
  nextInt(min: number, max: number): number {
    if (min > max) [min, max] = [max, min];
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Returns a random float in [min, max)
   */
  nextFloat(min: number, max: number): number {
    if (min > max) [min, max] = [max, min];
    return min + this.next() * (max - min);
  }

  /**
   * Returns a random value from a Gaussian distribution
   * Uses Box-Muller transform
   */
  nextGaussian(mean: number = 0, stddev: number = 1): number {
    // Box-Muller transform
    const u1 = this.next();
    const u2 = this.next();
    const r = Math.sqrt(-2 * Math.log(u1));
    const theta = 2 * Math.PI * u2;
    return mean + stddev * r * Math.cos(theta);
  }

  /**
   * Returns a random boolean with given probability of true
   */
  nextBool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Returns a random element from array
   */
  pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    return array[Math.floor(this.next() * array.length)];
  }

  /**
   * Returns a weighted random pick from array
   * weights should sum to approximately 1
   */
  pickWeighted<T>(items: T[], weights: number[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    if (items.length !== weights.length) {
      throw new Error('Items and weights arrays must have same length');
    }

    let sum = 0;
    for (const w of weights) {
      sum += w;
    }

    let rand = this.next() * sum;
    for (let i = 0; i < items.length; i++) {
      rand -= weights[i];
      if (rand < 0) return items[i];
    }
    return items[items.length - 1];
  }

  /**
   * Shuffles array in place (Fisher-Yates)
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Creates a child RNG forked from this one
   * Uses a label to create deterministic but distinct state
   */
  fork(label: string): DeterministicRNG {
    const hashLabel = fnv1a32(label);
    const random = this.nextInt(0, Number.MAX_SAFE_INTEGER);
    const combined = `${random}_${hashLabel}`;
    return new DeterministicRNG(combined);
  }

  /**
   * Creates a sequence of n independent RNGs
   */
  forkMany(n: number, labelPrefix: string = 'fork'): DeterministicRNG[] {
    const result: DeterministicRNG[] = [];
    for (let i = 0; i < n; i++) {
      result.push(this.fork(`${labelPrefix}_${i}`));
    }
    return result;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a simple RNG from a seed
 */
export function createRNG(seed: string | number): DeterministicRNG {
  return new DeterministicRNG(seed);
}

/**
 * Sample from a normal distribution using an RNG
 */
export function sampleGaussian(rng: DeterministicRNG, mean: number, stddev: number): number {
  return rng.nextGaussian(mean, stddev);
}

/**
 * Clamp a value to a range
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
