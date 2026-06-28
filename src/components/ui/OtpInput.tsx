import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  cellCount?: number;
  /** Fired when all cells are filled. */
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
};

/**
 * Segmented one-time-code input. Renders N cells backed by a single hidden
 * numeric TextInput, so it stays keyboard-friendly and supports SMS autofill
 * (textContentType / autoComplete = one-time-code).
 */
export function OtpInput({
  value,
  onChangeText,
  cellCount = 6,
  onComplete,
  autoFocus,
}: Props) {
  const { colors, radius } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const handleChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, cellCount);
    onChangeText(digits);
    if (digits.length === cellCount) onComplete?.(digits);
  };

  return (
    <Pressable
      style={styles.row}
      onPress={() => inputRef.current?.focus()}
      accessibilityRole="none"
    >
      {Array.from({ length: cellCount }).map((_, i) => {
        const char = value[i] ?? '';
        const isFilled = i < value.length;
        const isActive = focused && i === value.length;
        return (
          <View
            key={i}
            style={[
              styles.cell,
              {
                backgroundColor: colors.surfaceAlt,
                borderColor: isActive || isFilled ? colors.brand : colors.border,
                borderRadius: radius.md,
              },
            ]}
          >
            {char ? (
              <Text style={[styles.char, { color: colors.text }]}>{char}</Text>
            ) : isActive ? (
              <View style={[styles.caret, { backgroundColor: colors.brand }]} />
            ) : null}
          </View>
        );
      })}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={cellCount}
        caretHidden
        autoFocus={autoFocus}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    position: 'relative',
  },
  cell: {
    flex: 1,
    height: 62,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  char: {
    fontSize: 24,
    fontWeight: '800',
  },
  caret: {
    width: 2,
    height: 26,
    borderRadius: 1,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
});
