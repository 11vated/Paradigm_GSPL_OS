/**
 * marketplace.test.ts — Seed Marketplace Tests
 * Tests marketplace publishing, discovery, and interaction.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SeedMarketplace } from '../src/desktop/seed-marketplace.js';
import { createSeed } from '../src/kernel/seed.js';
import { scalar, categorical } from '../src/kernel/genes.js';

describe('SeedMarketplace', () => {
  let marketplace: SeedMarketplace;

  beforeEach(() => {
    marketplace = new SeedMarketplace();
  });

  it('publishes a seed', () => {
    const seed = createSeed('visual2d', 'TestArt', {
      width: scalar(800, 0, 1920),
      complexity: scalar(5, 0, 10),
    });

    const published = marketplace.publish(seed, {
      description: 'A test artwork',
      tags: ['test', 'art'],
    });

    expect(published.hash).toBe(seed.$hash);
    expect(published.name).toBe('TestArt');
    expect(published.domain).toBe('visual2d');
    expect(published.description).toBe('A test artwork');
    expect(published.tags).toContain('test');
  });

  it('retrieves published seed by hash', () => {
    const seed = createSeed('visual2d', 'MyArt', {
      color: categorical('red', ['red', 'blue', 'green']),
    });

    marketplace.publish(seed, { description: 'My art', tags: [] });

    const retrieved = marketplace.getByHash(seed.$hash);
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('MyArt');
  });

  it('unpublishes a seed', () => {
    const seed = createSeed('visual2d', 'RemoveMe', {
      value: scalar(42, 0, 100),
    });

    marketplace.publish(seed, { description: 'Temporary', tags: [] });
    expect(marketplace.getByHash(seed.$hash)).toBeDefined();

    const removed = marketplace.unpublish(seed.$hash);
    expect(removed).toBe(true);
    expect(marketplace.getByHash(seed.$hash)).toBeUndefined();
  });

  it('searches by text', () => {
    const seed1 = createSeed('visual2d', 'RedArt', { value: scalar(1, 0, 100) });
    const seed2 = createSeed('visual2d', 'BlueArt', { value: scalar(2, 0, 100) });

    marketplace.publish(seed1, { description: 'A red artwork', tags: ['color'] });
    marketplace.publish(seed2, { description: 'A blue artwork', tags: ['color'] });

    const results = marketplace.search({ text: 'red' });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(s => s.name === 'RedArt')).toBe(true);
  });

  it('searches by domain', () => {
    const seed1 = createSeed('visual2d', 'Visual', { value: scalar(1, 0, 100) });
    const seed2 = createSeed('audio', 'Sound', { value: scalar(2, 0, 100) });

    marketplace.publish(seed1, { description: 'Visual', tags: [] });
    marketplace.publish(seed2, { description: 'Audio', tags: [] });

    const visuals = marketplace.search({ domain: 'visual2d' });
    expect(visuals.every(s => s.domain === 'visual2d')).toBe(true);
  });

  it('searches by tags', () => {
    const seed1 = createSeed('visual2d', 'TaggedArt', { value: scalar(1, 0, 100) });
    const seed2 = createSeed('visual2d', 'OtherArt', { value: scalar(2, 0, 100) });

    marketplace.publish(seed1, { description: 'Art 1', tags: ['abstract', 'modern'] });
    marketplace.publish(seed2, { description: 'Art 2', tags: ['realistic'] });

    const results = marketplace.search({ tags: ['abstract'] });
    expect(results.some(s => s.name === 'TaggedArt')).toBe(true);
  });

  it('retrieves seeds by domain', () => {
    const seed1 = createSeed('visual2d', 'Visual1', { value: scalar(1, 0, 100) });
    const seed2 = createSeed('visual2d', 'Visual2', { value: scalar(2, 0, 100) });
    const seed3 = createSeed('audio', 'Audio1', { value: scalar(3, 0, 100) });

    marketplace.publish(seed1, { description: 'V1', tags: [] });
    marketplace.publish(seed2, { description: 'V2', tags: [] });
    marketplace.publish(seed3, { description: 'A1', tags: [] });

    const visuals = marketplace.getByDomain('visual2d');
    expect(visuals.length).toBe(2);
    expect(visuals.every(s => s.domain === 'visual2d')).toBe(true);
  });

  it('retrieves popular seeds', () => {
    const seed1 = createSeed('visual2d', 'Popular', { value: scalar(1, 0, 100) });
    const seed2 = createSeed('visual2d', 'Less', { value: scalar(2, 0, 100) });

    marketplace.publish(seed1, { description: 'Popular', tags: [] });
    marketplace.publish(seed2, { description: 'Less popular', tags: [] });

    // Download seed1 multiple times to make it popular
    marketplace.download(seed1.$hash);
    marketplace.download(seed1.$hash);
    marketplace.download(seed1.$hash);

    const popular = marketplace.getPopular(2);
    expect(popular[0].name).toBe('Popular');
  });

  it('retrieves recent seeds', () => {
    const seed1 = createSeed('visual2d', 'First', { value: scalar(1, 0, 100) });
    const seed2 = createSeed('visual2d', 'Second', { value: scalar(2, 0, 100) });

    marketplace.publish(seed1, { description: 'First', tags: [] });

    // Add delay to ensure different timestamps
    const prevDate = Date.now;
    Date.now = () => prevDate() + 1000;
    marketplace.publish(seed2, { description: 'Second', tags: [] });
    Date.now = prevDate;

    const recent = marketplace.getRecent(2);
    expect(recent[0].name).toBe('Second');
  });

  it('retrieves seeds by author', () => {
    const seed1 = createSeed('visual2d', 'Art1', {
      value: scalar(1, 0, 100),
    });
    const seed2 = createSeed('visual2d', 'Art2', {
      value: scalar(2, 0, 100),
    });

    // Manually set author in metadata
    seed1.$metadata.author = 'Alice';
    seed2.$metadata.author = 'Bob';

    marketplace.publish(seed1, { description: 'Art 1', tags: [] });
    marketplace.publish(seed2, { description: 'Art 2', tags: [] });

    const aliceSeeds = marketplace.getByAuthor('Alice');
    expect(aliceSeeds.length).toBe(1);
    expect(aliceSeeds[0].author).toBe('Alice');
  });

  it('downloads and increments download count', () => {
    const seed = createSeed('visual2d', 'DownloadMe', {
      value: scalar(1, 0, 100),
    });

    marketplace.publish(seed, { description: 'Download test', tags: [] });

    const downloaded1 = marketplace.download(seed.$hash);
    expect(downloaded1).toBeDefined();
    expect(downloaded1?.$name).toBe('DownloadMe');

    // Download again and verify count increased
    marketplace.download(seed.$hash);
    const marketSeed = marketplace.getByHash(seed.$hash);
    expect(marketSeed?.downloads).toBe(2);
  });

  it('rates a seed and calculates average', () => {
    const seed = createSeed('visual2d', 'RateMe', {
      value: scalar(1, 0, 100),
    });

    const published = marketplace.publish(seed, {
      description: 'Rate this',
      tags: [],
    });
    expect(published.rating).toBe(5.0);

    marketplace.rate(seed.$hash, 4);
    const updated = marketplace.getByHash(seed.$hash);
    expect(updated?.rating).toBeLessThan(5.0);
    expect(updated?.rating).toBeGreaterThanOrEqual(4.0);

    marketplace.rate(seed.$hash, 3);
    const final = marketplace.getByHash(seed.$hash);
    expect(final?.rating).toBeLessThanOrEqual(4.0);
  });

  it('clamps rating values', () => {
    const seed = createSeed('visual2d', 'ClampTest', {
      value: scalar(1, 0, 100),
    });

    marketplace.publish(seed, { description: 'Clamp test', tags: [] });

    marketplace.rate(seed.$hash, 10); // Should clamp to 5
    marketplace.rate(seed.$hash, -1); // Should clamp to 1

    const rated = marketplace.getByHash(seed.$hash);
    expect(rated?.rating).toBeLessThanOrEqual(5);
    expect(rated?.rating).toBeGreaterThanOrEqual(1);
  });

  it('forks a seed with new name and incremented generation', () => {
    const original = createSeed('visual2d', 'Original', {
      value: scalar(42, 0, 100),
    });

    marketplace.publish(original, { description: 'Original', tags: ['original'] });

    const forked = marketplace.fork(original.$hash, 'Forked');
    expect(forked).toBeDefined();
    expect(forked?.name).toBe('Forked');
    expect(forked?.generation).toBe(1);
    expect(forked?.parentHashes).toContain(original.$hash);
  });

  it('retrieves statistics', () => {
    const seed1 = createSeed('visual2d', 'V1', { value: scalar(1, 0, 100) });
    const seed2 = createSeed('visual2d', 'V2', { value: scalar(2, 0, 100) });
    const seed3 = createSeed('audio', 'A1', { value: scalar(3, 0, 100) });

    marketplace.publish(seed1, { description: 'V1', tags: [] });
    marketplace.publish(seed2, { description: 'V2', tags: [] });
    marketplace.publish(seed3, { description: 'A1', tags: [] });

    const stats = marketplace.getStats();
    expect(stats.totalSeeds).toBe(3);
    expect(stats.totalDomains).toBe(2);
    expect(stats.topDomains.length).toBeGreaterThan(0);
    expect(stats.topDomains[0].count).toBeGreaterThanOrEqual(1);
  });

  it('handles search with multiple criteria', () => {
    const seed = createSeed('visual2d', 'MultiSearch', {
      color: categorical('blue', ['red', 'blue', 'green']),
    });

    marketplace.publish(seed, {
      description: 'A blue visual artwork',
      tags: ['blue', 'visual'],
    });

    const results = marketplace.search({
      text: 'blue',
      domain: 'visual2d',
      tags: ['visual'],
      limit: 10,
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(s => s.name === 'MultiSearch')).toBe(true);
  });

  it('sorts results by downloads', () => {
    const seed1 = createSeed('visual2d', 'Popular', { value: scalar(1, 0, 100) });
    const seed2 = createSeed('visual2d', 'Unpopular', { value: scalar(2, 0, 100) });

    marketplace.publish(seed1, { description: 'Popular', tags: [] });
    marketplace.publish(seed2, { description: 'Unpopular', tags: [] });

    marketplace.download(seed1.$hash);
    marketplace.download(seed1.$hash);
    marketplace.download(seed1.$hash);

    const sorted = marketplace.search({ sortBy: 'downloads' });
    const popularIdx = sorted.findIndex(s => s.name === 'Popular');
    const unpopularIdx = sorted.findIndex(s => s.name === 'Unpopular');

    if (popularIdx >= 0 && unpopularIdx >= 0) {
      expect(popularIdx).toBeLessThan(unpopularIdx);
    }
  });

  it('sorts results by rating', () => {
    const seed1 = createSeed('visual2d', 'HighRated', { value: scalar(1, 0, 100) });
    const seed2 = createSeed('visual2d', 'LowRated', { value: scalar(2, 0, 100) });

    marketplace.publish(seed1, { description: 'High', tags: [] });
    marketplace.publish(seed2, { description: 'Low', tags: [] });

    marketplace.rate(seed2.$hash, 1);
    marketplace.rate(seed2.$hash, 1);

    const sorted = marketplace.search({ sortBy: 'rating' });
    const highIdx = sorted.findIndex(s => s.name === 'HighRated');
    const lowIdx = sorted.findIndex(s => s.name === 'LowRated');

    if (highIdx >= 0 && lowIdx >= 0) {
      expect(highIdx).toBeLessThan(lowIdx);
    }
  });
});
