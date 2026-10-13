import React,{createContext,useCallback,useContext,useEffect,useRef,useState}from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ActivityIndicator,Alert,View}from 'react-native';
import {SafeAreaView}from 'react-native-safe-area-context';
import {appReducer,decodeState,initialState}from './domain/state';
import {Journal,PRIMARY,FALLBACK}from './domain/recovery';
import{chunkedStorage}from './domain/chunkedStorage';
import type{WardrobeState,WardrobeAction}from './domain/types';
import {Button,Label,Notice}from './ui/primitives';
import {useTheme}from './ui/theme';
import {referencedPhotoUris}from './domain/photos';
import {pruneManagedPhotos}from './media';

type Store={state:WardrobeState;dispatch:(a:WardrobeAction)=>void;saveError:boolean;saving:boolean;revision:number;replacement:number;retrySave:()=>void;flush:()=>Promise<void>;replaceState:(s:WardrobeState,expectedRevision?:number)=>Promise<void>;setDraft:(id:string,dirty:boolean)=>void;hasDrafts:()=>boolean};
const Context=createContext<Store|null>(null);
const wardrobeStorage=chunkedStorage(AsyncStorage);
export function WardrobeProvider({children}:{children:React.ReactNode}){
 const[state,setState]=useState(initialState);const[ready,setReady]=useState(false);const[loadError,setLoadError]=useState(false);const[saveError,setSaveError]=useState(false);const[saving,setSaving]=useState(false);const[recovered,setRecovered]=useState(false);const[revision,setRevision]=useState(0);const[replacement,setReplacement]=useState(0);
 const journal=useRef(new Journal(wardrobeStorage));const stateRef=useRef(state);const rev=useRef(0);const pending=useRef(0);const replacing=useRef(false);const t=useTheme();
 const drafts=useRef(new Set<string>());const setDraft=useCallback((id:string,dirty:boolean)=>{if(dirty)drafts.current.add(id);else drafts.current.delete(id);},[]);const hasDrafts=useCallback(()=>drafts.current.size>0,[]);
 const load=useCallback(async()=>{setLoadError(false);try{const result=await journal.current.load();stateRef.current=result.state;setState(result.state);setRecovered(result.recovered);const keep=new Set(journal.current.retainedStates().flatMap(s=>[...referencedPhotoUris(s)]));const damaged=(await AsyncStorage.getAllKeys()).some(k=>k.startsWith(PRIMARY+'.damaged.')||k.startsWith(FALLBACK+'.damaged.'));if(!damaged)pruneManagedPhotos(keep);setReady(true);}catch{setLoadError(true);}},[]);
 useEffect(()=>{void load();},[load]);
 const persist=useCallback(async(next:WardrobeState)=>{pending.current++;setSaving(true);try{await journal.current.save(next);setSaveError(false);}catch(e){setSaveError(true);throw e;}finally{pending.current--;setSaving(pending.current>0);}},[]);
 const dispatch=useCallback((a:WardrobeAction)=>{if(replacing.current){setSaveError(true);return;}const next=appReducer(stateRef.current,a);stateRef.current=next;setState(next);setRevision(++rev.current);void persist(next).catch(()=>{});},[persist]);
 const replaceState=useCallback(async(next:WardrobeState,expectedRevision=rev.current)=>{if(replacing.current)throw Error('A restore is already running.');const validated=decodeState(JSON.stringify(next));replacing.current=true;try{await journal.current.flush();if(rev.current!==expectedRevision)throw Error('Your wardrobe changed. Start restore again.');await persist(validated);stateRef.current=validated;setState(validated);setRevision(++rev.current);setReplacement(value=>value+1);}finally{replacing.current=false;}},[persist]);
 if(!ready)return <SafeAreaView style={{flex:1,backgroundColor:t.background,padding:24,justifyContent:'center',gap:20}}>{loadError?<><Label size={26} weight="700">Your wardrobe needs recovery</Label><Notice error>Neither saved copy could be opened. Both have been left untouched.</Notice><Button title="Retry recovery" onPress={()=>void load()}/><Button secondary title="Open a fresh workspace to restore backup" onPress={()=>Alert.alert('Preserve damaged copies and start fresh?','The unreadable copies will be retained locally. You can then restore an encrypted backup from You → Backup.',[{text:'Cancel',style:'cancel'},{text:'Continue',onPress:async()=>{try{for(const key of[PRIMARY,FALLBACK]){const keys=await AsyncStorage.getAllKeys();for(const part of keys.filter(k=>k===key||k.startsWith(key+".page.")||k===key+".index")){const raw=await AsyncStorage.getItem(part);if(raw)await AsyncStorage.setItem(`${key}.damaged.${Date.now()}.${part}`,raw);}}await wardrobeStorage.setItem(PRIMARY,JSON.stringify(initialState));await wardrobeStorage.setItem(FALLBACK,JSON.stringify(initialState));journal.current=new Journal(wardrobeStorage);await load();}catch{setLoadError(true);}}}])}/></>:<><ActivityIndicator color={t.primary}/><Label>Opening your wardrobe…</Label></>}</SafeAreaView>;
 return <Context.Provider value={{state,dispatch,saveError,saving,revision,replacement,setDraft,hasDrafts,retrySave:()=>void persist(stateRef.current).catch(()=>{}),flush:()=>journal.current.flush(),replaceState}}>{recovered&&<SafeAreaView edges={['top']} style={{backgroundColor:t.background,paddingHorizontal:12}}><Notice>Recovered your last valid saved copy. Make a backup before continuing.</Notice><Button secondary title="Continue with recovered wardrobe" onPress={()=>{void persist(stateRef.current).then(()=>setRecovered(false)).catch(()=>{});}}/></SafeAreaView>}{children}</Context.Provider>;
}
export function useWardrobe(){const store=useContext(Context);if(!store)throw Error('WardrobeProvider missing');return store;}
export function useInventory(){const{state}=useWardrobe();return state.garments.filter(i=>i.source===state.dataset);}
export function SaveStatus(){const{saveError,retrySave}=useWardrobe();return saveError?<SafeAreaView edges={['top']} style={{padding:12,gap:8}}><Notice error>Recent changes aren’t saved. Free storage and retry before closing or backing up.</Notice><Button secondary title="Retry saving" onPress={retrySave}/></SafeAreaView>:null;}
