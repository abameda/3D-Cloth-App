import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { makeId } from '../domain/state';
import { outfitSignature } from '../domain/stylist';
import { useInventory, useWardrobe } from '../store';
import { Button, Field, Notice, Screen } from '../ui/primitives';
import { OutfitBoard } from '../ui/OutfitBoard';

export function SaveLookScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'SaveLook'>) {
  const { state, dispatch } = useWardrobe(); const inventory = useInventory(); const [name, setName] = useState(`${state.context.occasion} favorite`); const [error, setError] = useState(''); const outfit = state.outfits[state.dataset];
  function save() { if (!name.trim()) { setError('Give this look a name.'); return; } if (!Object.values(outfit).length) { setError('Choose at least one piece before saving.'); return; } const createdAt = new Date().toISOString(); dispatch({ type: 'look/save', look: { id: makeId(), name: name.trim(), outfit: { ...outfit }, source: state.dataset, createdAt } }); dispatch({ type: 'feedback/add', feedback: { signature: outfitSignature(outfit), outfit: { ...outfit }, vote: 'like', source: state.dataset, createdAt } }); navigation.goBack(); }
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Screen><OutfitBoard outfit={outfit} garments={inventory} compact /><Field label="Look name" value={name} onChangeText={setName} maxLength={100} autoFocus /><Notice>Saving helps the stylist learn what you like. It won’t mark this outfit as worn.</Notice>{!!error && <Notice error>{error}</Notice>}<Button title="Save this look" icon="looks" onPress={save} /></Screen></KeyboardAvoidingView>;
}
