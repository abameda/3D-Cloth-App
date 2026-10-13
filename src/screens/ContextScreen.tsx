import React,{useRef,useState} from 'react';
import {KeyboardAvoidingView,Linking,Platform,Switch,View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation';
import {occasions,type StyleContext} from '../domain/types';
import {contextForOccasion,inferContext} from '../domain/stylist';
import {fetchCityWeather,isWeatherFresh,searchWeatherCities,type WeatherCity} from '../domain/weather';
import {useWardrobe} from '../store';
import {useDraft} from '../useDraft';
import {interpretContext} from '../ai';
import {Button,Chip,Field,Label,Notice,Screen,Section,ui} from '../ui/primitives';
import {useTheme} from '../ui/theme';

export function ContextScreen({navigation}:NativeStackScreenProps<RootStackParamList,'Context'>){
  const {state,dispatch}=useWardrobe(),t=useTheme();
  const [context,setContext]=useState(state.context),[city,setCity]=useState(state.profile.weatherCity),[query,setQuery]=useState(''),[cities,setCities]=useState<WeatherCity[]>([]),[advanced,setAdvanced]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const revision=useRef(0);useDraft(JSON.stringify(context)!==JSON.stringify(state.context)||JSON.stringify(city)!==JSON.stringify(state.profile.weatherCity));
  function update<K extends keyof StyleContext>(key:K,value:StyleContext[K]){revision.current++;setContext(c=>({...c,[key]:value}));}
  async function search(){setBusy(true);setMessage('');try{const result=await searchWeatherCities(query);setCities(result);if(!result.length)setMessage('No matching city. Try another spelling or choose manual conditions.');}catch(e){setMessage(e instanceof Error?e.message:'Couldn’t find that city.');}finally{setBusy(false);}}
  async function chooseCity(value:WeatherCity){const requested=++revision.current;setBusy(true);setCity(value);setCities([]);setContext(c=>({...c,weatherMode:'forecast',forecast:undefined}));try{const forecast=await fetchCityWeather(value);if(requested!==revision.current)return;if(!isWeatherFresh(forecast))throw Error('The provider returned old weather. Choose manual conditions.');setContext(c=>({...c,weatherMode:'forecast',forecast,weather:forecast.conditions}));setMessage('Current city weather loaded.');}catch(e){setMessage(e instanceof Error?e.message:'Weather unavailable. Keep manual conditions.');}finally{setBusy(false);}}
  async function interpret(){const requested=revision.current;setBusy(true);try{const result=await interpretContext(context.prompt,context);if(requested!==revision.current){setMessage('Your newer choices were kept.');return;}setContext(result);setMessage('Request interpreted. Review your choices.');}catch(e){setMessage(e instanceof Error?e.message:'AI unavailable. Choose your destination below.');}finally{setBusy(false);}}
  return <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><Screen>
    <Label size={26} weight="600">Where are you headed?</Label>
    <View style={ui.wrap}>{occasions.map(o=><Chip key={o} title={o} selected={context.occasion===o} onPress={()=>{revision.current++;setContext(c=>contextForOccasion(c,o));}}/>)}</View>
    <Section title="Weather"><View style={ui.wrap}>{(['Warm','Mild','Cold']as const).map(weather=><Chip key={weather} title={weather} selected={context.weather===weather&&(context.weatherMode??'manual')==='manual'} onPress={()=>{revision.current++;setContext(c=>({...c,weather,weatherMode:'manual',forecast:undefined}));}}/>)}</View>
      <Label muted size={13}>{context.weatherMode==='forecast'&&context.forecast?`${context.forecast.city} · ${Math.round(context.forecast.temperatureC)}°C · ${isWeatherFresh(context.forecast)?'current':'last known'} weather`:'Manual conditions — choose what it feels like where you’ll be.'}</Label>
      <Field label="City for current weather" value={query} onChangeText={setQuery} placeholder={city?.name??'Search your destination city'} maxLength={100}/>
      <Button title="Find city" secondary loading={busy} disabled={query.trim().length<2} onPress={()=>void search()}/>
      {cities.map((value,index)=><Button key={`${value.latitude}-${value.longitude}-${index}`} title={value.name} secondary disabled={busy} onPress={()=>void chooseCity(value)}/>)}
      {city&&<Button title={`Refresh ${city.name}`} secondary disabled={busy} onPress={()=>void chooseCity(city)}/>}
      <Label muted size={12}>Only your chosen city is sent to Open-Meteo. No device location is requested.</Label><Button title="Weather data by Open-Meteo" secondary onPress={()=>void Linking.openURL('https://open-meteo.com/')}/>
    </Section>
    <Field label="Tell your stylist" value={context.prompt} onChangeText={value=>update('prompt',value)} placeholder="University, then dinner with friends" multiline maxLength={1000}/>
    <Button title={advanced?'Hide extra choices':'Extra choices'} secondary onPress={()=>setAdvanced(value=>!value)}/>
    {advanced&&<View style={{gap:16}}><View style={ui.wrap}><Chip title="Top + bottoms" selected={context.outfitMode!=='onepiece'} onPress={()=>update('outfitMode','separates')}/><Chip title="One-piece" selected={context.outfitMode==='onepiece'} onPress={()=>update('outfitMode','onepiece')}/></View><Label muted size={13}>Kept pieces stay in place. Unlock conflicting pieces to switch outfit shape.</Label><View style={ui.wrap}>{['Casual','Smart casual','Dressed up'].map((label,i)=><Chip key={label} title={label} selected={context.formality===i+1} onPress={()=>update('formality',i+1 as 1|2|3)}/>)}</View><View style={ui.between}><Label>Include a layer</Label><Switch accessibilityLabel="Include a layer" value={context.includeLayer} onValueChange={value=>update('includeLayer',value)} trackColor={{true:t.primary}}/></View><View style={ui.between}><Label>Include an accessory</Label><Switch accessibilityLabel="Include an accessory" value={context.includeAccessory} onValueChange={value=>update('includeAccessory',value)} trackColor={{true:t.primary}}/></View><Button title="Interpret request on device" secondary onPress={()=>{revision.current++;setContext(inferContext(context.prompt,context));}}/><Button title="Interpret request with Claude" secondary disabled={!context.prompt.trim()} loading={busy} onPress={()=>void interpret()}/><Label muted size={12}>Claude receives your request and uses your API credits.</Label></View>}
    {!!message&&<Notice>{message}</Notice>}
    <Button title="Use these details" disabled={busy} onPress={()=>{dispatch({type:'context/set',context});dispatch({type:'profile/set',profile:{...state.profile,weatherCity:city}});navigation.goBack();}}/>
  </Screen></KeyboardAvoidingView>;
}
