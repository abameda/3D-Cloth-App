import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';
import {threadProject}from './projectConfig';
import { SyncConflict, type Snapshot, type SyncTransport } from './domain/sync';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || threadProject.url;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || threadProject.publishableKey;
const origin = process.env.EXPO_PUBLIC_ACCOUNT_ORIGIN;
function https(value?: string) { try { return !!value && new URL(value).protocol === 'https:'; } catch { return false; } }
export const cloudConfigured = https(url) && !!key && key.length > 20;
export const accountOrigin = https(origin) ? origin : undefined;
// Chunk auth sessions because native SecureStore values have platform-dependent size limits.
const secureSession = {
  async getItem(name:string){const raw=await SecureStore.getItemAsync(name+'.head');if(!raw)return null;const head=JSON.parse(raw);if(!/^[a-f0-9-]+$/.test(head.id)||!Number.isInteger(head.count)||head.count<1||head.count>100)throw Error('Invalid secure session');let value='';for(let i=0;i<head.count;i++){const part=await SecureStore.getItemAsync(`${name}.${head.id}.${i}`);if(part===null)throw Error('Session is incomplete. Sign in again.');value+=part;}return value;},
  async setItem(name:string,value:string){const id=randomUUID();const count=Math.ceil(value.length/1800);if(count>100)throw Error('Session too large');const previous=await SecureStore.getItemAsync(name+'.head');for(let i=0;i<count;i++)await SecureStore.setItemAsync(`${name}.${id}.${i}`,value.slice(i*1800,(i+1)*1800));await SecureStore.setItemAsync(name+'.head',JSON.stringify({id,count}));if(previous){const old=JSON.parse(previous);for(let i=0;i<Math.min(old.count,100);i++)await SecureStore.deleteItemAsync(`${name}.${old.id}.${i}`).catch(()=>{});}},
  async removeItem(name:string){const raw=await SecureStore.getItemAsync(name+'.head');await SecureStore.deleteItemAsync(name+'.head');if(raw){const old=JSON.parse(raw);for(let i=0;i<Math.min(old.count,100);i++)await SecureStore.deleteItemAsync(`${name}.${old.id}.${i}`).catch(()=>{});}},
};
export const cloud = cloudConfigured ? createClient(url!, key!, { auth: { storage: secureSession, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }) : null;
if (cloud) { if (AppState.currentState === 'active') cloud.auth.startAutoRefresh(); AppState.addEventListener('change', state => { if (state === 'active') cloud.auth.startAutoRefresh(); else cloud.auth.stopAutoRefresh(); }); }
export function cloudTransport(): SyncTransport {
  const client = cloud; if (!client) throw new Error('Cloud backup is not available in this build.');
  return {
    async identity() { const { data, error } = await client.auth.getUser(); if (error || !data.user) throw new Error('Please sign in again.'); return data.user.id; },
    async head() { const { data, error } = await client.from('wardrobe_snapshots').select('revision,object_key,updated_at').maybeSingle(); if (error) throw error; return data as Snapshot | null; },
    async upload(path, envelope) { const bytes = new TextEncoder().encode(envelope); const { error } = await client.storage.from('thread-vaults').upload(path, bytes.buffer as ArrayBuffer, { contentType: 'application/json', upsert: false }); if (error) throw error; },
    async commit(expected, path) { const { data, error } = await client.rpc('commit_wardrobe_snapshot', { expected_revision: expected, next_key: path }); if (error) { if (error.code === '40001') throw new SyncConflict(); throw error; } return data as Snapshot; },
    async remove(path) { const { error } = await client.storage.from('thread-vaults').remove([path]); if (error) throw error; },
  };
}
export async function downloadSnapshot(key: string) { if (!cloud) throw new Error('Cloud unavailable.'); const owner=await cloudTransport().identity();if(!key.startsWith(owner+'/'))throw Error('Snapshot belongs to another account.'); const { data, error } = await cloud.storage.from('thread-vaults').download(key); if (error) throw error; if (data.size > 46*1024*1024) throw new Error('Cloud backup is too large.'); return await new Response(data).text(); }
