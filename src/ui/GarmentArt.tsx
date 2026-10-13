import React, { useState } from 'react';
import { Image, View } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import type { Category, Garment } from '../domain/types';
import { colorHex, useTheme } from './theme';

// Flat catalogue symbols, not photographs or fit simulations.
const paths: Record<Category, string> = {
  onepiece: 'M42 12 L78 12 L88 32 L76 40 L74 56 L103 108 L17 108 L46 56 L44 40 L32 32 Z',
  bag: 'M23 45 H97 L104 103 H16 Z M40 45 V28 Q60 9 80 28 V45',
  eyewear: 'M10 42 H49 V68 Q29 86 10 68 Z M71 42 H110 V68 Q90 86 71 68 Z M49 51 Q60 43 71 51',
  top: 'M35 19 L20 26 L8 49 L25 58 L32 44 L32 98 L88 98 L88 44 L95 58 L112 49 L100 26 L85 19 L73 16 Q60 30 47 16 Z',
  bottom: 'M32 18 L88 18 L95 107 L68 107 L60 55 L52 107 L25 107 Z',
  shoes: 'M18 54 L39 49 L58 67 L96 77 Q112 81 110 96 L15 96 Q9 76 18 54 Z',
  outerwear: 'M40 15 L21 24 L9 96 L28 100 L36 48 L34 107 L86 107 L84 48 L92 100 L111 96 L99 24 L80 15 L72 11 L60 30 L48 11 Z',
  accessories: 'M49 9 L71 9 L75 40 Q91 60 75 80 L71 111 L49 111 L45 80 Q29 60 45 40 Z',
};
export function GarmentArt({ item, category, size = 110 }: { item?: Garment; category?: Category; size?: number }) {
  const t = useTheme(); const [failedUri, setFailedUri] = useState<string>(); const kind = item?.category ?? category ?? 'top';
  if (item?.imageUri && failedUri !== item.imageUri) return <Image source={{ uri: item.imageUri }} accessibilityLabel={item.name} resizeMode="contain" style={{ width: '100%', height: size }} onError={() => setFailedUri(item.imageUri)} />;
  return <View accessibilityLabel={item ? `${item.name}, catalogue symbol` : `Empty ${kind} slot`} style={{ alignItems: 'center', justifyContent: 'center', height: size }}><Svg width={size} height={size} viewBox="0 0 120 120"><Path d={paths[kind]} fill={item ? colorHex[item.color] : 'transparent'} stroke={item ? '#516059' : t.muted} strokeWidth={1.6} strokeLinejoin="round" strokeDasharray={item ? undefined : '4 4'} />{kind === 'top' && <Path d="M47 16 Q60 39 73 16" fill="none" stroke="#64716A" strokeWidth={1.4} />}{kind === 'bottom' && <><Line x1="32" y1="26" x2="88" y2="26" stroke="#64716A" /><Line x1="60" y1="27" x2="60" y2="51" stroke="#64716A" /></>}{kind === 'shoes' && <><Line x1="16" y1="88" x2="109" y2="88" stroke="#64716A" /><Path d="M45 62 l-8 8 M52 67 l-8 8 M59 71 l-8 8" stroke="#64716A" /></>}{kind === 'outerwear' && <Path d="M48 12 L60 30 L72 12 M60 30 V107 M38 73 H50 M70 73 H82" fill="none" stroke="#64716A" strokeWidth={1.4} />}{kind === 'accessories' && <><Circle cx="60" cy="60" r="19" fill={t.surface} stroke="#64716A" /><Path d="M60 47 V60 L70 66" stroke={t.text} fill="none" strokeWidth={2} /></>}</Svg></View>;
}
