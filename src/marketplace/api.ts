/**
 * api.ts — Marketplace REST API Server
 * HTTP endpoints for publishing, searching, downloading, and interacting with seeds.
 * Zero external dependencies — uses Node http module.
 */

import * as http from 'http';
import { MarketplaceRegistry, SearchQuery } from './registry.js';
import { SeedPackage, packageSeed, forkPackage, deserializePackage, serializePackage } from './seed-package.js';
import { seedFromJSON } from '../kernel/seed.js';

export interface MarketplaceAPIOptions {
  port?: number;
  host?: string;
  dataDir?: string;
}

/**
 * Start the marketplace API server.
 */
export function startMarketplaceAPI(options: MarketplaceAPIOptions = {}): http.Server {
  const { port = 4444, host = '0.0.0.0', dataDir = '.paradigm/marketplace' } = options;

  const registry = new MarketplaceRegistry(`${dataDir}/registry.json`);

  const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const pathParts = url.pathname.split('/').filter(Boolean);

    try {
      // Route: GET /api/v1/packages — search
      if (req.method === 'GET' && pathParts[0] === 'api' && pathParts[1] === 'v1' && pathParts[2] === 'packages' && !pathParts[3]) {
        const query: SearchQuery = {
          text: url.searchParams.get('q') ?? undefined,
          domain: url.searchParams.get('domain') as any ?? undefined,
          sortBy: url.searchParams.get('sort') as any ?? 'newest',
          limit: parseInt(url.searchParams.get('limit') ?? '20'),
          offset: parseInt(url.searchParams.get('offset') ?? '0'),
        };
        const tags = url.searchParams.get('tags');
        if (tags) query.tags = tags.split(',');

        const result = registry.search(query);
        sendJSON(res, 200, result);
        return;
      }

      // Route: GET /api/v1/packages/:hash — get single
      if (req.method === 'GET' && pathParts[0] === 'api' && pathParts[1] === 'v1' && pathParts[2] === 'packages' && pathParts[3]) {
        const hash = pathParts[3];

        // Sub-routes
        if (pathParts[4] === 'similar') {
          const similar = registry.findSimilar(hash, 5);
          sendJSON(res, 200, { packages: similar });
          return;
        }

        const pkg = registry.download(hash, req.headers['x-user'] as string ?? 'anonymous');
        if (!pkg) {
          sendJSON(res, 404, { error: 'Package not found' });
          return;
        }
        sendJSON(res, 200, pkg);
        return;
      }

      // Route: POST /api/v1/packages — publish
      if (req.method === 'POST' && pathParts[0] === 'api' && pathParts[1] === 'v1' && pathParts[2] === 'packages') {
        const body = await readBody(req);
        const pkg = deserializePackage(body);
        const result = registry.publish(pkg);

        if (result.success) {
          sendJSON(res, 201, { hash: result.hash, message: 'Published successfully' });
        } else {
          sendJSON(res, 400, { error: result.error });
        }
        return;
      }

      // Route: POST /api/v1/packages/:hash/star — star
      if (req.method === 'POST' && pathParts[4] === 'star') {
        const user = req.headers['x-user'] as string ?? 'anonymous';
        const ok = registry.star(pathParts[3], user);
        sendJSON(res, ok ? 200 : 404, ok ? { message: 'Starred' } : { error: 'Not found' });
        return;
      }

      // Route: POST /api/v1/packages/:hash/rate — rate
      if (req.method === 'POST' && pathParts[4] === 'rate') {
        const body = JSON.parse(await readBody(req));
        const user = req.headers['x-user'] as string ?? 'anonymous';
        const ok = registry.rate(pathParts[3], user, body.rating);
        sendJSON(res, ok ? 200 : 404, ok ? { message: 'Rated' } : { error: 'Not found' });
        return;
      }

      // Route: POST /api/v1/packages/:hash/fork — fork
      if (req.method === 'POST' && pathParts[4] === 'fork') {
        const original = registry.get(pathParts[3]);
        if (!original) {
          sendJSON(res, 404, { error: 'Package not found' });
          return;
        }

        const body = JSON.parse(await readBody(req));
        const forked = forkPackage(original, original.seed, body.user ?? 'anonymous', 'fork');
        const result = registry.publish(forked);

        if (result.success) {
          sendJSON(res, 201, { hash: result.hash, package: forked });
        } else {
          sendJSON(res, 400, { error: result.error });
        }
        return;
      }

      // Route: GET /api/v1/featured — featured packages
      if (req.method === 'GET' && pathParts[2] === 'featured') {
        const limit = parseInt(url.searchParams.get('limit') ?? '6');
        const featured = registry.featured(limit);
        sendJSON(res, 200, { packages: featured });
        return;
      }

      // Route: GET /api/v1/stats — registry stats
      if (req.method === 'GET' && pathParts[2] === 'stats') {
        sendJSON(res, 200, registry.stats());
        return;
      }

      // Route: DELETE /api/v1/packages/:hash — unpublish
      if (req.method === 'DELETE' && pathParts[2] === 'packages' && pathParts[3]) {
        const user = req.headers['x-user'] as string ?? '';
        const ok = registry.unpublish(pathParts[3], user);
        sendJSON(res, ok ? 200 : 403, ok ? { message: 'Unpublished' } : { error: 'Unauthorized or not found' });
        return;
      }

      // Landing page
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '')) {
        const stats = registry.stats();
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(landingPage(stats));
        return;
      }

      sendJSON(res, 404, { error: 'Not found' });
    } catch (err) {
      sendJSON(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  server.listen(port, host, () => {
    console.log(`\x1b[35m● Paradigm Marketplace API\x1b[0m`);
    console.log(`  \x1b[90mEndpoint:\x1b[0m  \x1b[1mhttp://localhost:${port}/api/v1/\x1b[0m`);
    console.log(`  \x1b[90mData:\x1b[0m      ${dataDir}`);
    console.log(`  \x1b[90mPress Ctrl+C to stop\x1b[0m\n`);
  });

  return server;
}

// ============================================================================
// HELPERS
// ============================================================================

function sendJSON(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function landingPage(stats: { totalPackages: number; totalPublishers: number; totalDownloads: number; byDomain: Record<string, number> }): string {
  const domains = Object.entries(stats.byDomain)
    .map(([d, c]) => `<span style="margin:0 8px;color:#818cf8;">${d}: ${c}</span>`)
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Paradigm Marketplace</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,monospace;background:#09090b;color:#e4e4e7;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
h1{font-size:24px;letter-spacing:4px;margin-bottom:8px;background:linear-gradient(135deg,#6366f1,#a855f7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sub{color:#52525b;font-size:13px;margin-bottom:32px}
.stats{display:flex;gap:32px;justify-content:center;margin-bottom:24px}
.stat{text-align:center}.stat .n{font-size:28px;font-weight:800;color:#a855f7}.stat .l{font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:1px}
.domains{font-size:11px;color:#52525b}
.api{margin-top:32px;font-size:11px;color:#3f3f46}
code{background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:3px;color:#818cf8}
</style></head><body>
<div>
<h1>PARADIGM MARKETPLACE</h1>
<div class="sub">Seed Registry & Discovery</div>
<div class="stats">
<div class="stat"><div class="n">${stats.totalPackages}</div><div class="l">Seeds</div></div>
<div class="stat"><div class="n">${stats.totalPublishers}</div><div class="l">Publishers</div></div>
<div class="stat"><div class="n">${stats.totalDownloads}</div><div class="l">Downloads</div></div>
</div>
<div class="domains">${domains || 'No seeds published yet'}</div>
<div class="api">
<div>API: <code>GET /api/v1/packages?q=dragon&domain=visual2d</code></div>
<div style="margin-top:4px">Publish: <code>POST /api/v1/packages</code></div>
</div>
</div>
</body></html>`;
}
