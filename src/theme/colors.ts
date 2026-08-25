/**
 * Payhankey color system.
 *
 * `brand` holds the fixed brand identity colors (violet / indigo accents and the
 * secondary accents). These DO NOT change between light and dark mode — the
 * violet accent is the constant identity of the app.
 *
 * `lightColors` and `darkColors` provide the mode-dependent semantic surfaces and
 * text colors. UI code should always read from semantic keys (e.g. `colors.text`,
 * `colors.surface`) so components stay theme-agnostic.
 */

// ---------------------------------------------------------------------------
// Brand palette — fixed across light & dark mode
// ---------------------------------------------------------------------------
export const brand = {
  violet: '#5A4FDC', // primary accent
  violetBright: '#7B6CF6',
  indigo: '#15103A', // deep brand backdrop
  mint: '#10B981',
  mintBright: '#34D399',
  gold: '#F4B740',
  pink: '#F4467E',
  ink: '#171331',
  slate: '#5A5578',
  slateLight: '#8B86A6',
} as const;

export type ThemeColors = {
  /** Primary brand accent — identical in both modes. */
  brand: string;
  brandBright: string;
  brandDeep: string;
  mint: string;
  mintBright: string;
  gold: string;
  pink: string;

  /** App background (the base canvas). */
  background: string;
  /** Secondary background used for gradient depth. */
  backgroundElevated: string;
  /** Raised surfaces — cards, sheets. */
  surface: string;
  /** Alternate / tinted surface. */
  surfaceAlt: string;
  /** Hairline borders & dividers. */
  border: string;

  /** Primary text. */
  text: string;
  /** Secondary text — body copy. */
  textSecondary: string;
  /** Muted / tertiary text — captions. */
  textMuted: string;
  /** Text/icon color rendered on top of the brand accent. */
  onBrand: string;
  /** Errors and destructive actions. */
  danger: string;

  /** Inactive pagination dot. */
  dotInactive: string;
  /** Shadow color for elevation. */
  shadow: string;
  /** Translucent scrim / overlay. */
  overlay: string;
};

// ---------------------------------------------------------------------------
// Light mode
// ---------------------------------------------------------------------------
export const lightColors: ThemeColors = {
  brand: brand.violet,
  brandBright: brand.violetBright,
  brandDeep: brand.indigo,
  mint: brand.mint,
  mintBright: brand.mintBright,
  gold: brand.gold,
  pink: brand.pink,

  // Sampled from the live web app (payhankey.com, 2026-08-25) so light mode
  // matches it exactly — the web is light-only, so none of this applies to
  // dark mode below.
  //
  // The web's relationship is: page shell #EDF0F7, cards white on top of it,
  // and insets (the comment input, `.form-control-alt`) back at #EDF0F7. So
  // `background` and `surfaceAlt` being the same value is deliberate, not a
  // copy-paste slip — an inset sits inside a white card, never on the page.
  background: '#EDF0F7', // web page shell / --bs-light
  backgroundElevated: '#F7F8FA', // web .pk-comments strip
  surface: '#FFFFFF', // web .pk-card
  surfaceAlt: '#EDF0F7', // web .form-control-alt (comment input)
  // The web's form border (--bs-border-color), not its card border (#EFF3F4).
  // #EFF3F4 is near-invisible against white and vanishes entirely against the
  // page, which left every input looking unbordered; this reads on both.
  border: '#DFE4F1',

  text: '#171331', // --ph-ink
  textSecondary: '#5A5578', // --ph-slate
  textMuted: '#8B86A6', // --ph-slate-light
  onBrand: '#FFFFFF',
  danger: '#E11D48',

  dotInactive: 'rgba(90, 79, 220, 0.20)',
  shadow: '#2A2151',
  overlay: 'rgba(23, 19, 49, 0.45)',
};

// ---------------------------------------------------------------------------
// Dark mode
// ---------------------------------------------------------------------------
export const darkColors: ThemeColors = {
  brand: brand.violet,
  brandBright: brand.violetBright,
  brandDeep: brand.indigo,
  mint: brand.mint,
  mintBright: brand.mintBright,
  gold: brand.gold,
  pink: brand.pink,

  background: '#0C0820', // deep indigo-black canvas
  backgroundElevated: '#15103A', // --ph-indigo
  surface: '#191243',
  surfaceAlt: '#221B52',
  border: 'rgba(255, 255, 255, 0.08)',

  text: '#F5F3FF',
  textSecondary: '#BCB6E0',
  textMuted: '#8B86A6', // --ph-slate-light reads well on dark too
  onBrand: '#FFFFFF',
  danger: '#FB7185',

  dotInactive: 'rgba(255, 255, 255, 0.18)',
  shadow: '#000000',
  overlay: 'rgba(7, 5, 20, 0.55)',
};

export type ColorScheme = 'light' | 'dark';

export const palettes: Record<ColorScheme, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};
