import test from 'node:test';
import assert from 'node:assert/strict';
import { readConnection, saveConnection } from '../src/domain/connection';
import { removedPhotoUris, unsubmittedPhotoUris } from '../src/domain/photos';
import { decodeState } from '../src/domain/state';

test('connection credentials remain an atomic pair when a service switch fails', async () => {
  let stored: string | null = null; let fail = false;
  const storage = { get: async () => stored, set: async (value: string) => { if (fail) throw new Error('full'); stored = value; }, remove: async () => { stored = null; } };
  await saveConnection(storage, 'https://first.example', 'first-service-token-123456789');
  fail = true;
  await assert.rejects(saveConnection(storage, 'https://second.example', 'second-service-token-123456789'));
  assert.deepEqual(await readConnection(storage), { url: 'https://first.example', token: 'first-service-token-123456789' });
});
test('connection validates origins, transport and tokens before storage', async () => {
  let writes = 0; const storage = { get: async () => null, set: async () => { writes++; }, remove: async () => {} };
  for (const url of ['http://remote.example', 'https://user:pass@host.example', 'https://host.example/other', 'https://host.example?key=secret']) await assert.rejects(saveConnection(storage, url, 'long-service-token-123456789'));
  await assert.rejects(saveConnection(storage, 'https://host.example', 'token with spaces long enough'));
  assert.equal(writes, 0);
  await saveConnection(storage, 'http://192.168.50.2:8787', 'long-service-token-123456789', true);
  assert.equal(writes, 1);
});
test('photo cleanup preserves files referenced by committed or pending state', () => {
  const previous = decodeState(null); previous.profile.imageUri = 'file:///old.jpg';
  const next = decodeState(null); next.profile.imageUri = 'file:///new.jpg';
  assert.deepEqual(removedPhotoUris(previous, next, next), ['file:///old.jpg']);
  assert.deepEqual(removedPhotoUris(previous, next, previous), []);
  assert.deepEqual(removedPhotoUris(previous, previous, next), []);
});
test('closing profile after a failed replacement save preserves all submitted portraits', () => {
  const imported = ['file:///portrait-a.jpg', 'file:///portrait-b.jpg', 'file:///unused-draft.jpg'];
  const submitted = new Set([imported[0], imported[1]]);
  assert.deepEqual(unsubmittedPhotoUris(imported, submitted), ['file:///unused-draft.jpg']);
  const persisted = decodeState(null); persisted.profile.imageUri = imported[0];
  const pending = decodeState(null); pending.profile.imageUri = imported[1];
  assert.deepEqual(removedPhotoUris(persisted, persisted, pending), []);
  assert.deepEqual(removedPhotoUris(persisted, pending, pending), [imported[0]]);
});
