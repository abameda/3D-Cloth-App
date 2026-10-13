import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readGlb } from '../src/domain/glb';

function load(path: string) {
  const bytes = readFileSync(path);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function withJson(buffer: ArrayBuffer, change: (json: any) => void) {
  const view = new DataView(buffer), length = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length))); change(json);
  let text = JSON.stringify(json); while (text.length % 4) text += ' ';
  const binary = new Uint8Array(buffer, 20 + length);
  const out = new Uint8Array(20 + text.length + binary.length), outView = new DataView(out.buffer);
  out.set(new Uint8Array(buffer, 0, 20)); outView.setUint32(12, text.length, true);
  out.set(new TextEncoder().encode(text), 20); out.set(binary, 20 + text.length); outView.setUint32(8, out.length, true);
  return out.buffer;
}

test('bundled avatar kit assets are self-contained GLB 2.0 files', () => {
  for (const name of ['body', 'top', 'bottom']) {
    const json = readGlb(load(`assets/avatar/kit/${name}.glb`));
    assert.ok(json.nodes?.length, `${name} has nodes`);
  }
});

test('kit garments declare their category and body coverage', () => {
  const json = readGlb(load('assets/avatar/kit/top.glb'));
  const thread = json.nodes?.find(node => node.extras?.thread)?.extras?.thread as { category: string; coversBodyTriangles: string };
  assert.equal(thread.category, 'top');
  assert.ok(thread.coversBodyTriangles.length > 100);
});

test('readGlb rejects truncated files and external resources', () => {
  const body = load('assets/avatar/kit/body.glb');
  assert.throws(() => readGlb(body.slice(0, 24)), /empty or too large|not a valid/);
  assert.throws(() => readGlb(withJson(body, json => { json.buffers[0].uri = 'https://example.com/a.bin'; })), /embed its own data/);
});
