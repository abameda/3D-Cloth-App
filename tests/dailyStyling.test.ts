import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cachedDailyStyling,clearDailyStylingCache,dailyStylingInput} from '../src/domain/dailyStyling';
import {initialState} from '../src/domain/state';
import type {Garment,StylistInput} from '../src/domain/types';
const garments:Garment[]=(['top','bottom','shoes']as const).map(category=>({id:category,name:category,category,color:'White',fit:'Regular',formality:1,warmth:2,styles:[],favorite:false,available:true,source:'owned',createdAt:'2026-10-12T00:00:00Z'}));
const input:StylistInput={garments,current:{},locks:{},context:initialState.context,feedback:[],history:[],preferredStyles:[]};
test('unchanged daily input reuses validated result without a second paid call',async()=>{
  let raw:string|null=null,calls=0;const store={get:async()=>raw,set:async(value:string)=>{raw=value;}};
  const request=async()=>{calls++;return{outfit:{top:'top',bottom:'bottom',shoes:'shoes'},reason:'Your own outfit.'};};
  await cachedDailyStyling(input,'owned','model',store,request,'2026-10-12');await cachedDailyStyling(input,'owned','model',store,request,'2026-10-12');assert.equal(calls,1);
  assert.ok(!raw!.includes('preferredStyles'));
  await cachedDailyStyling(input,'owned','different-model',store,request,'2026-10-12');assert.equal(calls,2);
});
test('corrupted cache cannot supply an outfit; failed request never caches success',async()=>{
  let writes=0;const store={get:async()=>'{invalid',set:async()=>{writes++;}};
  await assert.rejects(cachedDailyStyling(input,'owned','model',store,async()=>{throw Error('offline');},'2026-10-12'));assert.equal(writes,0);
});
test('preparing or changing unlocked outfit does not invalidate the daily recommendation',()=>{
  assert.deepEqual(dailyStylingInput(input),dailyStylingInput({...input,current:{top:'top',bottom:'bottom',shoes:'shoes'}}));
  assert.equal(dailyStylingInput({...input,current:{top:'top'},locks:{top:true}}).current.top,'top');
});
test('erasure invalidates a pending request before it can repopulate cache',async()=>{
  let raw:string|null=null,release!:()=>void,started!:()=>void;
  const ready=new Promise<void>(resolve=>{started=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
  const store={get:async()=>raw,set:async(value:string)=>{raw=value;}};
  const pending=cachedDailyStyling(input,'owned','erase-test',store,async()=>{started();await gate;return{outfit:{top:'top',bottom:'bottom',shoes:'shoes'},reason:'Choice'};},'2026-10-12');
  await ready;await clearDailyStylingCache(async()=>{raw=null;});release();await assert.rejects(pending,/cancelled/);assert.equal(raw,null);
});
