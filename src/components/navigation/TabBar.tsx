import { Ionicons, Entypo } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/ThemeProvider';

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
  explore: { label: 'Explore', icon: 'compass-outline', iconActive: 'compass' },
  reels: { label: 'Reels', icon: 'film-outline', iconActive: 'film' },
  earnings: { label: 'Earnings', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  profile: { label: 'Profile', icon: 'person-outline', iconActive: 'person' },
};

/**
 * Floating pill tab bar plus a compose FAB anchored bottom-right above it.
 * Compose is not a tab — it pushes the /compose modal on the root stack.
 * The FAB hides on Reels, where the full-bleed player owns the screen.
 */
export function TabBar({ state, navigation }: TabBarProps) {
  const { colors, brand, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const renderTab = (routeName: string, index: number) => {
    const meta = TAB_META[routeName];
    if (!meta) return null;
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
        <Text style={[styles.label, { color: tint }]}>{meta.label}</Text>
      </Pressable>
    );
  };

  const onHome = state.routes[state.index]?.name === 'home';

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
            backgroundColor: isDark ? colors.surface : '#FFFFFF',
            borderColor: colors.border,
            shadowColor: colors.shadow,
          },
        ]}
      >
        {renderTab('home', 0)}
        {renderTab('explore', 1)}
        {renderTab('reels', 2)}
        {renderTab('earnings', 3)}
        {renderTab('profile', 4)}
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
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: { fontSize: 11, fontWeight: '700' },
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
