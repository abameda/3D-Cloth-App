import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { readConnection, saveConnection } from './domain/connection';
import { reconstructionJobSchema, type ReconstructionInput, type ReconstructionJob } from './domain/reconstruction';
import { validateFaceScan } from './domain/faceScan';
import { getFaceModel, getStoredFaceRecord, installGeneratedFace, removeFaceScan } from './faceScan';
import { faceCaptureOwnsModel } from './domain/faceRecord';
import { makeId } from './domain/state';
import {captureFolder,captureFolders,temporaryCaptureStorage} from './privateCaptureStorage';

const KEY='thread.local-reconstruction.connection.v1',JOBS='thread.local-reconstruction.jobs.v1';
const storage={get:()=>SecureStore.getItemAsync(KEY),set:(value:string)=>SecureStore.setItemAsync(KEY,value),remove:()=>SecureStore.deleteItemAsync(KEY)};
export const getReconstructionConnection=()=>readConnection(storage);
export const setReconstructionConnection=(url:string,token:string)=>saveConnection(storage,url,token,false);
export async function disconnectReconstruction(){await storage.remove();}

async function call(path:string,body?:unknown,binary=false){
  const config=await getReconstructionConnection();
  if(!config.url||!config.token)throw Error('Connect your local reconstruction computer in Profile → Reconstruction computer first.');
  const response=await fetch(config.url+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(body?120000:20000),redirect:'error'});
  if(!response.ok)throw Error(response.status===401?'The local computer connection was rejected. Check AI settings.':response.status===429?'Wait before refreshing again.':response.status===409?'This capture is not ready or needs new photos.':'The local computer could not finish this request. Your wardrobe was kept.');
  return binary?response:response.json();
}
export async function checkReconstructionComputer(){const capabilities=await call('/v1/reconstruction/capabilities');if(capabilities.engine!=='local-colmap-openmvs'||capabilities.paidReconstructionServices!==false||capabilities.photoReconstruction!==true)throw Error('Connect the free Thread local reconstruction engine. Paid reconstruction services are unsupported.');if(!capabilities.runtimeReady)throw Error('The computer needs its free local runtime. Run local-engine/setup.ps1 there first.');return capabilities;}
export async function submitReconstruction(input:ReconstructionInput){
  await checkReconstructionComputer();
  const data=await call('/v1/reconstruction/jobs',input),job=reconstructionJobSchema.parse(data.job);
  const ids:string[]=JSON.parse(await AsyncStorage.getItem(JOBS)??'[]');
  await AsyncStorage.setItem(JOBS,JSON.stringify([...new Set([job.id,...ids])].slice(0,30)));
  return job;
}
export async function getReconstructionJob(id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid capture.');return reconstructionJobSchema.parse((await call(`/v1/reconstruction/jobs/${id}`)).job);}
export async function listReconstructions(){return (await call('/v1/reconstruction/jobs')).jobs.map((value:unknown)=>reconstructionJobSchema.parse(value)) as ReconstructionJob[];}
export async function retryReconstruction(id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid capture.');return reconstructionJobSchema.parse((await call(`/v1/reconstruction/jobs/${id}/retry`,{})).job);}
export async function deleteReconstruction(id:string){
  if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid capture.');const config=await getReconstructionConnection();
  const response=await fetch(`${config.url}/v1/reconstruction/jobs/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${config.token}`},signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!response.ok&&response.status!==404)throw Error('The local computer could not remove this capture. Keep it connected and try again.');
  await removeInstalledReconstruction(id);
}
const assetKey=(id:string)=>`thread.reconstruction.asset.${id}`;
const assetFolder=()=>captureFolder('wardrobe-reconstructed-assets');
export interface InstalledReconstruction {uri:string;folderUri:string;job:ReconstructionJob;photos:string[];savedAt:number}
function insideAssets(uri:string){return captureFolders('wardrobe-reconstructed-assets').some(folder=>uri.startsWith(folder.uri.replace(/\/$/,'')+'/'));}
export async function getInstalledReconstruction(id:string):Promise<InstalledReconstruction|undefined>{
  const raw=await AsyncStorage.getItem(assetKey(id));if(!raw)return;
  const value=JSON.parse(raw) as InstalledReconstruction;
  if(!value.job)return; // Old model-only records are downloaded again with their photo references.
  value.job=reconstructionJobSchema.parse(value.job);
  const prefix=value.folderUri?.replace(/\/$/,'')+'/';
  if(value.job.id!==id||!insideAssets(value.folderUri)||!new Directory(value.folderUri).name.startsWith(id+'-')||!Array.isArray(value.photos)||value.photos.some(uri=>typeof uri!=='string'||!uri.startsWith(prefix)||!/\/\d{4}\.jpg$/.test(uri)))throw Error('Your saved capture reference is invalid.');
  let restored=value;
  if(temporaryCaptureStorage&&!value.folderUri.startsWith(assetFolder().uri.replace(/\/$/,'')+'/')){
    const old=new Directory(value.folderUri),destination=new Directory(assetFolder(),`${id}-${makeId()}`);
    if(!old.exists)return;
    assetFolder().create({idempotent:true,intermediates:true});old.copy(destination);
    const oldPrefix=old.uri.replace(/\/$/,'')+'/',newPrefix=destination.uri.replace(/\/$/,'')+'/';
    const updated={...value,folderUri:destination.uri,photos:value.photos.map(uri=>uri.replace(oldPrefix,newPrefix)),uri:value.uri.startsWith(oldPrefix)?value.uri.replace(oldPrefix,newPrefix):value.uri};
    try{await AsyncStorage.setItem(assetKey(id),JSON.stringify(updated));}catch(e){destination.delete();throw e;}
    old.delete();restored=updated;
  }
  if(restored.job.kind==='face'&&!insideAssets(restored.uri)){
    // Migrate old capture records which pointed at the currently active face file.
    // Archives are independent of character selection; opening an old capture never selects it.
    const current=await getFaceModel().catch(()=>undefined);
    const legacy=faceCaptureOwnsModel(current,id,restored.uri)?current!.uri:restored.uri;
    const allowed=captureFolders('wardrobe-face').some(folder=>legacy.startsWith(folder.uri.replace(/\/$/,'')+'/'))&&/\/scan-[a-z0-9-]+\.glb$/.test(legacy);
    if(!allowed||!new File(legacy).exists)return;
    const bytes=await new File(legacy).arrayBuffer();validateFaceScan(bytes);
    if(!restored.job.quality||bytesToHex(sha256(new Uint8Array(bytes)))!==restored.job.quality.sha256)throw Error('The saved capture model failed its integrity check. Download it again.');
    const file=new File(new Directory(restored.folderUri),`model-${makeId()}.glb`);file.create();file.write(new Uint8Array(bytes));
    const updated={...restored,uri:file.uri};try{await AsyncStorage.setItem(assetKey(id),JSON.stringify(updated));}catch(e){file.delete();throw e;}restored=updated;
  }
  if(!insideAssets(restored.uri))return;
  if(!new File(restored.uri).exists||restored.photos.some(uri=>!new File(uri).exists))return;
  return restored;
}
export async function findInstalledReconstruction(kind:ReconstructionJob['kind'],garmentId?:string){
  const keys=(await AsyncStorage.getAllKeys()).filter(key=>key.startsWith('thread.reconstruction.asset.'));
  const candidates:InstalledReconstruction[]=[];
  for(const key of keys){
    const raw=await AsyncStorage.getItem(key);if(!raw)continue;const metadata=JSON.parse(raw);
    if(metadata?.job?.kind!==kind||metadata?.job?.garmentId!==garmentId)continue;
    const installed=await getInstalledReconstruction(key.slice('thread.reconstruction.asset.'.length));
    if(installed?.job.kind===kind&&installed.job.garmentId===garmentId)candidates.push(installed);
  }
  return candidates.sort((a,b)=>(b.savedAt??0)-(a.savedAt??0))[0];
}
export async function removeInstalledReconstruction(id:string){
  const raw=await AsyncStorage.getItem(assetKey(id));
  if(raw){const value=JSON.parse(raw);if(value.job?.kind==='face'||value.kind==='face'){const current=await getStoredFaceRecord();if(faceCaptureOwnsModel(current,id,value.uri))await removeFaceScan(current!.uri);}}
  for(const folder of captureFolders('wardrobe-reconstructed-assets'))if(folder.exists)for(const file of folder.list())if(file.name.startsWith(id+'-'))file.delete();
  await AsyncStorage.removeItem(assetKey(id));
  const ids:string[]=JSON.parse(await AsyncStorage.getItem(JOBS)??'[]');await AsyncStorage.setItem(JOBS,JSON.stringify(ids.filter(value=>value!==id)));
}
export async function deleteAllComputerCaptures(){
  const config=await getReconstructionConnection();
  if(!config.url||!config.token)throw Error('Connect your private computer before deleting its captures.');
  const response=await fetch(config.url+'/v1/reconstruction/jobs',{method:'DELETE',headers:{Authorization:`Bearer ${config.token}`},signal:AbortSignal.timeout(120000),redirect:'error'});
  if(!response.ok)throw Error('Computer deletion did not finish. Keep the connection and retry.');
  // Keep credentials so a failed local erase can be retried.
  await clearInstalledReconstructions();
}
async function clearInstalledReconstructions(){
  await removeFaceScan();
  for(const folder of captureFolders('wardrobe-reconstructed-assets'))if(folder.exists)folder.delete();
  for(const entry of new Directory(Paths.cache).list())if(entry instanceof Directory&&(entry.name==='thread-captures'||entry.name==='thread-face-install'||entry.name==='thread-live-face'||entry.name.startsWith('thread-face-')))entry.delete();
  const keys=await AsyncStorage.getAllKeys();await AsyncStorage.multiRemove(keys.filter(key=>key===JOBS||key.startsWith('thread.reconstruction.asset.')));
}
export async function eraseGarmentReconstructionAssets(garmentId:string){
  for(const key of (await AsyncStorage.getAllKeys()).filter(key=>key.startsWith('thread.reconstruction.asset.'))){
    const value=JSON.parse(await AsyncStorage.getItem(key)??'null');
    if((value?.job?.garmentId??value?.garmentId)===garmentId)await removeInstalledReconstruction(key.slice('thread.reconstruction.asset.'.length));
  }
}
export async function installReconstruction(job:ReconstructionJob){
  if(job.status!=='reconstructed'||!job.quality)throw Error('This reconstruction is not ready.');
  const existing=await getInstalledReconstruction(job.id);if(existing)return existing;
  const response=await call(`/v1/reconstruction/jobs/${job.id}/artifact`,undefined,true) as Response;
  if(Number(response.headers.get('content-length'))>16*1024*1024)throw Error('This model exceeds the phone’s memory budget.');
  const bytes=await response.arrayBuffer();validateFaceScan(bytes);
  if(bytesToHex(sha256(new Uint8Array(bytes)))!==job.quality.sha256)throw Error('The model failed its integrity check. Download again.');
  const folder=new Directory(assetFolder(),`${job.id}-${makeId()}`);folder.create({idempotent:true,intermediates:true});
  const photos:string[]=[];
  try{
    for(let i=0;i<(job.photoCount??0);i++){
      const reference=await call(`/v1/reconstruction/jobs/${job.id}/photos/${i}`,undefined,true) as Response;
      const photo=new Uint8Array(await reference.arrayBuffer());if(photo.length>3*1024*1024||photo[0]!==255||photo[1]!==216)throw Error('A photo reference failed validation. Download the capture again.');
      const file=new File(folder,`${String(i).padStart(4,'0')}.jpg`);file.create();file.write(photo);photos.push(file.uri);
    }
    const model=new File(folder,'model.glb');model.create();model.write(new Uint8Array(bytes));const uri=model.uri;
    const installed:InstalledReconstruction={uri,folderUri:folder.uri,job,photos,savedAt:Date.now()};
    await AsyncStorage.setItem(assetKey(job.id),JSON.stringify(installed));
    for(const old of assetFolder().list())if(old.name.startsWith(job.id+'-')&&old.uri!==folder.uri)try{old.delete();}catch{} // Successful metadata commit must remain usable if retired-file cleanup fails.
    return installed;
  }catch(e){if(folder.exists)folder.delete();throw e;}
}
export async function activateReconstructionFace(capture:InstalledReconstruction){
  const installed=await getInstalledReconstruction(capture.job.id);
  if(!installed||installed.job.kind!=='face'||!installed.job.quality)throw Error('Download this face surface before using it.');
  const bytes=await new File(installed.uri).arrayBuffer();
  if(bytesToHex(sha256(new Uint8Array(bytes)))!==installed.job.quality.sha256)throw Error('The model failed its integrity check. Download again.');
  return installGeneratedFace(bytes,'photo',installed.job.id);
}
export async function eraseReconstructionAssets(){
  await clearInstalledReconstructions();await disconnectReconstruction();
}
