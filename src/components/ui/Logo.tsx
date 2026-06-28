import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

// Full horizontal Payhankey lockup (911 x 220, transparent background).
const LOGO = require('../../../assets/images/logo.png');
const ASPECT = 911 / 220;

type Props = {
  /** Rendered width in px; height is derived from the logo aspect ratio. */
  width?: number;
  style?: StyleProp<ImageStyle>;
};

export function Logo({ width = 190, style }: Props) {
  return (
    <Image
      source={LOGO}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Payhankey"
      style={[{ width, height: width / ASPECT }, style]}
    />
  );
}
