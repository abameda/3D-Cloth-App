import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {cachedDailyStyling,clearDailyStylingCache,DAILY_STYLING_KEY} from './domain/dailyStyling';
import{features}from './features';
import { z } from 'zod';
import { type StyleContext } from './domain/types';
import { contextSchema, itemSchema } from './domain/aiMetadata';
import { claudeRequest, listClaudeModels } from './domain/claude';
import { capturePlanSchema } from './domain/capturePlan';
import { buildStylingInput, validateStylingResult } from './domain/aiStyling';
import type { Dataset, StylistInput } from './domain/types';

import { readConnection, saveConnection, readAiConnection, saveClaudeConnection } from './domain/connection';
const CONNECTION_KEY = 'thread.ai.connection.v1';
const storage = { get: () => SecureStore.getItemAsync(CONNECTION_KEY), set: (value: string) => SecureStore.setItemAsync(CONNECTION_KEY, value), remove: () => SecureStore.deleteItemAsync(CONNECTION_KEY) };
export async function getAiConnection() { return readAiConnection(storage); }
export async function styleWardrobe(input:StylistInput,dataset:Dataset){
  if(!features.connectedAi)throw Error('Connected styling is disabled.');
  const config=await getAiConnection();
  if(!config||!('provider'in config))throw Error('Wardrobe-aware styling needs your Claude connection in Profile → AI stylist.');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
  try{return validateStylingResult(await claudeRequest(config,'style',buildStylingInput(input,dataset),controller.signal),input,dataset);}
  catch(e){if(e instanceof Error&&e.name==='AbortError')throw Error('Claude timed out. Your outfit was kept.');throw e;}
  finally{clearTimeout(timeout);}
}
export async function dailyWardrobeStyle(input:StylistInput,dataset:Dataset,day:string){
  const config=await getAiConnection();if(!config||!('provider'in config))throw Error('Connect Claude in Profile → AI stylist.');
  return cachedDailyStyling(input,dataset,config.model,{get:()=>AsyncStorage.getItem(DAILY_STYLING_KEY),set:value=>AsyncStorage.setItem(DAILY_STYLING_KEY,value)},()=>styleWardrobe(input,dataset),day);
}
export async function setClaudeConnection(apiKey: string, model: string) { return saveClaudeConnection(storage, apiKey, model); }
export async function disconnectAi() { await clearDailyStylingCache(()=>AsyncStorage.removeItem(DAILY_STYLING_KEY));await storage.remove(); }
export async function inspectReconstructionCapture(kind:'face'|'body'|'garment',images:string[]){
  const config=await getAiConnection();if(!config||!('provider'in config))throw Error('Save your Anthropic key and an available model in AI settings first.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{return capturePlanSchema.parse(await claudeRequest(config,'capture',{kind,images},controller.signal));}
  catch(e){if(e instanceof Error&&e.name==='AbortError')throw Error('Claude’s capture check timed out. Retry, or use local checks only.');throw e;}
  finally{clearTimeout(timer);}
}
export async function loadClaudeModels(apiKey: string) {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
  try { return await listClaudeModels(apiKey, controller.signal); }
  catch (e) { if (e instanceof Error && e.name === 'AbortError') throw Error('Loading models timed out. Try again.'); throw e; }
  finally { clearTimeout(timeout); }
}
export async function getConnection() { return readConnection(storage); }
export async function setConnection(url: string, token: string) { return saveConnection(storage, url, token, __DEV__); }
async function request(path: string, body: unknown): Promise<unknown> {
  if(!features.connectedAi)throw new Error('Connected AI is disabled in the no-cost edition. On-device styling remains available.');
  const config = await getAiConnection();
  if (!config) throw new Error('Add an API key in Profile → AI stylist first. On-device styling still works.');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    if ('provider' in config) {
      const task = path === '/context' ? 'context' : 'analyze';
      const result = await claudeRequest(config, task, body as Record<string, unknown>, controller.signal);
      return task === 'context' ? { context: result } : { item: result };
    }
    const response = await fetch(`${config.url}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` }, body: JSON.stringify(body), signal: controller.signal });
    if (!response.ok) throw new Error(response.status === 401 ? 'Connection token was rejected. Check AI connection settings.' : response.status === 429 ? 'The stylist is busy. Try again shortly.' : 'The AI service couldn’t complete this request. You can continue on device.');
    return await response.json();
  } catch (error) { if (error instanceof Error && error.name === 'AbortError') throw new Error('The AI service timed out. Your wardrobe is still available on device.'); throw error; }
  finally { clearTimeout(timeout); }
}
export async function interpretContext(prompt: string, context: StyleContext) { const {outfitMode,forecast,weatherMode,...wireContext}=context; const data = await request('/context', { prompt, context:wireContext }); const interpreted=z.object({ context: contextSchema }).parse(data).context;return {...interpreted,outfitMode,weatherMode:interpreted.weather===context.weather?weatherMode:'manual' as const,forecast:interpreted.weather===context.weather?forecast:undefined}; }
export async function analyzePhoto(image: string) { const data = await request('/analyze', { image }); return z.object({ item: itemSchema }).parse(data).item; }
