import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
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

import type { ApiCall, ApiCallParty } from '../src/api/calls';
import { toUserLevel } from '../src/api/levels';
import { tintFor } from '../src/api/timeline';
import { callsSupported, startCall } from '../src/calls/callEngine';
import { listStamp } from '../src/components/messages/time';
import { Avatar } from '../src/components/ui/Avatar';
import { BackButton } from '../src/components/ui/BackButton';
import { NameWithBadge } from '../src/components/ui/LevelBadge';
import { OnlineDot } from '../src/components/ui/OnlineDot';
import { ScreenBackground } from '../src/components/ui/ScreenBackground';
import { callOutcome, useCallHistory } from '../src/hooks/useCalls';
import { useIsOffline } from '../src/hooks/useIsOffline';
import { useAuthStore } from '../src/stores/authStore';
import { useTheme } from '../src/theme/ThemeProvider';
import { FONT } from '../src/theme/fonts';

const AVATAR_SIZE = 48;

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'missed', label: 'Missed' },
] as const;
type Filter = (typeof FILTERS)[number]['value'];

/**
 * Call history — `GET /calls`, from the phone icon in the Messages header.
 *
 * Laid out like a phone's recents: who, which way (the arrow), how it went
 * ("2:14", "Missed", "No answer"…), when, and a button to call straight back
 * with the same kind of call. Missed calls are red, and the Missed chip
 * narrows to them. Tapping the row itself opens your conversation with them,
 * which is where the rest of the relationship lives.
 *
 * The server's status is read from *your* side of the call — see
 * `callOutcome` in src/hooks/useCalls.ts.
 */
export default function CallsScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const offline = useIsOffline();
  const me = useAuthStore((s) => s.user?.id);
  const history = useCallHistory();
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const canCall = callsSupported();

  const calls = useMemo(() => {
    const rows = history.data?.pages.flatMap((page) => page.calls) ?? [];
    return filter === 'missed' ? rows.filter((c) => callOutcome(c, me).missed) : rows;
  }, [filter, history.data, me]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await history.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const firstLoad = history.isLoading && !history.data;
  const loadFailed = history.isError && !history.data;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenBackground />
      <FlatList
        data={calls}
        keyExtractor={(call) => call.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
        onEndReached={() => {
          if (history.hasNextPage && !history.isFetchingNextPage) void history.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.lg, paddingHorizontal: spacing.xl, paddingBottom: spacing.md }}>
            <View style={styles.headerRow}>
              <BackButton onPress={() => router.back()} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>Calls</Text>
              <View style={styles.headerSpacer} />
            </View>
            <View style={styles.chips}>
              {FILTERS.map((item) => {
                const active = item.value === filter;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setFilter(item.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.chip,
                      { borderRadius: radius.pill },
                      active
                        ? { backgroundColor: colors.brand, borderColor: colors.brand }
                        : { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? colors.onBrand : colors.textSecondary }]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <CallRow
            call={item}
            me={me}
            gutter={spacing.xl}
            canCall={canCall}
            onOpen={(other) => {
              if (item.conversation_id) {
                router.push({ pathname: '/messages/[id]', params: { id: item.conversation_id } });
              } else if (other.username) {
                router.push({ pathname: '/member/[handle]', params: { handle: other.username } });
              }
            }}
          />
        )}
        ItemSeparatorComponent={() => (
          <View
            style={[
              styles.divider,
              { marginLeft: spacing.xl + AVATAR_SIZE + 14, backgroundColor: colors.border },
            ]}
          />
        )}
        ListFooterComponent={
          history.isFetchingNextPage ? (
            <ActivityIndicator color={colors.brand} style={styles.spinner} />
          ) : null
        }
        ListEmptyComponent={
          firstLoad ? (
            <ActivityIndicator color={colors.brand} style={styles.spinner} />
          ) : (
            <View
              style={[
                styles.empty,
                { borderColor: colors.border, borderRadius: radius.lg, marginHorizontal: spacing.xl },
              ]}
            >
              <Ionicons
                name={loadFailed ? 'cloud-offline-outline' : 'call-outline'}
                size={28}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {loadFailed
                  ? 'Couldn’t load your calls'
                  : filter === 'missed'
                    ? 'No missed calls'
                    : 'No calls yet'}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {loadFailed
                  ? offline
                    ? 'You’re offline. They’ll load as soon as you reconnect.'
                    : 'Pull down to try again.'
                  : 'Start a voice or video call from any conversation.'}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

function CallRow({
  call,
  me,
  gutter,
  canCall,
  onOpen,
}: {
  call: ApiCall;
  me: string | undefined;
  gutter: number;
  canCall: boolean;
  onOpen: (other: ApiCallParty) => void;
}) {
  const { colors } = useTheme();
  const outcome = callOutcome(call, me);
  const other: ApiCallParty =
    (outcome.incoming ? call.caller : call.receiver) ?? {
      id: outcome.incoming ? call.caller_id : call.receiver_id,
    };
  const name = other.name?.trim() || other.username || 'Payhankey member';
  const level = toUserLevel(other.level);
  const when = Date.parse(call.started_at ?? call.created_at ?? '') || Date.now();
  const arrow = outcome.missed
    ? 'call-missed'
    : outcome.incoming
      ? 'call-received'
      : call.status === 'completed'
        ? 'call-made'
        : 'call-missed-outgoing';
  // Solid icons in brand violet, red for a missed call — the same treatment
  // as the call card in a thread and the call preview in the inbox.
  const tone = outcome.missed ? colors.danger : colors.brand;

  return (
    <View style={[styles.row, { paddingHorizontal: gutter }]}>
      <Pressable
        onPress={() => onOpen(other)}
        accessibilityRole="button"
        accessibilityLabel={`${outcome.incoming ? 'Call from' : 'Call to'} ${name}, ${outcome.label}`}
        style={({ pressed }) => [styles.rowMain, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View>
          <Avatar
            userId={other.id}
            level={level}
            name={name}
            tint={tintFor(other.id)}
            uri={other.avatar ?? null}
            size={AVATAR_SIZE}
          />
          <OnlineDot userId={other.id} avatarSize={AVATAR_SIZE} />
        </View>
        <View style={styles.rowBody}>
          <NameWithBadge
            style={[styles.name, { color: outcome.missed ? colors.danger : colors.text }]}
            name={name}
            userId={other.id}
            level={level}
            size={15}
          />
          <View style={styles.metaLine}>
            <MaterialIcons name={arrow} size={15} color={tone} />
            <Ionicons name={call.call_type === 'video' ? 'videocam' : 'call'} size={13} color={tone} />
            <Text
              style={[styles.meta, { color: outcome.missed ? colors.danger : colors.textMuted }]}
              numberOfLines={1}
            >
              {outcome.label}
            </Text>
          </View>
        </View>
        <Text style={[styles.stamp, { color: colors.textMuted }]}>{listStamp(when)}</Text>
      </Pressable>
      {canCall ? (
        <Pressable
          onPress={() =>
            void startCall({
              type: call.call_type === 'video' ? 'video' : 'audio',
              conversationId: call.conversation_id ?? null,
              peer: {
                id: other.id,
                name,
                username: other.username ?? '',
                avatar: other.avatar ?? null,
                level,
              },
            })
          }
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${call.call_type === 'video' ? 'Video' : 'Voice'} call ${name}`}
          style={({ pressed }) => [styles.callBack, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons
            name={call.call_type === 'video' ? 'videocam' : 'call'}
            size={22}
            color={colors.brand}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800' },
  headerSpacer: { width: 44 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  rowBody: { flex: 1, gap: 3 },
  name: { fontFamily: FONT, fontSize: 15, fontWeight: '700' },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontFamily: FONT, fontSize: 13, fontWeight: '500', flexShrink: 1 },
  stamp: { fontFamily: FONT, fontSize: 12, fontWeight: '500' },
  callBack: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth },
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
