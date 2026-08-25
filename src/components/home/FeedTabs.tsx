import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

/** Which slice of the timeline Home is showing. */
export type FeedTab = 'for-you' | 'following';

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'for-you', label: 'For You' },
  { key: 'following', label: 'Following' },
];

/**
 * Feed filter above the Home timeline. Communities is deliberately absent until
 * communities exist — a third tab that always says "coming soon" reads as
 * abandoned, not ambitious.
 */
export function FeedTabs({
  value,
  onChange,
}: {
  value: FeedTab;
  onChange: (tab: FeedTab) => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      {TABS.map((tab) => {
        const active = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            style={styles.tab}
          >
            <Text
              style={[
                styles.label,
                { color: active ? colors.text : colors.textMuted },
              ]}
            >
              {tab.label}
            </Text>
            <View
              style={[
                styles.underline,
                { backgroundColor: active ? colors.brand : 'transparent' },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: { flex: 1, alignItems: 'center', gap: 8 },
  label: { fontSize: 15, fontWeight: '800' },
  underline: { height: 3, width: 46, borderRadius: 2 },
});
