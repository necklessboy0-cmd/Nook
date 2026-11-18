import { createContext, useContext } from 'react';

/** How the app picks light or dark. */
export type ThemeMode = 'system' | 'light' | 'dark';

export type AccentId = 'crimson' | 'amber' | 'emerald' | 'azure' | 'violet' | 'rose' | 'mono';

export type TileShape = 'square' | 'rounded' | 'circle';

/** Everything the user can change about how NOOK looks. Saved on the phone. */
export type Appearance = {
  mode: ThemeMode;
  accent: AccentId;
  /** Grid columns on the gallery screen. */
  columns: number;
  /** Corner radius of tiles and cards. */
  radius: number;
  tileShape: TileShape;
  /** 0.9 – 1.25 */
  fontScale: number;
  /** Tighter spacing, smaller tiles. */
  compact: boolean;
  showBadges: boolean;
  showDates: boolean;
  haptics: boolean;
};

export const DEFAULT_APPEARANCE: Appearance = {
  mode: 'dark',
  accent: 'crimson',
  columns: 3,
  radius: 14,
  tileShape: 'rounded',
  fontScale: 1,
  compact: false,
  showBadges: true,
  showDates: true,
  haptics: true,
};

export const ACCENTS: Record<AccentId, { name: string; light: string; dark: string }> = {
  crimson: { name: 'Crimson', light: '#C81E3A', dark: '#FF4D6A' },
  amber: { name: 'Amber', light: '#B45309', dark: '#FBBF24' },
  emerald: { name: 'Emerald', light: '#047857', dark: '#34D399' },
  azure: { name: 'Azure', light: '#1D4ED8', dark: '#60A5FA' },
  violet: { name: 'Violet', light: '#6D28D9', dark: '#A78BFA' },
  rose: { name: 'Rose', light: '#BE185D', dark: '#F472B6' },
  mono: { name: 'Mono', light: '#111827', dark: '#E5E7EB' },
};

export const ACCENT_IDS = Object.keys(ACCENTS) as AccentId[];

export type Colors = {
  primary: string;
  onPrimary: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  danger: string;
  success: string;
  warning: string;
  /** Faint accent wash for selected chips and highlights. */
  accentSoft: string;
  /** Backdrop behind sheets and the viewer. */
  scrim: string;
};

const LIGHT_BASE = {
  background: '#F4F4F6',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#101014',
  muted: '#6B6B76',
  border: '#E2E2E8',
  danger: '#C81E3A',
  success: '#047857',
  warning: '#B45309',
  scrim: 'rgba(8,8,10,0.55)',
};

const DARK_BASE = {
  background: '#08080A',
  surface: '#121216',
  card: '#16161B',
  text: '#F5F5F7',
  muted: '#8E8E99',
  border: '#26262E',
  danger: '#FF5A6E',
  success: '#34D399',
  warning: '#FBBF24',
  scrim: 'rgba(0,0,0,0.72)',
};

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function buildColors(scheme: 'light' | 'dark', accent: AccentId): Colors {
  const base = scheme === 'dark' ? DARK_BASE : LIGHT_BASE;
  const primary = ACCENTS[accent][scheme];
  return {
    ...base,
    primary,
    onPrimary: scheme === 'dark' ? '#0A0A0C' : '#FFFFFF',
    accentSoft: withAlpha(primary, scheme === 'dark' ? 0.16 : 0.1),
  };
}

type ThemeValue = {
  colors: Colors;
  appearance: Appearance;
  scheme: 'light' | 'dark';
  /** Multiplies font sizes so the user can make text bigger or smaller. */
  fs: (size: number) => number;
};

const ThemeContext = createContext<ThemeValue>({
  colors: buildColors('dark', 'crimson'),
  appearance: DEFAULT_APPEARANCE,
  scheme: 'dark',
  fs: (size) => size,
});

export const ThemeProvider = ThemeContext.Provider;

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

/** Kept for the starter's UI components: the active palette. */
export function useColors(): Colors {
  return useContext(ThemeContext).colors;
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
