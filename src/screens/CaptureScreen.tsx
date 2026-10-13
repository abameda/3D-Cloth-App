import React,{useEffect,useRef,useState} from 'react';
import {Alert,AppState,Image,Switch,View} from 'react-native';
import {CameraView,useCameraPermissions} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import {manipulateAsync,SaveFormat} from 'expo-image-manipulator';
import {Directory,File,Paths} from 'expo-file-system';
import {randomUUID} from 'expo-crypto';
import {useIsFocused,usePreventRemove} from '@react-navigation/native';
import type{NativeStackScreenProps} from '@react-navigation/native-stack';
import type{RootStackParamList} from '../navigation';
import {useWardrobe} from '../store';
import {useDraft} from '../useDraft';
import {activateReconstructionFace,findInstalledReconstruction,getReconstructionJob,installReconstruction,listReconstructions,submitReconstruction,retryReconstruction,deleteReconstruction,type InstalledReconstruction} from '../reconstruction';
import {reconstructionStages,type ReconstructionJob,type ReconstructionStage} from '../domain/reconstruction';
import {captureGuide,type CaptureView} from '../domain/captureGuide';
import {Button,Chip,Label,Notice,Screen,Section,ui} from '../ui/primitives';
import {ReconstructionComparison} from '../ui/ReconstructionComparison';
import {inspectReconstructionCapture} from '../ai';
import {temporaryCaptureStorage} from '../privateCaptureStorage';

function removePhotos(photos:string[]){for(const uri of photos)try{new File(uri).delete();}catch{}}

export function CaptureScreen({route,navigation}:NativeStackScreenProps<RootStackParamList,'Capture'>){
 const {kind,garmentId}=route.params,{state,dispatch}=useWardrobe(),guide=captureGuide(kind);
 const focused=useIsFocused(),[foreground,setForeground]=useState(AppState.currentState==='active');
 const [permission,requestPermission]=useCameraPermissions(),camera=useRef<CameraView|null>(null),mounted=useRef(true);
 const [photos,setPhotos]=useState<string[]>([]),[views,setViews]=useState<CaptureView[]|undefined>(),[live,setLive]=useState(false),[busy,setBusy]=useState(false);
 const [cameraReady,setCameraReady]=useState(false),[facing,setFacing]=useState<'front'|'back'>('back');
 const [job,setJob]=useState<ReconstructionJob>(),[message,setMessage]=useState(''),[installed,setInstalled]=useState<InstalledReconstruction>();
 const [useClaude,setUseClaude]=useState(false),installing=useRef(new Set<string>()),operation=useRef(false);
 const requestId=useRef(randomUUID()),photosRef=useRef<string[]>([]);photosRef.current=photos;
 useDraft(busy||photos.length>0);
 usePreventRemove(busy,()=>Alert.alert('Please wait','Finish the current capture, upload, download or deletion before leaving.'));
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;removePhotos(photosRef.current);};},[]);
 useEffect(()=>{const sub=AppState.addEventListener('change',value=>{setForeground(value==='active');if(value!=='active')setLive(false);});return()=>sub.remove();},[]);
 useEffect(()=>{
  let active=true;
  void (async()=>{
   const saved=await findInstalledReconstruction(kind,garmentId);if(active&&saved){setInstalled(saved);setJob(saved.job);}
   try{const jobs=await listReconstructions(),latest=jobs.find(j=>j.kind===kind&&j.garmentId===garmentId);if(active&&latest)setJob(latest);}catch{if(active&&!saved)setMessage('Connect your private computer in Profile → Reconstruction computer before processing a capture.');}
  })().catch(e=>{if(active)setMessage(e instanceof Error?e.message:'Couldn’t restore this capture.');});
  return()=>{active=false;};
 },[kind,garmentId]);
 useEffect(()=>{
  if(!job||!focused||!foreground||!['queued','processing'].includes(job.status))return;
  let active=true;const timer=setTimeout(()=>{void getReconstructionJob(job.id).then(value=>{if(active){setJob(value);setMessage('');}}).catch(e=>{if(active)setMessage(e instanceof Error?e.message:'Your computer is offline. Reopen this screen to check.');});},4000);
  return()=>{active=false;clearTimeout(timer);};
 },[job,focused,foreground,message]);
 async function savePhoto(uri:string){
  const image=await manipulateAsync(uri,[{resize:{width:1200}}],{compress:.9,format:SaveFormat.JPEG});
  const folder=new Directory(Paths.cache,'thread-captures');folder.create({idempotent:true,intermediates:true});const copy=new File(folder,`${randomUUID()}.jpg`);
  try{new File(image.uri).copy(copy);return copy.uri;}catch(e){if(copy.exists)copy.delete();throw e;}finally{if(image.uri.startsWith(Paths.cache.uri)&&image.uri!==uri)removePhotos([image.uri]);}
 }
 async function choose(){
  if(operation.current)return;operation.current=true;setBusy(true);setMessage('');
  try{
   const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:true,selectionLimit:48,quality:1});if(result.canceled)return;
   const copied:string[]=[];try{for(const photo of result.assets)copied.push(await savePhoto(photo.uri));}catch(e){removePhotos(copied);throw e;}finally{removePhotos(result.assets.map(photo=>photo.uri).filter(uri=>uri.startsWith(Paths.cache.uri)));}
   if(!mounted.current){removePhotos(copied);return;}removePhotos(photosRef.current);setPhotos(copied);setViews(undefined);requestId.current=randomUUID();setJob(undefined);setInstalled(undefined);
  }catch(e){setMessage(e instanceof Error?e.message:'Couldn’t prepare these photos.');}finally{operation.current=false;if(mounted.current)setBusy(false);}
 }
 async function scan(){
  if(!permission?.granted){const granted=await requestPermission();if(!granted.granted){setMessage('Camera permission is needed. You can choose existing photos instead.');return;}}
  removePhotos(photosRef.current);setPhotos([]);setViews([]);setJob(undefined);setInstalled(undefined);requestId.current=randomUUID();setCameraReady(false);setLive(true);setMessage('');
 }
 async function takeView(){
  if(!camera.current||operation.current||!cameraReady)return;operation.current=true;setBusy(true);setMessage('');
  try{
   const photo=await camera.current.takePictureAsync({quality:.95});if(!photo)throw Error('Camera capture failed. Try this view again.');
   let uri:string;try{uri=await savePhoto(photo.uri);}finally{if(photo.uri.startsWith(Paths.cache.uri))removePhotos([photo.uri]);}
   if(!mounted.current){removePhotos([uri]);return;}
   const step=guide.steps[photos.length];setPhotos(current=>[...current,uri]);setViews(current=>[...(current??[]),{label:step.label,yaw:step.yaw}]);
   if(photos.length+1===guide.steps.length)setLive(false);
  }catch(e){if(mounted.current)setMessage(e instanceof Error?e.message:'Couldn’t capture this view.');}finally{operation.current=false;if(mounted.current)setBusy(false);}
 }
 async function generate(){
  if(operation.current)return;operation.current=true;setBusy(true);setMessage('');
  try{
   if(useClaude){
    const representatives:string[]=[];
    for(const index of [0,Math.floor(photos.length/3),Math.floor(photos.length*2/3),photos.length-1]){const small=await manipulateAsync(photos[index],[{resize:{width:512}}],{compress:.8,format:SaveFormat.JPEG});try{representatives.push(`data:image/jpeg;base64,${await new File(small.uri).base64()}`);}finally{removePhotos([small.uri]);}}
    const plan=await inspectReconstructionCapture(kind,representatives);if(plan.decision==='retake'){setMessage(plan.guidance.join(' ')||'Retake more overlapping, clear views.');return;}
   }
   const images:string[]=[];for(const uri of photos)images.push(`data:image/jpeg;base64,${await new File(uri).base64()}`);
   const result=await submitReconstruction({kind,garmentId,requestId:requestId.current,images,views,consent:true});setJob(result);removePhotos(photosRef.current);setPhotos([]);setViews(undefined);setMessage('Your computer is processing this capture. You can leave this screen.');
  }catch(e){setMessage(e instanceof Error?e.message:'Upload failed. Retry with the same capture.');}finally{operation.current=false;setBusy(false);}
 }
 async function install(){
  if(!job||operation.current)return;operation.current=true;setBusy(true);setMessage('');
  try{const saved=await installReconstruction(job);if(!mounted.current)return;setInstalled(saved);setMessage('The model and capture photos are saved privately on this phone. Compare every view before relying on this result.');}
  catch(e){if(mounted.current)setMessage(e instanceof Error?e.message:'Couldn’t save this result. Download again.');}finally{operation.current=false;if(mounted.current)setBusy(false);}
 }
 useEffect(()=>{if(job?.status==='reconstructed'&&focused&&foreground&&installed?.job.id!==job.id&&!installing.current.has(job.id)){installing.current.add(job.id);void install();}},[job,focused,foreground,installed]);
 async function eraseCapture(){
  if(!job||operation.current)return;operation.current=true;setBusy(true);setMessage('');
  try{await deleteReconstruction(job.id);setJob(undefined);setInstalled(undefined);setMessage('This capture, its working files, model and comparison photos were removed from the computer and this phone.');}
  catch(e){setMessage(e instanceof Error?e.message:'Deletion did not finish. Keep the computer connected and retry.');}finally{operation.current=false;setBusy(false);}
 }
 const step=guide.steps[Math.min(photos.length,guide.steps.length-1)],saved=installed?.job.id===job?.id?installed:undefined;
 return <Screen>
  <View style={{gap:8}}><Label size={24} weight="700">{kind==='face'?'Capture my face':kind==='garment'?'Capture my real clothes':'Capture my body'}</Label><Label muted>Photograph, reconstruct locally, then compare the result with your actual capture.</Label></View>
  {!live&&<Notice>All reconstruction runs on your private computer. Your iPhone currently captures RGB photos; depth scanning and natural garment fitting are still unavailable.</Notice>}
  {!live&&temporaryCaptureStorage&&<Notice>Expo Go keeps face/body models and comparison photos in private cache storage excluded from device backups. iOS can clear that cache; download again while the computer capture is available. Computer captures expire after 24 hours. An installed Thread build is needed for durable protected storage and final privacy validation.</Notice>}
  {!job&&!live&&<>
   <Section title="Before you capture">{guide.setup.map(text=><Label key={text}>{text}</Label>)}<Label muted>{guide.steps.length} guided views. Gallery sets need 8–48 overlapping photos, with a clear front view first. Photograph all relevant surfaces; unseen details cannot be recovered faithfully.</Label></Section>
   <Button title="Start guided camera capture" icon="camera" disabled={busy} onPress={()=>void scan()}/>
   <Button title="Choose existing capture photos" secondary icon="photo" disabled={busy} onPress={()=>void choose()}/>
   <View style={{gap:8}}><View style={ui.between}><Label style={{flex:1}}>Let Claude check capture quality</Label><Switch accessibilityLabel="Send four capture photos to Claude for paid inspection" value={useClaude} onValueChange={setUseClaude} disabled={busy}/></View><Label muted size={14}>{useClaude?'Four reduced photos will be sent to Anthropic with your saved model and paid API credits. Reconstruction stays local.':'Off: photos go only to the private computer you pair. No AI service receives them.'}</Label></View>
  </>}
  {live&&focused&&foreground&&permission?.granted&&<View style={{gap:12}}>
   <Label weight="600">View {photos.length+1} of {guide.steps.length} · {step.label}</Label>
   <CameraView ref={camera} facing={facing} onCameraReady={()=>setCameraReady(true)} style={{height:360,borderRadius:16,overflow:'hidden'}}/>
   <Label>{step.instruction}</Label>
   {kind==='face'&&<><View style={ui.wrap}><Chip title="Helper · rear camera" selected={facing==='back'} onPress={()=>{if(!busy){setCameraReady(false);setFacing('back');}}}/><Chip title="Front camera" selected={facing==='front'} onPress={()=>{if(!busy){setCameraReady(false);setFacing('front');}}}/></View>{facing==='front'&&<Notice>A stationary selfie while turning your head is unreliable for this engine. Keep your head still; have a helper move the phone.</Notice>}</>}
   <Button title="Take this view" icon="camera" disabled={!cameraReady||busy} loading={busy} onPress={()=>void takeView()}/>
   {!!photos.length&&<Button title="Retake previous view" secondary disabled={busy} onPress={()=>{removePhotos([photos[photos.length-1]]);setPhotos(current=>current.slice(0,-1));setViews(current=>current?.slice(0,-1));}}/>}
   <Button title="Pause capture" secondary disabled={busy} onPress={()=>setLive(false)}/>
  </View>}
  {!!photos.length&&!live&&<>
   <Label weight="600">{photos.length} photos ready</Label><View style={ui.row}>{photos.slice(0,3).map((uri,index)=><Image key={uri} source={{uri}} style={{width:70,height:90,borderRadius:8}} accessibilityLabel={`Capture photo ${index+1}`}/>)}</View>
   {views&&photos.length<guide.steps.length&&<Button title="Continue guided capture" secondary disabled={busy} onPress={()=>{setCameraReady(false);setLive(true);}}/>}
   <Button title="Process my photos locally" icon="check" loading={busy} disabled={photos.length<8||busy} onPress={()=>Alert.alert('Process this capture?',`The full capture goes to your paired private computer. ${useClaude?'Four reduced photos also go to Anthropic for the quality check you enabled.':'No photos go to an AI service.'} Computer files expire after 24 hours while the engine runs. The reconstructed model and comparison photos stay on this phone until you delete them.`,[{text:'Cancel',style:'cancel'},{text:'Process',onPress:()=>void generate()}])}/>
   <Button title="Discard these photos" danger disabled={busy} onPress={()=>{removePhotos(photosRef.current);setPhotos([]);setViews(undefined);requestId.current=randomUUID();}}/>
  </>}
  {job&&<Section title={reconstructionStages[job.stage as ReconstructionStage]??'Preparing your capture'}>
   <Label muted>{job.status==='reconstructed'?'A photo-based surface is ready. Facial likeness and natural clothing fit have not passed end-to-end testing.':job.status==='failed'?job.error:'Processing can continue on your computer while you use the app.'}</Label>
   {job.status==='reconstructed'&&!saved&&<Button title="Download model and comparison photos" loading={busy} onPress={()=>void install()}/>}
   {job.status==='failed'&&job.attempt<2&&<Button title="Retry processing" secondary disabled={busy} onPress={()=>{setBusy(true);void retryReconstruction(job.id).then(setJob).catch(e=>setMessage(e.message)).finally(()=>setBusy(false));}}/>}
   {!['queued','processing'].includes(job.status)&&<Button title="Start a new capture" secondary disabled={busy} onPress={()=>{setJob(undefined);setInstalled(undefined);}}/>}
   <Button title="Delete capture and reconstructed model" danger disabled={busy} onPress={()=>Alert.alert('Delete this capture everywhere?', 'Remove this capture’s source photos, processing files and model from your paired computer, and its model and comparison photos from this phone. Photos originally in your Photos library remain there. If the computer is offline, deletion will need a retry.',[{text:'Cancel',style:'cancel'},{text:'Delete capture',style:'destructive',onPress:()=>void eraseCapture()}])}/>
  </Section>}
  {saved&&focused&&foreground&&<ReconstructionComparison capture={saved}/>}
  {saved&&kind==='face'&&<Button title="Use this face on my character" disabled={busy} onPress={()=>{setBusy(true);void activateReconstructionFace(saved).then(()=>{dispatch({type:'profile/set',profile:{...state.profile,avatarMode:'real'}});navigation.navigate('Avatar');}).catch(e=>setMessage(e instanceof Error?e.message:'This face could not be selected. Your previous character was kept.')).finally(()=>setBusy(false));}}/>}
  {!!message&&<Notice>{message}</Notice>}
 </Screen>;
}
