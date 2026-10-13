import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { resolveAvatarOutfit } from '../domain/avatar';
import { defaultAppearance } from '../domain/appearance';
import type { Category, Dataset, Garment, Outfit, Profile } from '../domain/types';
import { getFaceModel } from '../faceScan';
import { AvatarView } from './AvatarView';
import { demoKit, type AvatarKit } from './avatarKit';
import { getLocalKit, syncPersonalKit } from '../studio';

let bundledKit: Promise<AvatarKit> | undefined;
import { Button, IconButton, Label, Notice, ui } from './primitives';
import type { RoomView } from './roomScene';

export function OutfitPreview({outfit,garments,dataset,profile,onCustomize,room='home',height,portrait=false,controls=true,onCategorySelect}:{outfit:Outfit;garments:Garment[];dataset:Dataset;profile:Profile;onCustomize:()=>void;room?:RoomView;height?:number;portrait?:boolean;controls?:boolean;onCategorySelect?:(category:Category)=>void}) {
  const focused=useIsFocused(),[foreground,setForeground]=useState(AppState.currentState==='active');
  const [scan,setScan]=useState<string>(),[scanSource,setScanSource]=useState('legacy'),[angle,setAngle]=useState(0),[error,setError]=useState(''),[loaded,setLoaded]=useState(false),[accuracy,setAccuracy]=useState(false),[greeting,setGreeting]=useState(0);
  const resolved=useMemo(()=>resolveAvatarOutfit(outfit,garments,dataset),[outfit,garments,dataset]);
  const [kit,setKit]=useState<AvatarKit>(),[kitSettled,setKitSettled]=useState(false);
  useFocusEffect(useCallback(()=>{
    // Personal kit (synced from the computer) wins; the bundled demo body is the fallback.
    let active=true;
    void (async()=>{
      const local=await getLocalKit().catch(()=>undefined);
      if(local){if(active){setKit(local);setKitSettled(true);}}
      else{bundledKit??=demoKit();const demo=await bundledKit.catch(()=>{bundledKit=undefined;return undefined;});if(active){setKit(demo);setKitSettled(true);}}
      const fresh=await syncPersonalKit().catch(()=>undefined);
      if(active&&fresh)setKit(current=>current?.source==='personal'&&JSON.stringify(current)===JSON.stringify(fresh)?current:fresh);
    })();
    return()=>{active=false;};
  },[]));
  const selectedScan=profile.avatarMode==='custom'?undefined:scan;
  const previewAllowed=!!selectedScan||profile.avatarMode==='custom';
  useEffect(()=>{const subscription=AppState.addEventListener('change',value=>setForeground(value==='active'));return()=>subscription.remove();},[]);
  useFocusEffect(useCallback(()=>{
    let active=true;
    void getFaceModel().then(model=>{if(active){setScan(model?.uri);setScanSource(model?.source??'legacy');setError('');}}).catch(()=>{if(active){setScan(undefined);setError('Your face model could not be opened. Reopen Your character to recover or recapture it.');}}).finally(()=>{if(active)setLoaded(true);});
    return()=>{active=false;};
  },[]));
  return <View style={{gap:10}}>
    {focused&&foreground&&loaded&&kitSettled?<AvatarView key={`${selectedScan??(kit?`kit-${kit.body}-${kit.garments.map(g=>g.uri).join()}`:'custom')}-${room}`} kit={selectedScan?undefined:kit} outfit={resolved} angle={angle} zoom={1} appearance={profile.avatar??defaultAppearance} scanUri={selectedScan} showCharacter={previewAllowed&&room!=='closet'} room={room} height={height} portrait={portrait} greeting={greeting} onRotate={setAngle} onCategorySelect={onCategorySelect}/>:<View style={{height:height??380,justifyContent:'center'}}><Label muted>Opening your dressing room…</Label></View>}
    {controls&&<>
      {previewAllowed?<View style={ui.between}><Label muted size={13} style={{flex:1}}>Drag to turn</Label><View style={ui.row}><IconButton icon="refresh" label="Choose front, side or back view" onPress={()=>Alert.alert('Character view','Choose a view.',[{text:'Front',onPress:()=>setAngle(0)},{text:'Side',onPress:()=>setAngle(Math.PI/2)},{text:'Back',onPress:()=>setAngle(Math.PI)},{text:'Cancel',style:'cancel'}])}/>{profile.avatarMode==='custom'&&<IconButton icon="person" label="Wave hello" onPress={()=>setGreeting(value=>value+1)}/>}<IconButton icon="info" label="About preview accuracy" selected={accuracy} onPress={()=>setAccuracy(value=>!value)}/></View></View>:<Button title="Create my character" icon="person" onPress={onCustomize}/>}
      <Label muted size={12}>{room==='closet'?'3D room · category previews':previewAllowed?(selectedScan?`${scanSource==='tracked'?'Tracked face surface':scanSource==='photo'?'Photo-reconstructed face':scanSource==='external'?'Imported head model':'Face model'} · standard body`:resolved.sample?'Custom avatar · sample clothes':'Custom avatar · clothing shape previews'):'Your room is ready. Choose how to create yourself.'}</Label>

      {accuracy&&<Notice>Category shapes show your chosen colors and cuts. They are not reconstructed garments or a fit prediction. A reconstructed face keeps its original geometry; likeness needs your review.</Notice>}
    </>}
    {!!error&&<Notice error>{error}</Notice>}
    {resolved.notices.map(notice=><Label muted size={13} key={notice}>{notice}</Label>)}
  </View>;
}
