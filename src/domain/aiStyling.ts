import { z } from 'zod';
import { contextSchema, itemSchema } from './aiMetadata';
import { categories, styles, colors, type Dataset, type Outfit, type StylistInput } from './types';
import { suggestOutfit } from './stylist';
import { isWeatherFresh, weatherSnapshotSchema } from './weather';

const id=z.string().min(1).max(200);
export const stylingOutfitSchema=z.object({top:id.optional(),bottom:id.optional(),shoes:id.optional(),outerwear:id.optional(),accessories:id.optional(),onepiece:id.optional(),bag:id.optional(),eyewear:id.optional()}).strict();
const bool=z.boolean().optional();
const locksSchema=z.object({top:bool,bottom:bool,shoes:bool,outerwear:bool,accessories:bool,onepiece:bool,bag:bool,eyewear:bool}).strict();
export const stylingResultSchema=z.object({outfit:stylingOutfitSchema,reason:z.string().trim().min(1).max(400)}).strict();
export type StylingResult=z.infer<typeof stylingResultSchema>;
export const stylingInputSchema=z.object({
  forecast:weatherSnapshotSchema.optional(),
  garments:z.array(itemSchema.extend({id,favorite:z.boolean()}).strict()).min(1).max(200),
  current:stylingOutfitSchema,locks:locksSchema,
  context:contextSchema.extend({outfitMode:z.enum(['separates','onepiece'])}).strict(),
  preferredStyles:z.array(z.enum(styles)).max(6),preferredFits:z.array(z.enum(['Regular','Relaxed','Slim'])).max(3),avoidColors:z.array(z.enum(colors)).max(12),
  recentOutfits:z.array(stylingOutfitSchema).max(14),feedback:z.array(z.object({outfit:stylingOutfitSchema,vote:z.enum(['like','dislike'])}).strict()).max(20),
}).strict();

export function buildStylingInput(input:StylistInput,dataset:Dataset){
  const available=input.garments.filter(g=>g.source===dataset&&g.available);
  const suggested=suggestOutfit({...input,garments:available,random:()=>0}).outfit;
  const priority=new Set([...Object.values(input.current),...Object.values(suggested),...categories.map(c=>available.find(g=>g.category===c)?.id)]);
  const selected=[...available.filter(g=>priority.has(g.id)),...available.filter(g=>!priority.has(g.id))].slice(0,200);
  const clean=(outfit:Outfit):Outfit=>Object.fromEntries(Object.entries(outfit).filter(([c,id])=>selected.some(g=>g.id===id&&g.category===c)));
  return stylingInputSchema.parse({
    garments:selected.map(g=>({id:g.id,name:g.name.slice(0,80),category:g.category,color:g.color,fit:g.fit,formality:g.formality,warmth:g.warmth,styles:g.styles,favorite:g.favorite})),
    current:clean(input.current),locks:input.locks,context:{occasion:input.context.occasion,weather:input.context.weather,formality:input.context.formality,includeLayer:input.context.includeLayer,includeAccessory:input.context.includeAccessory,prompt:input.context.prompt.slice(0,1000),outfitMode:input.context.outfitMode??'separates'},
    forecast:input.context.weatherMode==='forecast'&&isWeatherFresh(input.context.forecast)?input.context.forecast:undefined,
    preferredStyles:input.preferredStyles,preferredFits:input.preferredFits??[],avoidColors:input.avoidColors??[],
    recentOutfits:input.history.filter(h=>h.source===dataset).slice(0,14).map(h=>clean(h.outfit)),
    feedback:input.feedback.filter(f=>f.source===dataset).slice(-20).map(f=>({outfit:clean(f.outfit),vote:f.vote})),
  });
}

/** Provider output cannot bypass the same inventory, category and lock invariants as taps. */
export function validateStylingResult(value:unknown,input:StylistInput,dataset:Dataset):StylingResult {
  const result=stylingResultSchema.parse(value),available=input.garments.filter(g=>g.source===dataset&&g.available);
  for(const [category,id]of Object.entries(result.outfit))if(!available.some(g=>g.id===id&&g.category===category))throw Error('AI selected a missing, unavailable or mismatched piece. Your outfit was kept.');
  for(const category of categories)if(input.locks[category]&&result.outfit[category]!==input.current[category])throw Error('AI changed a kept piece. Your outfit was kept.');
  if(result.outfit.onepiece&&(result.outfit.top||result.outfit.bottom))throw Error('AI mixed incompatible outfit shapes. Your outfit was kept.');
  let onepiece=input.context.outfitMode==='onepiece';
  if(input.locks.onepiece&&input.current.onepiece)onepiece=true;
  if((input.locks.top&&input.current.top)||(input.locks.bottom&&input.current.bottom))onepiece=false;
  if((onepiece&&(result.outfit.top||result.outfit.bottom))||(!onepiece&&result.outfit.onepiece))throw Error('AI changed your selected outfit shape. Your outfit was kept.');
  const bodyAvailable=available.some(g=>g.category==='onepiece')||(available.some(g=>g.category==='top')&&available.some(g=>g.category==='bottom'));
  if(bodyAvailable&&!result.outfit.onepiece&&!(result.outfit.top&&result.outfit.bottom))throw Error('AI returned an incomplete outfit. Your outfit was kept.');
  if(available.some(g=>g.category==='shoes')&&!result.outfit.shoes)throw Error('AI omitted available shoes. Your outfit was kept.');
  if(!Object.keys(result.outfit).length)throw Error('AI returned no pieces. Your outfit was kept.');
  return result;
}

export function stylingKey(input:StylistInput,dataset:Dataset,day:string){
  // Full relevant metadata, not bounded provider sampling; any wardrobe edit invalidates a late reply.
  return JSON.stringify({day,dataset,garments:input.garments.filter(g=>g.source===dataset).map(({imageUri,createdAt,...g})=>g),current:input.current,locks:input.locks,context:input.context,preferredStyles:input.preferredStyles,preferredFits:input.preferredFits,avoidColors:input.avoidColors,history:input.history.slice(0,14),feedback:input.feedback.slice(-20)});
}
