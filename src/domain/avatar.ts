import { categories, type Category, type Color, type Dataset, type Garment, type Outfit } from './types';

export const avatarCategories = categories;
export type AvatarCategory = typeof avatarCategories[number];
export interface AvatarPiece { category: AvatarCategory; color: Color; name: string; fit?: Garment['fit'] }
export interface AvatarOutfit { sample: boolean; pieces: AvatarPiece[]; notices: string[] }

/** Rendering never repairs or changes the user's outfit. Unsupported items remain explicit. */
export function resolveAvatarOutfit(outfit: Outfit, garments: readonly Garment[], dataset: Dataset): AvatarOutfit {
  if (!Object.values(outfit).some(Boolean)) return {
    sample: true,
    pieces: [
      { category:'top',color:'White',name:'Sample crew-neck' },
      { category:'bottom',color:'Navy',name:'Sample trousers' },
      { category:'shoes',color:'White',name:'Sample sneakers' },
    ], notices: [],
  };
  const pieces: AvatarPiece[] = [], notices: string[] = [];
  const valid = (category: Category) => garments.find(g => g.id === outfit[category] && g.category === category && g.source === dataset && g.available);
  const onepiece = valid('onepiece');
  for (const category of categories) {
    if (!outfit[category]) continue;
    if (onepiece && (category === 'top' || category === 'bottom')) continue;
    const garment = valid(category);
    if (!garment) { notices.push(`The selected ${category} is missing or unavailable and is not shown.`); continue; }
    if (!(avatarCategories as readonly string[]).includes(category)) {
      notices.push(`${garment.name}: no 3D sample shape yet. View it on your outfit board.`);
      continue;
    }
    pieces.push({ category:category as AvatarCategory, color:garment.color, name:garment.name, fit:garment.fit });
  }
  return { sample:false, pieces, notices };
}
