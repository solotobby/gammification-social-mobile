/**
 * Plus Jakarta Sans — the font the web app's feed uses
 * (`--ph-body: 'Plus Jakarta Sans'`, from Google Fonts). Matching it is most of
 * why the web reads better at a glance.
 *
 * The web also uses **Space Mono** for money figures (`--ph-mono`) and **Clash
 * Display** for headings and avatar initials (`--ph-display`). Space Mono is
 * embedded here too. Clash Display comes from Fontshare rather than Google
 * Fonts, so it is not included — that would mean committing a font binary
 * under a different licence, which is a call to make deliberately.
 *
 * ## How it's applied
 *
 * The .ttf files are **embedded natively** through the `expo-font` config
 * plugin in app.json, not loaded at runtime. That matters: React Native has no
 * global font hook, and RN 0.85's `Text` is a plain function component — no
 * `defaultProps`, no `.render` to wrap (verified at runtime, not assumed). A
 * font can therefore only be applied by naming it in a style. Embedding lets a
 * single family name cover multiple weights, which keeps that to one constant
 * instead of a per-weight lookup at every call site.
 *
 * **Changing the font list requires a new native build.**
 *
 * ## Why only two weights are exact
 *
 * Google's static TTFs put only Regular and Bold in the `Plus Jakarta Sans`
 * family; Medium, SemiBold and ExtraBold each declare their *own* family with
 * subfamily "Regular" — the old four-style limit. Straight from the name
 * tables:
 *
 *   400Regular    family = Plus Jakarta Sans            subfamily = Regular
 *   700Bold       family = Plus Jakarta Sans            subfamily = Bold
 *   500Medium     family = Plus Jakarta Sans Medium     subfamily = Regular
 *   600SemiBold   family = Plus Jakarta Sans SemiBold   subfamily = Regular
 *   800ExtraBold  family = Plus Jakarta Sans ExtraBold  subfamily = Regular
 *
 * So `fontFamily: FONT` resolves `fontWeight: '400'` and `'700'` to the real
 * faces and rounds 500/600/800 to the nearest of the two. The heavier faces
 * are embedded anyway and can be named through `FONT_WEIGHTS` wherever an
 * exact one is worth the extra style.
 */

/** The family to put on text styles. Weight still comes from `fontWeight`. */
export const FONT = 'Plus Jakarta Sans';

/** Money figures, matching the web's `--ph-mono`. */
export const FONT_MONO = 'Space Mono';

/**
 * Exact faces for the weights the base family can't resolve itself. Use these
 * *without* a `fontWeight` — each is "Regular" inside its own family.
 */
export const FONT_WEIGHTS = {
  medium: 'Plus Jakarta Sans Medium',
  semibold: 'Plus Jakarta Sans SemiBold',
  extrabold: 'Plus Jakarta Sans ExtraBold',
} as const;
