import type { WardrobeState } from './types';
export function referencedPhotoUris(state: WardrobeState): Set<string> { return new Set([state.profile.imageUri, ...state.garments.map(g => g.imageUri)].filter((uri): uri is string => !!uri)); }
export function removedPhotoUris(previous: WardrobeState, committed: WardrobeState, pending: WardrobeState): string[] {
  const keep = new Set([...referencedPhotoUris(committed), ...referencedPhotoUris(pending)]);
  return [...referencedPhotoUris(previous)].filter(uri => !keep.has(uri));
}
export function unsubmittedPhotoUris(imported: string[], submitted: Set<string>): string[] { return imported.filter(uri => !submitted.has(uri)); }
