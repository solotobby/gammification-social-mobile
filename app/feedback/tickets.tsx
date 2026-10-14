import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FeedbackTicket } from '../../src/api/feedback';
import { listStamp } from '../../src/components/messages/time';
import { TicketStatusPill } from '../../src/components/support/TicketStatusPill';
import { BackButton } from '../../src/components/ui/BackButton';
import { ScreenBackground } from '../../src/components/ui/ScreenBackground';
import { useFeedbackTickets } from '../../src/hooks/useFeedback';
import { useIsOffline } from '../../src/hooks/useIsOffline';
import { useTheme } from '../../src/theme/ThemeProvider';
import { FONT } from '../../src/theme/fonts';

/**
 * Your feedback tickets — `GET /feedback`, newest activity first. A ticket the
 * team has answered last says so in brand colour ("Payhankey replied"), which
 * is the thing someone opening this list is looking for. Tapping one opens its
 * conversation (`/feedback/[id]`).
 */
export default function FeedbackTicketsScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const offline = useIsOffline();
  const tickets = useFeedbackTickets();
  const [refreshing, setRefreshing] = useState(false);

  const rows = tickets.data?.pages.flatMap((page) => page.data) ?? [];
  const firstLoad = tickets.isLoading && !tickets.data;
  const loadFailed = tickets.isError && !tickets.data;

  const newFeedback = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/feedback');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <FlatList
        data={rows}
        keyExtractor={(ticket) => ticket.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await tickets.refetch();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={colors.brand}
          />
        }
        onEndReached={() => {
          if (tickets.hasNextPage && !tickets.isFetchingNextPage) void tickets.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
          gap: 10,
        }}
        ListHeaderComponent={
          <View style={[styles.headerRow, { marginBottom: spacing.md }]}>
            <BackButton onPress={() => router.back()} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>Your feedback</Text>
            <Pressable
              onPress={newFeedback}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Send new feedback"
              style={[styles.newButton, { backgroundColor: colors.brand }]}
            >
              <Ionicons name="add" size={22} color={colors.onBrand} />
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <TicketRow
            ticket={item}
            onPress={() => router.push({ pathname: '/feedback/[id]', params: { id: item.id } })}
          />
        )}
        ListFooterComponent={
          tickets.isFetchingNextPage ? <ActivityIndicator color={colors.brand} style={styles.spinner} /> : null
        }
        ListEmptyComponent={
          firstLoad ? (
            <ActivityIndicator color={colors.brand} style={styles.spinner} />
          ) : (
            <View style={[styles.empty, { borderColor: colors.border, borderRadius: radius.lg }]}>
              <Ionicons
                name={loadFailed ? 'cloud-offline-outline' : 'chatbubbles-outline'}
                size={28}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {loadFailed ? 'Couldn’t load your feedback' : 'No feedback yet'}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {loadFailed
                  ? offline
                    ? 'You’re offline. It’ll load when you reconnect.'
                    : 'Pull down to try again.'
                  : 'Tell the team what’s working and what isn’t — they reply here.'}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

function TicketRow({ ticket, onPress }: { ticket: FeedbackTicket; onPress: () => void }) {
  const { colors, radius } = useTheme();
  const staffLast = ticket.last_message_by === 'staff';
  const when = Date.parse(ticket.last_message_at ?? ticket.created_at) || Date.now();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${ticket.subject}, ${ticket.status_label}${staffLast ? ', Payhankey replied' : ''}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: staffLast ? `${colors.brand}55` : colors.border,
          borderRadius: radius.md,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.rowTop}>
        <Text style={[styles.subject, { color: colors.text }]} numberOfLines={1}>
          {ticket.subject}
        </Text>
        <Text style={[styles.stamp, { color: colors.textMuted }]}>{listStamp(when)}</Text>
      </View>
      <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={2}>
        {ticket.message}
      </Text>
      <View style={styles.rowBottom}>
        <TicketStatusPill status={ticket.status} label={ticket.status_label} />
        <Text style={[styles.meta, { color: colors.textMuted }]}>{ticket.type_label}</Text>
        {staffLast ? (
          <View style={styles.replied}>
            <Ionicons name="chatbubble-ellipses" size={13} color={colors.brand} />
            <Text style={[styles.repliedText, { color: colors.brand }]}>Payhankey replied</Text>
          </View>
        ) : ticket.messages_count && ticket.messages_count > 1 ? (
          <Text style={[styles.meta, { color: colors.textMuted }]}>{ticket.messages_count} messages</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800' },
  newButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  row: { padding: 14, gap: 8, borderWidth: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subject: { flex: 1, fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  stamp: { fontFamily: FONT, fontSize: 12, fontWeight: '500' },
  preview: { fontFamily: FONT, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  meta: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  replied: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  repliedText: { fontFamily: FONT, fontSize: 12, fontWeight: '800' },
  spinner: { paddingVertical: 24 },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  emptyTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  emptyText: { fontFamily: FONT, fontSize: 13, fontWeight: '500', textAlign: 'center' },
});
