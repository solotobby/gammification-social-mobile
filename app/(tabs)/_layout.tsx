import { Tabs } from 'expo-router';
import React from 'react';

import { TabBar } from '../../src/components/navigation/TabBar';

/**
 * Main app shell after auth: Home (feed), Explore, Reels, Earnings, Profile,
 * plus the compose FAB rendered by the custom TabBar. Order here must match
 * the render order in TabBar.
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
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="reels" />
      <Tabs.Screen name="earnings" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
