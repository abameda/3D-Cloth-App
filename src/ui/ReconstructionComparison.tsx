import React,{useState} from 'react';
import {Image,View} from 'react-native';
import type {InstalledReconstruction} from '../reconstruction';
import {defaultAppearance} from '../domain/appearance';
import {resolveAvatarOutfit} from '../domain/avatar';
import {AvatarView} from './AvatarView';
import {Button,Chip,Label,Notice,Section,ui} from './primitives';

export function ReconstructionComparison({capture}:{capture:InstalledReconstruction}){
 const [index,setIndex]=useState(0),[angle,setAngle]=useState(-(capture.job.views?.[0]?.yaw??0));
 // Camera orbit and model rotation have opposite signs.
 function select(value:number){setIndex(value);setAngle(-(capture.job.views?.[value]?.yaw??0));}
 const view=capture.job.views?.[index];
 return <Section title="Compare with my photos">
  <Label muted>{view?.label??`Photo ${index+1} · camera angle was not recorded`}</Label>
  <View style={{flexDirection:'row',gap:10,alignItems:'flex-start'}}>
   <View style={{flex:1,gap:8}}><Label size={14} weight="600">Capture photo</Label>{capture.photos[index]?<Image source={{uri:capture.photos[index]}} resizeMode="contain" style={{height:310,width:'100%'}} accessibilityLabel={`Original capture ${index+1}: ${view?.label??'unlabeled view'}`}/>:<Notice>Photo references are unavailable. Capture again to compare.</Notice>}</View>
   <View style={{flex:1,gap:8}}><Label size={14} weight="600">Reconstructed 3D</Label><AvatarView key={capture.uri} assetUri={capture.uri} height={310} outfit={resolveAvatarOutfit({},[],'owned')} angle={angle} zoom={1} appearance={defaultAppearance} onRotate={setAngle}/></View>
  </View>
  <Label muted size={14}>View labels describe the capture guide; they are not calibrated camera positions. Drag the model to match the photograph. Inspect likeness, skin or fabric texture, seams, holes and missing surfaces from both sides.</Label>
  <View style={ui.row}><Button title="Previous photo" secondary disabled={index===0} style={{flex:1}} onPress={()=>select(index-1)}/><Button title="Next photo" secondary disabled={index>=capture.photos.length-1} style={{flex:1}} onPress={()=>select(index+1)}/></View>
  <View style={ui.wrap}>{[{title:'Front',yaw:0},{title:'Left',yaw:Math.PI/2},{title:'Right',yaw:-Math.PI/2},{title:'Back',yaw:Math.PI}].map(item=>{
   const photo=capture.job.views?.findIndex(v=>Math.abs(v.yaw-item.yaw)<.01)??-1;
   return <Chip key={item.title} title={item.title} selected={Math.abs(angle+item.yaw)<.04} onPress={()=>{if(photo>=0)select(photo);else setAngle(-item.yaw);}}/>;
  })}</View>
  <Notice>{capture.job.kind==='garment'?'This is your reconstructed garment surface. It is saved with this wardrobe piece; body fitting, layers and draping are still unavailable.':capture.job.kind==='body'?'This is your reconstructed body surface. Physical scale and avatar registration are still unverified.':'This is your reconstructed head, before placement on the preview body. Facial likeness is unverified until you review your real capture.'}</Notice>
 </Section>;
}
