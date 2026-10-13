import React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { categoryLabels } from '../domain/types';
import { useInventory, useWardrobe } from '../store';
import { Button, Empty, Label, Screen, ui } from '../ui/primitives';
import { GarmentArt } from '../ui/GarmentArt';
import { Icon } from '../ui/Icon';
import { useTheme } from '../ui/theme';

export function PickScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'Pick'>) {
  const { state, dispatch } = useWardrobe(); const inventory = useInventory(); const t = useTheme(); const category = route.params.category;
  const items = inventory.filter(g => g.category === category); const outfit = state.outfits[state.dataset];
  function select(id?: string) { const next = { ...outfit }; if (id) {next[category] = id;if(category==='onepiece'){delete next.top;delete next.bottom;}else if(category==='top'||category==='bottom')delete next.onepiece;}else delete next[category];dispatch({type:'context/set',context:{...state.context,outfitMode:next.onepiece?'onepiece':'separates'}}); dispatch({ type: 'outfit/set', outfit: next }); navigation.goBack(); }
  return <Screen scroll={false}><FlatList data={items} keyExtractor={i => i.id} contentContainerStyle={{ padding: 20, gap: 12 }} ListHeaderComponent={<View style={{ gap: 14, marginBottom: 10 }}><Label size={24} weight="700">Find your {categoryLabels[category].toLowerCase()}</Label><Label muted>Only this slot changes. Unavailable pieces stay out of the rotation.</Label><Button title="Leave this slot empty" secondary onPress={() => select()} /></View>} ListEmptyComponent={<Empty title="Nothing here yet" description="Add a piece in this category to start combining it with the rest of your wardrobe."><Button title="Add a piece" icon="add" onPress={() => navigation.navigate('Item')} /></Empty>} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityState={{ selected: outfit[category] === item.id, disabled: !item.available }} disabled={!item.available} onPress={() => select(item.id)} style={({ pressed }) => [ui.row, { padding: 12, borderRadius: 14, backgroundColor: outfit[category] === item.id ? t.selected : t.surface, opacity: !item.available ? .5 : pressed ? .7 : 1 }]}><View style={{ width: 90 }}><GarmentArt item={item} size={80} /></View><View style={{ flex: 1, gap: 4 }}><Label weight="600">{item.name}</Label><Label muted size={14}>{item.color} · {item.fit}</Label>{!item.available && <Label muted size={13}>Unavailable</Label>}</View>{outfit[category] === item.id && <Icon name="check" color={t.primary} />}</Pressable>} /></Screen>;
}
