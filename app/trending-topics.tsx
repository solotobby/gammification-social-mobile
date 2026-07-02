import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '../src/components/ui/BackButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { trendingTopics } from '../src/data/community';
import { useTheme } from '../src/theme/ThemeProvider';

/** Full ranked list behind the dashboard's "Trending Topics — Top 5" card. */
export default function TrendingTopicsScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
          gap: spacing.xl,
        }}
      >
        <View style={styles.headerRow}>
          <BackButton onPress={() => router.back()} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Trending topics</Text>
          <View style={{ width: 44 }} />
        </View>

        <View
          style={[
            styles.subBanner,
            { backgroundColor: `${colors.gold}14`, borderColor: `${colors.gold}40`, borderRadius: radius.md },
          ]}
        >
          <Ionicons name="flame" size={18} color={colors.gold} />
          <Text style={[styles.subText, { color: colors.text }]}>
            Post with a trending hashtag to ride the wave — trending posts get more
            engagements, and engagements pay.
          </Text>
        </View>

        <View style={{ gap: spacing.md }}>
          {trendingTopics.map((topic, index) => (
            <View
              key={topic.id}
              style={[
                styles.row,
                { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
              ]}
            >
              <Text style={[styles.rank, { color: colors.textMuted }]}>{index + 1}</Text>
              <View style={styles.rowText}>
                <Text style={[styles.tag, { color: colors.brand }]}>#{topic.tag}</Text>
                <Text style={[styles.count, { color: colors.textMuted }]}>
                  {topic.posts} posts this week
                </Text>
              </View>
              <Ionicons name="trending-up" size={20} color={colors.mint} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  subBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  subText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rank: { width: 22, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  rowText: { flex: 1, gap: 2 },
  tag: { fontSize: 16, fontWeight: '800' },
  count: { fontSize: 12, fontWeight: '600' },
});
