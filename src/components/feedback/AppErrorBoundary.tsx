import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { Component, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '../../stores/authStore';
import { brand } from '../../theme/colors';
import { FONT } from '../../theme/fonts';

/**
 * The last line of defence against a JavaScript error taking the app down.
 *
 * **Two layers.** `ScreenErrorBoundary` wraps every screen (via the navigators'
 * `screenLayout`), so a screen that throws is replaced by this screen *inside*
 * the navigator — the stack and tab bar stay mounted, and Reload can navigate
 * home. That matters: navigation state lives above the root layout (expo-router
 * owns the container), so a boundary *around* the navigator can only remount
 * it onto the very route that crashed, which throws again — verified, and a
 * `resetRoot()` from outside doesn't stick because expo-router rebuilds state
 * from its own URL. The root `AppErrorBoundary global` stays as the backstop
 * for errors outside any screen (providers, layouts) and for the global
 * handler below.
 *
 * Two kinds of error reach it:
 *
 * - **Render errors** — a component throws while rendering. React unmounts the
 *   tree above the nearest boundary; with none, that's a white screen in a
 *   release build. This class is that boundary, around everything.
 * - **Errors outside rendering** — a throw inside a tap handler, a timer or a
 *   promise callback. React boundaries never see those; RN hands them to its
 *   global handler, which for a fatal error **crashes a release build to the
 *   home screen**. `installGlobalErrorHandler` puts this screen in front of
 *   them instead.
 *
 * Either way the user gets one calm screen with a **Reload app** button. The
 * reload remounts the whole tree under a new key — navigation, screen state,
 * every hook starts again exactly as on launch — while the persisted query
 * cache and the signed-in session survive, so it comes back fast and still
 * signed in. It's a JS-level reload on purpose: a real bundle reload needs
 * `expo-updates` (`Updates.reloadAsync`), a native module this app doesn't
 * ship, and this works in the build that's already installed.
 *
 * The fallback itself deliberately depends on nothing app-level — no
 * ThemeProvider, no stores, no navigation — because any of those could be
 * what threw.
 */
type State = { error: Error | null; generation: number };

/** The mounted boundary, so the global handler can route errors to it. */
let activeBoundary: AppErrorBoundary | null = null;

type Props = {
  children: ReactNode;
  /** Runs just before the remount — a screen boundary navigates home here. */
  onReload?: () => void;
  /**
   * Wait this long before remounting. A screen boundary navigates away first;
   * remounting at once would render the screen that threw one more time while
   * the transition runs. If the route didn't change (Home itself crashed), the
   * remount still happens, just after the wait.
   */
  remountDelayMs?: number;
  /**
   * The app-wide boundary: the one `installGlobalErrorHandler` routes
   * non-render errors to. Exactly one, at the root.
   */
  global?: boolean;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, generation: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidMount() {
    if (this.props.global) activeBoundary = this;
  }

  componentWillUnmount() {
    if (activeBoundary === this) activeBoundary = null;
    if (this.remountTimer) clearTimeout(this.remountTimer);
  }

  private remountTimer: ReturnType<typeof setTimeout> | null = null;

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Still logged, so it shows in logcat / the Xcode console and in Metro.
    // A warning, not console.error: in development that would open a second
    // full-screen overlay on top of the one React already shows.
    console.warn('[AppErrorBoundary] render error', error, info.componentStack);
  }

  /** Called by the global handler for errors React never sees. */
  show(error: Error) {
    this.setState({ error });
  }

  reload = () => {
    try {
      this.props.onReload?.();
    } catch (error) {
      // A reload must always be possible; a failed reset only means the next
      // render starts from wherever navigation already was.
      console.error('[AppErrorBoundary] reset before reload failed', error);
    }
    const remount = () =>
      this.setState((state) => ({ error: null, generation: state.generation + 1 }));
    if (this.props.remountDelayMs) {
      this.remountTimer = setTimeout(remount, this.props.remountDelayMs);
    } else {
      remount();
    }
  };

  render() {
    if (this.state.error) {
      return <CrashScreen error={this.state.error} onReload={this.reload} />;
    }
    // A new key throws the old tree away entirely — nothing half-broken is
    // carried into the reloaded app.
    return <React.Fragment key={this.state.generation}>{this.props.children}</React.Fragment>;
  }
}

/**
 * Route uncaught JS errors to the crash screen instead of RN's default fatal
 * handler, which would kill a release build. Non-fatal errors (a rejected
 * promise RN reports as a warning, a `console.error` redbox in dev) keep the
 * default behaviour. Call once, at module scope in the root layout.
 */
export function installGlobalErrorHandler() {
  const ErrorUtils = (
    globalThis as unknown as {
      ErrorUtils?: {
        getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
        setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
      };
    }
  ).ErrorUtils;
  if (!ErrorUtils) return;

  const previous = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    // In development the redbox is the better tool — keep it.
    if (__DEV__ || !isFatal || !activeBoundary) {
      previous(error, isFatal);
      return;
    }
    console.error('[AppErrorBoundary] uncaught error', error);
    activeBoundary.show(error instanceof Error ? error : new Error(String(error)));
  });
}

/**
 * Per-screen boundary, installed through each navigator's `screenLayout`.
 * Reload goes back to the start — Home when signed in, the welcome screen when
 * not — and then remounts, so the screen that threw is left behind rather than
 * rendered again.
 */
export function ScreenErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <AppErrorBoundary
      onReload={() => {
        router.replace(useAuthStore.getState().token ? '/home' : '/');
      }}
      remountDelayMs={500}
    >
      {children}
    </AppErrorBoundary>
  );
}

function CrashScreen({ error, onReload }: { error: Error; onReload: () => void }) {
  const dark = useColorScheme() === 'dark';
  const text = dark ? '#FFFFFF' : '#14102B';
  const muted = dark ? 'rgba(255,255,255,0.65)' : '#6B6784';

  // If this happened during launch, the native splash would still be covering
  // it. Hiding an already-hidden splash is a harmless no-op.
  React.useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: dark ? '#0C0820' : '#F6F4FF' }]}>
      <View style={styles.body}>
        <View style={[styles.badge, { backgroundColor: `${brand.violet}22` }]}>
          <Text style={styles.badgeGlyph}>🛠️</Text>
        </View>
        <Text style={[styles.title, { color: text }]}>Something went wrong</Text>
        <Text style={[styles.copy, { color: muted }]}>
          Payhankey hit an unexpected problem. Reloading usually fixes it — you'll
          stay signed in, and nothing you've posted is lost.
        </Text>

        <Pressable
          onPress={onReload}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.buttonText}>Reload app</Text>
        </Pressable>

        {/* The message is only useful to us; in a release build it's noise. */}
        {__DEV__ ? (
          <ScrollView style={styles.devBox} contentContainerStyle={{ padding: 12 }}>
            <Text style={[styles.devText, { color: muted }]}>
              {error.name}: {error.message}
              {'\n\n'}
              {error.stack}
            </Text>
          </ScrollView>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  badgeGlyph: { fontSize: 34 },
  title: { fontFamily: FONT, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  copy: {
    fontFamily: FONT,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 300,
  },
  button: {
    marginTop: 14,
    height: 52,
    paddingHorizontal: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.violet,
  },
  buttonText: { fontFamily: FONT, fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  devBox: { marginTop: 18, maxHeight: 220, alignSelf: 'stretch', borderRadius: 12 },
  devText: { fontFamily: FONT, fontSize: 11 },
});
