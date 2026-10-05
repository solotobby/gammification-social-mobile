import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Appearance, Easing, Platform, StyleSheet, View } from 'react-native';

import { brand } from '../../theme/colors';

/**
 * The second half of the launch: the native splash comes alive.
 *
 * The coin tucks the wordmark away, grows to centre stage, is tossed — a
 * double flip and a landing that throws off two rings and a burst of
 * violet / mint / gold sparks (engagement turning into earnings) — then
 * settles back into the lockup and the name slides out of it again. Then the
 * whole thing dissolves into the app.
 *
 * ## Why it starts exactly where the native splash stops
 *
 * Its first frame is a pixel copy of what the OS drew, so hiding the native
 * splash underneath is invisible:
 *
 * - **iOS** draws the full lockup (`splash-logo-*.png`, `imageWidth: 260`,
 *   centred), so the animation opens on the lockup.
 * - **Android** draws only the mark (`splash-mark.png`, `imageWidth: 150`), so
 *   it opens on the big coin and skips the tuck-and-grow intro.
 *
 * These constants MUST stay in step with the `expo-splash-screen` block in
 * app.json — background colours and image widths. The moving parts are cut
 * from that same art (`assets/splash/p.png` is the white P from
 * `splash-mark.png`, cropped to the coin; `word.png` is the wordmark from
 * `splash-logo-dark.png`, right of the coin, full lockup height). Re-cut them
 * if the art changes.
 *
 * ## Why it's one clock
 *
 * The whole choreography runs off ONE `Animated.timing` on the native driver —
 * a linear clock over the timeline — and every moving part is that clock
 * pushed through a sampled interpolation of its phase (`track` below). No
 * `setTimeout`s hold the sequence together, so a busy JS thread (the app is
 * still settling underneath) can't make it stutter. The clock is seeded at
 * the platform's start point, so the frame before it runs is already right —
 * no reset, no flash. Plain `Animated`, no reanimated / Lottie: nothing here
 * needs a native build.
 */

// --- Geometry (pt), measured off the native splash art ----------------------

/** iOS lockup: 260pt wide (app.json `imageWidth`), image is 1600 x 279 px. */
const LOCKUP_W = 260;
const PX = LOCKUP_W / 1600;
const LOCKUP_H = 279 * PX;
/** The coin spans px 1..278 of the lockup; its centre, from the lockup's left. */
const COIN_D = 278 * PX;
const COIN_CX = 140 * PX;
/** The wordmark starts at px 304 and runs to the end. */
const WORD_LEFT = 304 * PX;
const WORD_W = 1296 * PX;
/** Android: the mark is 150dp, and the coin fills 815/1024 of it. Also the
 *  size the coin is tossed at on iOS. The coin is rendered at THIS size and
 *  scaled down for the lockup — scaling an image up comes out soft. */
const BIG_D = 150 * (815 / 1024);
const LOCKUP_SCALE = COIN_D / BIG_D;
/** From the screen centre to the coin's place in the lockup. */
const COIN_SHIFT = -(LOCKUP_W / 2 - COIN_CX);

/** The wordmark is clipped at the coin's centre, so it slides in UNDER the
 *  coin and never pokes out of its far side. */
const CLIP_LEFT = COIN_SHIFT;
const CLIP_W = LOCKUP_W / 2 - COIN_SHIFT;
const WORD_IN_CLIP = WORD_LEFT - COIN_CX;
const TUCK_DISTANCE = WORD_IN_CLIP + WORD_W;

const HOP = 30;
const SPINS = 2;
const RINGS = 2;
const SPARKS = 10;
const SPARK_COLORS = [brand.violetBright, brand.mint, brand.gold, brand.pink];

/** app.json `backgroundColor` / `dark.backgroundColor`. */
const BG = { light: '#F6F4FF', dark: '#0C0820' } as const;

// --- Timeline (ms) -----------------------------------------------------------

const T_TUCK = 100;
const TUCK_MS = 280;
const T_GROW = 240;
const GROW_MS = 420;
const T_TOSS = 720;
const TOSS_UP = 260;
const TOSS_DOWN = 240;
const T_LAND = T_TOSS + TOSS_UP + TOSS_DOWN;
const SQUASH_MS = 80;
const SETTLE_MS = 260;
const RING_MS = 680;
const RING_STAGGER = 130;
const BURST_MS = 640;
const T_BACK = 1420;
const BACK_MS = 400;
const T_UNTUCK = 1700;
const UNTUCK_MS = 380;
const TOTAL = T_UNTUCK + UNTUCK_MS + 160;
/** Android's native splash already IS the big coin, so it joins the timeline
 *  once the intro would have grown it there — a beat before the toss. */
const START = Platform.OS === 'android' ? T_GROW + GROW_MS : 0;
const RUN = TOTAL - START;
const FADE_MS = 340;
/** Sampling step for `track`; the native interpolation is linear between. */
const SAMPLE_MS = 8;

const IN_CUBIC = Easing.in(Easing.cubic);
const OUT_CUBIC = Easing.out(Easing.cubic);
const IN_OUT_CUBIC = Easing.inOut(Easing.cubic);
const OUT_QUAD = Easing.out(Easing.quad);
const IN_QUAD = Easing.in(Easing.quad);
const IN_OUT_QUAD = Easing.inOut(Easing.quad);

/** 0 before `from`, 1 after `from + ms`, eased in between. */
const seg = (now: number, from: number, ms: number, ease: (t: number) => number) =>
  now <= from ? 0 : now >= from + ms ? 1 : ease((now - from) / ms);

const SAMPLES = Array.from({ length: Math.ceil(TOTAL / SAMPLE_MS) + 1 }, (_, i) =>
  Math.min(i * SAMPLE_MS, TOTAL),
);
const CLOCK_RANGE = SAMPLES.map((ms) => ms / TOTAL);

/** One phase of the timeline as a native interpolation of the 0..1 clock. */
const track = (clock: Animated.Value, phase: (ms: number) => number) =>
  clock.interpolate({ inputRange: CLOCK_RANGE, outputRange: SAMPLES.map(phase) });

/** 0 = word showing, 1 = tucked under the coin. */
const tuckAt = (ms: number) =>
  seg(ms, T_TUCK, TUCK_MS, IN_CUBIC) - seg(ms, T_UNTUCK, UNTUCK_MS, OUT_CUBIC);
/** 0 = coin in the lockup, 1 = big at centre stage. */
const stageAt = (ms: number) =>
  seg(ms, T_GROW, GROW_MS, IN_OUT_CUBIC) - seg(ms, T_BACK, BACK_MS, IN_OUT_CUBIC);
/** Height of the toss: rise decelerating, fall accelerating. */
const hopAt = (ms: number) =>
  ms < T_TOSS + TOSS_UP
    ? seg(ms, T_TOSS, TOSS_UP, OUT_QUAD)
    : 1 - seg(ms, T_TOSS + TOSS_UP, TOSS_DOWN, IN_QUAD);
const spinAt = (ms: number) => seg(ms, T_TOSS, TOSS_UP + TOSS_DOWN, IN_OUT_QUAD);
/** Flat on impact, a touch of stretch, then rest — the thud of the landing. */
const squashAt = (ms: number) => {
  if (ms <= T_LAND) return 0;
  const hit = (ms - T_LAND) / SQUASH_MS;
  if (hit < 1) return OUT_QUAD(hit);
  const settle = (ms - T_LAND - SQUASH_MS) / SETTLE_MS;
  if (settle >= 1) return 0;
  return Math.exp(-4.4 * settle) * Math.cos(settle * Math.PI * 1.7);
};
const ringAt = (i: number) => (ms: number) =>
  seg(ms, T_LAND + i * RING_STAGGER, RING_MS, OUT_CUBIC);
const burstAt = (ms: number) => seg(ms, T_LAND, BURST_MS, OUT_CUBIC);

const useNative = Platform.OS !== 'web';

type Props = {
  /**
   * The app underneath is mounted and its persisted state is back. The native
   * splash is held until then, so the first screen's mount — the heaviest
   * UI-thread work of the launch — happens under it rather than under this
   * animation, where it would freeze the toss mid-air.
   */
  ready: boolean;
  /** Faded out; the parent unmounts it. */
  onDone: () => void;
};

export function LaunchSplash({ ready, onDone }: Props) {
  // The native splash follows the OS appearance, not the in-app theme toggle,
  // so this does too — read once, so a change mid-launch can't swap the frame.
  const [scheme] = useState<keyof typeof BG>(() =>
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  );
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [nativeGone, setNativeGone] = useState(false);

  // Seeded at START, so the first frame is what the native splash shows.
  const [clock] = useState(() => new Animated.Value(START / TOTAL));
  const [fade] = useState(() => new Animated.Value(0));

  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  const armed = useRef(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => alive && setReduceMotion(reduced))
      .catch(() => alive && setReduceMotion(false));
    return () => {
      alive = false;
    };
  }, []);

  // Hide the native splash once the app is ready AND this overlay has drawn
  // over it — two frames: one to commit, one to paint.
  useEffect(() => {
    if (!ready) return;
    let live = true;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        SplashScreen.hideAsync()
          .catch(() => {})
          .finally(() => live && setNativeGone(true));
      });
    });
    return () => {
      live = false;
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [ready]);

  useEffect(() => {
    if (!nativeGone || reduceMotion === null || armed.current) return;
    armed.current = true;

    const leave = (duration: number) =>
      Animated.timing(fade, {
        toValue: 1,
        duration,
        easing: IN_QUAD,
        useNativeDriver: useNative,
      }).start(({ finished }) => finished && done.current());

    if (reduceMotion) {
      // No toss: hold whatever the native splash showed, then dissolve.
      const t = setTimeout(() => leave(240), 300);
      return () => clearTimeout(t);
    }

    const sequence = Animated.timing(clock, {
      toValue: 1,
      duration: RUN,
      easing: Easing.linear,
      useNativeDriver: useNative,
    });
    sequence.start(({ finished }) => finished && leave(FADE_MS));
    return () => sequence.stop();
    // Armed exactly once; `reduceMotion` is read at arm time on purpose.
  }, [nativeGone, reduceMotion]);

  const [view] = useState(() => {
    const tuck = track(clock, tuckAt);
    const stage = track(clock, stageAt);
    const hop = track(clock, hopAt);
    const spin = track(clock, spinAt);
    const squash = track(clock, squashAt);
    const burst = track(clock, burstAt);
    const spinFront = spin.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', `${360 * SPINS}deg`],
    });
    const spinBack = spin.interpolate({
      inputRange: [0, 1],
      outputRange: ['180deg', `${360 * SPINS + 180}deg`],
    });
    return {
      opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
      exitScale: fade.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }),
      wordX: tuck.interpolate({ inputRange: [0, 1], outputRange: [0, -TUCK_DISTANCE] }),
      coinX: stage.interpolate({ inputRange: [0, 1], outputRange: [COIN_SHIFT, 0] }),
      coinScale: stage.interpolate({ inputRange: [0, 1], outputRange: [LOCKUP_SCALE, 1] }),
      coinY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -HOP] }),
      // Squash dips below 0 as it rebounds — that's the stretch, so extend.
      squashX: squash.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.08],
        extrapolate: 'extend',
      }),
      squashY: squash.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.9],
        extrapolate: 'extend',
      }),
      spinFront,
      spinBack,
      rings: Array.from({ length: RINGS }, (_, i) => {
        const ring = track(clock, ringAt(i));
        return {
          scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.3] }),
          opacity: ring.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.55, 0] }),
        };
      }),
      sparks: Array.from({ length: SPARKS }, (_, i) => {
        const reach = i % 2 ? 46 : 64;
        return {
          rotate: `${(360 / SPARKS) * i + 18}deg`,
          color: SPARK_COLORS[i % SPARK_COLORS.length],
          size: i % 2 ? 6 : 8,
          x: burst.interpolate({
            inputRange: [0, 1],
            outputRange: [BIG_D / 2 - 6, BIG_D / 2 + reach],
          }),
          opacity: burst.interpolate({
            inputRange: [0, 0.06, 0.55, 1],
            outputRange: [0, 1, 1, 0],
          }),
          scale: burst.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0.4, 1, 0.5] }),
        };
      }),
    };
  });

  const bg = BG[scheme];
  const wordTint = scheme === 'dark' ? '#FFFFFF' : brand.violet;
  const ringColor = scheme === 'dark' ? brand.violetBright : brand.violet;

  const face = (rotateY: Animated.AnimatedInterpolation<string>) => (
    <Animated.View
      style={[
        styles.face,
        { transform: [{ perspective: 900 }, { rotateY }] },
      ]}
    >
      {/* fadeDuration: Android fades images in over 300ms by default,
          which showed a bare disc before the P arrived. */}
      <Animated.Image source={P_IMAGE} fadeDuration={0} style={styles.p} />
    </Animated.View>
  );

  return (
    <Animated.View
      style={[styles.fill, { backgroundColor: bg, opacity: view.opacity }]}
      accessibilityRole="image"
      accessibilityLabel="Payhankey"
    >
      {/* Zero-size anchor at the screen centre: everything is placed from it,
          the way the native splash centres its image. */}
      <Animated.View style={[styles.anchor, { transform: [{ scale: view.exitScale }] }]}>
        {view.rings.map((ring, i) => (
          <Animated.View
            key={`ring-${i}`}
            style={[
              styles.ring,
              { borderColor: ringColor, opacity: ring.opacity, transform: [{ scale: ring.scale }] },
            ]}
          />
        ))}

        {view.sparks.map((spark, i) => (
          <Animated.View
            key={`spark-${i}`}
            style={[styles.sparkArm, { transform: [{ rotate: spark.rotate }] }]}
          >
            <Animated.View
              style={{
                width: spark.size,
                height: spark.size,
                borderRadius: spark.size / 2,
                backgroundColor: spark.color,
                marginTop: -spark.size / 2,
                opacity: spark.opacity,
                transform: [{ translateX: spark.x }, { scale: spark.scale }],
              }}
            />
          </Animated.View>
        ))}

        <View style={styles.wordClip}>
          <Animated.Image
            source={WORD_IMAGE}
            fadeDuration={0}
            style={[styles.word, { tintColor: wordTint, transform: [{ translateX: view.wordX }] }]}
          />
        </View>

        {/* Order matters: place it (shift + hop) in screen points, THEN scale,
            so the toss height doesn't shrink with the coin. */}
        <Animated.View
          style={[
            styles.coin,
            {
              transform: [
                { translateX: view.coinX },
                { translateY: view.coinY },
                { scale: view.coinScale },
                { scaleX: view.squashX },
                { scaleY: view.squashY },
              ],
            },
          ]}
        >
          {/* Two faces, each hidden while turned away, so the P reads the right
              way round through every turn instead of flashing a mirrored "q". */}
          {face(view.spinFront)}
          {face(view.spinBack)}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const P_IMAGE = require('../../../assets/splash/p.png');
const WORD_IMAGE = require('../../../assets/splash/word.png');

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 1000,
  },
  anchor: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 },
  coin: {
    position: 'absolute',
    left: -BIG_D / 2,
    top: -BIG_D / 2,
    width: BIG_D,
    height: BIG_D,
  },
  face: {
    ...StyleSheet.absoluteFill,
    borderRadius: BIG_D / 2,
    backgroundColor: brand.violet,
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
  },
  p: { width: BIG_D, height: BIG_D },
  wordClip: {
    position: 'absolute',
    left: CLIP_LEFT,
    top: -LOCKUP_H / 2,
    width: CLIP_W,
    height: LOCKUP_H,
    overflow: 'hidden',
  },
  word: { position: 'absolute', left: WORD_IN_CLIP, top: 0, width: WORD_W, height: LOCKUP_H },
  ring: {
    position: 'absolute',
    left: -BIG_D / 2,
    top: -BIG_D / 2,
    width: BIG_D,
    height: BIG_D,
    borderRadius: BIG_D / 2,
    borderWidth: 2,
  },
  // A zero-height arm from the centre, turned to the spark's angle; the dot
  // travels out along it.
  sparkArm: { position: 'absolute', left: 0, top: 0, width: 0, height: 0 },
});
