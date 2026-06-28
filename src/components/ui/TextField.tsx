import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

type Props = TextInputProps & {
  /** Leading icon. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Renders a password field with a show/hide toggle. */
  secure?: boolean;
};

/**
 * Themed text input matching the app style: rounded filled surface, leading icon,
 * brand-colored focus ring, and an optional password reveal toggle. Forwards its
 * ref to the underlying TextInput so screens can chain focus between fields.
 */
export const TextField = forwardRef<TextInput, Props>(function TextField(
  { icon, secure, style, onFocus, onBlur, ...rest },
  ref,
) {
  const { colors, radius } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceAlt,
          borderColor: focused ? colors.brand : colors.border,
          borderRadius: radius.md,
        },
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={20}
          color={focused ? colors.brand : colors.textMuted}
          style={styles.leading}
        />
      ) : null}

      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.brand}
        secureTextEntry={secure ? hidden : false}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, { color: colors.text }, style]}
        {...rest}
      />

      {secure ? (
        <Pressable
          hitSlop={10}
          onPress={() => setHidden((h) => !h)}
          accessibilityRole="button"
          accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          style={styles.trailing}
        >
          <Ionicons
            name={hidden ? 'eye-outline' : 'eye-off-outline'}
            size={20}
            color={colors.textMuted}
          />
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    paddingHorizontal: 16,
    borderWidth: 1.5,
  },
  leading: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    height: '100%',
    paddingVertical: 0,
  },
  trailing: {
    marginLeft: 8,
    padding: 2,
  },
});
