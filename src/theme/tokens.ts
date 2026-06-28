/** Shared, mode-independent design tokens. */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const typography = {
  hero: { fontSize: 30, lineHeight: 38, fontWeight: '800' as const },
  title: { fontSize: 26, lineHeight: 33, fontWeight: '800' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  button: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '700' as const },
} as const;
