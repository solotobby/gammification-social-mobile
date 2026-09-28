import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGiftSplashStore, type SplashGift } from '../../stores/giftSplashStore';
import { FONT } from '../../theme/fonts';
import {
  durationFor,
  effectFor,
  type GiftEffect,
  type HeroEntrance,
} from './giftEffects';

/**
 * The celebration after a gift is sent — full screen, above everything, and
 * choreographed per gift (see `giftEffects.ts`).
 *
 * Built on the core `Animated` API with the native driver, like the rest of
 * the app's motion: no reanimated, no Lottie, no new native module, so it ships
 * over Metro. Everything animated is a transform or an opacity, which is what
 * keeps ~50 emoji particles smooth on the UI thread.
 *
 * One `stage` value runs 0 → 1 over the whole show and drives the gift, the
 * glow and the rays through interpolation tables; particles, rings, the flash
 * and the shake each get their own value so they can start on the gift's
 * *impact* beat rather than at zero. Tap anywhere to skip.
 *
 * Reduce Motion is honoured: the choreography is dropped and only the caption
 * card shows, briefly.
 */
export function GiftSplashHost() {
  const current = useGiftSplashStore((s) => s.current);
  const clear = useGiftSplashStore((s) => s.clear);
  if (!current) return null;
  return (
    <GiftSplash
      key={current.key}
      gift={current}
      recipientName={current.recipientName}
      onDone={clear}
    />
  );
}

const NATIVE = Platform.OS !== 'web';

type Track = { input: number[]; output: number[] | string[] };

type Particle = {
  key: string;
  emoji: string;
  size: number;
  delay: number;
  duration: number;
  x: Track;
  y: Track;
  rotate: Track;
  scale: Track;
  opacity: Track;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const sign = () => (Math.random() < 0.5 ? -1 : 1);
const constant = (value: number | string): Track => ({
  input: [0, 1],
  output: [value, value] as number[] | string[],
});

/** Interpolate `value` along `track`, clamped at both ends. */
function along(value: Animated.Value, track: Track) {
  return value.interpolate({
    inputRange: track.input,
    outputRange: track.output as never,
    extrapolate: 'clamp',
  });
}

/** Piecewise-linear read of a track at `t` — used to emit particles on the gift's path. */
function sample(track: Track, t: number): number {
  const { input } = track;
  const output = track.output as number[];
  if (t <= input[0]) return output[0];
  for (let i = 1; i < input.length; i++) {
    if (t <= input[i]) {
      const span = input[i] - input[i - 1] || 1;
      return output[i - 1] + ((t - input[i - 1]) / span) * (output[i] - output[i - 1]);
    }
  }
  return output[output.length - 1];
}

// ---------------------------------------------------------------------------
// The gift itself
// ---------------------------------------------------------------------------

type HeroTracks = {
  x: Track;
  y: Track;
  scale: Track;
  rotate: Track;
  opacity: Track;
  /** Stage fraction at which the gift "lands" — rings, flash and bursts key off it. */
  impact: number;
};

function heroTracks(entrance: HeroEntrance, width: number, height: number): HeroTracks {
  // Every entrance exits the same way: a swell and a fade as the show ends.
  switch (entrance) {
    case 'drop':
      return {
        x: constant(0),
        y: {
          input: [0, 0.18, 0.24, 0.3, 0.45, 0.62, 0.8, 1],
          output: [-height * 0.6, 0, -30, 0, -10, 0, -10, -40],
        },
        scale: { input: [0, 0.18, 0.21, 0.27, 0.86, 1], output: [0.85, 1, 1.12, 1, 1, 1.3] },
        rotate: { input: [0, 0.18, 0.26, 1], output: ['-25deg', '6deg', '0deg', '0deg'] },
        opacity: { input: [0, 0.04, 0.86, 1], output: [0, 1, 1, 0] },
        impact: 0.18,
      };
    case 'slam':
      return {
        x: constant(0),
        y: { input: [0, 0.3, 0.5, 0.7, 0.86, 1], output: [0, 0, -10, 0, -10, -40] },
        scale: { input: [0, 0.09, 0.14, 0.2, 0.86, 1], output: [3.4, 0.86, 1.08, 1, 1, 1.3] },
        rotate: constant('0deg'),
        opacity: { input: [0, 0.06, 0.86, 1], output: [0, 1, 1, 0] },
        impact: 0.09,
      };
    case 'launch':
      return {
        x: {
          // Hovering on the pad, rattling before it goes.
          input: [0, 0.3, 0.36, 0.4, 0.44, 0.48, 0.52, 0.56, 0.58, 1],
          output: [0, 0, -4, 4, -4, 4, -3, 3, 0, 0],
        },
        y: {
          input: [0, 0.3, 0.34, 0.58, 0.82, 1],
          output: [height * 0.6, 0, 8, 0, -height * 0.95, -height * 0.95],
        },
        scale: { input: [0, 0.3, 0.58, 0.82, 1], output: [0.8, 1, 1, 0.7, 0.7] },
        // 🚀 is drawn pointing up-right; this stands it upright.
        rotate: constant('-45deg'),
        opacity: { input: [0, 0.05, 0.8, 0.84, 1], output: [0, 1, 1, 0, 0] },
        impact: 0.3,
      };
    case 'sail':
      return {
        // 🛥️ is drawn facing left, so it sails right → left, bow first.
        x: { input: [0, 0.32, 0.62, 0.88, 1], output: [width * 0.8, 0, 0, -width * 0.9, -width * 0.9] },
        y: {
          input: [0, 0.2, 0.32, 0.4, 0.48, 0.56, 0.62, 0.75, 0.88, 1],
          output: [0, -8, 0, -7, 0, -7, 0, -7, 0, 0],
        },
        scale: constant(1),
        rotate: {
          input: [0, 0.32, 0.4, 0.48, 0.56, 0.62, 0.88, 1],
          output: ['-6deg', '4deg', '-3deg', '3deg', '-3deg', '0deg', '-6deg', '-6deg'],
        },
        opacity: { input: [0, 0.04, 0.86, 0.9, 1], output: [0, 1, 1, 0, 0] },
        impact: 0.32,
      };
    case 'pop':
    default:
      return {
        x: constant(0),
        y: { input: [0, 0.28, 0.45, 0.62, 0.8, 1], output: [0, 0, -12, 0, -12, -40] },
        scale: {
          input: [0, 0.1, 0.16, 0.22, 0.28, 0.86, 1],
          output: [0, 1.3, 0.9, 1.06, 1, 1, 1.3],
        },
        rotate: {
          input: [0, 0.1, 0.18, 0.26, 1],
          output: ['-18deg', '10deg', '-5deg', '0deg', '0deg'],
        },
        opacity: { input: [0, 0.05, 0.86, 1], output: [0, 1, 1, 0] },
        impact: 0.1,
      };
  }
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------

function buildParticles(
  effect: GiftEffect,
  hero: HeroTracks,
  width: number,
  height: number,
  total: number,
): Particle[] {
  const impactMs = hero.impact * total;
  const out: Particle[] = [];
  const add = (p: Omit<Particle, 'key' | 'emoji'> & { emoji?: string }) =>
    out.push({ key: `p${out.length}`, emoji: p.emoji ?? pick(effect.particles), ...p });

  const burst = (
    cx: number,
    cy: number,
    n: number,
    minDist: number,
    maxDist: number,
    startMs: number,
  ) => {
    for (let i = 0; i < n; i++) {
      // Evenly spread with jitter reads as an explosion; pure random clumps.
      const angle = (i / n) * Math.PI * 2 + rand(-0.25, 0.25);
      const dist = rand(minDist, maxDist);
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      add({
        size: rand(20, 36),
        delay: startMs + rand(0, 140),
        duration: rand(1100, 1700),
        x: { input: [0, 0.5, 1], output: [cx, cx + dx * 0.85, cx + dx] },
        y: { input: [0, 0.5, 1], output: [cy, cy + dy * 0.85, cy + dy + rand(40, 110)] },
        rotate: { input: [0, 1], output: ['0deg', `${rand(-220, 220)}deg`] },
        scale: { input: [0, 0.15, 1], output: [0.2, 1.25, 0.8] },
        opacity: { input: [0, 0.05, 0.7, 1], output: [0, 1, 1, 0] },
      });
    }
  };

  switch (effect.motion) {
    case 'fall':
    case 'rain': {
      const rain = effect.motion === 'rain';
      for (let i = 0; i < effect.count; i++) {
        const x0 = rand(-width / 2 + 12, width / 2 - 12);
        const sway = rain ? rand(4, 10) * sign() : rand(22, 55) * sign();
        add({
          size: rain ? rand(24, 38) : rand(22, 34),
          delay: rand(0, total * (rain ? 0.45 : 0.35)),
          duration: rain ? rand(1100, 1700) : rand(2000, 3000),
          x: { input: [0, 0.25, 0.5, 0.75, 1], output: [x0, x0 + sway, x0, x0 - sway, x0] },
          y: { input: [0, 1], output: [-height / 2 - 60, height / 2 + 60] },
          rotate: {
            input: [0, 1],
            output: ['0deg', `${rain ? rand(-120, 120) : rand(-380, 380)}deg`],
          },
          scale: constant(1),
          opacity: { input: [0, 0.08, 0.85, 1], output: [0, 1, 1, 0] },
        });
      }
      break;
    }
    case 'rise': {
      for (let i = 0; i < effect.count; i++) {
        const x0 = rand(-width * 0.42, width * 0.42);
        const sway = rand(14, 32) * sign();
        add({
          size: rand(24, 40),
          delay: rand(0, total * 0.4),
          duration: rand(1800, 2600),
          x: { input: [0, 0.33, 0.66, 1], output: [x0, x0 + sway, x0 - sway, x0] },
          y: { input: [0, 1], output: [height / 2 + 40, -rand(height * 0.1, height * 0.48)] },
          rotate: { input: [0, 1], output: [`${rand(-15, 15)}deg`, `${rand(-25, 25)}deg`] },
          scale: { input: [0, 0.2, 1], output: [0.5, 1, 1.15] },
          opacity: { input: [0, 0.1, 0.72, 1], output: [0, 1, 1, 0] },
        });
      }
      break;
    }
    case 'burst': {
      // Two waves: the big one on impact, a smaller echo just after.
      const first = Math.ceil(effect.count * 0.62);
      const reach = Math.max(width, height) * 0.42;
      burst(0, 0, first, 110, reach, impactMs);
      burst(0, 0, effect.count - first, 70, reach * 0.7, impactMs + total * 0.2);
      break;
    }
    case 'fireworks': {
      const shells = 4;
      const each = Math.floor(effect.count / shells);
      for (let s = 0; s < shells; s++) {
        burst(
          rand(-width * 0.3, width * 0.3),
          rand(-height * 0.32, height * 0.05),
          each,
          60,
          130,
          impactMs + s * total * 0.15,
        );
      }
      break;
    }
    case 'swirl': {
      for (let i = 0; i < effect.count; i++) {
        const a0 = rand(0, Math.PI * 2);
        const dir = sign();
        const reach = rand(width * 0.25, width * 0.58);
        const steps = 8;
        const input: number[] = [];
        const xs: number[] = [];
        const ys: number[] = [];
        for (let k = 0; k <= steps; k++) {
          const f = k / steps;
          const angle = a0 + dir * k * 0.6;
          const r = 16 + reach * f;
          input.push(f);
          xs.push(Math.cos(angle) * r);
          ys.push(Math.sin(angle) * r);
        }
        add({
          size: rand(16, 32),
          delay: rand(0, total * 0.45),
          duration: rand(1800, 2600),
          x: { input, output: xs },
          y: { input, output: ys },
          rotate: { input: [0, 1], output: ['0deg', `${dir * rand(180, 420)}deg`] },
          scale: { input: [0, 0.3, 1], output: [0.3, 1.1, 0.6] },
          opacity: { input: [0, 0.1, 0.75, 1], output: [0, 1, 1, 0] },
        });
      }
      break;
    }
    case 'trail': {
      // Exhaust left behind wherever the rocket is at the moment it's emitted,
      // so the trail genuinely follows the launch rather than floating nearby.
      for (let i = 0; i < effect.count; i++) {
        const t = rand(0.02, 0.84);
        const at = sample(hero.y, t) + 64;
        const drift = rand(10, 60) * sign();
        add({
          size: rand(20, 36),
          delay: t * total,
          duration: rand(700, 1050),
          x: { input: [0, 1], output: [rand(-10, 10), drift] },
          y: { input: [0, 1], output: [at, at + rand(40, 130)] },
          rotate: { input: [0, 1], output: ['0deg', `${rand(-90, 90)}deg`] },
          scale: { input: [0, 1], output: [0.4, 1.6] },
          opacity: { input: [0, 0.08, 1], output: [0, 1, 0] },
        });
      }
      break;
    }
    case 'wave': {
      for (let i = 0; i < effect.count; i++) {
        const t = rand(0.02, 0.88);
        // Spray is thrown off the stern, which is on the right as it sails left.
        const x0 = sample(hero.x, t) + 50;
        const lift = rand(30, 90);
        add({
          size: rand(18, 30),
          delay: t * total,
          duration: rand(800, 1150),
          x: { input: [0, 1], output: [x0, x0 + rand(20, 70)] },
          y: { input: [0, 0.4, 1], output: [52, 52 - lift, 90] },
          rotate: { input: [0, 1], output: ['0deg', `${rand(-40, 40)}deg`] },
          scale: { input: [0, 0.3, 1], output: [0.4, 1, 0.8] },
          opacity: { input: [0, 0.1, 0.8, 1], output: [0, 1, 1, 0] },
        });
      }
      break;
    }
  }

  // Twinkles over everything — the glitter that makes it read as a moment
  // rather than an animation.
  for (let i = 0; i < 12; i++) {
    const x = rand(-width * 0.42, width * 0.42);
    const y = rand(-height * 0.32, height * 0.28);
    add({
      emoji: '✨',
      size: rand(12, 20),
      delay: rand(total * 0.08, total * 0.8),
      duration: 700,
      x: constant(x),
      y: constant(y),
      rotate: { input: [0, 1], output: ['0deg', '90deg'] },
      scale: { input: [0, 0.5, 1], output: [0, 1.2, 0] },
      opacity: { input: [0, 0.5, 1], output: [0, 1, 0] },
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// The overlay
// ---------------------------------------------------------------------------

function GiftSplash({
  gift,
  recipientName,
  onDone,
}: {
  gift: SplashGift;
  recipientName: string;
  onDone: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const effect = effectFor(gift.id, gift.tier);
  const total = durationFor(gift.tier);
  // Built once per show: random layouts must not reshuffle on a re-render.
  const [hero] = useState(() => heroTracks(effect.entrance, width, height));
  const [particles] = useState(() => buildParticles(effect, hero, width, height, total));

  const stage = useRef(new Animated.Value(0)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const master = useRef(new Animated.Value(1)).current;
  const caption = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const rings = useRef(
    Array.from({ length: effect.rings ?? 0 }, () => new Animated.Value(0)),
  ).current;
  const particleValues = useRef(particles.map(() => new Animated.Value(0))).current;

  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const finished = useRef(false);

  const finish = (fast = false) => {
    if (finished.current) return;
    finished.current = true;
    Animated.timing(master, {
      toValue: 0,
      duration: fast ? 180 : 360,
      useNativeDriver: NATIVE,
    }).start(() => onDone());
  };

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => alive && setReduceMotion(reduced))
      .catch(() => alive && setReduceMotion(false));
    AccessibilityInfo.announceForAccessibility?.(
      `${gift.name} sent to ${recipientName}`,
    );
    return () => {
      alive = false;
    };
  }, [gift.name, recipientName]);

  useEffect(() => {
    if (reduceMotion === null) return;
    const impactMs = hero.impact * total;
    const timers: ReturnType<typeof setTimeout>[] = [];

    Animated.timing(backdrop, {
      toValue: 1,
      duration: 240,
      useNativeDriver: NATIVE,
    }).start();

    if (reduceMotion) {
      Animated.timing(caption, { toValue: 1, duration: 200, useNativeDriver: NATIVE }).start();
      timers.push(setTimeout(() => finish(), 1800));
      return () => timers.forEach(clearTimeout);
    }

    Animated.timing(stage, {
      toValue: 1,
      duration: total,
      easing: Easing.linear,
      useNativeDriver: NATIVE,
    }).start();

    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: NATIVE,
      }),
    );
    if (effect.rays) loop.start();

    Animated.parallel(
      particles.map((particle, i) =>
        Animated.timing(particleValues[i], {
          toValue: 1,
          delay: particle.delay,
          duration: particle.duration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: NATIVE,
        }),
      ),
    ).start();

    timers.push(
      setTimeout(() => {
        Animated.stagger(
          170,
          rings.map((ring) =>
            Animated.timing(ring, {
              toValue: 1,
              duration: 950,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: NATIVE,
            }),
          ),
        ).start();

        if (effect.flash) {
          Animated.sequence([
            Animated.timing(flash, { toValue: 1, duration: 70, useNativeDriver: NATIVE }),
            Animated.timing(flash, { toValue: 0, duration: 380, useNativeDriver: NATIVE }),
          ]).start();
        }
        if (effect.shake) {
          Animated.sequence(
            [14, -12, 9, -7, 4, -2, 0].map((toValue) =>
              Animated.timing(shake, { toValue, duration: 45, useNativeDriver: NATIVE }),
            ),
          ).start();
        }
      }, impactMs),
    );

    timers.push(
      setTimeout(() => {
        Animated.spring(caption, {
          toValue: 1,
          friction: 7,
          tension: 70,
          useNativeDriver: NATIVE,
        }).start();
      }, impactMs + 140),
    );

    timers.push(setTimeout(() => finish(), total - 360));

    return () => {
      timers.forEach(clearTimeout);
      loop.stop();
    };
    // Runs once per show; every input is fixed at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const [primary, secondary] = effect.colors;
  const heroSize = gift.tier === 'premium' ? 132 : 116;
  const glowSize = Math.max(width, height) * 0.9;

  const glowOpacity = stage.interpolate({
    inputRange: [0, hero.impact, 0.85, 1],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  });
  const glowScale = stage.interpolate({
    inputRange: [0, hero.impact, 1],
    outputRange: [0.3, 1, 1.15],
    extrapolate: 'clamp',
  });
  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const firstName = recipientName.split(' ')[0] || recipientName;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { opacity: master }]}
      accessibilityViewIsModal
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => finish(true)}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        {/* Backdrop: dark, tinted from below in the gift's own colour. */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdrop }]}>
          <View style={[StyleSheet.absoluteFill, styles.dim]} />
          <LinearGradient
            colors={['transparent', `${primary}55`, `${primary}99`]}
            locations={[0.35, 0.8, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          style={[StyleSheet.absoluteFill, { transform: [{ translateX: shake }] }]}
          pointerEvents="none"
        >
          {/* Glow — stacked translucent discs fake a radial gradient without a
              blur module. */}
          <Animated.View
            style={[
              styles.centre,
              { opacity: glowOpacity, transform: [{ scale: glowScale }] },
            ]}
          >
            {[1, 0.66, 0.4, 0.2].map((f, i) => (
              <View
                key={f}
                style={[
                  styles.disc,
                  {
                    width: glowSize * f,
                    height: glowSize * f,
                    borderRadius: (glowSize * f) / 2,
                    backgroundColor: i % 2 ? secondary : primary,
                    opacity: [0.06, 0.1, 0.18, 0.34][i],
                  },
                ]}
              />
            ))}

            {effect.rays ? (
              <Animated.View
                style={[
                  styles.disc,
                  { width: glowSize, height: glowSize, transform: [{ rotate: spinDeg }] },
                ]}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.rayWrap,
                      {
                        height: glowSize,
                        left: glowSize / 2 - 6,
                        transform: [{ rotate: `${i * 15}deg` }],
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={['transparent', `${secondary}AA`, 'transparent']}
                      style={[styles.ray, { width: i % 2 ? 6 : 12 }]}
                    />
                  </View>
                ))}
              </Animated.View>
            ) : null}
          </Animated.View>

          {/* Shockwaves */}
          <View style={styles.centre}>
            {rings.map((ring, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.disc,
                  styles.ring,
                  {
                    borderColor: i % 2 ? secondary : primary,
                    opacity: ring.interpolate({
                      inputRange: [0, 0.1, 1],
                      outputRange: [0, 0.9, 0],
                    }),
                    transform: [
                      { scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.2, 3.4] }) },
                    ],
                  },
                ]}
              />
            ))}
          </View>

          {/* Particles */}
          {reduceMotion
            ? null
            : particles.map((particle, i) => {
                const value = particleValues[i];
                const box = particle.size * 1.5;
                return (
                  <Animated.Text
                    key={particle.key}
                    style={[
                      styles.particle,
                      {
                        fontSize: particle.size,
                        lineHeight: particle.size * 1.25,
                        width: box,
                        left: width / 2 - box / 2,
                        top: height / 2 - (particle.size * 1.25) / 2,
                        opacity: along(value, particle.opacity),
                        transform: [
                          { translateX: along(value, particle.x) },
                          { translateY: along(value, particle.y) },
                          { rotate: along(value, particle.rotate) },
                          { scale: along(value, particle.scale) },
                        ],
                      },
                    ]}
                  >
                    {particle.emoji}
                  </Animated.Text>
                );
              })}

          {/* The gift */}
          {reduceMotion ? null : (
            <Animated.Text
              style={[
                styles.hero,
                {
                  fontSize: heroSize,
                  lineHeight: heroSize * 1.2,
                  width: heroSize * 1.6,
                  left: width / 2 - (heroSize * 1.6) / 2,
                  top: height / 2 - heroSize * 0.6 - height * 0.06,
                  textShadowColor: primary,
                  opacity: along(stage, hero.opacity),
                  transform: [
                    { translateX: along(stage, hero.x) },
                    { translateY: along(stage, hero.y) },
                    { rotate: along(stage, hero.rotate) },
                    { scale: along(stage, hero.scale) },
                  ],
                },
              ]}
            >
              {gift.emoji}
            </Animated.Text>
          )}
        </Animated.View>

        {/* Flash */}
        {effect.flash ? (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash }]}
          />
        ) : null}

        {/* Caption card */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.captionWrap,
            {
              bottom: insets.bottom + 56,
              opacity: caption,
              transform: [
                { translateY: caption.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
                { scale: caption.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[`${primary}`, `${secondary}`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.captionBorder}
          >
            <View style={styles.caption}>
              <View style={[styles.tagline, { backgroundColor: `${primary}33` }]}>
                <Text style={[styles.taglineText, { color: secondary }]}>
                  {effect.tagline.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.captionTitle} numberOfLines={1}>
                {gift.emoji} {gift.name}
              </Text>
              <Text style={styles.captionSub} numberOfLines={1}>
                sent to <Text style={styles.captionName}>{firstName}</Text>
                {'  ·  '}
                <Text style={styles.captionPrice}>{gift.price.toLocaleString()} PK</Text>
              </Text>
            </View>
          </LinearGradient>
          <Text style={styles.skip}>Tap anywhere to close</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 1000, elevation: 1000 },
  dim: { backgroundColor: 'rgba(8, 4, 24, 0.86)' },
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: { position: 'absolute' },
  rayWrap: { position: 'absolute', top: 0, width: 12, alignItems: 'center' },
  ray: { flex: 1, borderRadius: 6 },
  ring: { width: 120, height: 120, borderRadius: 60, borderWidth: 3 },
  particle: { position: 'absolute', textAlign: 'center' },
  hero: {
    position: 'absolute',
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 28,
  },
  flash: { backgroundColor: '#FFFFFF' },
  captionWrap: { position: 'absolute', left: 24, right: 24, alignItems: 'center', gap: 12 },
  captionBorder: { borderRadius: 22, padding: 1.5, alignSelf: 'stretch' },
  caption: {
    borderRadius: 21,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(14, 8, 34, 0.92)',
  },
  tagline: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  taglineText: { fontFamily: FONT, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  captionTitle: { fontFamily: FONT, fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  captionSub: { fontFamily: FONT, fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },
  captionName: { fontWeight: '800', color: '#FFFFFF' },
  captionPrice: { fontWeight: '800', color: '#FFD66B' },
  skip: { fontFamily: FONT, fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
});
