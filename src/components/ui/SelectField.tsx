import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/ThemeProvider';

export type SelectOption = { label: string; value: string };

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Title shown at the top of the picker sheet. */
  title?: string;
};

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
}: Props) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={selected ? `${placeholder}: ${selected.label}` : placeholder}
        style={[
          styles.field,
          {
            backgroundColor: colors.surfaceAlt,
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
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={() => setOpen(false)}
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
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
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
  value: { flex: 1, fontSize: 16, fontWeight: '500' },
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
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  rowText: { fontSize: 16, fontWeight: '600' },
});
