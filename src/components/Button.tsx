import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import React, { useMemo } from 'react';

type Variant = 'primary' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'xl';

type Props = {
  style?: ViewStyle;
  size?: Size;
  text: string;
  variant?: Variant;
  isDisabled?: boolean;
  onPress: () => void;
};

export default function Button({
  style,
  text,
  size = 'md',
  variant = 'primary',
  isDisabled,
  onPress,
}: Props) {
  const styles = createStyles({ variant, size, isDisabled });

  return (
    <View style={style}>
      <TouchableOpacity
        disabled={isDisabled}
        style={styles.button}
        onPress={onPress}
      >
        <Text style={styles.text}>{text}</Text>
      </TouchableOpacity>
    </View>
  );
}

type StyleProps = {
  size: Size;
  variant: Variant;
  isDisabled?: boolean;
};

const createStyles = ({ size, variant, isDisabled }: StyleProps) => {
  const color = getColor(variant);
  const _size = getSize(size);

  return StyleSheet.create({
    button: {
      borderWidth: 3,
      borderColor: color,
      borderRadius: 100,
      width: _size,
      height: _size,
      justifyContent: 'center',
      alignItems: 'center',

      ...(isDisabled && {
        opacity: 0.5,
      }),
    },
    text: {
      color: color,
      fontSize: getFontSize(size),
      textAlign: 'center',
    },
  });
};

const getColor = (variant: Variant) => {
  switch (variant) {
    case 'danger':
      return '#dc3545';
    case 'primary':
    default:
      return '#2f79e0';
  }
};

const getSize = (size: Size) => {
  switch (size) {
    case 'sm':
      return 75;
    case 'lg':
      return 150;
    case 'xl':
      return 200;
    case 'md':
    default:
      return 100;
  }
};

const getFontSize = (size: Size) => {
  switch (size) {
    case 'sm':
      return 16;
    case 'lg':
      return 20;
    case 'xl':
      return 22;
    case 'md':
    default:
      return 18;
  }
};
