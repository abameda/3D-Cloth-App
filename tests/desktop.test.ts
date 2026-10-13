import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createDesktop } from '../server/desktop';

const desktop = createDesktop({ projectRoot: process.cwd() });
const request = (remote: string, origin?: string, local = '127.0.0.1') =>
  ({ socket: { remoteAddress: remote, localAddress: local, localPort: 8790 }, headers: origin ? { origin } : {} }) as unknown as IncomingMessage;

test('only the studio page served to this computer may call the engine from a browser', () => {
  assert.equal(desktop.trustedOrigin(request('127.0.0.1', 'http://127.0.0.1:8790')), true);
  assert.equal(desktop.trustedOrigin(request('::1', 'http://localhost:8790')), true);
  assert.equal(desktop.trustedOrigin(request('192.168.1.20', 'https://192.168.1.20:8790', '192.168.1.20')), true);  // own LAN address over HTTPS
  assert.equal(desktop.trustedOrigin(request('127.0.0.1', 'http://evil.example:8790')), false);  // DNS rebinding
  assert.equal(desktop.trustedOrigin(request('127.0.0.1', 'http://127.0.0.1:9999')), false);
  assert.equal(desktop.trustedOrigin(request('192.168.1.30', 'http://127.0.0.1:8790', '192.168.1.20')), false);  // another device
});

test('the studio serves its page, three.js and the shared dressing rules, nothing else', async () => {
  const server = createServer(async (req, res) => { if (!await desktop.serve(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const page = await fetch(`${base}/studio/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy') ?? '', /script-src 'self' 'sha256-[A-Za-z0-9+/=]+'/);
    const rules = await (await fetch(`${base}/studio/lib/kitDressing.js`)).text();
    assert.match(rules, /export const \{ kitLayer, wornItems, tucked, visibleTriangles \} = exports;/);
    assert.equal((await fetch(`${base}/studio/vendor/three/build/three.module.js`)).status, 200);
    for (const path of ['/studio/vendor/three/package.json', '/studio/%2e%2e/package.json', '/studio/vendor/three/examples/jsm/%2e%2e/%2e%2e/%2e%2e/package.json', '/studio/../.env.local-reconstruction'])
      assert.equal((await fetch(`${base}${path}`)).status, 404, path);
  } finally { server.close(); }
});
