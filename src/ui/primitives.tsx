import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextProps, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon';
import { useTheme } from './theme';

export function Label({ children, muted, size = 16, weight = '400', style, ...props }: TextProps & { muted?: boolean; size?: number; weight?: TextProps['style'] extends never ? never : '400' | '500' | '600' | '700' | '800' }) {
  const t = useTheme();
  return <Text {...props} style={[{ color: muted ? t.muted : t.text, fontSize: size, fontWeight: weight, lineHeight: size * 1.4 }, style]}>{children}</Text>;
}
export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const t = useTheme(); const inset = useSafeAreaInsets();
  return scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: t.background }} contentContainerStyle={{ padding: 20, paddingBottom: Math.max(28, inset.bottom + 16), gap: 22 }}>{children}</ScrollView> : <View style={{ flex: 1, backgroundColor: t.background }}>{children}</View>;
}
export function Button({ title, onPress, icon, secondary = false, danger = false, disabled = false, loading = false, style }: { title: string; onPress: () => void; icon?: IconName; secondary?: boolean; danger?: boolean; disabled?: boolean; loading?: boolean; style?: ViewStyle }) {
  const t = useTheme(); const foreground = danger ? t.danger : secondary ? t.primary : t.onPrimary;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || loading, busy: loading }} disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [{ minHeight: 52, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 14, backgroundColor: secondary || danger ? t.inset : t.primary, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', opacity: disabled ? .45 : pressed ? .72 : 1 }, style]}>{loading ? <ActivityIndicator color={foreground} /> : icon ? <Icon name={icon} color={foreground} size={20} /> : null}<Label weight="600" style={{ color: foreground, flexShrink: 1, textAlign: 'center' }}>{title}</Label></Pressable>;
}
export function IconButton({ icon, label, onPress, selected, disabled }: { icon: IconName; label: string; onPress: () => void; selected?: boolean; disabled?: boolean }) {
  const t = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: selected ? t.selected : 'transparent', opacity: disabled ? .4 : pressed ? .6 : 1 })}><Icon name={icon} color={selected ? t.primary : t.text} /></Pressable>;
}
export function Chip({ title, selected, onPress }: { title: string; selected: boolean; onPress: () => void }) {
  const t = useTheme(); return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => ({ minHeight: 48, justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 24, backgroundColor: selected ? t.primary : t.inset, opacity: pressed ? .7 : 1 })}><Label weight={selected ? '600' : '400'} size={15} style={{ color: selected ? t.onPrimary : t.text }}>{title}</Label></Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme(); return <View style={{ gap: 8 }}><Label weight="600">{label}</Label><TextInput accessibilityLabel={label} placeholderTextColor={t.muted} selectionColor={t.primary} {...props} style={[{ color: t.text, backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 17, minHeight: 52, textAlignVertical: props.multiline ? 'top' : 'center' }, props.style]} /></View>;
}
export function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={{ gap: 12 }}><Label size={19} weight="600">{title}</Label>{children}</View>; }
export function Notice({ children, error }: { children: React.ReactNode; error?: boolean }) { const t = useTheme(); return <View accessibilityLiveRegion="polite" style={{ padding: 14, borderRadius: 12, backgroundColor: t.inset }}><Label size={14} style={{ color: error ? t.danger : t.muted }}>{children}</Label></View>; }
export function Empty({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) { return <View style={{ paddingVertical: 32, gap: 18 }}><Label size={27} weight="700">{title}</Label><Label muted>{description}</Label>{children}</View>; }
export const ui = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, group: { gap: 12 } });
