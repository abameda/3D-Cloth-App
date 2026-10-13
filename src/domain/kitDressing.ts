import type { Category } from './types';

/**
 * Dressing rules for the personal avatar kit (a skinned body plus garments draped on that exact body).
 * Pure, so the phone (src/ui/avatarKit.ts) and the Windows studio (desktop/) make identical decisions.
 */
export type KitCategory = Category | 'hair' | 'base_top' | 'base_bottom';
/** colors: wardrobe colours a stand-in represents (e.g. white trainers for White shoes). */
export interface KitItem { id: string; category: KitCategory; garmentId?: string; colors?: string[] }
export interface KitPiece { category: Category; color: string; garmentId?: string }

/** Cloth layer order: inner layers render first and tuck under outer ones. Base layers are innermost. */
export const kitLayer: Partial<Record<KitCategory, number>> = { base_top: -1, base_bottom: -1, bottom: 0, onepiece: 0, top: 1, outerwear: 2 };

/**
 * The kit items an outfit wears, each with a tint for colour stand-ins (undefined: the piece's own look).
 * A piece's own fitted model wins over a category stand-in; hair is always worn; the neutral base layer
 * fills an empty bottom (and, when the kit has one, an empty top).
 */
export function wornItems<T extends KitItem>(items: readonly T[], pieces: readonly KitPiece[], palette: Record<string, string>): Map<T, string | undefined> {
  const worn = new Map<T, string | undefined>();
  for (const piece of pieces) {
    const own = items.find(item => item.garmentId && item.garmentId === piece.garmentId);
    const standIns = items.filter(item => !item.garmentId && item.category === piece.category);
    const chosen = own ?? standIns.find(item => item.colors?.includes(piece.color)) ?? standIns[0];
    if (chosen) worn.set(chosen, own ? undefined : palette[piece.color] ?? palette.Unknown);
  }
  const wearing = (...categories: KitCategory[]) => [...worn.keys()].some(item => categories.includes(item.category));
  const fill = (base: KitCategory, ...covering: KitCategory[]) => {
    const item = items.find(i => i.category === base);
    if (item && !wearing(...covering)) worn.set(item, undefined);
  };
  fill('base_bottom', 'bottom', 'onepiece');
  fill('base_top', 'top', 'onepiece', 'outerwear');
  for (const item of items) if (item.category === 'hair') worn.set(item, undefined);
  return worn;
}

/** Whether an inner layer should use its precomputed tuck morph (pulled snug) under the worn categories. */
export function tucked(category: KitCategory, worn: readonly KitCategory[]): boolean {
  const own = kitLayer[category] ?? 1;
  return worn.some(other => (kitLayer[other] ?? -Infinity) > own);
}

/** A garment's record of the body triangles it hides (extras.thread). */
export interface CoverageMask { bits: Uint8Array; bodyTriangles?: number }

/**
 * The body's triangle index list with skin under worn cloth removed. A mask made for a different body
 * build (its triangle count differs) would punch holes in the wrong places, so it is skipped and counted.
 */
export function visibleTriangles(index: ArrayLike<number>, masks: readonly CoverageMask[]): { kept: number[]; stale: number } {
  const triangles = Math.floor(index.length / 3);
  const valid = masks.filter(mask => mask.bodyTriangles === triangles && mask.bits.length === Math.ceil(triangles / 8));
  const kept: number[] = [];
  for (let t = 0; t < triangles; t++) {
    if (valid.some(mask => mask.bits[t >> 3] & (0x80 >> (t & 7)))) continue;
    kept.push(index[3 * t], index[3 * t + 1], index[3 * t + 2]);
  }
  return { kept, stale: masks.length - valid.length };
}
