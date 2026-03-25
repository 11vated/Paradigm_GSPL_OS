/**
 * server.ts — Paradigm Dev Server
 * Minimal HTTP server that serves generated artifacts with auto-refresh.
 * Zero external dependencies — uses Node built-in http module.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

export interface ServerOptions {
  dir: string;
  port?: number;
  host?: string;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.obj': 'text/plain',
  '.mid': 'audio/midi',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
};

export function startServer(options: ServerOptions): void {
  const { dir, port = 3333, host = '0.0.0.0' } = options;
  const absDir = path.resolve(dir);

  if (!fs.existsSync(absDir)) {
    fs.mkdirSync(absDir, { recursive: true });
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    let filePath = path.join(absDir, decodeURIComponent(url.pathname));

    // CORS headers for local dev
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'no-cache');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Index page
    if (url.pathname === '/') {
      serveIndex(res, absDir);
      return;
    }

    // Serve static file
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // Directory listing
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      serveDirListing(res, filePath, url.pathname);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(port, host, () => {
    console.log(`\x1b[36m● Paradigm Dev Server\x1b[0m`);
    console.log(`  \x1b[90mServing:\x1b[0m  ${absDir}`);
    console.log(`  \x1b[90mLocal:\x1b[0m    \x1b[1mhttp://localhost:${port}/\x1b[0m`);
    console.log(`  \x1b[90mPress Ctrl+C to stop\x1b[0m\n`);
  });
}

function serveIndex(res: http.ServerResponse, dir: string): void {
  const seeds = listSeeds(dir);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paradigm Dev Server</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'SF Mono', monospace; background: #0a0a0f; color: #e0e0e0; padding: 40px; }
    h1 { font-size: 20px; letter-spacing: 2px; margin-bottom: 8px;
         background: linear-gradient(135deg, #6366f1, #a855f7, #ec4899);
         -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .subtitle { color: #555; font-size: 12px; margin-bottom: 32px; }
    .seed-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .seed-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
                 border-radius: 10px; padding: 16px; transition: border-color 0.15s; }
    .seed-card:hover { border-color: rgba(99,102,241,0.3); }
    .seed-card h3 { font-size: 14px; margin-bottom: 4px; }
    .seed-card .domain { font-size: 10px; color: #818cf8; text-transform: uppercase; letter-spacing: 1px; }
    .seed-card .files { margin-top: 8px; font-size: 11px; color: #666; }
    .seed-card a { color: #818cf8; text-decoration: none; }
    .seed-card a:hover { text-decoration: underline; }
    .empty { color: #444; text-align: center; padding: 60px; font-size: 13px; }
  </style>
</head>
<body>
  <h1>PARADIGM</h1>
  <div class="subtitle">Dev Server — Generated Artifacts</div>
  ${seeds.length === 0
    ? '<div class="empty">No artifacts yet. Run <code>paradigm run your-file.gspl --output .</code> to generate.</div>'
    : `<div class="seed-grid">${seeds.map(s => `
    <div class="seed-card">
      <div class="domain">${s.domain}</div>
      <h3>${s.name}</h3>
      <div class="files">
        ${s.files.map(f => `<div><a href="${s.path}/${f}">${f}</a></div>`).join('')}
      </div>
    </div>`).join('')}</div>`}
</body>
</html>`;

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

function serveDirListing(res: http.ServerResponse, dir: string, urlPath: string): void {
  const entries = fs.readdirSync(dir);
  const links = entries.map(e => {
    const stat = fs.statSync(path.join(dir, e));
    const suffix = stat.isDirectory() ? '/' : '';
    return `<div><a href="${urlPath}${e}${suffix}">${e}${suffix}</a></div>`;
  });

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${urlPath}</title>
<style>body{font-family:monospace;background:#0a0a0f;color:#e0e0e0;padding:32px;}
a{color:#818cf8;text-decoration:none;line-height:1.8;}a:hover{text-decoration:underline;}</style>
</head><body><h2>${urlPath}</h2>${links.join('')}
<div style="margin-top:16px;"><a href="/">&larr; Home</a></div></body></html>`;

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

interface SeedInfo {
  name: string;
  domain: string;
  path: string;
  files: string[];
}

function listSeeds(dir: string): SeedInfo[] {
  const seeds: SeedInfo[] = [];

  if (!fs.existsSync(dir)) return seeds;

  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const entryPath = path.join(dir, entry);
    if (!fs.statSync(entryPath).isDirectory()) continue;

    const files = fs.readdirSync(entryPath).filter(f => !f.startsWith('.'));

    // Try to detect domain from JSON files
    let domain = 'unknown';
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(entryPath, file), 'utf-8'));
          if (content.$domain) {
            domain = content.$domain;
            break;
          }
        } catch { /* skip */ }
      }
      if (file.endsWith('.svg')) domain = 'visual2d';
      if (file.endsWith('.html')) domain = 'ui';
    }

    seeds.push({
      name: entry,
      domain,
      path: `/${entry}`,
      files,
    });
  }

  return seeds;
}
