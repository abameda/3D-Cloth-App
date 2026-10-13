import { gcm } from '@noble/ciphers/aes';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { utf8ToBytes, bytesToUtf8 } from '@noble/ciphers/utils';
import { fromByteArray, toByteArray } from 'base64-js';
import { z } from 'zod';
import { decodeState } from './state';
import type { WardrobeState } from './types';
export interface PortableArchive { format:1; createdAt:string; state:WardrobeState; photos:Record<string,string>; }
export const MAX_ARCHIVE_BYTES=32*1024*1024;
export const MAX_ENVELOPE_BYTES=46*1024*1024;
export const MAX_PHOTO_BYTES=4*1024*1024;
const iterations=210000;
const base64=/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
function bytes(value:string,max:number){if(value.length>Math.ceil(max/3)*4||!base64.test(value))throw Error('Invalid or oversized backup data');const data=toByteArray(value);if(data.length>max||fromByteArray(data)!==value)throw Error('Invalid backup encoding');return data;}
export function validateArchive(value:unknown):PortableArchive {
 const shape=z.object({format:z.literal(1),createdAt:z.string().datetime({offset:true}),state:z.unknown(),photos:z.record(z.string(),z.string())}).strict().parse(value);
 const state=decodeState(JSON.stringify(shape.state));const references=new Set<string>();
 for(const entry of [state.profile,...state.garments])if(entry.imageUri){if(!/^photo:p[0-9]{1,5}$/.test(entry.imageUri))throw Error('Backup contains a nonportable photo reference');references.add(entry.imageUri.slice(6));}
 const keys=Object.keys(shape.photos);if(keys.length>10001)throw Error('Too many backup photos');
 for(const key of keys){if(!/^p[0-9]{1,5}$/.test(key)||!references.has(key))throw Error('Invalid or unused photo identifier');const data=bytes(shape.photos[key],MAX_PHOTO_BYTES);if(data.length<4||data[0]!==255||data[1]!==216||data[data.length-2]!==255||data[data.length-1]!==217)throw Error('Backup photo must be a JPEG');}
 for(const id of references)if(!Object.prototype.hasOwnProperty.call(shape.photos,id))throw Error('Backup is missing a referenced photo');
 const archive:PortableArchive={format:1,createdAt:shape.createdAt,state,photos:shape.photos};if(utf8ToBytes(JSON.stringify(archive)).length>MAX_ARCHIVE_BYTES)throw Error('Wardrobe exceeds the 32 MB backup limit');return archive;
}
function passwordBytes(password:string){if(password.length<12||password.length>1024)throw Error('Use a password with 12 to 1024 characters');return utf8ToBytes(password);}
export async function sealArchive(archive:PortableArchive,password:string,randomBytes:(n:number)=>Uint8Array):Promise<string>{
 const plaintext=utf8ToBytes(JSON.stringify(validateArchive(archive)));const secret=passwordBytes(password);const salt=randomBytes(16),nonce=randomBytes(12);if(salt.length!==16||nonce.length!==12)throw Error('Invalid secure randomness');
 const key=await pbkdf2Async(sha256,secret,salt,{c:iterations,dkLen:32,asyncTick:10});try{return JSON.stringify({format:'thread-encrypted',version:1,kdf:'pbkdf2-sha256',iterations,salt:fromByteArray(salt),nonce:fromByteArray(nonce),ciphertext:fromByteArray(gcm(key,nonce).encrypt(plaintext))});}finally{key.fill(0);secret.fill(0);plaintext.fill(0);}
}
export async function openArchive(envelope:string,password:string):Promise<PortableArchive>{
 if(envelope.length>MAX_ENVELOPE_BYTES)throw Error('Backup exceeds the 46 MB file limit');
 const e=z.object({format:z.literal('thread-encrypted'),version:z.literal(1),kdf:z.literal('pbkdf2-sha256'),iterations:z.literal(iterations),salt:z.string(),nonce:z.string(),ciphertext:z.string()}).strict().parse(JSON.parse(envelope));
 const salt=bytes(e.salt,16),nonce=bytes(e.nonce,12),cipher=bytes(e.ciphertext,MAX_ARCHIVE_BYTES+16);if(salt.length!==16||nonce.length!==12||cipher.length<16)throw Error('Invalid encrypted backup');
 const secret=passwordBytes(password);const key=await pbkdf2Async(sha256,secret,salt,{c:iterations,dkLen:32,asyncTick:10});let plaintext:Uint8Array|undefined;try{try{plaintext=gcm(key,nonce).decrypt(cipher);}catch{throw Error('Incorrect password or damaged backup');}return validateArchive(JSON.parse(bytesToUtf8(plaintext)));}finally{key.fill(0);secret.fill(0);plaintext?.fill(0);}
}
