import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import type { RootStackParamList } from '../navigation';
import type { Category, Outfit, StylistInput } from '../domain/types';
import { categoryLabels } from '../domain/types';
import { outfitSignature, suggestOutfit } from '../domain/stylist';
import { selectDressingPiece } from '../domain/dressing';
import { getAiConnection, styleWardrobe, dailyWardrobeStyle } from '../ai';
import { stylingKey, type StylingResult } from '../domain/aiStyling';
import { dailyStylingInput } from '../domain/dailyStyling';
import { fetchCityWeather, isWeatherFresh, isWeatherForCity } from '../domain/weather';
import { makeId } from '../domain/state';
import { useInventory, useWardrobe } from '../store';
import { Button, IconButton, Label, Notice, Screen, ui } from '../ui/primitives';
import { GarmentSurface } from '../ui/GarmentSurface';
import { DressingRail } from '../ui/DressingRail';
import { OutfitPreview } from '../ui/OutfitPreview';

export function StudioScreen() {
  const {state,dispatch}=useWardrobe(),inventory=useInventory();
  const navigation=useNavigation<NativeStackNavigationProp<RootStackParamList>>(),{height}=useWindowDimensions();
  const [category,setCategory]=useState<Category>('top'),[details,setDetails]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [previous,setPrevious]=useState<{outfit:Outfit;source:typeof state.dataset}>();
  const prepared=useRef(new Set<string>()),operation=useRef(false);
  const focused=useIsFocused(),[foreground,setForeground]=useState(AppState.currentState==='active');
  useEffect(()=>{const subscription=AppState.addEventListener('change',value=>setForeground(value==='active'));return()=>subscription.remove();},[]);
  const [aiReady,setAiReady]=useState(false),[daily,setDaily]=useState<{result:StylingResult;key:string}>();
  const outfit=state.outfits[state.dataset],locks=state.locks[state.dataset],hasOutfit=Object.values(outfit).some(Boolean);
  const input:StylistInput={garments:inventory,current:outfit,locks,context:state.context,feedback:state.feedback.filter(f=>f.source===state.dataset),history:state.history.filter(h=>h.source===state.dataset),preferredStyles:state.profile.styles,preferredFits:state.profile.preferredFits,avoidColors:state.profile.avoidColors};
  const day=new Date().toDateString(),dailyInput=dailyStylingInput(input);
  const dailyRequestKey=inventory.some(g=>g.available)?stylingKey(dailyInput,state.dataset,day):'';
  const requestKey=inventory.some(g=>g.available)?stylingKey(input,state.dataset,day):'';
  const latest=useRef({key:requestKey,dailyKey:dailyRequestKey,state});latest.current={key:requestKey,dailyKey:dailyRequestKey,state};
  useFocusEffect(useCallback(()=>{let active=true;void getAiConnection().then(config=>{if(active)setAiReady(!!config&&'provider'in config);}).catch(()=>{if(active)setAiReady(false);});return()=>{active=false;};},[]));
  useFocusEffect(useCallback(()=>{
    let active=true;const snapshot=latest.current.state;
    if(snapshot.context.weatherMode==='forecast'&&snapshot.profile.weatherCity&&(!isWeatherFresh(snapshot.context.forecast)||!isWeatherForCity(snapshot.context.forecast,snapshot.profile.weatherCity))){
      const city=snapshot.profile.weatherCity,contextKey=JSON.stringify(snapshot.context);
      void fetchCityWeather(city).then(forecast=>{if(active&&JSON.stringify(latest.current.state.context)===contextKey&&JSON.stringify(latest.current.state.profile.weatherCity)===JSON.stringify(city)&&isWeatherFresh(forecast))dispatch({type:'context/set',context:{...latest.current.state.context,weather:forecast.conditions,forecast}});}).catch(()=>{if(active)setMessage('Weather could not refresh. Last known conditions remain; choose manual weather in your day details.');});
    }
    return()=>{active=false;};
  },[state.profile.weatherCity?.latitude,state.profile.weatherCity?.longitude,state.context.weatherMode]));
  const valid=hasOutfit&&Object.entries(outfit).every(([c,id])=>inventory.some(g=>g.category===c&&g.id===id&&g.available));
  useEffect(()=>{
    const day=new Date().toDateString(),key=`${state.dataset}:${day}`;
    if(!hasOutfit&&inventory.some(g=>g.available)&&!prepared.current.has(key)) {prepared.current.add(key);dispatch({type:'outfit/set',outfit:suggestOutfit(input).outfit});}
  },[state.dataset,inventory.length,hasOutfit]);
  useEffect(()=>{setMessage('');setPrevious(undefined);setDaily(undefined);},[state.dataset]);
  function remember(){setPrevious({outfit:{...outfit},source:state.dataset});}
  function select(id:string){const result=selectDressingPiece({garments:inventory,dataset:state.dataset,outfit,locks},id);if(result.notice){setMessage(result.notice);return;}remember();dispatch({type:'outfit/set',outfit:result.outfit});setMessage('');void Haptics.selectionAsync().catch(()=>{});}
  async function style(){
    if(operation.current)return;operation.current=true;setBusy(true);const key=requestKey;setMessage('');
    try{
      if(aiReady&&state.dataset==='owned'){
        const result=await styleWardrobe(input,state.dataset);
        if(latest.current.key!==key){setMessage('You changed the outfit or day details while Claude worked. Your newer choices were kept.');return;}
        remember();dispatch({type:'outfit/set',outfit:result.outfit});setMessage(`Claude · ${result.reason}`);
      }else{const result=suggestOutfit(input);remember();dispatch({type:'outfit/set',outfit:result.outfit});setMessage(['On-device suggestion.',...result.reasons,...result.notices].join(' '));}
      void Haptics.selectionAsync().catch(()=>{});
    }catch(e){setMessage(`${e instanceof Error?e.message:'Claude is unavailable.'} Your current outfit stays. Use the on-device option in Outfit tools.`);}finally{operation.current=false;setBusy(false);}
  }
  useEffect(()=>{
    const dailyKey=dailyRequestKey;
    if(!focused||!foreground||!state.profile.dailyAi||!aiReady||state.dataset!=='owned'||!inventory.some(g=>g.available))return;
    const key=dailyKey;let active=true;
    void dailyWardrobeStyle(dailyInput,state.dataset,day).then(result=>{if(active&&latest.current.dailyKey===key&&latest.current.state.profile.dailyAi)setDaily({result,key});}).catch(e=>{if(active)setMessage(e instanceof Error?e.message:'Daily Claude styling is unavailable.');});
    return()=>{active=false;};
  },[state.profile.dailyAi,aiReady,dailyRequestKey,focused,foreground]);

  function wear(){
    const today=new Date().toDateString();
    if(state.history.some(w=>w.source===state.dataset&&new Date(w.wornAt).toDateString()===today&&outfitSignature(w.outfit)===outfitSignature(outfit))){setMessage('Already in today’s wear history.');return;}
    const names=Object.fromEntries(Object.entries(outfit).map(([c,id])=>[c,inventory.find(g=>g.id===id)?.name??'Removed piece']));
    dispatch({type:'wear/add',wear:{id:makeId(),outfit:{...outfit},names,wornAt:new Date().toISOString(),source:state.dataset}});setMessage('Added to today’s wear history.');void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
  }
  const selected=inventory.find(g=>g.id===outfit[category]);
  return <Screen>
    <View style={ui.between}><View style={{flex:1}}><Label size={23} weight="600">{state.profile.name?`Hi, ${state.profile.name}`:'Make today yours'}</Label><Label muted size={13}>{state.dataset==='example'?'Example wardrobe':`${state.context.occasion} · ${state.context.weatherMode==='forecast'&&state.context.forecast?`${Math.round(state.context.forecast.temperatureC)}°C · ${isWeatherFresh(state.context.forecast)?state.context.forecast.city:'last known weather'}`:`${state.context.weather.toLowerCase()} · manual weather`}`}</Label></View><IconButton icon="sun" label="Change destination and weather" onPress={()=>navigation.navigate('Context')}/><IconButton icon="looks" label="Open saved looks" onPress={()=>navigation.navigate('Looks',{view:'saved'})}/></View>
    <OutfitPreview outfit={outfit} garments={inventory} dataset={state.dataset} profile={state.profile} height={Math.min(430,Math.max(290,height*.46))} onCustomize={()=>navigation.navigate('Avatar')}/>
    {!!inventory.length?<DressingRail garments={inventory} outfit={outfit} category={category} onCategory={setCategory} onSelect={piece=>select(piece.id)}/>:<View style={{gap:8}}><Label size={20} weight="600">Start with a favorite</Label><Label muted>Your character stays here as your wardrobe grows.</Label><Button title="Add my first piece" icon="add" onPress={()=>navigation.navigate('Item')}/></View>}
    {selected?.source==='owned'&&<GarmentSurface garment={selected} onReview={()=>navigation.navigate('Capture',{kind:'garment',garmentId:selected.id})}/>}
    {daily&&daily.key===dailyRequestKey&&<View style={{gap:8}}><Label weight="600">Today’s Claude suggestion</Label><Label muted>{daily.result.reason}</Label><Button title="Wear this suggestion" secondary onPress={()=>{remember();dispatch({type:'outfit/set',outfit:daily.result.outfit});setDaily(undefined);}}/></View>}
    {!!inventory.length&&<View style={{gap:10}}><Label muted size={12}>{aiReady&&state.dataset==='owned'?'Claude receives wardrobe details and uses your API credits. No face photos are sent.':'On-device stylist · works offline'}</Label><Button title="Style me" icon="studio" loading={busy} onPress={()=>void style()}/><View style={ui.between}><Button title={details?'Close outfit tools':'Outfit tools'} secondary onPress={()=>setDetails(v=>!v)}/>{previous?.source===state.dataset&&<Button title="Undo" secondary onPress={()=>{dispatch({type:'outfit/set',outfit:previous.outfit});setPrevious(undefined);setMessage('Previous look restored.');}}/>}</View></View>}
    {!!message&&<Notice>{message}</Notice>}
    {details&&<View style={{gap:12}}>
      <View style={ui.between}><Label weight="600">{selected?.name??categoryLabels[category]}</Label><IconButton icon={locks[category]?'lock':'unlock'} label={`${locks[category]?'Unlock':'Keep'} ${categoryLabels[category].toLowerCase()}`} selected={!!locks[category]} onPress={()=>dispatch({type:'lock/toggle',category})}/></View>
      {selected&&<Button title="Edit this piece" secondary icon="edit" onPress={()=>navigation.navigate('Item',{id:selected.id})}/>}
      <Button title="Suggest on device" secondary icon="shuffle" disabled={busy} onPress={()=>{remember();const result=suggestOutfit(input);dispatch({type:'outfit/set',outfit:result.outfit});setMessage(['On-device suggestion.',...result.reasons,...result.notices].join(' '));}}/>
      <Button title="Edit character" secondary icon="person" onPress={()=>navigation.navigate('Avatar')}/>
      <View style={ui.row}><Button title="Save look" secondary icon="looks" disabled={!valid} style={{flex:1}} onPress={()=>navigation.navigate('SaveLook')}/><Button title="Wore this" secondary icon="check" disabled={!valid} style={{flex:1}} onPress={wear}/></View>
      {!valid&&hasOutfit&&<Notice>Replace unavailable pieces before saving or wearing this outfit.</Notice>}
      {hasOutfit&&<View style={ui.between}><Label muted>Feels like you?</Label><View style={ui.row}>{(['dislike','like']as const).map(vote=><IconButton key={vote} icon={vote==='like'?'heart':'dislike'} label={vote==='like'?'I like this outfit':'Suggest this outfit less often'} onPress={()=>{dispatch({type:'feedback/add',feedback:{signature:outfitSignature(outfit),outfit:{...outfit},vote,source:state.dataset,createdAt:new Date().toISOString()}});setMessage('Your preference will guide future suggestions.');}}/>)}</View></View>}
      <Button title={state.dataset==='example'?'Use my wardrobe':'Explore example wardrobe'} secondary onPress={()=>dispatch({type:'dataset/set',dataset:state.dataset==='example'?'owned':'example'})}/>
    </View>}
  </Screen>;
}
