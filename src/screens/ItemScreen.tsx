import{features}from '../features';
import{useDraft}from '../useDraft';
import{usePreventRemove}from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Switch, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { categories, categoryLabels, colors, styles, type Garment } from '../domain/types';
import { makeId } from '../domain/state';
import { useWardrobe } from '../store';
import { choosePhoto, photoDataUri, removeManagedPhoto } from '../media';
import { analyzePhoto } from '../ai';
import { eraseGarmentReconstructionAssets } from '../reconstruction';
import { presetForCategory, specFromShape } from '../domain/studio';
import { sendGarmentForFitting } from '../studio';
import { colorHex } from '../ui/theme';
import { Button, Chip, Field, Label, Notice, Screen, Section, ui } from '../ui/primitives';
import { GarmentArt } from '../ui/GarmentArt';
import { useTheme } from '../ui/theme';

export function ItemScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'Item'>) {
  const { state, dispatch } = useWardrobe(); const existing = state.garments.find(i => i.id === route.params?.id); const t = useTheme();
  const [item, setItem] = useState<Garment>(() => existing ?? { id: makeId(), name: '', category: 'top', color: 'White', fit: 'Regular', formality: 1, warmth: 1, styles: [], source: 'owned', available: true, favorite: false, createdAt: new Date().toISOString() });
  const [details,setDetails]=useState(!!existing); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [analyzed, setAnalyzed] = useState(false);
  useDraft(existing?JSON.stringify(existing)!==JSON.stringify(item):!!item.name||!!item.imageUri);
  const leaving=useRef(false);usePreventRemove(busy||(existing?JSON.stringify(existing)!==JSON.stringify(item):!!item.name||!!item.imageUri),({data})=>{if(leaving.current){navigation.dispatch(data.action);return;}if(busy){Alert.alert("Please wait","Finish the current photo operation first.");return;}Alert.alert("Discard unsaved changes?","Your saved wardrobe stays unchanged.",[{text:"Keep editing",style:"cancel"},{text:"Discard",style:"destructive",onPress:()=>{leaving.current=true;navigation.dispatch(data.action);}}]);});
  const addedPhotos = useRef<string[]>([]); const retained = useRef(existing?.imageUri); const revision = useRef(0);
  useEffect(() => () => { addedPhotos.current.filter(uri => uri !== retained.current).forEach(removeManagedPhoto); }, []);
  function update<K extends keyof Garment>(key: K, value: Garment[K]) { revision.current++; setItem(current => ({ ...current, [key]: value })); }
  async function photo(camera: boolean) { setBusy(true); setError(''); try { const uri = await choosePhoto(camera); if (uri) { addedPhotos.current.push(uri); update('imageUri', uri); setAnalyzed(false); } } catch (e) { setError(e instanceof Error ? e.message : 'Photo could not be opened. Please try another.'); } finally { setBusy(false); } }
  const openedSource=useRef(false);
  useEffect(()=>{if(!existing&&route.params?.photoSource&&!openedSource.current){openedSource.current=true;void photo(route.params.photoSource==='camera');}},[]);
  async function analyze() { if (!item.imageUri) return; const requestedRevision = revision.current; setBusy(true); setError(''); try { const result = await analyzePhoto(await photoDataUri(item.imageUri)); if (revision.current !== requestedRevision) { setError('You edited this piece while AI was working, so your changes were kept. Analyze again if you still want suggestions.'); return; } setItem(current => ({ ...current, ...result })); setAnalyzed(true); } catch (e) { setError(e instanceof Error ? e.message : 'Photo analysis failed. You can add the details below.'); } finally { setBusy(false); } }
  function save() {
    if (!item.name.trim()) { setError('Give this piece a short name so you can find it again.'); return; }
    dispatch({ type: 'garment/upsert', garment: { ...item, name: item.name.trim() } });
    retained.current = item.imageUri;
    if (!existing) dispatch({ type: 'dataset/set', dataset: 'owned' });
    leaving.current=true;navigation.goBack();
  }
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Screen>
    <View style={{ backgroundColor: t.board, borderRadius: 16, padding: 18 }}><GarmentArt item={item} size={190} />{!item.imageUri && <Label muted size={13} style={{ textAlign: 'center' }}>Add a photo, or start with a simple catalogue symbol.</Label>}</View>
    <View style={ui.row}><Button title="Camera" secondary icon="camera" disabled={busy} style={{ flex: 1 }} onPress={() => void photo(true)} /><Button title="Photos" secondary icon="photo" disabled={busy} style={{ flex: 1 }} onPress={() => void photo(false)} /></View>
    {features.connectedAi && !!item.imageUri && <Button title="Identify this piece with AI" icon="studio" secondary loading={busy} onPress={() => Alert.alert('Analyze this photo?', 'This sends the selected clothing photo to your configured AI service and its model provider. No other wardrobe photos are shared. You can review every suggested detail before saving.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Analyze photo', onPress: () => void analyze() }])} />}
    {!!error && <Notice error>{error}</Notice>}{analyzed && <Notice>Details suggested by AI. Check the category, color and fit before saving.</Notice>}
    {existing&&presetForCategory[existing.category]&&<Button title="Fit on my body" secondary icon="person" disabled={busy} onPress={()=>void sendGarmentForFitting({garmentId:existing.id,category:existing.category,colorHex:colorHex[existing.color],spec:existing.shape?specFromShape(existing.shape):undefined}).then(()=>Alert.alert('Fitting on your computer','This piece is being sewn and draped on your body. It appears in your dressing room when it is ready.')).catch(e=>Alert.alert('Couldn’t start fitting',e instanceof Error?e.message:'Check your computer connection.'))}/>}
    {existing&&<Button title="Capture or review this piece in 3D" secondary icon="camera" disabled={busy} onPress={()=>navigation.navigate('Capture',{kind:'garment',garmentId:existing.id})}/>}
    <Field label="Piece name" value={item.name} onChangeText={v => update('name', v)} placeholder="e.g. White weekend tee" maxLength={100} />
    <Section title="Category"><View style={ui.wrap}>{categories.map(c => <Chip key={c} title={categoryLabels[c]} selected={item.category === c} onPress={() => update('category', c)} />)}</View></Section>
    <Section title="Color"><View style={ui.wrap}>{colors.map(c => <Chip key={c} title={c} selected={item.color === c} onPress={() => update('color', c)} />)}</View></Section>
    <Button title={existing ? "Save changes" : "Add to my wardrobe"} disabled={busy} icon="check" onPress={save}/><Button title={details?"Hide styling details":"Add optional styling details"} secondary onPress={()=>setDetails(!details)}/>{details&&<><Section title="Fit"><View style={ui.wrap}>{(['Regular', 'Relaxed', 'Slim'] as const).map(f => <Chip key={f} title={f} selected={item.fit === f} onPress={() => update('fit', f)} />)}</View></Section>
    <Section title="Dress level"><View style={ui.wrap}>{(['Casual', 'Smart casual', 'Dressed up'] as const).map((title, i) => <Chip key={title} title={title} selected={item.formality === i + 1} onPress={() => update('formality', (i + 1) as 1 | 2 | 3)} />)}</View></Section>
    <Section title="Weight"><View style={ui.wrap}>{['Light', 'Midweight', 'Warm'].map((title, i) => <Chip key={title} title={title} selected={item.warmth === i + 1} onPress={() => update('warmth', (i + 1) as 1 | 2 | 3)} />)}</View></Section>
    <Section title="Style notes"><View style={ui.wrap}>{styles.map(style => <Chip key={style} title={style} selected={item.styles.includes(style)} onPress={() => update('styles', item.styles.includes(style) ? item.styles.filter(s => s !== style) : [...item.styles, style])} />)}</View></Section>
    <View style={ui.between}><View style={{ flex: 1 }}><Label weight="600">Ready to wear</Label><Label muted size={14}>Turn off for laundry or repairs.</Label></View><Switch accessibilityLabel="Ready to wear" value={item.available} onValueChange={v => update('available', v)} trackColor={{ true: t.primary }} /></View>
    <View style={ui.between}><Label weight="600">A favorite piece</Label><Switch accessibilityLabel="Favorite piece" value={item.favorite} onValueChange={v => update('favorite', v)} trackColor={{ true: t.primary }} /></View>
    </>}
    {existing && <Button title="Remove piece" danger icon="trash" disabled={busy} onPress={() => Alert.alert('Remove this piece?', 'Remove it from this phone’s wardrobe and saved outfits, including its downloaded reconstruction and comparison photos. Previous wear records keep its name. To also delete computer captures, use the capture’s delete action or Privacy before removing this piece.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { setBusy(true);void eraseGarmentReconstructionAssets(existing.id).then(()=>{dispatch({ type: 'garment/delete', id: existing.id }); leaving.current=true;navigation.goBack();}).catch(()=>setError('The reconstructed files could not be removed. Retry before deleting the piece.')).finally(()=>setBusy(false)); } }])} />}
  </Screen></KeyboardAvoidingView>;
}
