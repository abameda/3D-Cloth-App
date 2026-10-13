import { Directory, File, Paths } from 'expo-file-system';
import { toByteArray } from 'base64-js';
import { decodeState, makeId } from './domain/state';
import { validateArchive, MAX_PHOTO_BYTES, type PortableArchive } from './domain/portable';
import type { WardrobeState } from './domain/types';

export async function createArchive(input: WardrobeState): Promise<PortableArchive> {
  const state=decodeState(JSON.stringify(input)); const photos:Record<string,string>={}; const ids=new Map<string,string>();
  const prefix=new Directory(Paths.document,'wardrobe-photos').uri.replace(/\/$/,'')+'/';
  for(const entry of [state.profile,...state.garments]) if(entry.imageUri){
    const uri=entry.imageUri;
    if(!uri.startsWith(prefix)||uri.slice(prefix.length).includes('/')||uri.includes('..'))throw Error('A photo is outside managed wardrobe storage. Reimport it before backing up.');
    let id=ids.get(uri);if(!id){const file=new File(uri);if(!file.exists)throw Error('A wardrobe photo is missing. Reimport or remove it before backing up.');if(file.size>MAX_PHOTO_BYTES)throw Error('A photo exceeds the 4 MB backup limit. Reimport a smaller photo.');id=`p${ids.size}`;ids.set(uri,id);photos[id]=await file.base64();}
    entry.imageUri=`photo:${id}`;
  }
  return validateArchive({format:1,createdAt:new Date().toISOString(),state,photos});
}
export async function restoreArchive(input:PortableArchive,replaceState:(next:WardrobeState)=>Promise<void>):Promise<void>{
  const archive=validateArchive(input);const state=decodeState(JSON.stringify(archive.state));const staged:File[]=[];
  const directory=new Directory(Paths.document,'wardrobe-photos');directory.create({intermediates:true,idempotent:true});
  try{const uris=new Map<string,string>();for(const [id,encoded]of Object.entries(archive.photos)){const file=new File(directory,`${makeId()}.jpg`);file.create();staged.push(file);file.write(toByteArray(encoded));uris.set(`photo:${id}`,file.uri);}for(const entry of [state.profile,...state.garments])if(entry.imageUri)entry.imageUri=uris.get(entry.imageUri)!;await replaceState(decodeState(JSON.stringify(state)));}
  catch(error){for(const file of staged)try{if(file.exists)file.delete();}catch{}throw error;}
}
