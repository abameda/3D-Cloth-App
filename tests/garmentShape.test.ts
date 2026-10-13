import test from 'node:test';
import assert from 'node:assert/strict';
import { garmentRequestSchema, garmentShapeSchema, specFromShape } from '../src/domain/studio';
import { analyzedItemSchema } from '../src/domain/aiMetadata';

test('photo shapes map to bounded GarmentCode parameters', () => {
  assert.deepEqual(specFromShape({ silhouette: 'tshirt', sleeve: 'short', length: 'hip', fit: 'loose', neckline: 'v' }), {
    preset: 'tshirt', params: { 'shirt.length': 1.5, 'shirt.width': 1.2, 'sleeve.sleeveless': false, 'sleeve.length': 0.3, 'collar.f_collar': 'VNeckHalf' } });
  assert.deepEqual(specFromShape({ silhouette: 'trousers', length: 'ankle', fit: 'slim' }), {
    preset: 'trousers', params: { 'pants.length': 0.88, 'pants.width': 1.0, 'pants.flare': 0.7 } });
  // Lengths that do not exist for a silhouette are ignored instead of producing invalid geometry.
  assert.deepEqual(specFromShape({ silhouette: 'shorts', length: 'cropped' }), { preset: 'shorts', params: {} });
});

test('every mapped spec is accepted by the studio request schema', () => {
  const spec = specFromShape({ silhouette: 'skirt', length: 'knee', fit: 'loose' });
  assert.equal(garmentRequestSchema.safeParse({ garmentId: 'g1', category: 'bottom', spec }).success, true);
});

test('photo analysis accepts an optional shape and rejects unknown shape values', () => {
  const item = { name: 'Navy tee', category: 'top', color: 'Navy', fit: 'Regular', formality: 1, warmth: 1, styles: ['Minimal'] };
  assert.equal(analyzedItemSchema.safeParse(item).success, true);
  assert.equal(analyzedItemSchema.safeParse({ ...item, shape: { silhouette: 'tshirt', sleeve: 'short' } }).success, true);
  assert.equal(garmentShapeSchema.safeParse({ silhouette: 'tshirt', sleeve: 'cap' }).success, false);
});
