import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAvatarOutfit } from '../src/domain/avatar';
import type { Garment } from '../src/domain/types';
const top: Garment = { id:'shirt', name:'My shirt', category:'top', color:'Blue', fit:'Regular', formality:1, warmth:1, available:true, favorite:false, styles:[], source:'owned', createdAt:'2026-10-04T00:00:00Z' };

test('empty selection explicitly uses a sample outfit', () => {
  const result = resolveAvatarOutfit({}, [], 'owned');
  assert.equal(result.sample, true);
  assert.deepEqual(result.pieces.map(p => p.category), ['top','bottom','shoes']);
});
test('maps selected colors without mutating clothes or selection', () => {
  const outfit = Object.freeze({top:top.id});
  const result = resolveAvatarOutfit(outfit, [Object.freeze(top)], 'owned');
  assert.equal(result.sample, false);
  assert.equal(result.pieces[0].color, 'Blue');
  assert.equal(result.pieces[0].name, 'My shirt');
});
test('other datasets, missing IDs and unavailable garments do not dress the character', () => {
  for (const garments of [[], [{...top,source:'example' as const}], [{...top,available:false}]]) {
    const result=resolveAvatarOutfit({top:top.id},garments,'owned');
    assert.equal(result.sample,false);
    assert.equal(result.pieces.length,0);
    assert.equal(result.notices.length,1);
  }
});
test('category mismatch is rejected', () => {
  assert.equal(resolveAvatarOutfit({shoes:top.id},[top],'owned').pieces.length,0);
});
test('bags, eyewear and accessories all map to 3D without triggering samples', () => {
  const bag={...top,id:'bag',category:'bag' as const,name:'My tote'};
  const result=resolveAvatarOutfit({bag:bag.id},[bag],'owned');
  assert.equal(result.sample,false);
  assert.equal(result.pieces.length,1);
  assert.equal(result.pieces[0].name,'My tote');
  for (const category of ['bag','eyewear','accessories'] as const) {
    const piece={...top,id:category,category};
    assert.equal(resolveAvatarOutfit({[category]:category},[piece],'owned').pieces[0].category,category);
  }
});
test('a valid one-piece takes precedence over separates but preserves layers', () => {
  const dress={...top,id:'dress',category:'onepiece' as const};
  const jacket={...top,id:'jacket',category:'outerwear' as const};
  const result=resolveAvatarOutfit({top:top.id,onepiece:dress.id,outerwear:jacket.id},[top,dress,jacket],'owned');
  assert.deepEqual(result.pieces.map(p=>p.category),['outerwear','onepiece']);
});
