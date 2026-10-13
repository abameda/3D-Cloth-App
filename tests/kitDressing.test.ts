import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tucked, visibleTriangles, wornItems, type KitItem } from '../src/domain/kitDressing';

const palette = { White: '#fff', Navy: '#123', Unknown: '#999' };
const items: KitItem[] = [
  { id: 'own-tee', category: 'top', garmentId: 'tee' },
  { id: 'stand-top', category: 'top' },
  { id: 'stand-bottom', category: 'bottom' },
  { id: 'shoes-white', category: 'shoes', colors: ['White'] },
  { id: 'shoes-navy', category: 'shoes', colors: ['Navy'] },
  { id: 'hair', category: 'hair' },
  { id: 'base_top', category: 'base_top' },
  { id: 'base_bottom', category: 'base_bottom' },
];
const ids = (worn: Map<KitItem, string | undefined>) => [...worn.keys()].map(item => item.id).sort();

test('own fitted pieces win over stand-ins, stand-ins take the wardrobe colour', () => {
  const worn = wornItems(items, [{ category: 'top', color: 'Navy', garmentId: 'tee' }, { category: 'shoes', color: 'Navy' }, { category: 'bottom', color: 'Navy' }], palette);
  assert.deepEqual(ids(worn), ['hair', 'own-tee', 'shoes-navy', 'stand-bottom']);
  assert.equal(worn.get(items[0]), undefined);
  assert.equal(worn.get(items[2]), '#123');
});

test('the base layer fills only empty slots', () => {
  assert.deepEqual(ids(wornItems(items, [], palette)), ['base_bottom', 'base_top', 'hair']);
  assert.deepEqual(ids(wornItems(items, [{ category: 'top', color: 'White' }], palette)), ['base_bottom', 'hair', 'stand-top']);
  assert.deepEqual(ids(wornItems(items, [{ category: 'bottom', color: 'White' }], palette)), ['base_top', 'hair', 'stand-bottom']);
  assert.deepEqual(ids(wornItems(items, [{ category: 'outerwear', color: 'White' }], palette)), ['base_bottom', 'base_top', 'hair']);  // no outerwear model in the kit: the bra stays
});

test('inner layers tuck only under a higher layer', () => {
  assert.equal(tucked('bottom', ['bottom', 'top']), true);
  assert.equal(tucked('top', ['bottom', 'top']), false);
  assert.equal(tucked('top', ['top', 'outerwear']), true);
  assert.equal(tucked('bottom', ['bottom', 'shoes', 'hair']), false);
});

test('coverage masks hide covered skin and skip masks from another body build', () => {
  const index = [0, 1, 2, 2, 3, 0, 3, 4, 0];  // three triangles
  const covers = { bits: new Uint8Array([0b01000000]), bodyTriangles: 3 };
  assert.deepEqual(visibleTriangles(index, [covers]), { kept: [0, 1, 2, 3, 4, 0], stale: 0 });
  const stale = { bits: new Uint8Array([0b11100000]), bodyTriangles: 5 };
  assert.deepEqual(visibleTriangles(index, [covers, stale]), { kept: [0, 1, 2, 3, 4, 0], stale: 1 });
});
