import { Pressable, StyleSheet, Text } from 'react-native';

import { spacing, useTheme } from '@/constants/theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
};

/** Small pill used for filters and quick choices. */
export function Chip({ label, selected, onPress }: Props) {
  const { colors, fs } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.card,
          borderColor: selected ? colors.primary : colors.border,
        },
        pressed && { opacity: 0.7 },
      ]}>
      <Text
        style={[
          styles.label,
          { color: selected ? colors.onPrimary : colors.text, fontSize: fs(13) },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { fontWeight: '600' },
});
