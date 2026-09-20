import { Tabs } from 'expo-router';
import React from 'react';

import { AppDrawer } from '../../src/components/navigation/AppDrawer';
import { TabBar } from '../../src/components/navigation/TabBar';

/**
 * Main app shell after auth: Home (feed), Earn, Rolls, Communities, Messages,
 * plus the compose FAB rendered by the custom TabBar.
 *
 * `discover` is a tab *route* that isn't in the bar — five slots is the limit
 * before the labels stop fitting, and Messages took its. It is reached from the
 * side drawer's Explore section and from the Home header's search icon.
 *
 * The old `me` tab is gone: everything that was on it now lives in `AppDrawer`,
 * which is mounted here rather than inside a screen so it can cover the
 * floating tab bar as well as the scene. Home's header opens it.
 */
export default function TabsLayout() {
  return (
    <>
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
      </Tabs>
      <AppDrawer />
    </>
  );
}
