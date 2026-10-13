export type Snapshot = { revision: number; object_key: string; updated_at?: string };
export interface SyncTransport {
  identity(): Promise<string>;
  head(): Promise<Snapshot | null>;
  upload(key: string, envelope: string): Promise<void>;
  commit(expected: number, key: string): Promise<Snapshot>;
  remove(key: string): Promise<void>;
}
export class SyncConflict extends Error { constructor() { super('Cloud backup changed on another device. Choose which copy to keep.'); } }
export async function pushSnapshot(transport: SyncTransport, owner: string, expected: number, envelope: string, id: string): Promise<Snapshot> {
  if (await transport.identity() !== owner) throw new Error('Account changed. Start again.');
  if (!/^[A-Za-z0-9-]+$/.test(owner)||!/^[A-Za-z0-9-]+$/.test(id)) throw new Error('Invalid snapshot identity.');
  if (envelope.length > 46*1024*1024) throw new Error('Backup exceeds the 46 MB cloud limit. Export a local backup instead.');
  const key = `${owner}/${id}.json`;
  await transport.upload(key, envelope);
  try {
    if (await transport.identity() !== owner) throw new Error('Account changed. Start again.');
    return await transport.commit(expected, key);
  } catch (error) {
    // If the commit response was lost, the object may be the committed head. Never delete it blindly.
    try { if ((await transport.head())?.object_key !== key) await transport.remove(key); } catch { /* Retain uncertain objects for scheduled cleanup. */ }
    throw error;
  }
}
export function assertRestoreUnchanged(startRevision: number, currentRevision: number, owner: string, currentOwner: string | null) {
  if (startRevision !== currentRevision) throw new Error('Your device wardrobe changed during download. Start restore again.');
  if (owner !== currentOwner) throw new Error('Account changed. Start restore again.');
}
