import { focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, Platform } from 'react-native';

/**
 * Connectivity wiring for React Query.
 *
 * React Query's default `networkMode: 'online'` already knows how to pause
 * queries and mutations while the device is offline — but only if
 * `onlineManager` is told about connectivity. Its built-in listener uses the
 * browser's online/offline events, which don't exist on native, so without this
 * the manager reports "online" forever: every request fires into the void and
 * burns the full axios timeout instead of pausing, and nothing refetches when
 * the connection comes back.
 *
 * Call `startNetworkWatch()` once at app start (app/_layout.tsx).
 */

/**
 * Treat the connection as usable unless the OS explicitly says it isn't.
 * `isInternetReachable` is undefined until the first probe resolves, and a
 * false "offline" reading is worse than a slow request — it pauses the whole
 * data layer behind a banner the user can't dismiss.
 */
function isOnline(state: Network.NetworkState): boolean {
  if (state.isConnected === false) return false;
  return state.isInternetReachable !== false;
}

export function startNetworkWatch(): () => void {
  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(isOnline(state));
    });
    // The listener only fires on *changes*, so seed the current value too —
    // otherwise a cold start in airplane mode still reads as online.
    void Network.getNetworkStateAsync()
      .then((state) => setOnline(isOnline(state)))
      .catch(() => setOnline(true));
    return () => subscription.remove();
  });

  // Refetch stale data when the app returns from the background. RN has no
  // window focus events either, so AppState stands in for them.
  const appState = AppState.addEventListener('change', (status) => {
    if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
  });

  return () => appState.remove();
}
