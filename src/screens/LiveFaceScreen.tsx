import React,{useEffect,useRef,useState} from 'react';
import {Alert,AppState,Image,View} from 'react-native';
import {useCameraPermissions} from 'expo-camera';
import {Directory,File,Paths} from 'expo-file-system';
import {toByteArray,fromByteArray} from 'base64-js';
import {useIsFocused,usePreventRemove} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation';
import {faceScanViews,faceObservationSchema,canCaptureFaceView,assertFaceCaptureAnchor,packTrackedFace,type FaceObservation,type TrackedFacePacket} from '../domain/trackedFace';
import {defaultAppearance} from '../domain/appearance';
import {resolveAvatarOutfit} from '../domain/avatar';
import {makeId} from '../domain/state';
import {useDraft} from '../useDraft';
import {useWardrobe} from '../store';
import {installGeneratedFace} from '../faceScan';
import {NativeFaceScanner,supportsNativeFaceScan,type NativeFaceScannerRef,type NativeFaceCapture} from '../ui/NativeFaceScanner';
import {AvatarView} from '../ui/AvatarView';
import {Button,Label,Notice,Screen,ui} from '../ui/primitives';

export function LiveFaceScreen({navigation}:NativeStackScreenProps<RootStackParamList,'LiveFace'>){
  const {state,dispatch}=useWardrobe(),focused=useIsFocused(),supported=supportsNativeFaceScan();
  const [permission,requestPermission]=useCameraPermissions(),camera=useRef<NativeFaceScannerRef|null>(null);
  const [attempt,setAttempt]=useState(0),[live,setLive]=useState(false),[face,setFace]=useState<FaceObservation>(),[count,setCount]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[candidate,setCandidate]=useState<{uri:string;bytes:ArrayBuffer;image:string}>(),[angle,setAngle]=useState(0);
  useDraft(live||!!candidate||busy);
  const latestProfile=useRef(state.profile);latestProfile.current=state.profile;
  const attemptRef=useRef(0),anchor=useRef<string|undefined>(undefined),liveRef=useRef(false);liveRef.current=live;
  const first=useRef<NativeFaceCapture|undefined>(undefined),surfaces=useRef<TrackedFacePacket[]>([]),generation=useRef(0),operation=useRef(false),candidateUri=useRef<string|undefined>(undefined);
  usePreventRemove(busy,()=>Alert.alert('Please wait','Finish capturing or saving this face surface.'));
  function clear(){generation.current++;liveRef.current=false;setLive(false);anchor.current=undefined;setFace(undefined);setCount(0);first.current=undefined;surfaces.current=[];if(candidateUri.current){try{new File(candidateUri.current).delete();}catch{}candidateUri.current=undefined;}setCandidate(undefined);}
  useEffect(()=>{const folder=new Directory(Paths.cache,'thread-live-face');try{if(folder.exists)for(const file of folder.list())if(file instanceof File&&/^candidate-[a-z0-9-]+\.glb$/.test(file.name))file.delete();}catch{setMessage('Private preview cleanup needs attention. Use Privacy to retry local erasure.');}
    const sub=AppState.addEventListener('change',value=>{if(value!=='active'){clear();setMessage('The scan was cleared when the app left the foreground. Restart for consistent tracking.');}});return()=>{sub.remove();generation.current++;if(candidateUri.current)try{new File(candidateUri.current).delete();}catch{}};},[]);
  async function start(){clear();attemptRef.current++;setAttempt(attemptRef.current);setMessage('');if(!permission?.granted){const next=await requestPermission();if(!next.granted){setMessage('Camera permission is needed for live scanning. You can use existing photos in guided capture.');return;}}liveRef.current=true;setLive(true);}
  async function capture(){
    if(!camera.current||operation.current||!face||!canCaptureFaceView(face,faceScanViews[count]))return;
    const token=generation.current,view=faceScanViews[count];operation.current=true;setBusy(true);setMessage('');
    try{
      const packet=await camera.current.capture(view.yaw,view.pitch);if(token!==generation.current)return;
      anchor.current=assertFaceCaptureAnchor(first.current?.anchorId??face.anchorId,packet.anchorId);
      // Validate each observed surface; keep only one photograph to bound private in-memory data.
      if(typeof packet.jpegBase64!=='string'||packet.jpegBase64.length>6*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(packet.jpegBase64))throw Error('The camera photograph is invalid. Restart the scan.');
      const image=toByteArray(packet.jpegBase64);if(image.length>4*1024*1024||fromByteArray(image)!==packet.jpegBase64)throw Error('The camera photograph is invalid. Restart the scan.');
      packTrackedFace({positions:packet.positions,indices:packet.indices,uvs:packet.uvs},image);
      if(!first.current)first.current=packet;
      surfaces.current.push({positions:packet.positions,indices:packet.indices,uvs:packet.uvs});
      const next=count+1;setCount(next);
      if(next===faceScanViews.length){
        liveRef.current=false;setLive(false);anchor.current=undefined;const front=first.current!;
        if(surfaces.current.some(p=>p.positions.length!==front.positions.length||p.indices.length!==front.indices.length||p.indices.some((value,index)=>value!==front.indices[index])))throw Error('Tracking changed during capture. Restart with one face.');
        const positions=front.positions.map((_,index)=>surfaces.current.reduce((sum,p)=>sum+p.positions[index],0)/surfaces.current.length);
        const bytes=packTrackedFace({positions,indices:front.indices,uvs:front.uvs},toByteArray(front.jpegBase64));
        const directory=new Directory(Paths.cache,'thread-live-face');directory.create({idempotent:true,intermediates:true});
        const file=new File(directory,`candidate-${makeId()}.glb`);file.create();file.write(new Uint8Array(bytes));candidateUri.current=file.uri;
        setCandidate({uri:file.uri,bytes,image:`data:image/jpeg;base64,${front.jpegBase64}`});first.current=undefined;surfaces.current=[];
      }
    }catch(e){setMessage(e instanceof Error?e.message:'Couldn’t capture this view. Try again.');}
    finally{operation.current=false;setBusy(false);}
  }
  async function useFace(){if(!candidate||operation.current)return;operation.current=true;setBusy(true);try{await installGeneratedFace(candidate.bytes,'tracked');dispatch({type:'profile/set',profile:{...latestProfile.current,avatarMode:'real'}});clear();navigation.popTo('Avatar');}catch(e){setMessage(e instanceof Error?e.message:'Saving failed. Your previous face was kept.');}finally{operation.current=false;setBusy(false);}}
  const view=faceScanViews[Math.min(count,faceScanViews.length-1)],ready=!!face?.anchorId&&canCaptureFaceView(face,view);
  return <Screen>
    <Label size={25} weight="600">Scan my face</Label>
    {!supported?<><Notice>This build cannot run native live face tracking. It needs an installed Thread iOS build and a supported TrueDepth phone; Expo Go and Android retain guided RGB capture.</Notice><Button title="Use guided photo capture" icon="camera" onPress={()=>navigation.navigate('Capture',{kind:'face'})}/></>:<>
      {!live&&!candidate&&<><Label>Start looking straight at the camera in steady light. Then follow the measured head-pose guide with a neutral expression.</Label><Notice>This uses Apple’s tracked face-surface model and your photograph, on this phone. It does not reconstruct hair, ears, the back of your head or your body, and it is not Face ID or identity verification. Review likeness before using it.</Notice><Button title="Start live face scan" icon="camera" disabled={busy} onPress={()=>void start()}/></>}
      {live&&focused&&NativeFaceScanner&&<View style={{gap:12}}>
        <NativeFaceScanner key={attempt} ref={camera} running={live&&focused} style={{height:390,borderRadius:16,overflow:'hidden'}} onFaceUpdate={event=>{
          if(attempt!==attemptRef.current||!liveRef.current)return;
          const value=faceObservationSchema.safeParse(event.nativeEvent);
          const incoming=value.success?value.data:undefined;
          if((anchor.current&&(!incoming?.tracked||incoming.anchorId?.toLowerCase()!==anchor.current))||(!incoming?.tracked&&first.current)){
            clear();setMessage('Tracking was lost or changed. The poses were cleared; restart with one face.');return;
          }
          if(incoming?.tracked&&!incoming.anchorId){setFace(undefined);setMessage('Update the installed Thread native build to use live scanning.');return;}
          if(incoming?.tracked&&incoming.anchorId)anchor.current=incoming.anchorId.toLowerCase();
          setFace(incoming);if(typeof event.nativeEvent.error==='string')setMessage(event.nativeEvent.error.slice(0,200));
        }}/>

        <Label size={20} weight="600">{view.label}</Label><Label muted>{count} of {faceScanViews.length} poses checked · {face?.tracked?'Face tracked':'Looking for your face'}</Label>
        <Label muted size={14}>{!face?.tracked?'Keep your face visible.':face.framed===false?'Move the phone further away so your face is fully visible.':(face.jawOpen>.15||face.blinkLeft>.5||face.blinkRight>.5)?'Relax your mouth and keep your eyes open.':ready?'Pose ready. Hold still and capture.':'Turn gently until this pose is ready.'}</Label>
        <Button title="Capture this pose" icon="camera" loading={busy} disabled={!ready} onPress={()=>void capture()}/><Button title="Restart scan" secondary disabled={busy} onPress={()=>void start()}/>
      </View>}
      {candidate&&focused&&<View style={{gap:12}}>
        <Label weight="600">Review your tracked face surface</Label><Image source={{uri:candidate.image}} resizeMode="contain" style={{height:190}} accessibilityLabel="Neutral camera photograph used to texture this surface"/>
        <AvatarView assetUri={candidate.uri} height={320} outfit={resolveAvatarOutfit({},[],'owned')} angle={angle} zoom={1} appearance={defaultAppearance} onRotate={setAngle}/>
        <View style={ui.row}><Button title="Front" secondary onPress={()=>setAngle(0)}/><Button title="Side" secondary onPress={()=>setAngle(Math.PI/2)}/><Button title="Back" secondary onPress={()=>setAngle(Math.PI)}/></View>
        <Notice>Geometry averages the tracked face surface across checked poses. Texture comes from the neutral front photograph; unseen surfaces and side texture are not faithfully reconstructed. This is a static face surface on the standard preview body, not a complete head or an expression rig. Accept only if the result is recognizable and useful to you.</Notice>
        <Button title="Use this face surface" disabled={busy} onPress={()=>void useFace()}/><Button title="Discard and rescan" secondary disabled={busy} onPress={()=>void start()}/>
      </View>}
    </>}
    {!!message&&<Notice>{message}</Notice>}
  </Screen>;
}
