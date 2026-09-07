import { useMemo, useRef } from 'react';
import type { ViewToken } from 'react-native';

import { recordPostView } from '../api/timeline';
import { useViewedStore } from '../stores/viewedStore';

/**
 * How much of a post must be on screen, and for how long, before it counts as
 * read. 60% keeps a post that is merely passing the edge of the screen from
 * counting; a full second of dwell keeps a fast flick through the feed from
 * marking everything it flew past.
 */
const VISIBLE_PERCENT = 60;
const DWELL_MS = 1000;

/**
 * Marks feed posts viewed as they enter the viewport, silently.
 *
 * Returns the two props a `FlatList` needs. Both are built once and held in
 * refs: React Native throws "Changing onViewableItemsChanged on the fly is not
 * supported" if either identity changes between renders, which is exactly what
 * happens if you inline them or wrap them in a `useCallback` with dependencies.
 *
 * The view itself is one request per post per session — `viewedStore` claims
 * the id before firing, and the server dedupes per user on top of that. See
 * `recordPostView` for why the request is a detail fetch rather than a
 * purpose-built endpoint.
 */
export function usePostViewTracker(enabled = true) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: VISIBLE_PERCENT,
    minimumViewTime: DWELL_MS,
    // Without this a post that is already on screen when the list first renders
    // — the top of the feed, every time — never fires a viewability event.
    waitForInteraction: false,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (!enabledRef.current) return;
    const { claim } = useViewedStore.getState();
    for (const token of viewableItems) {
      const id = (token.item as { id?: string } | undefined)?.id;
      // `isViewable` is belt and braces: RN only reports items that met the
      // config, but a false here would mean counting something off screen.
      if (!id || !token.isViewable) continue;
      if (claim(id)) void recordPostView(id);
    }
  }).current;

  return useMemo(
    () => ({ onViewableItemsChanged, viewabilityConfig }),
    [onViewableItemsChanged, viewabilityConfig],
  );
}
