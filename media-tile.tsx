import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { formatDuration } from '@/lib/format';
import type { MediaItem } from '@/lib/media';

type Props = {
  item: MediaItem;
  size: number;
  selected?: boolean;
  selectionMode?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
};

/** One square tile in a grid. */
export function MediaTile({ item, size, selected, selectionMode, onPress, onLongPress }: Props) {
  const { colors, appearance, fs } = useTheme();
  const radius =
    appearance.tileShape === 'circle' ? size / 2 : appearance.tileShape === 'square' ? 2 : appearance.radius;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.mediaType === 'video' ? 'Video' : 'Photo'}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={280}
      style={({ pressed }) => [
        styles.tile,
        { width: size, height: size, borderRadius: radius, backgroundColor: colors.card },
        pressed && { opacity: 0.75 },
      ]}>
      <Image
        source={{ uri: item.uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        recyclingKey={item.id}
        transition={120}
      />

      {appearance.showBadges && item.mediaType === 'video' ? (
        <View style={styles.durationBadge}>
          <Ionicons name="play" size={9} color="#FFFFFF" />
          <Text style={[styles.durationText, { fontSize: fs(10) }]}>{formatDuration(item.duration)}</Text>
        </View>
      ) : null}

      {selectionMode ? (
        <View style={styles.selectWrap}>
          <View
            style={[
              styles.check,
              {
                backgroundColor: selected ? colors.primary : 'rgba(0,0,0,0.35)',
                borderColor: selected ? colors.primary : 'rgba(255,255,255,0.85)',
              },
            ]}>
            {selected ? <Ionicons name="checkmark" size={13} color={colors.onPrimary} /> : null}
          </View>
        </View>
      ) : null}

      {selected ? (
        <View style={[StyleSheet.absoluteFill, styles.selectedOverlay, { borderColor: colors.primary }]} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { overflow: 'hidden' },
  durationBadge: {
    position: 'absolute',
    bottom: 5,
    end: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  durationText: { color: '#FFFFFF', fontWeight: '600' },
  selectWrap: { position: 'absolute', top: 5, end: 5 },
  check: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedOverlay: { borderWidth: 2.5, borderRadius: 0 },
});
