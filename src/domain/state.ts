import { garmentShapeSchema } from './studio';
import {z} from 'zod';
import { appearanceSchema } from './appearance';
import { weatherCitySchema, weatherSnapshotSchema } from './weather';
import {categories,colors,styles,occasions,type WardrobeState,type WardrobeAction,type Outfit,type Dataset} from './types';
import {demoGarments} from '../data/demo';
import {outfitSignature} from './stylist';
export const initialState:WardrobeState={version:2,profile:{preferredFits:[],avoidColors:[],name:'',styles:[]},garments:demoGarments,dataset:'owned',outfits:{owned:{},example:{}},locks:{owned:{},example:{}},context:{outfitMode:'separates',occasion:'Everyday',weather:'Mild',formality:1,includeLayer:false,includeAccessory:false,prompt:''},saved:[],history:[],feedback:[]};
const id=z.string().min(1).max(200); const date=z.string().datetime({offset:true}); const rank=z.union([z.literal(1),z.literal(2),z.literal(3)]); const dataset=z.enum(['owned','example']);
const outfit=z.object({top:id.optional(),bottom:id.optional(),shoes:id.optional(),outerwear:id.optional(),accessories:id.optional(),onepiece:id.optional(),bag:id.optional(),eyewear:id.optional()}).strict();
const locks=z.object({top:z.boolean().optional(),bottom:z.boolean().optional(),shoes:z.boolean().optional(),outerwear:z.boolean().optional(),accessories:z.boolean().optional(),onepiece:z.boolean().optional(),bag:z.boolean().optional(),eyewear:z.boolean().optional()}).strict();
const names=z.object({top:z.string().optional(),bottom:z.string().optional(),shoes:z.string().optional(),outerwear:z.string().optional(),accessories:z.string().optional(),onepiece:z.string().optional(),bag:z.string().optional(),eyewear:z.string().optional()}).strict();
const schema=z.object({version:z.union([z.literal(1),z.literal(2)]),profile:z.object({weatherCity:weatherCitySchema.optional(),dailyAi:z.boolean().optional(),avatarMode:z.enum(['real','custom']).optional(),avatar:appearanceSchema.optional(),preferredFits:z.array(z.enum(['Regular','Relaxed','Slim'])).max(3).default([]),avoidColors:z.array(z.enum(colors)).max(12).default([]),name:z.string().max(200),imageUri:z.string().min(1).optional(),styles:z.array(z.enum(styles)).max(6)}).strict(),garments:z.array(z.object({id,name:z.string().min(1).max(200),category:z.enum(categories),color:z.enum(colors),fit:z.enum(['Regular','Relaxed','Slim']),formality:rank,warmth:rank,imageUri:z.string().min(1).optional(),available:z.boolean(),favorite:z.boolean(),styles:z.array(z.enum(styles)).max(6),source:dataset,createdAt:date,shape:garmentShapeSchema.optional()}).strict()).max(10000),dataset,outfits:z.object({owned:outfit,example:outfit}).strict(),locks:z.object({owned:locks,example:locks}).strict(),context:z.object({weatherMode:z.enum(['manual','forecast']).optional(),forecast:weatherSnapshotSchema.optional(),outfitMode:z.enum(['separates','onepiece']).default('separates'),occasion:z.enum(occasions),weather:z.enum(['Warm','Mild','Cold']),formality:rank,includeLayer:z.boolean(),includeAccessory:z.boolean(),prompt:z.string().max(4000)}).strict(),saved:z.array(z.object({id,name:z.string().min(1).max(200),outfit,createdAt:date,source:dataset}).strict()).max(5000),history:z.array(z.object({id,outfit,names,wornAt:date,source:dataset}).strict()).max(20000),feedback:z.array(z.object({reason:z.enum(['color','fit','occasion','combination']).optional(),signature:z.string(),outfit,vote:z.enum(['like','dislike']),createdAt:date,source:dataset}).strict()).max(500)}).strict();
export function decodeState(raw:string|null):WardrobeState {
 if(raw===null) return JSON.parse(JSON.stringify(initialState)) as WardrobeState;
 const parsed=schema.parse(JSON.parse(raw));
 const state:WardrobeState={...parsed,version:2};
 for(const list of [state.garments,state.saved,state.history]) if(new Set(list.map(x=>x.id)).size!==list.length) throw new Error('Duplicate stored identifiers');
 const valid=(look:Outfit,source:Dataset)=>!(look.onepiece&&(look.top||look.bottom))&&categories.every(c=>!look[c]||state.garments.some(g=>g.id===look[c]&&g.category===c&&g.source===source));
 for(const source of ['owned','example'] as const) if(!valid(state.outfits[source],source)) throw new Error('Invalid outfit reference');
 for(const look of [...state.saved,...state.feedback]) if(!valid(look.outfit,look.source)) throw new Error('Invalid saved reference');
 for(const feedback of state.feedback) if(feedback.signature!==outfitSignature(feedback.outfit)) throw new Error('Invalid feedback signature');
 // Wear records intentionally retain deleted IDs and immutable names as historical snapshots.
 for(const wear of state.history) for(const category of categories) if(wear.outfit[category]&&!wear.names[category]) throw new Error('Missing historical item name');
 return state;
}
let serial=0;
export function makeId():string {serial+=1;return `${Date.now().toString(36)}-${serial.toString(36)}-${Math.random().toString(36).slice(2,12)}`;}
function cleanOutfit(state:WardrobeState,outfit:Outfit,source:Dataset):Outfit {const clean:Outfit=Object.fromEntries(categories.filter(c=>state.garments.some(g=>g.id===outfit[c]&&g.category===c&&g.source===source)).map(c=>[c,outfit[c]]));if(clean.onepiece){delete clean.top;delete clean.bottom;}return clean;}
export function appReducer(state:WardrobeState,action:WardrobeAction):WardrobeState {
 switch(action.type) {
  case 'garments/import':return action.garments.reduce((current,garment)=>appReducer(current,{type:'garment/upsert',garment}),state);
  case 'garment/upsert': {const existing=state.garments.find(g=>g.id===action.garment.id);if(existing&&(existing.source!==action.garment.source||existing.category!==action.garment.category)) {const cleared=appReducer(state,{type:'garment/delete',id:existing.id});return {...cleared,garments:[...cleared.garments,action.garment]};}return {...state,garments:[...state.garments.filter(g=>g.id!==action.garment.id),action.garment]};}
  case 'garment/delete': {const garments=state.garments.filter(g=>g.id!==action.id);const clean=(o:Outfit):Outfit=>Object.fromEntries(Object.entries(o).filter(([,id])=>id!==action.id));const newLocks={owned:{...state.locks.owned},example:{...state.locks.example}};for(const source of ['owned','example'] as const) for(const c of categories) if(state.outfits[source][c]===action.id) delete newLocks[source][c];return {...state,garments,outfits:{owned:clean(state.outfits.owned),example:clean(state.outfits.example)},locks:newLocks,saved:state.saved.map(l=>({...l,outfit:clean(l.outfit)})),feedback:state.feedback.filter(f=>!Object.values(f.outfit).includes(action.id))};}
  case 'dataset/set':return {...state,dataset:action.dataset};
  case 'outfit/set':return {...state,outfits:{...state.outfits,[state.dataset]:cleanOutfit(state,action.outfit,state.dataset)}};
  case 'lock/toggle':return {...state,locks:{...state.locks,[state.dataset]:{...state.locks[state.dataset],[action.category]:!state.locks[state.dataset][action.category]}}};
  case 'context/set':return {...state,context:{...action.context}};
  case 'profile/set':return {...state,profile:{...action.profile,styles:[...action.profile.styles]}};
  case 'look/save':return {...state,saved:[{...action.look,outfit:cleanOutfit(state,action.look.outfit,action.look.source)},...state.saved.filter(l=>l.id!==action.look.id)]};
  case 'look/delete':return {...state,saved:state.saved.filter(l=>l.id!==action.id)};
  case 'wear/add': {const outfit=cleanOutfit(state,action.wear.outfit,action.wear.source);const names=Object.fromEntries(categories.filter(c=>outfit[c]).map(c=>[c,state.garments.find(g=>g.id===outfit[c])!.name]));return {...state,history:[{...action.wear,outfit,names},...state.history.filter(w=>w.id!==action.wear.id)]};}
  case 'wear/delete':return {...state,history:state.history.filter(w=>w.id!==action.id)};
  case 'feedback/add': {const outfit=cleanOutfit(state,action.feedback.outfit,action.feedback.source);const signature=outfitSignature(outfit);if(!signature)return state;return {...state,feedback:[...state.feedback.filter(f=>!(f.source===action.feedback.source&&f.signature===signature)),{...action.feedback,outfit,signature}].slice(-500)};}
  case 'feedback/reset':return {...state,feedback:[]};
 }
}

