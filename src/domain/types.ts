export const categories = ['top', 'bottom', 'shoes', 'outerwear', 'accessories', 'onepiece', 'bag', 'eyewear'] as const;
export type Category = typeof categories[number];
export const categoryLabels: Record<Category, string> = { top: 'Tops', bottom: 'Bottoms', shoes: 'Shoes', outerwear: 'Layers', accessories: 'Accessories', onepiece: 'One-piece', bag: 'Bags', eyewear: 'Eyewear' };
export const colors = ['White', 'Black', 'Grey', 'Navy', 'Blue', 'Green', 'Beige', 'Brown', 'Red', 'Pink', 'Yellow', 'Purple', 'Unknown'] as const;
export type Color = typeof colors[number];
export const styles = ['Minimal', 'Relaxed', 'Classic', 'Streetwear', 'Sporty', 'Expressive'] as const;
export type PersonalStyle = typeof styles[number];
export type Dataset = 'owned' | 'example';
export interface Garment {
  id: string; name: string; category: Category; color: Color;
  fit: 'Regular' | 'Relaxed' | 'Slim'; formality: 1 | 2 | 3; warmth: 1 | 2 | 3;
  imageUri?: string; available: boolean; favorite: boolean;
  styles: PersonalStyle[]; source: Dataset; createdAt: string;
}
export type Outfit = Partial<Record<Category, string>>;
export type Locks = Partial<Record<Category, boolean>>;
export const occasions = ['Everyday', 'University', 'Work', 'Dinner', 'Date', 'Event', 'Travel', 'Friends', 'Surprise me'] as const;
export type Occasion = typeof occasions[number];
export interface StyleContext { weatherMode?:'manual'|'forecast'; forecast?:import('./weather').WeatherSnapshot; outfitMode?: 'separates' | 'onepiece'; occasion: Occasion; weather: 'Warm' | 'Mild' | 'Cold'; formality: 1 | 2 | 3; includeLayer: boolean; includeAccessory: boolean; prompt: string; }
export interface Feedback { reason?: 'color' | 'fit' | 'occasion' | 'combination'; signature: string; outfit: Outfit; vote: 'like' | 'dislike'; createdAt: string; source: Dataset; }
export interface SavedLook { id: string; name: string; outfit: Outfit; createdAt: string; source: Dataset; }
export interface Wear { id: string; outfit: Outfit; names: Partial<Record<Category, string>>; wornAt: string; source: Dataset; }
export interface Profile { weatherCity?:import('./weather').WeatherCity; dailyAi?:boolean; avatarMode?: 'real' | 'custom'; avatar?: import('./appearance').AvatarAppearance; preferredFits?: Garment['fit'][]; avoidColors?: Color[]; name: string; imageUri?: string; styles: PersonalStyle[]; }
export interface WardrobeState {
  version: 2; profile: Profile; garments: Garment[]; dataset: Dataset;
  outfits: Record<Dataset, Outfit>; locks: Record<Dataset, Locks>;
  context: StyleContext; saved: SavedLook[]; history: Wear[]; feedback: Feedback[];
}
export type WardrobeAction =
  | {type:'garments/import';garments:Garment[]}
  | { type: 'garment/upsert'; garment: Garment }
  | { type: 'garment/delete'; id: string }
  | { type: 'dataset/set'; dataset: Dataset }
  | { type: 'outfit/set'; outfit: Outfit }
  | { type: 'lock/toggle'; category: Category }
  | { type: 'context/set'; context: StyleContext }
  | { type: 'profile/set'; profile: Profile }
  | { type: 'look/save'; look: SavedLook }
  | { type: 'look/delete'; id: string }
  | { type: 'wear/add'; wear: Wear }
  | { type: 'wear/delete'; id: string }
  | { type: 'feedback/add'; feedback: Feedback }
  | { type: 'feedback/reset' };
export interface Suggestion { outfit: Outfit; reasons: string[]; notices: string[]; changed: boolean; }
export interface StylistInput {
  garments: Garment[]; current: Outfit; locks: Locks; context: StyleContext;
  feedback: Feedback[]; history: Wear[]; preferredStyles: PersonalStyle[];
  preferredFits?: Garment['fit'][]; avoidColors?: Color[];
  random?: () => number; now?: Date;
}
