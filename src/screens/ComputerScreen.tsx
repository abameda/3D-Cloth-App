import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { checkReconstructionComputer, getReconstructionConnection, setReconstructionConnection } from '../reconstruction';
import { Button, Field, Label, Notice, Screen } from '../ui/primitives';

export function ComputerScreen(){
  const [url,setUrl]=useState(''),[token,setToken]=useState(''),[busy,setBusy]=useState(true),[ready,setReady]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false);
  usePreventRemove(busy,()=>Alert.alert('Please wait','Finish loading or checking your private computer.'));
  useEffect(()=>{let active=true;void getReconstructionConnection().then(config=>{if(active){setUrl(config.url);setToken(config.token);setReady(true);}}).catch(()=>{if(active){setError(true);setMessage('Couldn’t read secure settings. Reopen this screen before changing them.');}}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[]);
  async function check(){setBusy(true);setMessage('');setError(false);try{await setReconstructionConnection(url,token);await checkReconstructionComputer();setMessage('Your local reconstruction computer is ready. Photo surfaces are supported; natural clothing fitting and depth scanning remain unavailable.');}catch(e){setError(true);setMessage(e instanceof Error?e.message:'Couldn’t connect. Check the address, certificate and pairing token.');}finally{setBusy(false);}}
  return <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><Screen>
    <Label size={25} weight="600">Your private 3D computer</Label><Label muted>Pair once. Reconstruction runs locally, with no paid reconstruction service. Keep your phone and computer on the same private network.</Label>
    <Field label="Computer HTTPS address" value={url} onChangeText={setUrl} editable={ready&&!busy} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://your-private-computer"/>
    <Field label="Pairing token" value={token} onChangeText={setToken} editable={ready&&!busy} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={512}/>
    <Label muted size={14}>Use the certificate and token from your Thread local engine. Face and clothing captures travel over HTTPS.</Label>
    <Button title="Save and check computer" icon="link" disabled={!ready||!url.trim()||!token.trim()} loading={busy} onPress={()=>void check()}/>
    {!!message&&<Notice error={error}>{message}</Notice>}
  </Screen></KeyboardAvoidingView>;
}
