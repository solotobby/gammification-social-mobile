import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { startNetworkWatch } from '../src/api/network';
import { persistOptions, queryClient } from '../src/api/queryClient';
import {
  AppErrorBoundary,
  installGlobalErrorHandler,
  ScreenErrorBoundary,
} from '../src/components/feedback/AppErrorBoundary';
import { ErrorModalHost } from '../src/components/feedback/ErrorModal';
import { OfflineBanner } from '../src/components/feedback/OfflineBanner';
import { ToastHost } from '../src/components/feedback/Toast';
import { GiftSplashHost } from '../src/components/gifts/GiftSplash';
import { PaymentSheet } from '../src/components/payments/PaymentSheet';
import { registerMessagingMutationDefaults, useMessagingSync } from '../src/hooks/useMessages';
import { registerMutationDefaults } from '../src/hooks/useTimeline';
import { useUpdateCheck } from '../src/hooks/useInAppUpdate';
import { useAuthStore } from '../src/stores/authStore';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';

// Must be registered before the persisted cache is restored, so any comment
// (or conversation pin/mute) paused offline in a previous run can be replayed
// from its key alone.
registerMutationDefaults(queryClient);
registerMessagingMutationDefaults(queryClient);

// Uncaught JS errors outside rendering (tap handlers, timers) show the crash
// screen instead of killing a release build — see AppErrorBoundary.
installGlobalErrorHandler();

// Without this the native splash hides the moment the root view mounts, which
// is before the session has been read back — see ThemedStack below.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 350, fade: true });

/**
 * Messaging upkeep that must outlive any one screen: the outbox keeps sending
 * after you leave a thread, and the tab badge keeps polling. Rendered only
 * while signed in.
 */
function MessagingSync() {
  useMessagingSync();
  return null;
}

function ThemedStack() {
  const { colors, isDark } = useTheme();
  const status = useAuthStore((s) => s.status);
  const { checkForUpdate } = useUpdateCheck();

  // Hold the splash until the persisted session loads, so launch lands
  // directly on the right side of the auth guard with no flash.
  useEffect(() => {
    if (status !== 'hydrating') void SplashScreen.hideAsync();
  }, [status]);

  // Ask Play for a newer build once the first route is up — the same beat
  // Freebyz checks on, right after its splash animation finishes. Delayed a
  // little so the launch route settles before /app-update can push over it.
  useEffect(() => {
    if (status === 'hydrating') return;
    const timer = setTimeout(() => void checkForUpdate(), 600);
    return () => clearTimeout(timer);
  }, [status, checkForUpdate]);

  if (status === 'hydrating') return null;

  const signedIn = status === 'signedIn';

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        // Every screen gets its own error boundary, so a crash replaces that
        // screen and leaves navigation alive — see ScreenErrorBoundary.
        screenLayout={({ children }) => <ScreenErrorBoundary>{children}</ScreenErrorBoundary>}
        screenOptions={{
          headerShown: false,
          // Match the app background so there's no white flash between routes.
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        {/* (tabs) is declared first so a signed-in launch lands on the shell. */}
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="compose" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="story/create" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="community/create" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          {/* A thread covers the tab bar like every other pushed screen; the
              people picker is a modal, the same shape as /compose. */}
          <Stack.Screen name="messages/[id]" />
          <Stack.Screen name="messages/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen
            name="story/[member]"
            options={{ animation: 'fade', contentStyle: { backgroundColor: '#000000' } }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="index" />
          <Stack.Screen name="sign-up" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="verify-code" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="reset-success" />
        </Stack.Protected>
        {/* Reachable in both states: verification navigates here in the same
            beat that it activates the session, which flips the guards. */}
        <Stack.Screen name="get-started" />
        {/* Play in-app update prompt — reachable signed in or out. */}
        <Stack.Screen name="app-update" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
      {signedIn ? <MessagingSync /> : null}
      <OfflineBanner />
      {/* Checkout runs above every screen: a payment must not be cancelled by
          navigating, and only one can ever be in flight. */}
      <PaymentSheet />
      {/* After a gift is sent — above every screen, since the gift sheet is a
          Modal that closes as the celebration starts. */}
      <GiftSplashHost />
      <ToastHost />
      <ErrorModalHost />
    </>
  );
}

export default function RootLayout() {
  // Load any persisted session before screens start gating on auth state.
  useEffect(() => {
    void useAuthStore.getState().hydrate();
  }, []);

  // Tell React Query about connectivity, so it pauses requests while offline
  // and refetches on reconnect instead of timing out against a dead network.
  useEffect(() => startNetworkWatch(), []);


  return (
    <SafeAreaProvider>
      {/* Outermost app-level wrapper: a render error anywhere below shows the
          "Something went wrong · Reload app" screen instead of a white one. */}
      <AppErrorBoundary global>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
          // Send anything that was paused offline as soon as the cache is back.
          onSuccess={() => void queryClient.resumePausedMutations()}
        >
          <ThemeProvider>
            <ThemedStack />
          </ThemeProvider>
        </PersistQueryClientProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
