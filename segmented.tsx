import { Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing, useTheme } from '@/constants/theme';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Row of mutually exclusive choices, e.g. Light / Dark / System. */
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const { colors, fs } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.background, borderColor: colors.border }]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active && { backgroundColor: colors.primary }]}>
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: active ? colors.onPrimary : colors.muted, fontSize: fs(13) },
              ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontWeight: '600' },
});
