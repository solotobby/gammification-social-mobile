import { Tabs } from 'expo-router';
import React from 'react';

import { TabBar } from '../../src/components/navigation/TabBar';

/**
 * Main app shell after auth: Home (feed), Earn, Rolls, Communities, Messages,
 * plus the compose FAB rendered by the custom TabBar.
 *
 * `me` and `discover` are tab *routes* that aren't in the bar — five slots is
 * the limit before the labels stop fitting, and Messages took Discover's.
 * Both are reached from elsewhere: the Home header's avatar pushes /me, and
 * the Me screen's Explore row pushes /discover. TabBar looks its tabs up by
 * route name, so this list's order doesn't have to match the bar's.
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
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
