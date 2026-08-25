import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '../src/components/ui/BackButton';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { notifications, type AppNotification } from '../src/data/community';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

/** Icon + accent per notification kind. */
function useKindMeta() {
  const { colors } = useTheme();
  const meta: Record<
    AppNotification['kind'],
    { icon: keyof typeof Ionicons.glyphMap; tint: string }
  > = {
    like: { icon: 'heart', tint: colors.pink },
    comment: { icon: 'chatbubble', tint: colors.brand },
    follow: { icon: 'person-add', tint: colors.brandBright },
    payout: { icon: 'cash', tint: colors.mint },
    referral: { icon: 'gift', tint: colors.gold },
  };
  return meta;
}

/** Notification center for engagement, payout, and referral events. */
export default function NotificationsScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const kindMeta = useKindMeta();

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={{ gap: spacing.md }}>
          {notifications.map((item) => {
            const meta = kindMeta[item.kind];
            return (
              <View
                key={item.id}
                style={[
                  styles.row,
                  {
                    backgroundColor: colors.surface,
                    borderColor: item.unread ? `${colors.brand}45` : colors.border,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <View style={[styles.iconWrap, { backgroundColor: `${meta.tint}1A` }]}>
                  <Ionicons name={meta.icon} size={18} color={meta.tint} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.text, { color: colors.text }]}>{item.text}</Text>
                  <View style={styles.metaRow}>
                    <Text style={[styles.time, { color: colors.textMuted }]}>{item.timeAgo} ago</Text>
                    {item.amount ? (
                      <Text style={[styles.amount, { color: colors.mint }]}>
                        +₦{item.amount.toLocaleString()}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {item.unread ? (
                  <View style={[styles.unreadDot, { backgroundColor: colors.brand }]} />
                ) : null}
              </View>
            );
          })}
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
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 4 },
  text: { fontFamily: FONT, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  time: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  amount: { fontFamily: FONT, fontSize: 12, fontWeight: '800' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
});
