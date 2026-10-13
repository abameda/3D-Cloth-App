import { categoryLabels, type Dataset, type Garment, type Locks, type Outfit } from './types';

/** Direct selection shares the stylist's slot/lock invariants, without shuffling. */
export function selectDressingPiece(input: { garments: Garment[]; dataset: Dataset; outfit: Outfit; locks: Locks }, id: string): { outfit: Outfit; notice?: string } {
  const outfit = { ...input.outfit };
  const garment = input.garments.find(g => g.id === id && g.source === input.dataset && g.available);
  if (!garment) return { outfit, notice: 'This piece is unavailable. Choose another or mark it ready to wear.' };
  const category = garment.category;
  const conflicts = category === 'onepiece' ? ['top','bottom'] as const : category === 'top' || category === 'bottom' ? ['onepiece'] as const : [];
  const blocked = conflicts.find(c => outfit[c] && input.locks[c]);
  if (blocked || (input.locks[category] && outfit[category] !== id)) return { outfit, notice: `Unlock ${categoryLabels[blocked ?? category].toLowerCase()} to change this outfit.` };
  for (const conflict of conflicts) delete outfit[conflict];
  outfit[category] = id;
  return { outfit };
}
