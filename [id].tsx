import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmDialog, EmptyState } from '@/components/ui';
import { spacing, useTheme } from '@/constants/theme';
import { formatDate, formatDuration, plural } from '@/lib/format';
import { loadMediaPage } from '@/lib/media';
import { useFolders } from '@/lib/store';

export default function FolderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, appearance, fs } = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();

  const [folders, setFolders] = useFolders();
  const [toRemove, setToRemove] = useState<string | null>(null);
  const [memories, setMemories] = useState<{ id: string; uri: string; mediaType: string; duration: number }[]>([]);

  const isOnThisDay = params.id === 'on-this-day';
  const folder = useMemo(() => folders.find((f) => f.id === params.id), [folders, params.id]);

  // "On this day" is computed from the phone's library, not stored.
  useEffect(() => {
    if (!isOnThisDay) return;
    let alive = true;
    (async () => {
      try {
        const page = await loadMediaPage(undefined, 200);
        const now = new Date();
        const found = page.items
          .filter((item) => {
            const d = new Date(item.creationTime);
            return (
              d.getDate() === now.getDate() &&
              d.getMonth() === now.getMonth() &&
              d.getFullYear() < now.getFullYear()
            );
          })
          .map((item) => ({
            id: item.id,
            uri: item.uri,
            mediaType: item.mediaType,
            duration: item.duration,
          }));
        if (alive) setMemories(found);
      } catch {
        if (alive) setMemories([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isOnThisDay]);

  const columns = appearance.columns;
  const gap = 3;
  const tile = Math.floor((width - gap * (columns + 1)) / columns);

  const items = isOnThisDay ? memories : (folder?.items ?? []);
  const title = isOnThisDay ? 'On this day' : (folder?.name ?? 'Folder');

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        contentContainerStyle={{
          padding: gap,
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + 40,
          gap,
        }}
        columnWrapperStyle={columns > 1 ? { gap } : undefined}
        ListHeaderComponent={
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text, fontSize: fs(22) }]}>{title}</Text>
              <Text style={{ color: colors.muted, fontSize: fs(11) }}>
                {plural(items.length, 'item')}
                {folder ? ` · created ${formatDate(folder.createdAt)}` : ''}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/viewer', params: { id: item.id } })}
            onLongPress={() => {
              if (!isOnThisDay) setToRemove(item.id);
            }}
            style={({ pressed }) => [
              {
                width: tile,
                height: tile,
                borderRadius: appearance.tileShape === 'circle' ? tile / 2 : appearance.radius,
                overflow: 'hidden',
                backgroundColor: colors.card,
              },
              pressed && { opacity: 0.75 },
            ]}>
            <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            {item.mediaType === 'video' ? (
              <View style={styles.badge}>
                <Ionicons name="play" size={9} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '600' }}>
                  {formatDuration(item.duration)}
                </Text>
              </View>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={isOnThisDay ? 'sparkles-outline' : 'heart-outline'}
            title={isOnThisDay ? 'No memories today' : 'This folder is empty'}
            message={
              isOnThisDay
                ? 'Photos from this date in earlier years will appear here.'
                : 'Favourite items into this folder from the gallery.'
            }
          />
        }
      />

      <ConfirmDialog
        visible={toRemove !== null}
        title="Remove from this folder?"
        message="The item goes back to your main gallery. It is not deleted."
        confirmTitle="Remove"
        cancelTitle="Cancel"
        onCancel={() => setToRemove(null)}
        onConfirm={() => {
          if (folder && toRemove) {
            setFolders((prev) =>
              prev.map((f) =>
                f.id === folder.id ? { ...f, items: f.items.filter((i) => i.id !== toRemove) } : f,
              ),
            );
          }
          setToRemove(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  title: { fontWeight: '800', letterSpacing: -0.4 },
  badge: {
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
});
