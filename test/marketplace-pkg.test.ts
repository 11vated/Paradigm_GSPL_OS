import { describe, it, expect } from 'vitest';
import { createSeed } from '../src/kernel/seed.js';
import { scalar, categorical } from '../src/kernel/genes.js';
import { packageSeed, forkPackage, serializePackage, deserializePackage } from '../src/marketplace/seed-package.js';
import { MarketplaceRegistry } from '../src/marketplace/registry.js';

// ============================================================================
// SEED PACKAGING
// ============================================================================

describe('SeedPackage', () => {
  const seed = createSeed('visual2d', 'TestArt', {
    complexity: scalar(0.5, 0, 1),
    hue: scalar(200, 0, 360),
    style: categorical('geometric', ['geometric', 'organic', 'minimal']),
  });

  it('packages a seed with correct format', () => {
    const pkg = packageSeed(seed, {
      publisher: 'testuser',
      description: 'A test seed',
      tags: ['art', 'test'],
    });

    expect(pkg.$format).toBe('gseed');
    expect(pkg.$version).toBe('1.0');
    expect(pkg.seed.$name).toBe('TestArt');
    expect(pkg.publication.publisher).toBe('testuser');
    expect(pkg.publication.description).toBe('A test seed');
    expect(pkg.publication.tags).toContain('art');
    expect(pkg.$packageHash).toBeTruthy();
    expect(pkg.$packageHash.length).toBe(16);
  });

  it('serializes and deserializes', () => {
    const pkg = packageSeed(seed, { publisher: 'testuser', description: 'test' });
    const json = serializePackage(pkg);
    const restored = deserializePackage(json);

    expect(restored.$format).toBe('gseed');
    expect(restored.seed.$name).toBe('TestArt');
    expect(restored.$packageHash).toBe(pkg.$packageHash);
  });

  it('rejects invalid format on deserialize', () => {
    expect(() => deserializePackage('{"$format":"nope"}')).toThrow('Invalid format');
  });

  it('creates fork with attribution', () => {
    const original = packageSeed(seed, { publisher: 'alice', description: 'original' });
    const forked = forkPackage(original, seed, 'bob', 'evolve');

    expect(forked.attribution.creator).toBe(seed.$metadata.author);
    expect(forked.attribution.parentPackages).toContain(original.$packageHash);
    expect(forked.attribution.contributors.some(c => c.name === 'bob')).toBe(true);
    expect(forked.publication.publisher).toBe('bob');
  });

  it('generates preview with highlights', () => {
    const pkg = packageSeed(seed, { publisher: 'test', description: 'test' });

    expect(pkg.preview.summary).toContain('TestArt');
    expect(pkg.preview.highlights.length).toBeGreaterThan(0);
    expect(pkg.preview.highlights[0].gene).toBeTruthy();
  });

  it('initializes stats to zero', () => {
    const pkg = packageSeed(seed, { publisher: 'test', description: 'test' });

    expect(pkg.stats.downloads).toBe(0);
    expect(pkg.stats.stars).toBe(0);
    expect(pkg.stats.forks).toBe(0);
    expect(pkg.stats.averageRating).toBe(0);
  });
});

// ============================================================================
// MARKETPLACE REGISTRY
// ============================================================================

describe('MarketplaceRegistry', () => {
  function makePkg(name: string, domain: string, publisher: string, tags: string[] = []) {
    const seed = createSeed(domain as any, name, { val: scalar(0.5, 0, 1) });
    return packageSeed(seed, { publisher, description: `${name} seed`, tags });
  }

  it('publishes and retrieves a package', () => {
    const reg = new MarketplaceRegistry();
    const pkg = makePkg('Dragon', 'visual2d', 'alice', ['art']);

    const result = reg.publish(pkg);
    expect(result.success).toBe(true);
    expect(result.hash).toBe(pkg.$packageHash);

    const retrieved = reg.get(pkg.$packageHash);
    expect(retrieved).toBeDefined();
    expect(retrieved!.seed.$name).toBe('Dragon');
  });

  it('rejects duplicate publish', () => {
    const reg = new MarketplaceRegistry();
    const pkg = makePkg('Dragon', 'visual2d', 'alice');

    reg.publish(pkg);
    const result = reg.publish(pkg);
    expect(result.success).toBe(false);
    expect(result.error).toContain('already published');
  });

  it('searches by text', () => {
    const reg = new MarketplaceRegistry();
    reg.publish(makePkg('FireDragon', 'visual2d', 'alice', ['fire']));
    reg.publish(makePkg('IceWolf', 'visual2d', 'bob', ['ice']));
    reg.publish(makePkg('WindEagle', 'audio', 'alice', ['wind']));

    const result = reg.search({ text: 'dragon' });
    expect(result.total).toBe(1);
    expect(result.packages[0].seed.$name).toBe('FireDragon');
  });

  it('searches by domain', () => {
    const reg = new MarketplaceRegistry();
    reg.publish(makePkg('Art1', 'visual2d', 'alice'));
    reg.publish(makePkg('Music1', 'audio', 'bob'));
    reg.publish(makePkg('Art2', 'visual2d', 'carol'));

    const result = reg.search({ domain: 'visual2d' as any });
    expect(result.total).toBe(2);
  });

  it('searches by tags', () => {
    const reg = new MarketplaceRegistry();
    reg.publish(makePkg('A', 'visual2d', 'alice', ['fire', 'art']));
    reg.publish(makePkg('B', 'visual2d', 'bob', ['ice', 'art']));
    reg.publish(makePkg('C', 'audio', 'carol', ['fire', 'music']));

    const result = reg.search({ tags: ['fire'] });
    expect(result.total).toBe(2);
  });

  it('sorts by newest', () => {
    const reg = new MarketplaceRegistry();
    const pkg1 = makePkg('Old', 'visual2d', 'alice');
    pkg1.publication.publishedAt = 1000;
    const pkg2 = makePkg('New', 'visual2d', 'bob');
    pkg2.publication.publishedAt = 2000;

    reg.publish(pkg1);
    reg.publish(pkg2);

    const result = reg.search({ sortBy: 'newest' });
    expect(result.packages[0].seed.$name).toBe('New');
  });

  it('tracks downloads', () => {
    const reg = new MarketplaceRegistry();
    const pkg = makePkg('Test', 'visual2d', 'alice');
    reg.publish(pkg);

    reg.download(pkg.$packageHash, 'bob');
    reg.download(pkg.$packageHash, 'carol');

    const updated = reg.get(pkg.$packageHash);
    expect(updated!.stats.downloads).toBe(2);
  });

  it('tracks stars', () => {
    const reg = new MarketplaceRegistry();
    const pkg = makePkg('Test', 'visual2d', 'alice');
    reg.publish(pkg);

    reg.star(pkg.$packageHash, 'bob');
    reg.star(pkg.$packageHash, 'carol');

    const updated = reg.get(pkg.$packageHash);
    expect(updated!.stats.stars).toBe(2);
  });

  it('computes ratings', () => {
    const reg = new MarketplaceRegistry();
    const pkg = makePkg('Test', 'visual2d', 'alice');
    reg.publish(pkg);

    reg.rate(pkg.$packageHash, 'bob', 5);
    reg.rate(pkg.$packageHash, 'carol', 3);

    const updated = reg.get(pkg.$packageHash);
    expect(updated!.stats.averageRating).toBe(4);
    expect(updated!.stats.ratingCount).toBe(2);
  });

  it('returns featured packages', () => {
    const reg = new MarketplaceRegistry();
    reg.publish(makePkg('A', 'visual2d', 'alice'));
    reg.publish(makePkg('B', 'audio', 'bob'));

    const featured = reg.featured(5);
    expect(featured.length).toBe(2);
  });

  it('returns registry stats', () => {
    const reg = new MarketplaceRegistry();
    reg.publish(makePkg('A', 'visual2d', 'alice'));
    reg.publish(makePkg('B', 'audio', 'bob'));

    const stats = reg.stats();
    expect(stats.totalPackages).toBe(2);
    expect(stats.totalPublishers).toBe(2);
    expect(stats.byDomain['visual2d']).toBe(1);
    expect(stats.byDomain['audio']).toBe(1);
  });

  it('unpublishes by publisher', () => {
    const reg = new MarketplaceRegistry();
    const pkg = makePkg('Test', 'visual2d', 'alice');
    reg.publish(pkg);

    expect(reg.unpublish(pkg.$packageHash, 'bob')).toBe(false); // wrong publisher
    expect(reg.unpublish(pkg.$packageHash, 'alice')).toBe(true);
    expect(reg.get(pkg.$packageHash)).toBeUndefined();
  });

  it('paginates results', () => {
    const reg = new MarketplaceRegistry();
    for (let i = 0; i < 10; i++) {
      reg.publish(makePkg(`Seed${i}`, 'visual2d', 'alice'));
    }

    const page1 = reg.search({ limit: 3, offset: 0 });
    expect(page1.packages.length).toBe(3);
    expect(page1.total).toBe(10);

    const page2 = reg.search({ limit: 3, offset: 3 });
    expect(page2.packages.length).toBe(3);
  });

  it('updates fork count on parent', () => {
    const reg = new MarketplaceRegistry();
    const parent = makePkg('Parent', 'visual2d', 'alice');
    reg.publish(parent);

    const child = makePkg('Child', 'visual2d', 'bob');
    child.attribution.parentPackages = [parent.$packageHash];
    reg.publish(child);

    const updated = reg.get(parent.$packageHash);
    expect(updated!.stats.forks).toBe(1);
    expect(updated!.attribution.descendantCount).toBe(1);
  });
});

// ============================================================================
// TEMPLATES
// ============================================================================

describe('Templates', () => {
  it('generates valid init package.json', async () => {
    const { getInitPackageJson } = await import('../src/runtime/templates.js');
    const json = getInitPackageJson('test-project');
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe('test-project');
    expect(parsed.scripts.build).toContain('paradigm');
  });

  it('generates valid GSPL main file', async () => {
    const { getInitMainGspl } = await import('../src/runtime/templates.js');
    const gspl = getInitMainGspl('TestProject');
    expect(gspl).toContain('seed TestProject');
    expect(gspl).toContain('visual2d');
    expect(gspl).toContain('genes');
  });

  it('generates domain templates for all domains', async () => {
    const { getDomainTemplate, getAvailableDomains } = await import('../src/runtime/templates.js');
    const domains = getAvailableDomains();
    expect(domains.length).toBeGreaterThanOrEqual(9);

    for (const domain of domains) {
      const template = getDomainTemplate(domain, 'Test');
      expect(template).toBeTruthy();
      expect(template!).toContain('seed Test');
      expect(template!).toContain(domain);
    }
  });

  it('returns null for unknown domain', async () => {
    const { getDomainTemplate } = await import('../src/runtime/templates.js');
    expect(getDomainTemplate('nonexistent', 'Test')).toBeNull();
  });
});
