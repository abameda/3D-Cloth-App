import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, View } from 'react-native';
import { useIsFocused, useFocusEffect, useNavigation, usePreventRemove } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { resolveAvatarOutfit } from '../domain/avatar';
import { defaultAppearance, type AvatarAppearance } from '../domain/appearance';
import { getFaceScan, getFaceModel, importFaceScan, removeFaceScan } from '../faceScan';
import * as Clipboard from 'expo-clipboard';
import { choosePhoto } from '../media';
import { externalCharacterPrompt } from '../domain/characterPrompt';
import { supportsNativeFaceScan } from '../ui/NativeFaceScanner';
import { categoryLabels } from '../domain/types';
import { useWardrobe } from '../store';
import { useDraft } from '../useDraft';
import { AvatarView } from '../ui/AvatarView';
import { Button, Chip, Label, Notice, Screen, Section, ui } from '../ui/primitives';

export function AvatarScreen() {
  const {state,dispatch}=useWardrobe();
  const navigation=useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const focused=useIsFocused();
  const [foreground,setForeground]=useState(AppState.currentState==='active');
  const [angle,setAngle]=useState(0),[zoom,setZoom]=useState(1);
  const [mode,setMode]=useState<'real'|'custom'>(state.profile.avatarMode??'real'),[scan,setScan]=useState<string>();
  const [method,setMethod]=useState<'scan'|'external'|'manual'>(state.profile.avatarMode==='custom'?'manual':'scan'),[source,setSource]=useState('legacy'),[greeting,setGreeting]=useState(0);
  const [appearance,setAppearance]=useState<AvatarAppearance>(state.profile.avatar??defaultAppearance);
  const [customize,setCustomize]=useState(false),[pieces,setPieces]=useState(false),[busy,setBusy]=useState(true),[message,setMessage]=useState('');
  const changed=JSON.stringify(appearance)!==JSON.stringify(state.profile.avatar??defaultAppearance);
  useDraft(changed||busy);
  usePreventRemove(busy||changed,({data})=>{
    if(busy){Alert.alert('Please wait','Finish importing or removing your face scan first.');return;}
    Alert.alert('Discard avatar changes?','Your saved avatar will stay as it is.',[{text:'Keep editing',style:'cancel'},{text:'Discard',style:'destructive',onPress:()=>navigation.dispatch(data.action)}]);
  });
  useEffect(()=>{setAppearance(state.profile.avatar??defaultAppearance);},[state.profile.avatar]);
  useEffect(()=>{let active=true;void getFaceModel().then(model=>{if(active){setScan(model?.uri);setSource(model?.source??'legacy');if(model?.source==='external'&&state.profile.avatarMode!=='custom')setMethod('external');}}).catch(e=>{if(active)setMessage(e instanceof Error?e.message:'Couldn’t read your face scan.');}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[]);
  useFocusEffect(useCallback(()=>{let active=true;void getFaceModel().then(model=>{if(active){setScan(model?.uri);setSource(model?.source??'legacy');}}).catch(()=>{});return()=>{active=false;};},[]));
  useEffect(()=>{const sub=AppState.addEventListener('change',value=>setForeground(value==='active'));return()=>sub.remove();},[]);
  const outfit=useMemo(()=>resolveAvatarOutfit(state.outfits[state.dataset],state.garments,state.dataset),[state.outfits,state.garments,state.dataset]);
  const activeAngle=((angle%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
  const scanUri=mode==='real'?scan:undefined;
  const canRender=mode==='custom'||!!scanUri;
  function change<K extends keyof AvatarAppearance>(key:K,value:AvatarAppearance[K]){setAppearance(current=>({...current,[key]:value}));}
  function selectMode(value:'real'|'custom'){if(busy)return;setMode(value);dispatch({type:'profile/set',profile:{...state.profile,avatarMode:value}});}
  return <Screen>
    <Label size={24} weight="600">Create yourself</Label>
    <View style={ui.wrap}>{([{id:'scan',title:'Scan my face'},{id:'external',title:'AI references'},{id:'manual',title:'Build my avatar'}]as const).map(option=><Chip key={option.id} title={option.title} selected={method===option.id} onPress={()=>{if(busy)return;setMethod(option.id);selectMode(option.id==='manual'?'custom':'real');if(option.id==='manual')setCustomize(true);}}/>)}</View>
    {method==='external'&&<View style={{gap:12}}><Label muted>Use the prompt with your chosen image model, then bring back references or a compatible head model. You choose which photos to upload externally.</Label><Button title="Copy character prompt" icon="photo" onPress={()=>{void Clipboard.setStringAsync(externalCharacterPrompt).then(()=>setMessage('Prompt copied. Attach your own photos in the external model.')).catch(()=>setMessage('Clipboard is unavailable. Select and copy the prompt below.'));}}/><Label selectable size={14}>{externalCharacterPrompt}</Label><Button title="Import a head model (.glb)" secondary disabled={busy} onPress={()=>{setBusy(true);void importFaceScan().then(uri=>{if(uri){setScan(uri);setSource('external');setMessage('Head model imported. Review all sides before relying on its likeness.');}}).catch(e=>setMessage(e instanceof Error?e.message:'Import failed. The previous model was kept.')).finally(()=>setBusy(false));}}/><Button title="Save an image reference" secondary disabled={busy} onPress={()=>{setBusy(true);void choosePhoto(false).then(uri=>{if(uri){dispatch({type:'profile/set',profile:{...state.profile,imageUri:uri}});setMessage('Image saved as your reference portrait. It is not a 3D model. Match it in the manual editor, or import a usable head model.');}}).catch(e=>setMessage(e instanceof Error?e.message:'Couldn’t read that reference.')).finally(()=>setBusy(false));}}/><Label muted size={13}>Images are modeling references. Automatic reference-to-character conversion and full-body rig import remain unfinished. Synthetic views are not measured capture evidence.</Label></View>}
    {method==='scan'&&<>{supportsNativeFaceScan()&&<Button title="Live front-camera scan" icon="camera" onPress={()=>navigation.navigate('LiveFace')}/>}<Label muted size={13}>Native live tracking needs an installed Thread build and supported TrueDepth hardware. Guided RGB capture remains available. Neither method is Face ID or identity verification.</Label></>}
    {method==='scan'&&!scan&&<Section title="Your photos become the model"><Label>Capture overlapping angles. Your local computer isolates the subject, measures the geometry, rebuilds textures and sends the result back automatically.</Label><Notice>The photo pipeline is implemented. Real face likeness still needs validation with your own capture. The surrounding preview body is standard; face photos do not measure your body.</Notice></Section>}
    {method==='scan'&&<Button title={scan?'Compare or recapture my face':'Create my face from photos'} icon="camera" secondary disabled={busy} onPress={()=>navigation.navigate('Capture',{kind:'face'})}/>}
    {method==='scan'&&<Button title="Capture or review my body" secondary onPress={()=>navigation.navigate('Capture',{kind:'body'})}/>}
    {canRender&&(focused&&foreground?<AvatarView key={scanUri??'custom'} outfit={outfit} angle={angle} zoom={zoom} appearance={appearance} scanUri={scanUri} greeting={greeting} room="home" onRotate={setAngle}/>:<Notice>3D rendering is paused while this screen is inactive.</Notice>)}
    {canRender&&<View style={{gap:12}}><Label muted size={14}>Drag to turn, or choose a view.</Label><View style={ui.wrap}>{[{title:'Front',value:0},{title:'Side',value:Math.PI/2},{title:'Back',value:Math.PI}].map(view=><Chip key={view.title} title={view.title} selected={Math.abs(activeAngle-view.value)<.04} onPress={()=>setAngle(view.value)}/>)}</View><View style={ui.wrap}><Button title="Closer" secondary disabled={zoom>=1.4} onPress={()=>setZoom(z=>Math.min(1.4,Number((z+.1).toFixed(1))))}/><Button title="Further" secondary disabled={zoom<=.8} onPress={()=>setZoom(z=>Math.max(.8,Number((z-.1).toFixed(1))))}/><Button title="Reset view" secondary onPress={()=>{setAngle(0);setZoom(1);}}/></View></View>}
    {mode==='real'&&scan&&<Label muted size={14}>{source==='tracked'?'Your tracked face surface':source==='external'?'Your imported head model':source==='photo'?'Your photo-reconstructed face':'Your face model'} is preserved on a standard preview body. This does not reconstruct your body measurements. Face scans stay on this device and are not included in backup or cloud sync.</Label>}
    {mode==='custom'&&<><Label muted size={14}>A stylized avatar you can adjust. It does not reproduce your real facial features.</Label><Button title={customize?'Hide customization':'Customize my avatar'} secondary onPress={()=>setCustomize(value=>!value)}/></>}
    {mode==='custom'&&customize&&<>
      <Section title="Skin tone"><View style={ui.wrap}>{(['porcelain','light','sand','warm','tan','deep','rich'] as const).map(value=><Chip key={value} title={value[0].toUpperCase()+value.slice(1)} selected={appearance.skin===value} onPress={()=>change('skin',value)}/>)}</View></Section>
      <Section title="Hair"><View style={ui.wrap}>{(['black','brown','blonde','grey'] as const).map(value=><Chip key={value} title={value[0].toUpperCase()+value.slice(1)} selected={appearance.hair===value} onPress={()=>change('hair',value)}/>)}</View><View style={ui.wrap}>{(['short','long','none'] as const).map(value=><Chip key={value} title={value==='none'?'No hair':`${value[0].toUpperCase()+value.slice(1)} hair`} selected={appearance.hairstyle===value} onPress={()=>change('hairstyle',value)}/>)}</View></Section>
      <Section title="Body shape"><View style={ui.wrap}>{(['slim','regular','broad'] as const).map(value=><Chip key={value} title={value[0].toUpperCase()+value.slice(1)} selected={appearance.build===value} onPress={()=>change('build',value)}/>)}</View></Section>
      <Section title="Face shape"><View style={ui.wrap}>{(['oval','round','square']as const).map(value=><Chip key={value} title={value} selected={appearance.faceShape===value} onPress={()=>change('faceShape',value)}/>)}</View></Section>
      <Section title="Eyes"><View style={ui.wrap}>{(['natural','wide']as const).map(value=><Chip key={value} title={value} selected={appearance.eyes===value} onPress={()=>change('eyes',value)}/>)}</View></Section>
      <Section title="Nose"><View style={ui.wrap}>{(['small','medium','strong']as const).map(value=><Chip key={value} title={value} selected={appearance.nose===value} onPress={()=>change('nose',value)}/>)}</View></Section>
      <Section title="Brows"><View style={ui.wrap}>{(['soft','bold']as const).map(value=><Chip key={value} title={value} selected={appearance.brows===value} onPress={()=>change('brows',value)}/>)}</View></Section>
      <Section title="Expression"><View style={ui.wrap}>{(['natural','smile']as const).map(value=><Chip key={value} title={value} selected={appearance.mouth===value} onPress={()=>change('mouth',value)}/>)}</View></Section>
      <Section title="Height"><View style={ui.wrap}>{(['short','average','tall']as const).map(value=><Chip key={value} title={value} selected={appearance.height===value} onPress={()=>change('height',value)}/>)}</View></Section>
      <Button title="Wave hello" secondary onPress={()=>setGreeting(value=>value+1)}/>
      {changed&&<><Button title="Save my avatar" icon="check" onPress={()=>{dispatch({type:'profile/set',profile:{...state.profile,avatar:appearance}});setMessage('Avatar choices updated. Any storage problem will appear in the save banner.');}}/><Button title="Discard avatar changes" secondary onPress={()=>setAppearance(state.profile.avatar??defaultAppearance)}/></>}
    </>}
    {!!message&&<Notice>{message}</Notice>}
    {canRender&&<><Notice>{outfit.sample?'Showing sample clothes. Choose your outfit on Home to see your own selection.':'Clothes use category shapes, your selected colors and approximate cuts. They are not exact copies of your photos or a fit prediction.'}</Notice><Button title="Choose my outfit" icon="wardrobe" onPress={()=>navigation.navigate('Main',{screen:'Home'})}/><Button title={pieces?'Hide outfit details':'Show outfit details'} secondary onPress={()=>setPieces(value=>!value)}/>{pieces&&<Section title="On your character">{outfit.pieces.map(piece=><Label key={piece.category}>{piece.name} · {categoryLabels[piece.category]}</Label>)}{outfit.notices.map(notice=><Notice key={notice}>{notice}</Notice>)}</Section>}</>}
    {mode==='real'&&scan&&<Button title="Remove face from this character" danger disabled={busy} onPress={()=>Alert.alert('Remove this face from the character?','This deletes the face model on this phone. Capture photos on the computer and comparison photos on this phone remain. Use Compare or recapture my face → Delete capture to remove the full capture, or Privacy → Delete all reconstruction captures and models.',[{text:'Cancel',style:'cancel'},{text:'Remove face',style:'destructive',onPress:()=>{setBusy(true);void removeFaceScan().then(()=>setScan(undefined)).catch(()=>setMessage('Removal did not finish. Try again.')).finally(()=>setBusy(false));}}])}/>}
  </Screen>;
}
