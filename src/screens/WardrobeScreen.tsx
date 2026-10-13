import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { categories, categoryLabels, type Category } from '../domain/types';
import { selectDressingPiece } from '../domain/dressing';
import { useInventory, useWardrobe } from '../store';
import { Button, Chip, IconButton, Label, Notice, Screen, ui } from '../ui/primitives';
import { GarmentArt } from '../ui/GarmentArt';
import { OutfitPreview } from '../ui/OutfitPreview';
import { DressingRail } from '../ui/DressingRail';
import { Icon } from '../ui/Icon';
import { useTheme } from '../ui/theme';

export function WardrobeScreen() {
  const navigation=useNavigation<NativeStackNavigationProp<RootStackParamList>>(),inventory=useInventory(),{state,dispatch}=useWardrobe(),t=useTheme(),{height}=useWindowDimensions();
  const [query,setQuery]=useState(''),[category,setCategory]=useState<Category>('top'),[list,setList]=useState(false),[message,setMessage]=useState('');
  const outfit=state.outfits[state.dataset];
  function add(){Alert.alert('Add clothes','Choose a photo source. A single photo saves a wardrobe item; 3D reconstruction needs overlapping views.',[{text:'Camera',onPress:()=>navigation.navigate('Item',{photoSource:'camera'})},{text:'Existing photo',onPress:()=>navigation.navigate('Item',{photoSource:'library'})},{text:'Several pieces',onPress:()=>navigation.navigate('Batch')},{text:'Cancel',style:'cancel'}]);}
  function inspect(id:string){const piece=inventory.find(g=>g.id===id);if(!piece)return;Alert.alert(piece.name,'Choose how to use this piece.',[{text:'Wear it',onPress:()=>{const result=selectDressingPiece({garments:inventory,dataset:state.dataset,outfit,locks:state.locks[state.dataset]},id);if(result.notice)setMessage(result.notice);else{dispatch({type:'outfit/set',outfit:result.outfit});navigation.navigate('Main',{screen:'Home'});}}},{text:'Edit details',onPress:()=>navigation.navigate('Item',{id})},...(piece.source==='owned'?[{text:'Make or review 3D',onPress:()=>navigation.navigate('Capture',{kind:'garment',garmentId:id})}]:[]),{text:'Cancel',style:'cancel'}]);}
  const filtered=inventory.filter(g=>(query.trim()?true:g.category===category)&&`${g.name} ${g.color} ${g.styles.join(' ')}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <Screen>
    <View style={ui.between}><View style={{flex:1}}><Label size={23} weight="600">Your dressing room</Label><Label muted size={13}>{inventory.length} {state.dataset==='example'?'example pieces':'pieces, all yours'}</Label></View><IconButton icon={list?'room':'list'} label={list?'Show 3D closet':'Show accessible inventory list'} onPress={()=>setList(v=>!v)}/></View>
    {!list&&!query&&<OutfitPreview room="closet" controls={false} height={Math.min(370,Math.max(270,height*.4))} outfit={outfit} garments={inventory} dataset={state.dataset} profile={state.profile} onCustomize={()=>navigation.navigate('Avatar')} onCategorySelect={setCategory}/>}
    {!list&&!query&&<Label muted size={13}>Tap a rail or shelf, then choose a piece below. Room clothes are category previews.</Label>}
    <View style={ui.between}><Button title="Add clothes" icon="add" onPress={add} style={{flex:1}}/><IconButton icon="search" label="Search wardrobe and show list" onPress={()=>setList(true)}/></View>
    {(list||query)&&<View style={[ui.row,{backgroundColor:t.inset,borderRadius:12,paddingHorizontal:14}]}><Icon name="search" color={t.muted}/><TextInput accessibilityLabel="Search wardrobe" placeholder="Find a piece, color or style" placeholderTextColor={t.muted} value={query} onChangeText={setQuery} style={{flex:1,minHeight:52,color:t.text,fontSize:16}}/></View>}
    {!list&&!query?<DressingRail garments={inventory} outfit={outfit} category={category} onCategory={setCategory} onSelect={g=>inspect(g.id)} onInspect={g=>navigation.navigate('Item',{id:g.id})}/>:<View style={{gap:10}}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{categories.map(c=><Chip key={c} title={categoryLabels[c]} selected={category===c} onPress={()=>{setCategory(c);setQuery('');}}/>)}</ScrollView>
      <Label weight="600">{query?'Search results':categoryLabels[category]}</Label>
      {!filtered.length&&<Label muted>No matching pieces. Try another category or search.</Label>}
      {filtered.map(g=><Pressable key={g.id} accessibilityRole="button" accessibilityLabel={`Open ${g.name}`} onPress={()=>inspect(g.id)} style={({pressed})=>({flexDirection:'row',gap:14,paddingVertical:10,alignItems:'center',opacity:pressed ? .7 : 1,borderBottomWidth:1,borderBottomColor:t.line})}><GarmentArt item={g} size={62}/><View style={{flex:1}}><Label weight="600">{g.name}</Label><Label muted size={13}>{g.color} · {g.available?'Ready to wear':'Unavailable'}</Label></View><Icon name="next" size={18}/></Pressable>)}

    </View>}
    {state.dataset==='example'&&<Button title="Use my actual wardrobe" secondary onPress={()=>dispatch({type:'dataset/set',dataset:'owned'})}/>}
    {!!message&&<Notice>{message}</Notice>}
  </Screen>;
}
