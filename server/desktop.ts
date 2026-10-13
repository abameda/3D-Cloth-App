import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Thread Studio for Windows: the desktop fitting room, served by the local engine to this computer only.
 * The page is static (no personal data); it reads kits through the same authenticated studio API as the
 * phone, plus read-only access to command-line factory outputs in pipeline/output ("samples").
 */
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const NAME = /^[A-Za-z0-9_-]{1,80}$/;

export function createDesktop(options: { projectRoot: string }) {
  const ui = resolve(options.projectRoot, 'desktop');
  const three = resolve(options.projectRoot, 'node_modules', 'three');
  const samples = resolve(options.projectRoot, 'pipeline', 'output');
  /** This computer: loopback, or its own LAN address when the engine serves the phone over HTTPS. */
  const loopback = (req: IncomingMessage) => LOOPBACK.has(req.socket.remoteAddress ?? '') || req.socket.remoteAddress === req.socket.localAddress;

  function send(res: ServerResponse, status: number, body: string | Buffer, type: string, scriptHash = '') {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': `default-src 'self'; img-src 'self' blob: data:; connect-src 'self' blob: data:; style-src 'self'; script-src 'self'${scriptHash}; frame-ancestors 'none'` });
    res.end(body);
  }

  /** The studio page itself calls the engine API; only its own loopback origin is accepted for that. */
  function trustedOrigin(req: IncomingMessage): boolean {
    // Only IP-literal/localhost origins: a hostile site re-pointing its own DNS name at this computer cannot pass.
    const port = req.socket.localPort, local = (req.socket.localAddress ?? '').replace(/^::ffff:/, '');
    const hosts = ['127.0.0.1', 'localhost', local.includes(':') ? `[${local}]` : local].map(host => `${host}:${port}`);
    return loopback(req) && hosts.flatMap(host => [`http://${host}`, `https://${host}`]).includes(req.headers.origin ?? '');
  }

  /** Static studio files (GET /studio/...). Returns true when the request was handled. */
  async function serve(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const path = (req.url ?? '').split('?')[0];
    if (path !== '/studio' && !path.startsWith('/studio/')) return false;
    if (req.method !== 'GET' || !loopback(req)) { send(res, 404, 'Not found', 'text/plain'); return true; }
    let file: string | undefined, body: Buffer | string | undefined;
    if (path === '/studio' || path === '/studio/') file = join(ui, 'index.html');
    else if (/^\/studio\/[a-z-]{1,40}\.(js|css)$/.test(path)) file = join(ui, path.slice('/studio/'.length));
    else if (/^\/studio\/vendor\/three\/(build\/three\.(module|core)\.js|examples\/jsm\/[A-Za-z0-9_/]{1,120}\.js)$/.test(path) && !path.includes('..'))
      file = join(three, path.slice('/studio/vendor/three/'.length));
    else if (path === '/studio/lib/kitDressing.js') {
      // The phone's dressing rules (src/domain/kitDressing.ts, compiled by the engine's build) as an ES module.
      const compiled = resolve(options.projectRoot, '.node-build', 'src', 'domain', 'kitDressing.js');
      if (existsSync(compiled)) body = `const exports = {};\n(function (exports) {\n${await readFile(compiled, 'utf8')}\n})(exports);\nexport const { kitLayer, wornItems, tucked, visibleTriangles } = exports;\n`;
      file = compiled;
    }
    if (!file || !existsSync(file)) { send(res, 404, 'Not found', 'text/plain'); return true; }
    const extension = file.slice(file.lastIndexOf('.'));
    body ??= await readFile(file);
    // The page's inline import map is allowed by its hash; no other inline script runs.
    const importMap = extension === '.html' ? /<script type="importmap">([\s\S]*?)<\/script>/.exec(body.toString()) : null;
    const hash = importMap ? ` 'sha256-${createHash('sha256').update(importMap[1]).digest('base64')}'` : '';
    send(res, 200, body, TYPES[extension] ?? 'application/octet-stream', hash);
    return true;
  }

  /** Authenticated read-only API for command-line factory outputs. Returns true when handled. */
  async function handle(req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean> {
    if (!path.startsWith('/v1/desktop/')) return false;
    const reply = (status: number, value: unknown) => send(res, status, JSON.stringify(value), 'application/json');
    if (!loopback(req) || req.method !== 'GET') { reply(404, { error: 'Not available.' }); return true; }
    if (path === '/v1/desktop/samples') {
      const kits = [];
      for (const entry of existsSync(samples) ? await readdir(samples, { withFileTypes: true }) : []) {
        if (!entry.isDirectory() || !NAME.test(entry.name) || !existsSync(join(samples, entry.name, 'body.glb'))) continue;
        const files = (await readdir(join(samples, entry.name))).filter(name => name.endsWith('.glb') && NAME.test(name.slice(0, -4)));
        kits.push({ name: entry.name, files, updated: (await stat(join(samples, entry.name, 'body.glb'))).mtimeMs });
      }
      reply(200, { samples: kits.sort((a, b) => b.updated - a.updated) });
      return true;
    }
    const match = /^\/v1\/desktop\/samples\/([^/]+)\/([^/]+)\.glb$/.exec(path);
    if (match && NAME.test(match[1]) && NAME.test(match[2]) && existsSync(join(samples, match[1], `${match[2]}.glb`))) {
      const bytes = await readFile(join(samples, match[1], `${match[2]}.glb`));
      res.writeHead(200, { 'Content-Type': 'model/gltf-binary', 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(bytes);
      return true;
    }
    reply(404, { error: 'Not found.' });
    return true;
  }

  return { serve, handle, trustedOrigin };
}
export type Desktop = ReturnType<typeof createDesktop>;
