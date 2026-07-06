import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../ui/Avatar';
import type { Member } from '../../data/community';

/**
 * A member result row with a follow toggle — shared by Explore, the search
 * screen, and anywhere else people are listed. Follow state is local (dummy).
 */
export function MemberRow({ member }: { member: Member }) {
  const { colors, radius } = useTheme();
  const [following, setFollowing] = useState(false);

  return (
    <View
      style={[
        styles.memberRow,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
      ]}
    >
      <Avatar name={member.name} tint={member.tint} size={44} />
      <View style={styles.memberText}>
        <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
          {member.name}
        </Text>
        <Text style={[styles.memberMeta, { color: colors.textMuted }]} numberOfLines={1}>
          @{member.handle} · {member.followers} followers
        </Text>
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
        <Text
          style={[
            styles.followText,
            { color: following ? colors.textSecondary : colors.onBrand },
          ]}
        >
          {following ? 'Following' : 'Follow'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  memberText: { flex: 1, gap: 2 },
  memberName: { fontSize: 15, fontWeight: '800' },
  memberMeta: { fontSize: 13, fontWeight: '500' },
  followBtn: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  followText: { fontSize: 13, fontWeight: '800' },
});
