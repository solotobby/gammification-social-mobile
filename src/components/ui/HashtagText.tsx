import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

/**
 * Hashtag detection. Deliberately ASCII-only (`\w`) rather than a unicode
 * property escape — Hermes' support for `\p{...}` varies by version, and a
 * regex that throws at parse time would take the whole feed down.
 */
const HASHTAG_RE = /#(\w+)/g;

export type HashtagSegment = {
  /** The literal text, including the leading '#' for a tag. */
  text: string;
  /** Present only for hashtag segments — the tag without its '#'. */
  tag?: string;
};

/** Split a body into plain-text and hashtag runs, preserving order and spacing. */
export function splitHashtags(text: string): HashtagSegment[] {
  const segments: HashtagSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(HASHTAG_RE)) {
    const start = match.index!;
    if (start > lastIndex) segments.push({ text: text.slice(lastIndex, start) });
    segments.push({ text: match[0], tag: match[1] });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex) });

  return segments;
}

/** True when the body has at least one hashtag (cheap guard before mapping). */
export function hasHashtag(text: string): boolean {
  HASHTAG_RE.lastIndex = 0;
  return HASHTAG_RE.test(text);
}

/**
 * Coloured, tappable hashtag spans for use as `TextInput` children — the same
 * tint as rendered posts, so what you type matches what you'll publish. No
 * press handlers: tapping inside an input belongs to the caret.
 */
export function HashtagSpans({ text }: { text: string }) {
  const { colors } = useTheme();
  const segments = useMemo(() => splitHashtags(text), [text]);

  return (
    <>
      {segments.map((segment, i) =>
        segment.tag ? (
          <Text key={i} style={{ color: colors.brand, fontWeight: '700' }}>
            {segment.text}
          </Text>
        ) : (
          <React.Fragment key={i}>{segment.text}</React.Fragment>
        ),
      )}
    </>
  );
}

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

/**
 * Renders a post/comment body with `#hashtags` tinted and tappable, routing to
 * `/hashtag/[tag]` (the same screen the trending topic rows open).
 *
 * Note there's no `accessibilityRole="button"` on the spans: these render
 * inside pressable cards, and react-native-web would emit nested <button>s.
 */
export function HashtagText({ children, style, numberOfLines }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const segments = useMemo(() => splitHashtags(children), [children]);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((segment, i) =>
        segment.tag ? (
          <Text
            key={i}
            suppressHighlighting
            style={{ color: colors.brand, fontWeight: '700' }}
            onPress={() => router.push(`/hashtag/${encodeURIComponent(segment.tag!)}`)}
          >
            {segment.text}
          </Text>
        ) : (
          <React.Fragment key={i}>{segment.text}</React.Fragment>
        ),
      )}
    </Text>
  );
}
