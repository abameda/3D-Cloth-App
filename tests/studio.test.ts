import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createStudio, type StudioRunner } from '../server/studio';
import type { KitManifest } from '../src/domain/studio';

function fakeRunner(calls: string[]): StudioRunner {
  let version = 0;
  return {
    async body(_profile, outDir) {
      calls.push('body');
      await writeFile(join(outDir, 'body.glb'), `body-${++version}`);
      await writeFile(join(outDir, 'skeleton.npz'), 'rig');
    },
    async garment({ outFile, category }, stage) {
      calls.push(`garment:${category}`); stage('draping');
      await writeFile(outFile, `garment-${category}-${version}`);
    },
  };
}

async function harness() {
  const root = await mkdtemp(join(tmpdir(), 'thread-studio-'));
  const calls: string[] = [];
  const studio = createStudio({ root, runner: fakeRunner(calls) });
  const server = createServer((req, res) => void studio.handle(req, res, 'owner-a', (req.url ?? '').split('?')[0]));
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = (path: string, method = 'GET', body?: unknown) => fetch(base + path, {
    method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const kit = async () => (await (await call('/v1/studio/kit')).json()) as KitManifest;
  const settled = async () => { for (let i = 0; i < 200; i++) { const m = await kit(); if (m.jobs.every(j => j.status === 'done' || j.status === 'failed')) return m; await new Promise(r => setTimeout(r, 10)); } throw Error('jobs never settled'); };
  return { call, kit, settled, calls, close: async () => { studio.close(); server.close(); await rm(root, { recursive: true, force: true }); } };
}

const profile = { sex: 'male', age: 30, height_cm: 178, chest_cm: 100, waist_cm: 84, hips_cm: 98 };

test('measurements build a body, garments drape on it, and the kit lists both', async () => {
  const h = await harness();
  try {
    assert.equal((await h.call('/v1/studio/body', 'PUT', profile)).status, 202);
    let manifest = await h.settled();
    assert.equal(manifest.body?.profile.height_cm, 178);
    const garment = await h.call('/v1/studio/garments/shirt%201', 'PUT', { garmentId: 'shirt 1', category: 'top', colorHex: '#223344' });
    assert.equal(garment.status, 202);
    manifest = await h.settled();
    assert.deepEqual(manifest.garments.map(g => [g.garmentId, g.category, g.bodySha256 === manifest.body?.sha256]), [['shirt 1', 'top', true]]);
    assert.equal(await (await h.call('/v1/studio/assets/garments/shirt%201')).text(), 'garment-top-1');
    assert.equal(await (await h.call('/v1/studio/assets/body')).text(), 'body-1');
  } finally { await h.close(); }
});

test('a new body re-drapes every garment so no piece is shown on a stale body', async () => {
  const h = await harness();
  try {
    await h.call('/v1/studio/body', 'PUT', profile); await h.settled();
    await h.call('/v1/studio/garments/jeans', 'PUT', { garmentId: 'jeans', category: 'bottom' }); await h.settled();
    await h.call('/v1/studio/body', 'PUT', { ...profile, waist_cm: 90 });
    const manifest = await h.settled();
    assert.deepEqual(h.calls, ['body', 'garment:bottom', 'body', 'garment:bottom']);
    assert.equal(manifest.garments[0].bodySha256, manifest.body?.sha256);
    assert.equal(await (await h.call('/v1/studio/assets/garments/jeans')).text(), 'garment-bottom-2');
  } finally { await h.close(); }
});

test('invalid measurements, undrapeable categories and mismatched ids are rejected', async () => {
  const h = await harness();
  try {
    assert.equal((await h.call('/v1/studio/body', 'PUT', { ...profile, height_cm: 400 })).status, 400);
    assert.equal((await h.call('/v1/studio/garments/x', 'PUT', { garmentId: 'x', category: 'shoes' })).status, 400);
    assert.equal((await h.call('/v1/studio/garments/x', 'PUT', { garmentId: 'y', category: 'top' })).status, 400);
    assert.equal((await h.call('/v1/studio/garments/x', 'PUT', { garmentId: 'x', category: 'top', spec: { preset: 'tshirt', params: { '../etc': 1 } } })).status, 400);
  } finally { await h.close(); }
});

test('garments need a body first, and deleting the studio erases everything', async () => {
  const h = await harness();
  try {
    await h.call('/v1/studio/garments/tee', 'PUT', { garmentId: 'tee', category: 'top' });
    const manifest = await h.settled();
    assert.match(manifest.jobs[0].error ?? '', /measurements first/);
    await h.call('/v1/studio/body', 'PUT', profile); await h.settled();
    assert.equal((await h.call('/v1/studio', 'DELETE')).status, 200);
    const empty = await h.kit();
    assert.equal(empty.body, null); assert.deepEqual(empty.garments, []);
  } finally { await h.close(); }
});
