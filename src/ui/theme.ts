import { useColorScheme } from 'react-native';

const light = {
  background: '#F5F1EA', surface: '#FFFCF6', inset: '#EAE3D7', board: '#E9E1D4',
  text: '#292C25', muted: '#615F56', line: '#D6CEBF', primary: '#3E5243',
  onPrimary: '#FFFFFF', selected: '#DBE1D4', danger: '#A7352B', warning: '#795514',
};
const dark: typeof light = {
  background: '#201F1B', surface: '#2B2923', inset: '#38352D', board: '#34312D',
  text: '#F3EEE4', muted: '#C4BEAF', line: '#514B40', primary: '#C3D3B7',
  onPrimary: '#253224', selected: '#3C4836', danger: '#FFABA6', warning: '#EDCD8E',
};
export function useTheme() { const isDark = useColorScheme() === 'dark'; return { ...isDark ? dark : light, isDark }; }
export type Theme = ReturnType<typeof useTheme>;
export const colorHex: Record<string, string> = { Unknown: '#CBD4CF', White: '#F4F1E9', Black: '#252925', Grey: '#969D99', Navy: '#293A50', Blue: '#7799B4', Green: '#718569', Beige: '#CFBFA2', Brown: '#8B6851', Red: '#BA5750', Pink: '#D8A4AB', Yellow: '#D4B662', Purple: '#9485AF' };
