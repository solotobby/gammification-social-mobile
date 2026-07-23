import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/**
 * Whether the device is currently offline.
 *
 * Reads React Query's `onlineManager` rather than subscribing to expo-network
 * separately, so the banner can never disagree with the data layer: the same
 * flag that pauses queries is the one that shows the banner. Requires
 * `startNetworkWatch()` to have run (app/_layout.tsx).
 */
export function useIsOffline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => !onlineManager.isOnline(),
    // Server/web prerender: assume online so nothing flashes a banner.
    () => false,
  );
}
