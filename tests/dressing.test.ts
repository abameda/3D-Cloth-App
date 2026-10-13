import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectDressingPiece } from '../src/domain/dressing';
import type { Garment } from '../src/domain/types';

const piece = (id: string, category: Garment['category'], source: Garment['source'] = 'owned', available = true): Garment => ({ id, category, source, available, name: id, color: 'White', fit: 'Regular', formality: 1, warmth: 1, styles: [], favorite: false, createdAt: '2026-10-12T00:00:00Z' });
const garments = [piece('top','top'),piece('bottom','bottom'),piece('dress','onepiece'),piece('shoe','shoes'),piece('sample','top','example'),piece('dirty','top','owned',false)];
test('selecting a piece preserves other slots and immutable input', () => {
  const outfit = { bottom:'bottom', shoes:'shoe' };
  assert.deepEqual(selectDressingPiece({garments,dataset:'owned',outfit,locks:{}},'top').outfit,{...outfit,top:'top'});
  assert.deepEqual(outfit,{bottom:'bottom',shoes:'shoe'});
});
test('selection rejects missing, another dataset and unavailable garments', () => {
  for (const id of ['missing','sample','dirty']) assert.deepEqual(selectDressingPiece({garments,dataset:'owned',outfit:{shoes:'shoe'},locks:{}},id).outfit,{shoes:'shoe'});
});
test('one-piece replaces unlocked separates and keeps shoes', () => {
  assert.deepEqual(selectDressingPiece({garments,dataset:'owned',outfit:{top:'top',bottom:'bottom',shoes:'shoe'},locks:{}},'dress').outfit,{onepiece:'dress',shoes:'shoe'});
  assert.deepEqual(selectDressingPiece({garments,dataset:'owned',outfit:{onepiece:'dress',shoes:'shoe'},locks:{}},'top').outfit,{top:'top',shoes:'shoe'});
});
test('direct selection never removes a locked conflicting slot', () => {
  const input = {garments,dataset:'owned' as const,outfit:{onepiece:'dress',shoes:'shoe'},locks:{onepiece:true}};
  const result=selectDressingPiece(input,'top');
  assert.deepEqual(result.outfit,input.outfit); assert.match(result.notice!,/unlock/i);
  assert.match(selectDressingPiece({garments,dataset:'owned',outfit:{top:'top'},locks:{top:true}},'dress').notice!,/unlock/i);
});
