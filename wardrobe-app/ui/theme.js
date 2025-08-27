// ui/theme.js
import { useColorScheme } from 'react-native';

export const PALETTES = {
  light: {
    bg: '#F8F7FB',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F2F6',
    text: '#111827',
    textMuted: '#6B7280',
    primary: '#1F6FEB',      // bright fashion blue
    primaryAlt: '#5AA2FF',
    hairline: '#E5E7EB',
    shadow: '#00000022',
    chipBg: '#F3F6FF',
    chipActiveBg: '#1F6FEB',
    chipActiveText: '#FFFFFF',
    accent: '#FFD54F',
  },
  dark: {
    bg: '#0B0F17',
    surface: '#121723',
    surfaceAlt: '#0F1420',
    text: '#E5E7EB',
    textMuted: '#98A2B3',
    primary: '#7DB2FF',
    primaryAlt: '#A7CBFF',
    hairline: '#1E293B',
    shadow: '#00000066',
    chipBg: '#1A2232',
    chipActiveBg: '#7DB2FF',
    chipActiveText: '#0B0F17',
    accent: '#FFC043',
  },
};

export function useTheme() {
  // we’ll force light for now, but this hook is dark-ready
  const scheme = useColorScheme(); // 'light' | 'dark' | null
  const palette = PALETTES.light; // later: scheme === 'dark' ? PALETTES.dark : PALETTES.light
  return { colors: palette, isDark: false };
}
