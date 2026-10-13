import React from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { categories, categoryLabels, type Category, type Garment, type Outfit } from '../domain/types';
import { GarmentArt } from './GarmentArt';
import { Chip, Label, ui } from './primitives';
import { useTheme } from './theme';

export function DressingRail({garments,outfit,category,onCategory,onSelect,onInspect}:{garments:Garment[];outfit:Outfit;category:Category;onCategory:(category:Category)=>void;onSelect:(garment:Garment)=>void;onInspect?:(garment:Garment)=>void}) {
  const t=useTheme(),pieces=garments.filter(g=>g.category===category);
  return <View style={{gap:12}}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{categories.map(c=><Chip key={c} title={categoryLabels[c]} selected={category===c} onPress={()=>onCategory(c)}/>)}</ScrollView>
    <FlatList horizontal data={pieces} keyExtractor={g=>g.id} showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:12}} ListEmptyComponent={<View style={{paddingVertical:16}}><Label muted>No {categoryLabels[category].toLowerCase()} yet. Add a favorite piece.</Label></View>} renderItem={({item})=>{
      const selected=outfit[category]===item.id;
      return <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}${!item.available?', unavailable':''}. ${onInspect?'Open piece':'Wear piece'}`} accessibilityState={{selected,disabled:!onInspect&&!item.available}} disabled={!onInspect&&!item.available} onPress={()=>onSelect(item)} onLongPress={onInspect?()=>onInspect(item):undefined} style={({pressed})=>({width:126,gap:6,opacity:pressed ? .7 : !item.available ? .55 : 1})}>
        <View style={{height:134,alignItems:'center',justifyContent:'center',backgroundColor:selected?t.selected:t.surface,borderRadius:14,borderWidth:selected?2:0,borderColor:t.primary}}><GarmentArt item={item} size={100}/></View>
        <Label size={14} weight="600" numberOfLines={2}>{item.name}</Label>
        <View style={ui.row}><Label size={12} muted>{selected?'On your look':item.available?'Photo reference':'Unavailable'}</Label></View>
      </Pressable>;
    }}/>
  </View>;
}
