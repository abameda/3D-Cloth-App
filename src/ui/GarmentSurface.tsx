import React,{useCallback,useEffect,useState} from 'react';
import {AppState,View} from 'react-native';
import {useFocusEffect,useIsFocused} from '@react-navigation/native';
import {findInstalledReconstruction,type InstalledReconstruction} from '../reconstruction';
import type {Garment} from '../domain/types';
import {defaultAppearance} from '../domain/appearance';
import {resolveAvatarOutfit} from '../domain/avatar';
import {AvatarView} from './AvatarView';
import {Button,Label,ui} from './primitives';

/** One actual captured garment at a time bounds GL memory while preserving its original texture. */
export function GarmentSurface({garment,onReview}:{garment:Garment|undefined;onReview:()=>void}){
  const focused=useIsFocused(),[foreground,setForeground]=useState(AppState.currentState==='active'),[surface,setSurface]=useState<InstalledReconstruction>(),[angle,setAngle]=useState(0),[message,setMessage]=useState('');
  useEffect(()=>{const sub=AppState.addEventListener('change',value=>setForeground(value==='active'));return()=>sub.remove();},[]);
  useFocusEffect(useCallback(()=>{let active=true;setSurface(undefined);setAngle(0);setMessage('');if(garment?.source==='owned')void findInstalledReconstruction('garment',garment.id).then(value=>{if(active)setSurface(value);}).catch(()=>{if(active)setMessage('The saved 3D surface needs recovery. Reopen its capture.');});return()=>{active=false;};},[garment?.id,garment?.source]));
  if(!garment||(!surface&&!message))return null;
  return <View style={{gap:10}}>
    <View style={ui.between}><View style={{flex:1}}><Label weight="600">{garment.name}</Label><Label muted size={13}>Your captured 3D surface · not fitted</Label></View></View>
    {surface&&focused&&foreground&&<AvatarView key={surface.uri} assetUri={surface.uri} height={230} outfit={resolveAvatarOutfit({},[],'owned')} angle={angle} zoom={1} appearance={defaultAppearance} onRotate={setAngle}/>}
    <Label muted size={13}>{message||'Drag to inspect your actual garment geometry and texture. It remains separate from the character until fitting is validated.'}</Label>
    <Button title="Compare capture or make 3D" secondary onPress={onReview}/>
  </View>;
}
