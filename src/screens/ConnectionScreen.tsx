import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { disconnectAi, getAiConnection, loadClaudeModels, setClaudeConnection, setConnection } from '../ai';
import type { ClaudeModel } from '../domain/claude';
import { Button, Chip, Field, Label, Notice, Screen, Section, ui } from '../ui/primitives';

export function ConnectionScreen() {
  const [apiKey, setApiKey] = useState(''), [model, setModel] = useState('');
  const [url, setUrl] = useState(''), [token, setToken] = useState(''), [advanced, setAdvanced] = useState(false);
  const [models, setModels] = useState<ClaudeModel[]>([]), [busy, setBusy] = useState(true), [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(false);
  usePreventRemove(busy, () => Alert.alert('Please wait', 'Finish saving or loading your AI settings first.'));
  useEffect(() => {
    let active = true;
    void getAiConnection().then(config => {
      if (!active) return;
      if (config && 'provider' in config) { setApiKey(config.apiKey); setModel(config.model); }
      else if (config) { setUrl(config.url); setToken(config.token); setAdvanced(true); }
      setConnected(!!config); setReady(true);
    }).catch(() => { if (active) { setError(true); setMessage('Couldn’t read secure settings. Reopen this screen before changing them.'); } })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage(''); setError(false);
    try { await action(); } catch (e) { setError(true); setMessage(e instanceof Error ? e.message : 'Couldn’t save settings. Try again.'); }
    finally { setBusy(false); }
  }
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Screen>
    <View style={{ gap: 8 }}><Label size={24} weight="700">AI, when you want it</Label><Label muted>Add your Anthropic key to identify clothing photos and understand styling requests. Your wardrobe works without it.</Label></View>
    <Notice>AI requests use your Anthropic credits. Nothing is sent automatically. Claude does not create 3D models.</Notice>

    <Field label="Anthropic API key" value={apiKey} onChangeText={value => { setApiKey(value); setModels([]); }} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="sk-ant-…" editable={ready && !busy} maxLength={512} />
    <Button title="Load my available models" secondary loading={busy} disabled={!ready || !apiKey.trim()} onPress={() => void run(async () => {
      const available = await loadClaudeModels(apiKey); setModels(available);
      setMessage(available.length ? 'Choose a model below. Loading this list does not run AI.' : 'No models were returned. Check access in your Anthropic account.');
    })} />
    {!!models.length && <Section title="Choose a model"><View style={ui.wrap}>{models.map(option => <Chip key={option.id} title={option.display_name} selected={model === option.id} onPress={() => setModel(option.id)} />)}</View></Section>}
    <Field label="API model ID" value={model} onChangeText={setModel} autoCapitalize="none" autoCorrect={false} placeholder="Choose above, or paste an exact model ID" editable={ready && !busy} maxLength={160} />
    <Label muted size={14}>Choose Haiku for quick clothing tags or Opus for detailed requests, if your account offers them. Model names and availability come from Anthropic.</Label>
    <Button title="Save Claude settings" icon="check" disabled={!ready || !apiKey.trim() || !model.trim()} loading={busy} onPress={() => void run(async () => { await setClaudeConnection(apiKey, model); setConnected(true); setMessage('Claude settings saved. Use AI in Add a piece or Style my day when you need it.'); })} />
    {!!message && <Notice error={error}>{message}</Notice>}
    <Label muted size={13}>Your key stays in secure device storage. It is sent only to Anthropic and is excluded from wardrobe backups and cloud sync.</Label>
    {connected && <Button title="Disconnect AI" secondary disabled={busy} onPress={() => void run(async () => { await disconnectAi(); setConnected(false); setApiKey(''); setModel(''); setUrl(''); setToken(''); setModels([]); setMessage('AI disconnected. On-device styling still works.'); })} />}
    <Button title={advanced ? 'Hide private service settings' : 'Use a private service instead'} secondary disabled={!ready || busy} onPress={() => setAdvanced(value => !value)} />
    {advanced && <Section title="Private AI service"><Field label="Service address" value={url} onChangeText={setUrl} editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://your-service.example" /><Field label="Service token" value={token} onChangeText={setToken} editable={!busy} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={512} /><Label muted size={13}>Use the service token here, not a provider key. Saving replaces the Claude connection.</Label><Button title="Save private service" secondary disabled={busy || !url.trim() || !token.trim()} onPress={() => void run(async () => { await setConnection(url, token); setConnected(true); setApiKey(''); setModel(''); setMessage('Private service saved. It will be used for your next AI request.'); })} /></Section>}
  </Screen></KeyboardAvoidingView>;
}
