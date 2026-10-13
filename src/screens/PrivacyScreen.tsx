import {DAILY_STYLING_KEY} from '../domain/dailyStyling';
import React,{useState}from 'react';
import{Alert}from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import{usePreventRemove}from '@react-navigation/native';
import{useWardrobe}from '../store';
import{decodeState}from '../domain/state';
import{disableAutoSync}from '../autoSync';
import{Button,Label,Notice,Screen,Section}from '../ui/primitives';
import{eraseRetiredMetadata}from '../eraseMetadata';
import{eraseManagedPhotos}from '../media';
import{removeFaceScan}from '../faceScan';
import{disconnectAi}from '../ai';
import{deleteAllComputerCaptures,eraseReconstructionAssets}from '../reconstruction';
import{temporaryCaptureStorage}from '../privateCaptureStorage';
export function PrivacyScreen(){
 const{replaceState,flush}=useWardrobe();const[busy,setBusy]=useState(false);const[message,setMessage]=useState('');
 usePreventRemove(busy,()=>Alert.alert('Please wait','Finish clearing this device’s wardrobe before leaving.'));
 async function erase(){setBusy(true);try{await disableAutoSync();await flush();const empty=decodeState(null);await replaceState(empty);await replaceState(empty);await eraseRetiredMetadata();await removeFaceScan();await eraseReconstructionAssets();await disconnectAi();await AsyncStorage.removeItem(DAILY_STYLING_KEY);await AsyncStorage.removeItem('thread.cloud.binding');eraseManagedPhotos();setMessage('This device’s wardrobe, reconstructed models, capture photos and credentials were cleared. Automatic sync is off. Computer captures, cloud data and exported backups were not deleted.');}catch{setMessage('Local erasure did not fully finish. Retry after resolving any storage error. Cloud data was not deleted.');}finally{setBusy(false);}}
 async function eraseCaptures(){setBusy(true);setMessage('');try{await deleteAllComputerCaptures();setMessage('Reconstruction captures, working files, models and comparison photos were deleted from your connected computer and this phone. Original photos in your Photos library and any copies you made remain under your control.');}catch(e){setMessage(e instanceof Error?e.message:'Capture deletion did not finish. Keep your computer connected and retry.');}finally{setBusy(false);}}
 return <Screen><Label size={24} weight="700">Your wardrobe, your control</Label>
 {temporaryCaptureStorage&&<Notice>In Expo Go, reconstructed models and comparison photos use private cache storage excluded from device backups. iOS may clear the cache. Thread’s native file-protection settings require an installed Thread build; they do not run in Expo Go.</Notice>}
 <Section title="On this device"><Label>Clothing photos and wardrobe records live in private app storage. A previous valid save is retained for recovery. Signing out keeps your local wardrobe.</Label></Section>
 <Section title="Backups and cloud sync"><Label>Backups and synced wardrobe content are encrypted before leaving the device. Your recovery password is saved in secure storage only if you enable automatic sync. Supabase holds account information, encrypted objects, sizes and timestamps.</Label></Section>
 <Section title="Private reconstruction"><Label>Face, body and garment reconstruction runs on the private computer you pair. Photos are not included in app logs or sent to reconstruction providers. Claude capture inspection is off by default; enabling it sends four reduced photos to Anthropic using your credits. Models and comparison photos stay in private app storage and are excluded from Thread backup and cloud sync.</Label><Label>Computer captures expire after 24 hours while the engine runs. Your phone keeps downloaded models and comparison photos for review. Delete them below while your computer is connected. Photos you selected from the Photos library remain in that library.</Label><Button title="Delete all reconstruction captures and models" danger loading={busy} onPress={()=>Alert.alert('Delete all private captures?', 'This stops reconstruction and removes every face, body and clothing capture, model and working file belonging to your pairing token from the computer, plus reconstructed models and comparison photos from this phone. The computer must be connected. Your wardrobe records, Photos library and exported copies remain.',[{text:'Cancel',style:'cancel'},{text:'Delete all captures',style:'destructive',onPress:()=>void eraseCaptures()}])}/></Section>
 <Section title="Optional AI"><Label>On-device styling is free. Optional Claude uses only the clothing photo or styling request you choose and can use paid credits. API keys stay in secure storage and are excluded from Thread backup and sync. Realistic photo try-on remains disabled.</Label></Section>
 <Section title="Deleting data"><Label>Remove individual pieces in Wardrobe. Erase the local wardrobe below, or delete your cloud account separately in Account. Backup files you saved elsewhere remain under your control.</Label><Notice>Erasing here turns off automatic sync so it does not propagate an empty wardrobe to the cloud.</Notice><Button title="Erase this device’s wardrobe" danger loading={busy} onPress={()=>Alert.alert('Erase the wardrobe on this device?','This removes local clothes, photos, face scan, AI credentials, profile, saved looks and wear history, including the recovery copy. Export a backup first. Your cloud account is not deleted.',[{text:'Cancel',style:'cancel'},{text:'Erase local wardrobe',style:'destructive',onPress:()=>void erase()}])}/></Section>
 {!!message&&<Notice>{message}</Notice>}</Screen>;
}
