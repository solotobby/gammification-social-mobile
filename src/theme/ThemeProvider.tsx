import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

import { brand, palettes, type ColorScheme, type ThemeColors } from './colors';
import { radius, spacing, typography } from './tokens';

/**
 * `system` follows the OS appearance setting (the default). `light` / `dark`
 * are explicit user overrides.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  /** The resolved scheme actually being rendered. */
  scheme: ColorScheme;
  isDark: boolean;
  colors: ThemeColors;
  /** Fixed brand identity colors (do not change with the mode). */
  brand: typeof brand;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  /** The user's preference: 'system' | 'light' | 'dark'. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const PREFERENCE_KEY = 'payhankey.themePreference';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  // `null` while the persisted preference loads — children render only after,
  // so an explicit Light/Dark choice never flashes the wrong theme on launch.
  const [preference, setPreferenceState] = useState<ThemePreference | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PREFERENCE_KEY)
      .then((stored) =>
        setPreferenceState(stored === 'light' || stored === 'dark' ? stored : 'system'),
      )
      .catch(() => setPreferenceState('system'));
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(PREFERENCE_KEY, next).catch(() => {
      // Persistence is best-effort; the in-memory preference still applies.
    });
  }, []);

  const scheme: ColorScheme = useMemo(() => {
    if (preference === 'system' || preference === null) {
      return systemScheme === 'dark' ? 'dark' : 'light';
    }
    return preference;
  }, [preference, systemScheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      isDark: scheme === 'dark',
      colors: palettes[scheme],
      brand,
      spacing,
      radius,
      typography,
      preference: preference ?? 'system',
      setPreference,
    }),
    [scheme, preference, setPreference],
  );

  if (preference === null) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
