import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { startNetworkWatch } from '../src/api/network';
import { persistOptions, queryClient } from '../src/api/queryClient';
import { ErrorModalHost } from '../src/components/feedback/ErrorModal';
import { OfflineBanner } from '../src/components/feedback/OfflineBanner';
import { ToastHost } from '../src/components/feedback/Toast';
import { registerMutationDefaults } from '../src/hooks/useTimeline';
import { useAuthStore } from '../src/stores/authStore';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';

// Must be registered before the persisted cache is restored, so any comment
// paused offline in a previous run can be replayed from its key alone.
registerMutationDefaults(queryClient);

function ThemedStack() {
  const { colors, isDark } = useTheme();
  const status = useAuthStore((s) => s.status);

  // Hold the splash until the persisted session loads, so launch lands
  // directly on the right side of the auth guard with no flash.
  if (status === 'hydrating') return null;

  const signedIn = status === 'signedIn';

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
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
      </Stack>
      <OfflineBanner />
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
    </SafeAreaProvider>
  );
}
