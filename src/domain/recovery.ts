import { decodeState } from './state';
import type { WardrobeState } from './types';
export const PRIMARY='thread.wardrobe.v1';
export const FALLBACK='thread.wardrobe.previous';
export interface Storage { getItem(key:string):Promise<string|null>; setItem(key:string,value:string):Promise<void>; }
/** Primary is replaced only after the last validated commit is copied to fallback. */
export class Journal {
 private committed:WardrobeState|undefined;
 private previous:WardrobeState|undefined;
 private queue:Promise<void>=Promise.resolve();
 constructor(private storage:Storage){}
 async load(){
  const primary=await this.storage.getItem(PRIMARY);const fallback=await this.storage.getItem(FALLBACK);
  try {if(primary===null&&fallback!==null)throw Error('Interrupted primary');const state=decodeState(primary);this.committed=state;try{this.previous=fallback?decodeState(fallback):undefined;}catch{this.previous=undefined;}return {state,recovered:false};}
  catch(error){if(fallback===null)throw error;const state=decodeState(fallback);this.committed=state;return {state,recovered:true};}
 }
 save(next:WardrobeState):Promise<void>{
  const validated=decodeState(JSON.stringify(next));
  const task=this.queue.catch(()=>{}).then(async()=>{if(!this.committed)throw Error('Wardrobe has not loaded');await this.storage.setItem(FALLBACK,JSON.stringify(this.committed));this.previous=this.committed;await this.storage.setItem(PRIMARY,JSON.stringify(validated));this.committed=validated;});
  this.queue=task;return task;
 }
 flush(){return this.queue;}
 retainedStates(){return [this.committed,this.previous].filter((s):s is WardrobeState=>!!s);}
}
