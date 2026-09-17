import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';

export type SelectOption = { label: string; value: string };

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Title shown at the top of the picker sheet. */
  title?: string;
  /**
   * Show a filter box above the list. Defaults on past {@link SEARCH_THRESHOLD}
   * options — the Nigerian bank list is 285 entries, and scrolling to "Zenith"
   * one flick at a time is not a picker, it's a punishment.
   */
  searchable?: boolean;
  /** Placeholder for the filter box. "Search <title>" reads badly for a title
   *  that is already an instruction ("Search Select bank"), so it defaults to
   *  a plain "Search". */
  searchPlaceholder?: string;
};

/** Option count past which the picker filters itself by default. */
const SEARCH_THRESHOLD = 12;

/**
 * Tappable field styled like {@link TextField} that opens a bottom-sheet modal to
 * pick from a list of options. Keeps the form keyboard-free for enumerated values.
 */
export function SelectField({
  icon,
  placeholder,
  value,
  options,
  onChange,
  title,
  searchable,
  searchPlaceholder,
}: Props) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value);
  const filtering = searchable ?? options.length > SEARCH_THRESHOLD;
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!filtering || !term) return options;
    return options.filter((option) => option.label.toLowerCase().includes(term));
  }, [filtering, options, query]);

  /** Always reopen on a clean list — a stale filter looks like a short list. */
  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={selected ? `${placeholder}: ${selected.label}` : placeholder}
        style={[
          styles.field,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.md,
          },
        ]}
      >
        {icon ? (
          <Ionicons name={icon} size={20} color={colors.textMuted} style={styles.leading} />
        ) : null}
        <Text
          style={[
            styles.value,
            { color: selected ? colors.text : colors.textMuted },
          ]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={close}
        >
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                paddingBottom: insets.bottom + spacing.lg,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            {title ? (
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            ) : null}
            {filtering ? (
              <View
                style={[
                  styles.search,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={searchPlaceholder ?? 'Search'}
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.brand}
                  autoCorrect={false}
                  autoCapitalize="none"
                  style={[styles.searchInput, { color: colors.text }]}
                />
                {query ? (
                  <Pressable
                    onPress={() => setQuery('')}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                  >
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <FlatList
              data={visible}
              keyExtractor={(item) => item.value}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={[styles.empty, { color: colors.textMuted }]}>
                  Nothing matches "{query.trim()}".
                </Text>
              }
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value);
                      close();
                    }}
                    style={[
                      styles.row,
                      {
                        backgroundColor: active ? colors.surfaceAlt : 'transparent',
                        borderRadius: radius.md,
                      },
                    ]}
                  >
                    <Text style={[styles.rowText, { color: colors.text }]}>
                      {item.label}
                    </Text>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.brand} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    paddingHorizontal: 16,
    borderWidth: 1.5,
  },
  leading: { marginRight: 12 },
  value: { fontFamily: FONT, flex: 1, fontSize: 16, fontWeight: '500' },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingTop: 10,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '70%',
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  searchInput: {
    fontFamily: FONT,
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },
  empty: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 24,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  rowText: { fontFamily: FONT, fontSize: 16, fontWeight: '600' },
});
