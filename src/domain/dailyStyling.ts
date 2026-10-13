import {sha256} from '@noble/hashes/sha256';
import {bytesToHex} from '@noble/hashes/utils';
import {stylingKey,stylingResultSchema,validateStylingResult,type StylingResult} from './aiStyling';
import type {Dataset,StylistInput} from './types';
export const DAILY_STYLING_KEY='thread.ai.daily-styling.v1';
let generation=0,writes:Promise<unknown>=Promise.resolve();
const flights=new Map<string,Promise<StylingResult>>();
export function dailyStylingInput(input:StylistInput):StylistInput{
  return {...input,current:Object.fromEntries(Object.entries(input.current).filter(([category])=>input.locks[category as keyof typeof input.locks]))};
}
export async function clearDailyStylingCache(remove:()=>Promise<void>){
  generation++;flights.clear();await writes.catch(()=>{});await remove();
}
export async function cachedDailyStyling(input:StylistInput,dataset:Dataset,model:string,store:{get:()=>Promise<string|null>;set:(value:string)=>Promise<void>},request:()=>Promise<StylingResult>,day:string){
  const key=bytesToHex(sha256(new TextEncoder().encode(model+stylingKey(input,dataset,day))));
  const existing=flights.get(key);if(existing)return existing;
  const requestedGeneration=generation;
  const pending=(async()=>{
    let cachedResult:StylingResult|undefined;
    try{const raw=await store.get();if(raw){const cached=JSON.parse(raw);if(cached.key===key)cachedResult=validateStylingResult(stylingResultSchema.parse(cached.result),input,dataset);}}catch{/* Corrupt optional cache is never authoritative. */}
    if(requestedGeneration!==generation)throw Error('Daily AI request was cancelled because its cache or connection was cleared.');
    if(cachedResult)return cachedResult;
    const result=validateStylingResult(await request(),input,dataset);
    if(requestedGeneration!==generation)throw Error('Daily AI request was cancelled because its cache or connection was cleared.');
    // Serialize writes with erasure; store only a digest, garment IDs and reason.
    writes=writes.catch(()=>{}).then(async()=>{if(requestedGeneration===generation)await store.set(JSON.stringify({key,result}));});
    await writes.catch(()=>{});
    if(requestedGeneration!==generation)throw Error('Daily AI request was cancelled because its cache or connection was cleared.');
    return result;
  })();
  flights.set(key,pending);try{return await pending;}finally{if(flights.get(key)===pending)flights.delete(key);}
}
