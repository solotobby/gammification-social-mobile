import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorModalHost } from '../src/components/feedback/ErrorModal';
import { ToastHost } from '../src/components/feedback/Toast';
import { useAuthStore } from '../src/stores/authStore';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

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

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ThemedStack />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
