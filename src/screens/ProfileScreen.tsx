import React, { useEffect, useRef, useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useDraft } from '../useDraft';
import { styles,colors } from '../domain/types';
import { styleInsights } from '../domain/stylist';
import { useWardrobe } from '../store';
import { choosePhoto, removeManagedPhoto } from '../media';
import { unsubmittedPhotoUris } from '../domain/photos';
import { Button, Chip, Field, Label, Notice, Screen, Section, ui } from '../ui/primitives';
import { mergeProfileDraft } from '../domain/profileDraft';
import { SettingsRow } from '../ui/SettingsRow';
import { OutfitPreview } from '../ui/OutfitPreview';

export function ProfileScreen(){
  const {state,dispatch,replacement}=useWardrobe(),navigation=useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [profile,setProfile]=useState(state.profile),[edit,setEdit]=useState(false),[insights,setInsights]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const draftBase=useRef(state.profile),draftReplacement=useRef(replacement);
  const changed=JSON.stringify(profile)!==JSON.stringify(state.profile);useDraft(changed);
  const added=useRef<string[]>([]),submitted=useRef(new Set<string>(state.profile.imageUri?[state.profile.imageUri]:[]));
  useEffect(()=>{const previous=draftBase.current;if(draftReplacement.current!==replacement){setProfile(state.profile);draftReplacement.current=replacement;}else setProfile(draft=>mergeProfileDraft(previous,draft,state.profile));draftBase.current=state.profile;if(state.profile.imageUri)submitted.current.add(state.profile.imageUri);},[state.profile,replacement]);
  useEffect(()=>()=>{unsubmittedPhotoUris(added.current,submitted.current).forEach(removeManagedPhoto);},[]);
  async function portrait(){setBusy(true);try{const uri=await choosePhoto(false);if(uri){added.current.push(uri);setProfile(p=>({...p,imageUri:uri}));}}catch(e){setMessage(e instanceof Error?e.message:'Couldn’t open that photo.');}finally{setBusy(false);}}
  function save(){const submittedProfile={...profile,name:profile.name.trim()};if(submittedProfile.imageUri)submitted.current.add(submittedProfile.imageUri);draftBase.current=submittedProfile;setProfile(submittedProfile);dispatch({type:'profile/set',profile:submittedProfile});setMessage('Preferences updated. Storage errors appear in the save banner.');setEdit(false);}
  return <Screen>
    <OutfitPreview outfit={state.outfits[state.dataset]} garments={state.garments} dataset={state.dataset} profile={state.profile} height={230} portrait controls={false} onCustomize={()=>navigation.navigate('Avatar')}/>
    <View style={ui.between}><View style={{flex:1}}><Label numberOfLines={2} size={25} weight="600">{state.profile.name||'Your Thread'}</Label><Label muted size={13}>A room that feels like you</Label></View><Button title="Edit character" secondary icon="person" onPress={()=>navigation.navigate('Avatar')}/></View>
    <View>
      <SettingsRow title="My preferences" detail="Name, personal style and favorite fits" icon="edit" onPress={()=>setEdit(v=>!v)}/>
      <SettingsRow title="AI stylist" detail="Your existing Claude connection" icon="studio" onPress={()=>navigation.navigate('Connection')}/>
      <SettingsRow title="Reconstruction computer" detail="Free local 3D processing" icon="room" onPress={()=>navigation.navigate('Computer')}/>
      <SettingsRow title="Account" icon="person" onPress={()=>navigation.navigate('Account')}/>
      <SettingsRow title="Privacy and data" icon="lock" onPress={()=>navigation.navigate('Privacy')}/>
      <SettingsRow title="Backup and restore" icon="cloud" onPress={()=>navigation.navigate('Backup')}/>
      <SettingsRow title="Wear history" icon="clock" onPress={()=>navigation.navigate('Looks',{view:'history'})}/>
      <SettingsRow title="What my wardrobe learns" icon="heart" onPress={()=>setInsights(v=>!v)}/>
    </View>
    {edit&&<View style={{gap:18}}>
      <View style={ui.between}><View style={{flex:1}}><Label weight="600">Daily Claude suggestion</Label><Label muted size={13}>Opt in to a cached daily suggestion. Wardrobe or day-detail changes may create a new paid request. Sends metadata and uses your API credits; never replaces your outfit automatically.</Label></View><Switch accessibilityLabel="Enable automatic daily Claude styling using API credits" value={!!profile.dailyAi} onValueChange={dailyAi=>setProfile(p=>({...p,dailyAi}))}/></View>
      <Field label="My name" value={profile.name} onChangeText={name=>setProfile(p=>({...p,name}))} maxLength={60} textContentType="givenName"/>
      <Section title="Personal style"><View style={ui.wrap}>{styles.map(style=><Chip key={style} title={style} selected={profile.styles.includes(style)} onPress={()=>setProfile(p=>({...p,styles:p.styles.includes(style)?p.styles.filter(s=>s!==style):[...p.styles,style]}))}/>)}</View></Section>
      <Section title="Fits I reach for"><View style={ui.wrap}>{(['Regular','Relaxed','Slim']as const).map(fit=><Chip key={fit} title={fit} selected={!!profile.preferredFits?.includes(fit)} onPress={()=>setProfile(p=>({...p,preferredFits:p.preferredFits?.includes(fit)?p.preferredFits.filter(f=>f!==fit):[...p.preferredFits??[],fit]}))}/>)}</View></Section>
      <Section title="Colors I’d rather skip"><View style={ui.wrap}>{colors.filter(c=>c!=='Unknown').map(color=><Chip key={color} title={color} selected={!!profile.avoidColors?.includes(color)} onPress={()=>setProfile(p=>({...p,avoidColors:p.avoidColors?.includes(color)?p.avoidColors.filter(c=>c!==color):[...p.avoidColors??[],color]}))}/>)}</View></Section>
      <Button title={profile.imageUri?'Change reference portrait':'Add reference portrait'} secondary icon="photo" loading={busy} onPress={()=>void portrait()}/>
      {profile.imageUri&&<Button title="Remove reference portrait" secondary onPress={()=>setProfile(p=>({...p,imageUri:undefined}))}/>}
      <Label muted size={13}>A portrait is a saved reference, not a reconstructed face.</Label>
      <Button title="Save preferences" disabled={busy} onPress={save}/>
      {changed&&<Button title="Discard changes" secondary onPress={()=>setProfile(state.profile)}/>}
    </View>}
    {changed&&!edit&&<Button title="Save pending preference changes" disabled={busy} onPress={save}/>}
    {insights&&<View style={{gap:14}}>{styleInsights(state.garments.filter(g=>g.source===state.dataset),state.feedback.filter(f=>f.source===state.dataset),state.history.filter(w=>w.source===state.dataset)).map(insight=><View key={insight.label}><Label weight="600">{insight.label}</Label><Label muted>{insight.detail}</Label></View>)}<Button title="Reset outfit feedback" secondary onPress={()=>Alert.alert('Start learning fresh?','Clear outfit likes and dislikes. Clothes, personal styles, saved looks and wear history stay.',[{text:'Cancel',style:'cancel'},{text:'Reset',onPress:()=>dispatch({type:'feedback/reset'})}])}/></View>}
    {!!message&&<Notice>{message}</Notice>}
  </Screen>;
}
