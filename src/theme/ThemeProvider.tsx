import React, {
  createContext,
  useCallback,
  useContext,
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [preference, setPreference] = useState<ThemePreference>('system');

  const scheme: ColorScheme = useMemo(() => {
    if (preference === 'system') {
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
      preference,
      setPreference,
    }),
    [scheme, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
