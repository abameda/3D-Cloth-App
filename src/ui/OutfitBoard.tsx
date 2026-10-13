import React from 'react';
import { Image, Pressable, View } from 'react-native';
import type { Category, Garment, Outfit, Profile } from '../domain/types';
import { GarmentArt } from './GarmentArt';
import { Icon } from './Icon';
import { Label, ui } from './primitives';
import { useTheme } from './theme';

export function OutfitBoard({ outfit, garments, profile, onSelect, compact = false }: { outfit: Outfit; garments: Garment[]; profile?: Profile; onSelect?: (category: Category) => void; compact?: boolean }) {
  const t = useTheme();
  const piece = (category: Category, height: number) => {
    const item = garments.find(g => g.id === outfit[category]);
    return <Pressable key={category} disabled={!onSelect} accessibilityRole={onSelect ? 'button' : undefined} accessibilityLabel={`${item?.name ?? `Choose ${category}`}${item && !item.available ? ', unavailable' : ''}`} onPress={() => onSelect?.(category)} style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5, minWidth: 0, paddingVertical: 8, opacity: pressed ? .65 : 1 })}><GarmentArt item={item} category={category} size={height} />{!compact && <Label size={13} muted style={{ textAlign: 'center', paddingHorizontal: 4 }}>{item?.name ?? `Choose ${category}`}</Label>}</Pressable>;
  };
  return <View style={{ backgroundColor: t.board, borderRadius: 16, padding: compact ? 8 : 16, gap: 8 }}>
    {profile && <View style={[ui.row, { paddingBottom: 6 }]}>{profile.imageUri ? <Image source={{ uri: profile.imageUri }} accessibilityLabel="Your portrait" style={{ width: 38, height: 38, borderRadius: 19 }} /> : <Icon name="person" size={28} color={t.primary} />}<View style={{ flex: 1 }}><Label weight="600" size={15}>{profile.name ? `For ${profile.name}` : 'Made for your day'}</Label><Label muted size={12}>Outfit board · not a fit simulation</Label></View></View>}
    <View style={ui.row}>{outfit.onepiece?piece('onepiece',compact?90:160):<>{piece('top', compact ? 68 : 112)}{piece('bottom', compact ? 68 : 112)}</>}</View>
    <View style={ui.row}>{outfit.outerwear && piece('outerwear', compact ? 54 : 86)}{piece('shoes', compact ? 54 : 86)}{outfit.accessories && piece('accessories', compact ? 54 : 76)}</View>
    {(outfit.bag||outfit.eyewear)&&<View style={ui.row}>{outfit.bag&&piece('bag',compact?54:76)}{outfit.eyewear&&piece('eyewear',compact?54:76)}</View>}
  </View>;
}
