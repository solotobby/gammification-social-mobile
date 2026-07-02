import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

type Props = {
  title: string;
  /** Optional emoji/icon rendered before the title. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Shows a "See all" affordance when provided. */
  onSeeAll?: () => void;
};

/** Section heading row used across the dashboard screens. */
export function SectionHeader({ title, icon, onSeeAll }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.titleWrap}>
        {icon ? <Ionicons name={icon} size={18} color={colors.brand} /> : null}
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.seeAll, { color: colors.brand }]}>See all</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 18, fontWeight: '800' },
  seeAll: { fontSize: 14, fontWeight: '700' },
});
