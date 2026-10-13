import {readFaceRecord, type FaceRecord} from './domain/faceRecord';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { makeId } from './domain/state';
import { MAX_SCAN_BYTES, validateFaceScan } from './domain/faceScan';
import * as THREE from 'three';
import { loadFaceScan } from './ui/loadFaceScan';
import { attachFaceScan, disposeAvatar } from './ui/avatarScene';
import {captureFolder,captureFolders,temporaryCaptureStorage} from './privateCaptureStorage';

const KEY='thread.avatar.face-scan.v1';
// Avatar focus reads, migration, replacement and deletion share the same files/key.
let faceOperations:Promise<unknown>=Promise.resolve();
function withFaceStorage<T>(operation:()=>Promise<T>):Promise<T>{
  const result=faceOperations.then(operation);faceOperations=result.catch(()=>{});return result;
}
const directory=()=>captureFolder('wardrobe-face');
function managed(uri: string) { return /^file:\/\//.test(uri)&&captureFolders('wardrobe-face').some(folder=>uri.startsWith(folder.uri.replace(/\/$/,'')+'/'))&&/\/scan-[a-z0-9-]+\.glb$/.test(uri); }
/** Ownership/deletion can inspect metadata even after the OS evicts the model file. */
export async function getStoredFaceRecord(){return withFaceStorage(async()=>readFaceRecord(await AsyncStorage.getItem(KEY)));}
export async function getFaceModel(): Promise<FaceRecord | undefined> {
 return withFaceStorage(async()=>{
  const record=readFaceRecord(await AsyncStorage.getItem(KEY));
  if(!record)return;const uri=record.uri;
  if(!managed(uri)||!new File(uri).exists)throw Error('Your face model is unavailable. Reopen the capture to download it again, or capture new photos. Expo Go cache can be cleared by iOS.');
  if(temporaryCaptureStorage&&!uri.startsWith(directory().uri.replace(/\/$/,'')+'/')){
    const source=new File(uri);directory().create({intermediates:true,idempotent:true});
    const copy=new File(directory(),source.name);source.copy(copy);
    try{await AsyncStorage.setItem(KEY,JSON.stringify({...record,uri:copy.uri}));}catch(e){copy.delete();throw e;}
    source.delete();return {...record,uri:copy.uri};
  }
  return record;
 });
}
export async function getFaceScan(){return (await getFaceModel())?.uri;}
export async function importFaceScan(): Promise<string | undefined> {
  const result=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true,multiple:false});
  if(result.canceled)return;
  const selected=result.assets[0], source=new File(selected.uri);
  try{if(!selected.name.toLowerCase().endsWith('.glb')||source.size>MAX_SCAN_BYTES)throw Error('Choose a head-only GLB model under 16 MB. Full rigged characters need the compatible-character importer.');
  return await commitFaceSource(source,'external');}finally{if(source.uri.startsWith(Paths.cache.uri)&&source.exists)source.delete();}
}
async function commitFaceSource(source:File,provenance:'photo'|'external'|'tracked',captureId?:string){
 return withFaceStorage(async()=>{
  validateFaceScan(await source.arrayBuffer());
  // Decode the candidate and confirm usable head bounds before replacing a good scan.
  const candidate=await loadFaceScan(source.uri);
  try { attachFaceScan(new THREE.Group(),candidate.scene); }
  finally { disposeAvatar(candidate.scene);candidate.cleanup(); }
  directory().create({intermediates:true,idempotent:true});
  const copy=new File(directory(),`scan-${makeId()}.glb`);
  source.copy(copy);
  try { await AsyncStorage.setItem(KEY,JSON.stringify(readFaceRecord(JSON.stringify({uri:copy.uri,source:provenance,...(captureId?{captureId}:{})})))); } catch(e) { copy.delete(); throw e; }
  // Metadata commits before cleanup; a failed replacement preserves the last scan.
  for(const file of directory().list()) if(file instanceof File&&managed(file.uri)&&file.uri!==copy.uri)try{file.delete();}catch{}
  return copy.uri;
 });
}
export async function installGeneratedFace(bytes:ArrayBuffer,provenance:'photo'|'tracked'='photo',captureId?:string){
  validateFaceScan(bytes);
  const folder=new Directory(Paths.cache,'thread-face-install');folder.create({idempotent:true,intermediates:true});
  const source=new File(folder,`generated-${makeId()}.glb`);source.create();source.write(new Uint8Array(bytes));
  try{return await commitFaceSource(source,provenance,captureId);}finally{if(source.exists)source.delete();}
}
export async function removeFaceScan(expectedUri?:string) {
 return withFaceStorage(async()=>{
  if(expectedUri&&!managed(expectedUri))throw Error('Invalid saved face model.');
  const expectedName=expectedUri?new File(expectedUri).name:undefined;
  const current=expectedName?readFaceRecord(await AsyncStorage.getItem(KEY))?.uri:undefined;
  for(const folder of captureFolders('wardrobe-face'))if(folder.exists)for(const file of folder.list())if(file instanceof File&&managed(file.uri)&&(!expectedName||file.name===expectedName))file.delete();
  if(!expectedName||current&&new File(current).name===expectedName)await AsyncStorage.removeItem(KEY);
 });
}
