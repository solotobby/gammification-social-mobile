import { Ionicons, Entypo } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';

/** Vertical space screens should reserve so content scrolls clear of the bar. */
export const TAB_BAR_CLEARANCE = 104;

/**
 * Minimal shape of the react-navigation tab bar props we consume — typed
 * locally because @react-navigation/bottom-tabs is only a transitive
 * dependency of expo-router.
 */
type TabBarProps = {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  navigation: {
    emit: (event: {
      type: 'tabPress';
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

const TAB_META: Record<string, { label: string; icon: string; iconActive: string }> = {
  home: { label: 'Home', icon: 'home-outline', iconActive: 'home' },
  discover: { label: 'Discover', icon: 'compass-outline', iconActive: 'compass' },
  rolls: { label: 'Rolls', icon: 'film-outline', iconActive: 'film' },
  earn: { label: 'Earn', icon: 'cash-outline', iconActive: 'cash' },
  communities: { label: 'Communities', icon: 'people-outline', iconActive: 'people' },
};

/**
 * What the bar shows, in order. `me` is deliberately absent — the profile is
 * reached by tapping the avatar in the Home header instead.
 */
const TABS = ['home', 'discover', 'rolls', 'earn', 'communities'] as const;

/**
 * Floating pill tab bar plus a compose FAB anchored bottom-right above it.
 * Compose is not a tab — it pushes the /compose modal on the root stack.
 * The FAB shows on Home only: that's where posting belongs, and the other tabs
 * stay clear.
 *
 * The whole bar hides on Rolls so the pager is fully immersive; that screen
 * renders its own back button instead.
 */
export function TabBar({ state, navigation }: TabBarProps) {
  const { colors, brand, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Looked up by name rather than position, so adding or reordering a
  // Tabs.Screen in the layout can't silently point a tab at the wrong route.
  const renderTab = (routeName: string) => {
    const meta = TAB_META[routeName];
    const index = state.routes.findIndex((r) => r.name === routeName);
    if (!meta || index === -1) return null;
    const focused = state.index === index;
    const tint = focused ? colors.brand : colors.textMuted;
    const route = state.routes[index];

    return (
      <Pressable
        key={routeName}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        onPress={() => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }}
        style={styles.tab}
      >
        <Ionicons
          name={(focused ? meta.iconActive : meta.icon) as keyof typeof Ionicons.glyphMap}
          size={23}
          color={tint}
        />
        <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
          {meta.label}
        </Text>
      </Pressable>
    );
  };

  const onHome = state.routes[state.index]?.name === 'home';

  // Rolls is full-bleed video and owns the whole screen — the bar would float
  // over the caption and action rail. Its own header carries a back button,
  // which is the way out of the pager.
  if (state.routes[state.index]?.name === 'rolls') return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: insets.bottom + 10 }]}
    >
      {onHome ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create a post"
          onPress={() => router.push('/compose')}
          style={styles.fab}
        >
          <LinearGradient
            colors={[brand.violetBright, brand.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.fabButton, { shadowColor: brand.violet }]}
          >
            <Entypo name="plus" size={32} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      ) : null}

      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.surfaceAlt,
            borderColor: `${colors.brand}33`,
            shadowColor: colors.shadow,
          },
        ]}
      >
        {TABS.map((name) => renderTab(name))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    paddingHorizontal: 4,
    shadowOpacity: 0.22,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 2,
  },
  // 9pt so the longest label ("Communities") fits one line across five tabs.
  label: { fontFamily: FONT, fontSize: 9, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: "180%",
    marginBottom: 14,
  },
  fabButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
});
