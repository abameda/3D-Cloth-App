import React from 'react';
import { Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from './theme';

const map = {
  settings: ['settings-outline', 'gearshape'], room: ['cube-outline', 'cube'], list: ['list-outline', 'list.bullet'],
  studio: ['sparkles', 'sparkles'], wardrobe: ['shirt-outline', 'tshirt'], looks: ['bookmark-outline', 'bookmark'], person: ['person-outline', 'person.crop.circle'],
  add: ['add', 'plus'], close: ['close', 'xmark'], next: ['chevron-forward', 'chevron.right'], shuffle: ['shuffle', 'shuffle'], lock: ['lock-closed-outline', 'lock.fill'], unlock: ['lock-open-outline', 'lock.open'],
  camera: ['camera-outline', 'camera'], photo: ['image-outline', 'photo'], heart: ['heart-outline', 'heart'], heartFill: ['heart', 'heart.fill'], check: ['checkmark', 'checkmark'],
  edit: ['pencil-outline', 'pencil'], trash: ['trash-outline', 'trash'], clock: ['time-outline', 'clock'], search: ['search-outline', 'magnifyingglass'],
  sun: ['sunny-outline', 'sun.max'], cloud: ['cloud-outline', 'cloud'], cold: ['snow-outline', 'snowflake'], link: ['link-outline', 'link'], refresh: ['refresh', 'arrow.clockwise'],
  down: ['chevron-down', 'chevron.down'], dislike: ['thumbs-down-outline', 'hand.thumbsdown'], info: ['information-circle-outline', 'info.circle'],
} as const;
export type IconName = keyof typeof map;
export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const t = useTheme();
  return Platform.OS === 'ios'
    ? <SymbolView name={map[name][1]} tintColor={color ?? t.text} style={{ width: size, height: size }} />
    : <Ionicons name={map[name][0]} size={size} color={color ?? t.text} />;
}
