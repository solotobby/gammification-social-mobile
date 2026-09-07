import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CommunityMember, MemberAction } from '../../api/communities';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../ui/Avatar';
import { FONT } from '../../theme/fonts';

/** What a moderator can do to this row, given who they are and who it is. */
type Action = { key: MemberAction | 'remove'; label: string; icon: keyof typeof Ionicons.glyphMap; destructive?: boolean };

/**
 * Which actions to offer.
 *
 * The **owner is untouchable** — there is no transfer-ownership endpoint, and
 * `/leave` refuses them, so there is nothing a moderator could legitimately do
 * to that row. An admin can only be acted on by the owner: letting admins
 * demote each other invites a moderation war the API has no way to arbitrate.
 */
function actionsFor(row: CommunityMember, viewerIsOwner: boolean): Action[] {
  if (row.isOwner) return [];
  if (row.isAdmin && !viewerIsOwner) return [];

  if (row.status === 'banned') {
    return [{ key: 'unban', label: 'Unban', icon: 'lock-open-outline' }];
  }

  return [
    row.isAdmin
      ? { key: 'demote', label: 'Remove as admin', icon: 'arrow-down-circle-outline' }
      : { key: 'promote', label: 'Make admin', icon: 'shield-checkmark-outline' },
    { key: 'ban', label: 'Ban from community', icon: 'ban-outline', destructive: true },
    { key: 'remove', label: 'Remove member', icon: 'person-remove-outline', destructive: true },
  ];
}

const ROLE_LABEL: Record<string, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' };

/**
 * One row of the Members tab: who they are, their role, and — for an
 * owner/admin — the moderation menu.
 *
 * Moderation is confirmed in a sheet rather than fired on tap: banning and
 * removing are the sort of thing a mis-tap should not do, and the sheet is also
 * where the row says plainly what each verb means.
 */
export function CommunityMemberRow({
  row,
  canModerate,
  viewerIsOwner,
  onAction,
  pending,
}: {
  row: CommunityMember;
  canModerate: boolean;
  viewerIsOwner: boolean;
  onAction: (action: MemberAction | 'remove') => void;
  pending?: boolean;
}) {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const actions = canModerate ? actionsFor(row, viewerIsOwner) : [];

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
      ]}
    >
      <Pressable
        onPress={() => router.push(`/member/${row.member.handle}`)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${row.member.name}'s profile`}
        style={styles.identity}
      >
        <Avatar name={row.member.name} tint={row.member.tint} size={40} />
        <View style={styles.identityText}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {row.member.name}
          </Text>
          <Text style={[styles.handle, { color: colors.textMuted }]} numberOfLines={1}>
            @{row.member.handle}
            {row.joinedAgo ? ` · joined ${row.joinedAgo}` : ''}
          </Text>
        </View>
      </Pressable>

      {/* Role pill — members are the default, so only owner/admin are labelled,
          alongside a banned state that has to be visible wherever it appears. */}
      {row.status === 'banned' ? (
        <View style={[styles.pill, { backgroundColor: `${colors.pink}1A` }]}>
          <Text style={[styles.pillText, { color: colors.pink }]}>Banned</Text>
        </View>
      ) : row.role !== 'member' ? (
        <View style={[styles.pill, { backgroundColor: `${colors.brand}1A` }]}>
          <Text style={[styles.pillText, { color: colors.brand }]}>{ROLE_LABEL[row.role]}</Text>
        </View>
      ) : null}

      {actions.length ? (
        <Pressable
          onPress={() => setMenuOpen(true)}
          hitSlop={8}
          disabled={pending}
          accessibilityRole="button"
          accessibilityLabel={`Manage ${row.member.name}`}
          style={styles.more}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={18}
            color={pending ? colors.textMuted : colors.text}
          />
        </Pressable>
      ) : null}

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <Pressable
            // Swallow taps so pressing the sheet itself doesn't dismiss it.
            onPress={() => {}}
            style={[
              styles.sheet,
              { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{row.member.name}</Text>
            <Text style={[styles.sheetHandle, { color: colors.textMuted }]}>
              @{row.member.handle}
            </Text>

            {actions.map((action) => (
              <Pressable
                key={action.key}
                onPress={() => {
                  setMenuOpen(false);
                  onAction(action.key);
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.action,
                  { backgroundColor: pressed ? colors.surfaceAlt : 'transparent' },
                ]}
              >
                <Ionicons
                  name={action.icon}
                  size={18}
                  color={action.destructive ? colors.pink : colors.text}
                />
                <Text
                  style={[
                    styles.actionText,
                    { color: action.destructive ? colors.pink : colors.text },
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  identityText: { flex: 1, gap: 2 },
  name: { fontFamily: FONT, fontSize: 14.5, fontWeight: '800' },
  handle: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontFamily: FONT, fontSize: 11, fontWeight: '800' },
  more: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  sheet: { gap: 4 },
  sheetTitle: { fontFamily: FONT, fontSize: 16, fontWeight: '800' },
  sheetHandle: { fontFamily: FONT, fontSize: 12.5, fontWeight: '600', marginBottom: 8 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  actionText: { fontFamily: FONT, fontSize: 14.5, fontWeight: '700' },
});
