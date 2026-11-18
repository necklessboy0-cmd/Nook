import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { MediaTile } from '@/components/media-tile';
import { EmptyState } from '@/components/ui';
import { spacing, useTheme } from '@/constants/theme';
import { formatDate, plural } from '@/lib/format';
import {
  loadMediaPage,
  requestMediaPermission,
  type MediaItem,
  type PermissionState,
} from '@/lib/media';
import { favouritedIds, useAppearance, useFolders, useTrash } from '@/lib/store';

type SortKey = 'newest' | 'oldest' | 'largest';
type FilterKey = 'all' | 'photos' | 'videos';

export default function GalleryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, appearance, fs } = useTheme();
  const { width } = useWindowDimensions();
  const [, setAppearance] = useAppearance();

  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sort, setSort] = useState<SortKey>('newest');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [folders] = useFolders();
  const [trash] = useTrash();
  const favourited = useMemo(() => favouritedIds(folders), [folders]);

  // Pull-down shutter that reveals the hidden vault.
  const shutter = useRef(new Animated.Value(0)).current;
  const pullStart = useRef<number | null>(null);
  const [pulling, setPulling] = useState(false);

  const columns = appearance.columns;
  const gap = appearance.compact ? 2 : 3;
  const tileSize = Math.floor((width - gap * (columns + 1)) / columns);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'initial') setLoading(true);
    setError(null);
    try {
      const state = await requestMediaPermission();
      setPermission(state);
      if (state === 'denied' || state === 'unavailable') {
        setItems([]);
        setHasMore(false);
        return;
      }
      const page = await loadMediaPage(undefined, 90);
      setItems(page.items);
      setCursor(page.endCursor);
      setHasMore(page.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read your photos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load('initial');
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await loadMediaPage(cursor, 90);
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...page.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(page.endCursor);
      setHasMore(page.hasMore);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loadingMore]);

  const visible = useMemo(() => {
    let list = items.filter((item) => !favourited.has(item.id));
    if (filter === 'photos') list = list.filter((i) => i.mediaType === 'photo');
    if (filter === 'videos') list = list.filter((i) => i.mediaType === 'video');
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((i) => i.filename.toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sort === 'oldest') sorted.sort((a, b) => a.creationTime - b.creationTime);
    else if (sort === 'largest') sorted.sort((a, b) => b.width * b.height - a.width * a.height);
    else sorted.sort((a, b) => b.creationTime - a.creationTime);
    return sorted;
  }, [items, favourited, filter, query, sort]);

  const onThisDay = useMemo(() => {
    const now = new Date();
    return items.filter((item) => {
      const d = new Date(item.creationTime);
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() < now.getFullYear()
      );
    });
  }, [items]);

  const toggleSelect = useCallback(
    (id: string) => {
      if (appearance.haptics) void Haptics.selectionAsync();
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [appearance.haptics],
  );

  const enterSelection = useCallback(
    (id: string) => {
      if (appearance.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectionMode(true);
      setSelected(new Set([id]));
    },
    [appearance.haptics],
  );

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelected(new Set());
  }, []);

  const openVault = useCallback(() => {
    if (appearance.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.timing(shutter, { toValue: 1, duration: 240, useNativeDriver: true }).start(() => {
      router.push('/vault');
      setTimeout(() => {
        shutter.setValue(0);
      }, 500);
    });
  }, [appearance.haptics, router, shutter]);

  // Two-finger pinch changes the number of columns.
  const pinchStart = useRef<{ distance: number; columns: number } | null>(null);

  const onTouchStart = (e: { nativeEvent: { touches: { pageX: number; pageY: number }[] } }) => {
    const touches = e.nativeEvent.touches;
    if (touches.length === 2) {
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      pinchStart.current = { distance: Math.hypot(dx, dy), columns };
    }
  };

  const onTouchMove = (e: { nativeEvent: { touches: { pageX: number; pageY: number }[] } }) => {
    const touches = e.nativeEvent.touches;
    if (touches.length !== 2 || !pinchStart.current) return;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    const distance = Math.hypot(dx, dy);
    const ratio = distance / pinchStart.current.distance;
    let next = pinchStart.current.columns;
    if (ratio > 1.35) next = Math.max(2, pinchStart.current.columns - 1);
    else if (ratio < 0.72) next = Math.min(6, pinchStart.current.columns + 1);
    if (next !== columns) {
      pinchStart.current = { distance, columns: next };
      setAppearance((prev) => ({ ...prev, columns: next }));
    }
  };

  const header = (
    <View style={{ paddingTop: insets.top + spacing.sm }}>
      {/* Pull-down strip: drag it down to open the hidden vault. */}
      <View
        style={styles.pullZone}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          pullStart.current = e.nativeEvent.pageY;
          setPulling(true);
        }}
        onResponderMove={(e) => {
          if (pullStart.current === null) return;
          const delta = e.nativeEvent.pageY - pullStart.current;
          if (delta > 70) {
            pullStart.current = null;
            setPulling(false);
            openVault();
          }
        }}
        onResponderRelease={() => {
          pullStart.current = null;
          setPulling(false);
        }}>
        <View style={[styles.grabber, { backgroundColor: pulling ? colors.primary : colors.border }]} />
        <Text style={[styles.pullHint, { color: colors.muted, fontSize: fs(10) }]}>
          {pulling ? 'Release to open vault' : 'Pull down for vault'}
        </Text>
      </View>

      <View style={styles.titleRow}>
        {selectionMode ? (
          <>
            <Pressable onPress={exitSelection} hitSlop={10} style={styles.iconBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
            <Text style={[styles.title, { color: colors.text, fontSize: fs(22), flex: 1 }]}>
              {selected.size} selected
            </Text>
            <Pressable
              onPress={() => setSelected(new Set(visible.map((i) => i.id)))}
              hitSlop={10}
              style={styles.iconBtn}>
              <Ionicons name="checkmark-done" size={22} color={colors.text} />
            </Pressable>
          </>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text, fontSize: fs(26) }]}>NOOK</Text>
              <Text style={[styles.subtitle, { color: colors.muted, fontSize: fs(12) }]}>
                {plural(visible.length, 'item')}
                {trash.length > 0 ? ` · ${trash.length} in trash` : ''}
              </Text>
            </View>
            <Pressable onPress={() => setSearchOpen((v) => !v)} hitSlop={10} style={styles.iconBtn}>
              <Ionicons name="search" size={21} color={colors.text} />
            </Pressable>
            <Pressable onPress={() => router.push('/trash')} hitSlop={10} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={21} color={colors.text} />
              {trash.length > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.badgeText, { color: colors.onPrimary }]}>
                    {trash.length > 99 ? '99+' : trash.length}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable onPress={() => setSelectionMode(true)} hitSlop={10} style={styles.iconBtn}>
              <Ionicons name="ellipsis-horizontal-circle-outline" size={22} color={colors.text} />
            </Pressable>
          </>
        )}
      </View>

      {searchOpen ? (
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your library"
            placeholderTextColor={colors.muted}
            autoFocus
            style={[styles.searchInput, { color: colors.text, fontSize: fs(14) }]}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.chipRow}>
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Photos" selected={filter === 'photos'} onPress={() => setFilter('photos')} />
        <Chip label="Videos" selected={filter === 'videos'} onPress={() => setFilter('videos')} />
        <Chip
          label={sort === 'newest' ? 'Newest' : sort === 'oldest' ? 'Oldest' : 'Largest'}
          onPress={() =>
            setSort((s) => (s === 'newest' ? 'oldest' : s === 'oldest' ? 'largest' : 'newest'))
          }
        />
      </View>

      {onThisDay.length > 0 && !query ? (
        <Pressable
          onPress={() => router.push('/folder/on-this-day')}
          style={[styles.memoryCard, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
          <Ionicons name="sparkles" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.memoryTitle, { color: colors.text, fontSize: fs(14) }]}>
              On this day
            </Text>
            <Text style={[styles.memorySub, { color: colors.muted, fontSize: fs(12) }]}>
              {plural(onThisDay.length, 'memory', 'memories')} from{' '}
              {formatDate(onThisDay[0].creationTime)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.muted, fontSize: fs(13) }]}>
          Reading your library…
        </Text>
      </View>
    );
  }

  if (permission === 'denied' || permission === 'unavailable') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <EmptyState
          icon="images-outline"
          title={permission === 'unavailable' ? 'Gallery not available' : 'NOOK needs your photos'}
          message={
            permission === 'unavailable'
              ? 'This device does not expose a media library to apps.'
              : 'Allow photo access in Settings so NOOK can show your library. Nothing leaves your phone.'
          }
          actionTitle="Try again"
          onAction={() => void load('initial')}
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.root, { backgroundColor: colors.background }]}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={() => {
        pinchStart.current = null;
      }}>
      <FlatList
        key={`grid-${columns}`}
        data={visible}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        ListHeaderComponent={header}
        columnWrapperStyle={columns > 1 ? { gap } : undefined}
        contentContainerStyle={{
          paddingHorizontal: gap,
          paddingBottom: insets.bottom + 96,
          gap,
        }}
        renderItem={({ item }) => (
          <MediaTile
            item={item}
            size={tileSize}
            selected={selected.has(item.id)}
            selectionMode={selectionMode}
            onPress={() => {
              if (selectionMode) toggleSelect(item.id);
              else router.push({ pathname: '/viewer', params: { id: item.id } });
            }}
            onLongPress={() => enterSelection(item.id)}
          />
        )}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={() => {
              setRefreshing(true);
              void load('refresh');
            }}
          />
        }
        ListEmptyComponent={
          error ? (
            <EmptyState
              icon="alert-circle-outline"
              title="Could not load"
              message={error}
              actionTitle="Retry"
              onAction={() => void load('initial')}
            />
          ) : (
            <EmptyState
              icon="images-outline"
              title={query ? 'No matches' : 'Nothing here yet'}
              message={
                query
                  ? 'Try a different search.'
                  : 'Photos and videos you favourite move to Favourites and leave this grid.'
              }
            />
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: spacing.lg }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
      />

      {/* Selection action bar */}
      {selectionMode && selected.size > 0 ? (
        <View
          style={[
            styles.actionBar,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              paddingBottom: insets.bottom + spacing.sm,
            },
          ]}>
          <ActionButton
            icon="heart"
            label="Favourite"
            onPress={() => {
              router.push({ pathname: '/favourites', params: { add: [...selected].join(',') } });
              exitSelection();
            }}
          />
          <ActionButton
            icon="share-outline"
            label="Share"
            onPress={() => {
              router.push({ pathname: '/viewer', params: { id: [...selected][0], share: '1' } });
            }}
          />
          <ActionButton
            icon="trash-outline"
            label="Delete"
            onPress={() => {
              router.push({ pathname: '/trash', params: { add: [...selected].join(',') } });
              exitSelection();
            }}
          />
          <ActionButton
            icon="lock-closed-outline"
            label="Vault"
            onPress={() => {
              router.push({ pathname: '/vault', params: { add: [...selected].join(',') } });
              exitSelection();
            }}
          />
        </View>
      ) : null}

      {/* Shutter that closes over the screen when the vault opens */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.shutter, { opacity: shutter }]}
      />
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors, fs } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.actionBtn} hitSlop={6}>
      <Ionicons name={icon} size={21} color={colors.text} />
      <Text style={[styles.actionLabel, { color: colors.muted, fontSize: fs(10) }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { marginTop: spacing.sm },
  pullZone: { alignItems: 'center', paddingBottom: spacing.sm, gap: 3 },
  grabber: { width: 44, height: 4, borderRadius: 2 },
  pullHint: { letterSpacing: 0.4, textTransform: 'uppercase' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  title: { fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { marginTop: 1 },
  iconBtn: { padding: spacing.sm },
  badge: {
    position: 'absolute',
    top: 2,
    end: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '800' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 42,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, paddingVertical: 0 },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  memoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  memoryTitle: { fontWeight: '700' },
  memorySub: { marginTop: 1 },
  actionBar: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: { alignItems: 'center', gap: 3, paddingHorizontal: spacing.md },
  actionLabel: { fontWeight: '600' },
  shutter: { backgroundColor: '#000' },
});
