import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '../src/components/ui/Avatar';
import { BackButton } from '../src/components/ui/BackButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { members, type Member } from '../src/data/community';
import { useTheme } from '../src/theme/ThemeProvider';

const MEDALS = ['trophy', 'medal', 'medal-outline'] as const;
const MEDAL_TINTS = ['gold', 'pink', 'mint'] as const;

function TrendingRow({ member, index }: { member: Member; index: number }) {
  const { colors, radius } = useTheme();
  const [following, setFollowing] = useState(false);
  const medal = index < 3;

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
      ]}
    >
      <View style={styles.rankSlot}>
        {medal ? (
          <Ionicons
            name={MEDALS[index]}
            size={20}
            color={colors[MEDAL_TINTS[index]]}
          />
        ) : (
          <Text style={[styles.rank, { color: colors.textMuted }]}>{index + 1}</Text>
        )}
      </View>
      <Avatar name={member.name} tint={member.tint} size={44} />
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {member.name}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="pulse" size={13} color={colors.mint} />
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {member.engagements} engagements
          </Text>
        </View>
      </View>
      <Pressable
        onPress={() => setFollowing((f) => !f)}
        accessibilityRole="button"
        accessibilityLabel={following ? `Unfollow ${member.name}` : `Follow ${member.name}`}
        style={[
          styles.followBtn,
          following
            ? { backgroundColor: colors.surfaceAlt, borderColor: colors.border }
            : { backgroundColor: colors.brand, borderColor: colors.brand },
        ]}
      >
        <Ionicons
          name={following ? 'checkmark' : 'person-add-outline'}
          size={17}
          color={following ? colors.textSecondary : colors.onBrand}
        />
      </Pressable>
    </View>
  );
}

/** Full list behind the dashboard's "Trending Members — last 6 hours" card. */
export default function TrendingMembersScreen() {
  const { colors, spacing } = useTheme();
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
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Trending members</Text>
            <Text style={[styles.headerSub, { color: colors.textMuted }]}>Last 6 hours</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <View style={{ gap: spacing.md }}>
          {members.map((member, index) => (
            <TrendingRow key={member.id} member={member} index={index} />
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
  headerCenter: { alignItems: 'center', gap: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerSub: { fontSize: 12, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rankSlot: { width: 26, alignItems: 'center' },
  rank: { fontSize: 15, fontWeight: '900' },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontSize: 12, fontWeight: '600' },
  followBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
