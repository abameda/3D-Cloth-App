import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { readGlb } from './domain/glb';
import { kitManifestSchema, type BodyProfile, type GarmentRequest, type KitManifest } from './domain/studio';
import { captureFolder } from './privateCaptureStorage';
import { getReconstructionConnection } from './reconstruction';
import type { AvatarKit } from './ui/avatarKit';

/** Client for the Windows asset factory ("studio") on the paired computer. */
const INDEX = 'thread.studio.kit.v1';
const folder = () => { const dir = captureFolder('thread-avatar-kit'); dir.create({ idempotent: true, intermediates: true }); return dir; };

async function request(path: string, method = 'GET', body?: unknown): Promise<Response> {
  const config = await getReconstructionConnection();
  if (!config.url || !config.token) throw Error('Connect your computer in Profile → Reconstruction computer first.');
  const response = await fetch(config.url + path, {
    method, redirect: 'error', signal: AbortSignal.timeout(method === 'GET' ? 30000 : 20000),
    headers: { Authorization: `Bearer ${config.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const message = await response.json().then((value: { error?: string }) => value.error).catch(() => undefined);
    throw Error(response.status === 401 ? 'Your computer rejected the connection. Pair it again.' : message ?? 'Your computer could not finish this request.');
  }
  return response;
}

export async function getStudioKit(): Promise<KitManifest> { return kitManifestSchema.parse(await (await request('/v1/studio/kit')).json()); }
export async function sendBodyProfile(profile: BodyProfile) { await request('/v1/studio/body', 'PUT', profile); }
export async function sendGarmentForFitting(input: GarmentRequest) { await request(`/v1/studio/garments/${encodeURIComponent(input.garmentId)}`, 'PUT', input); }
export async function removeFittedGarment(garmentId: string) { await request(`/v1/studio/garments/${encodeURIComponent(garmentId)}`, 'DELETE'); }

async function download(path: string, expected: string, bytes: number) {
  const file = new File(folder(), `${expected}.glb`);
  if (file.exists) return file.uri;
  if (bytes > 24 * 1024 * 1024) throw Error('This model exceeds the phone’s memory budget.');
  const data = new Uint8Array(await (await request(path)).arrayBuffer());
  if (bytesToHex(sha256(data)) !== expected) throw Error('A model failed its integrity check. Sync again.');
  readGlb(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
  file.create(); file.write(data);
  return file.uri;
}

/** Downloads changed assets (content-addressed by SHA-256) and returns the personal kit, if any. */
export async function syncPersonalKit(): Promise<AvatarKit | undefined> {
  const manifest = await getStudioKit();
  if (!manifest.body) { await AsyncStorage.removeItem(INDEX); return undefined; }
  const kit: AvatarKit = { source: 'personal', body: await download('/v1/studio/assets/body', manifest.body.sha256, manifest.body.bytes), garments: [] };
  for (const garment of manifest.garments) {
    const uri = await download(`/v1/studio/assets/garments/${encodeURIComponent(garment.garmentId)}`, garment.sha256, garment.bytes);
    kit.garments.push({ id: garment.garmentId, garmentId: garment.garmentId, category: garment.category, uri });
  }
  await AsyncStorage.setItem(INDEX, JSON.stringify(kit));
  const keep = new Set([kit.body, ...kit.garments.map(g => g.uri)]);
  for (const entry of folder().list()) if (entry instanceof File && !keep.has(entry.uri)) try { entry.delete(); } catch {}
  return kit;
}

/** The last synced personal kit, usable offline. Undefined if never synced or files were evicted. */
export async function getLocalKit(): Promise<AvatarKit | undefined> {
  const raw = await AsyncStorage.getItem(INDEX);
  if (!raw) return undefined;
  const kit = JSON.parse(raw) as AvatarKit;
  return [kit.body, ...kit.garments.map(g => g.uri)].every(uri => new File(uri).exists) ? kit : undefined;
}

export async function eraseLocalKit() {
  await AsyncStorage.removeItem(INDEX);
  const dir = captureFolder('thread-avatar-kit');
  if (dir.exists) dir.delete();
}
