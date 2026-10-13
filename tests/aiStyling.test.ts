import {test} from 'node:test';
import assert from 'node:assert/strict';
import { buildStylingInput, validateStylingResult, stylingKey } from '../src/domain/aiStyling';
import { initialState } from '../src/domain/state';
import type {Garment,StylistInput} from '../src/domain/types';
const garment=(id:string,category:Garment['category'],extra:Partial<Garment>={}):Garment=>({id,name:id,category,color:'White',fit:'Regular',formality:1,warmth:2,available:true,favorite:false,styles:[],source:'owned',createdAt:'2026-10-12T00:00:00Z',...extra});
const input=():StylistInput=>({garments:[garment('top','top',{imageUri:'file:///private/photo.jpg'}),garment('pants','bottom'),garment('shoes','shoes'),garment('dress','onepiece'),garment('example','top',{source:'example'}),garment('dirty','top',{available:false})],current:{},locks:{},context:initialState.context,feedback:[],history:[],preferredStyles:[]});
test('wardrobe-aware payload contains only available same-dataset metadata',()=>{
  const wire=buildStylingInput(input(),'owned');
  assert.deepEqual(wire.garments.map(g=>g.id).sort(),['dress','pants','shoes','top']);
  assert.ok(!JSON.stringify(wire).includes('file:///'));assert.equal('imageUri' in wire.garments[0],false);
});
test('AI must choose valid wardrobe IDs, correct categories and complete outfit',()=>{
  const i=input();assert.deepEqual(validateStylingResult({outfit:{top:'top',bottom:'pants',shoes:'shoes'},reason:'Your pieces suit the day.'},i,'owned').outfit,{top:'top',bottom:'pants',shoes:'shoes'});
  for(const outfit of [{top:'invented'},{top:'pants'},{top:'example'},{top:'dirty'},{top:'top',onepiece:'dress'},{shoes:'shoes'}])assert.throws(()=>validateStylingResult({outfit,reason:'Choice'},i,'owned'));
});
test('AI cannot change locked pieces or fill locked empty slots',()=>{
  const i=input();i.current={onepiece:'dress'};i.locks={onepiece:true};
  assert.throws(()=>validateStylingResult({outfit:{top:'top',bottom:'pants',shoes:'shoes'},reason:'Choice'},i,'owned'));
  assert.equal(validateStylingResult({outfit:{onepiece:'dress',shoes:'shoes'},reason:'Choice'},i,'owned').outfit.onepiece,'dress');
  i.current={};i.locks={top:true};assert.throws(()=>validateStylingResult({outfit:{top:'top',bottom:'pants',shoes:'shoes'},reason:'Choice'},i,'owned'));
});
test('AI respects explicit outfit shape while a valid locked shape wins',()=>{
  const i=input();assert.throws(()=>validateStylingResult({outfit:{onepiece:'dress',shoes:'shoes'},reason:'Choice'},i,'owned'),/shape/);
  i.context={...i.context,outfitMode:'onepiece'};assert.throws(()=>validateStylingResult({outfit:{top:'top',bottom:'pants',shoes:'shoes'},reason:'Choice'},i,'owned'),/shape/);
  i.current={top:'top'};i.locks={top:true};assert.equal(validateStylingResult({outfit:{top:'top',bottom:'pants',shoes:'shoes'},reason:'Choice'},i,'owned').outfit.top,'top');
});
test('daily request identity changes with wardrobe availability, preferences and selection',()=>{
  const i=input(),key=stylingKey(i,'owned','2026-10-12');
  assert.notEqual(key,stylingKey({...i,current:{top:'top'}},'owned','2026-10-12'));
  assert.notEqual(key,stylingKey({...i,preferredStyles:['Classic']},'owned','2026-10-12'));
  assert.notEqual(key,stylingKey({...i,garments:i.garments.map(g=>({...g,available:false}))},'owned','2026-10-12'));
  assert.notEqual(key,stylingKey(i,'owned','2026-10-13'));
});
test('large wardrobe payload keeps required categories and selected pieces inside budget',()=>{
  const i=input();i.garments=[...Array.from({length:500},(_,n)=>garment(`t${n}`,'top')),...i.garments];i.current={top:'t499'};i.locks={top:true};
  const wire=buildStylingInput(i,'owned');assert.ok(wire.garments.length<=200);assert.ok(['shoes','pants','t499'].every(id=>wire.garments.some(g=>g.id===id)));
});
