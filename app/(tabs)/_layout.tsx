import { Tabs } from 'expo-router';
import React from 'react';

import { TabBar } from '../../src/components/navigation/TabBar';

/**
 * Main app shell after auth: Home (feed), Discover, Rolls, Earn, Communities,
 * plus the compose FAB rendered by the custom TabBar.
 *
 * `me` is still a tab *route* — it just isn't in the bar. The Home header's
 * avatar pushes /me, which is the only way in now that Communities has taken
 * its slot. TabBar looks its tabs up by route name, so this list's order
 * doesn't have to match the bar's.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Screens paint their own ScreenBackground; keep the scene transparent.
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="rolls" />
      <Tabs.Screen name="earn" />
      <Tabs.Screen name="communities" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
