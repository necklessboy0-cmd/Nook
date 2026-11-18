import Ionicons from '@expo/vector-icons/Ionicons';
import Slider from '@react-native-community/slider';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { MediaTile } from '@/components/media-tile';
import { Segmented } from '@/components/segmented';
import { Button, EmptyState } from '@/components/ui';
import { spacing, useTheme } from '@/constants/theme';
import {
  DEFAULT_SETTINGS,
  compressItem,
  estimateBytes,
  keepResult,
  targetDimensions,
  type CompressResult,
  type CompressSettings,
  type ResizeMode,
} from '@/lib/compress';
import { formatBytes, formatDuration, plural } from '@/lib/format';
import { loadMediaPage, saveToDevice, type MediaItem } from '@/lib/media';

type Stage = 'pick' | 'configure' | 'working' | 'done';

const PRESETS: { name: string; settings: Partial<CompressSettings> }[] = [
  { name: 'Chat', settings: { targetPx: 1080, quality: 0.62, videoBitrate: 1_500_000, format: 'jpeg' } },
  { name: 'Social', settings: { targetPx: 1440, quality: 0.78, videoBitrate: 3_000_000, format: 'jpeg' } },
  { name: 'HD', settings: { targetPx: 1920, quality: 0.85, videoBitrate: 6_000_000, format: 'jpeg' } },
  { name: 'Archive', settings: { targetPx: 2560, quality: 0.92, videoBitrate: 12_000_000, format: 'jpeg' } },
  { name: '8K', settings: { targetPx: 8192, quality: 0.95, videoBitrate: 40_000_000, format: 'jpeg' } },
];

export default function CompressScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, fs } = useTheme();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>('pick');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<MediaItem[]>([]);
  const [settings, setSettings] = useState<CompressSettings>(DEFAULT_SETTINGS);
  const [filter, setFilter] = useState<'all' | 'photo' | 'video'>('all');

  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState<CompressResult[]>([]);
  const [saved, setSaved] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const page = await loadMediaPage(undefined, 90);
        setItems(page.items);
        setCursor(page.endCursor);
        setHasMore(page.hasMore);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not read your library.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadMore = async () => {
    if (!hasMore || !cursor) return;
    try {
      const page = await loadMediaPage(cursor, 90);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.endCursor);
      setHasMore(page.hasMore);
    } catch {
      setHasMore(false);
    }
  };

  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.mediaType === filter)),
    [items, filter],
  );

  const tile = Math.floor((width - spacing.md * 2 - spacing.xs * 2) / 3);

  const totalOriginal = useMemo(
    () => results.reduce((sum, r) => sum + (r.originalBytes ?? 0), 0),
    [results],
  );
  const totalNew = useMemo(() => results.reduce((sum, r) => sum + r.bytes, 0), [results]);

  const previewItem = selected[0];
  const previewDims = previewItem
    ? targetDimensions(previewItem.width, previewItem.height, settings)
    : null;

  const toggle = (item: MediaItem) => {
    setSelected((prev) =>
      prev.some((p) => p.id === item.id) ? prev.filter((p) => p.id !== item.id) : [...prev, item],
    );
  };

  // Only show the photo controls when photos are in the queue.
  const hasPhotos = selected.length === 0 || selected.some((i) => i.mediaType === 'photo');
  const hasVideos = selected.some((i) => i.mediaType === 'video');

  const run = async () => {
    if (selected.length === 0) return;
    setStage('working');
    setProgress(0);
    setCurrent(0);
    setResults([]);
    setSaved(0);
    setFailure(null);

    const produced: CompressResult[] = [];
    for (let i = 0; i < selected.length; i += 1) {
      const item = selected[i];
      setCurrent(i);
      try {
        const result = await compressItem(item, settings, (p) => setProgress(p));
        produced.push(result);
        setResults([...produced]);
        setProgress(0);
      } catch (e) {
        setFailure(
          `${item.filename}: ${e instanceof Error ? e.message : 'could not be compressed'}`,
        );
      }
    }
    setStage('done');
  };

  const saveAll = async () => {
    let count = 0;
    for (let i = 0; i < results.length; i += 1) {
      const extension = settings.format === 'png' ? 'png' : settings.format === 'webp' ? 'webp' : 'jpg';
      const kept = keepResult(results[i].uri, `nook-${Date.now()}-${i}.${extension}`);
      const ok = await saveToDevice(kept);
      if (ok) count += 1;
    }
    setSaved(count);
  };

  const reset = () => {
    setStage('pick');
    setSelected([]);
    setResults([]);
    setSaved(0);
    setProgress(0);
    setFailure(null);
  };

  if (stage === 'pick') {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={{
            padding: spacing.md,
            paddingTop: insets.top + spacing.md,
            paddingBottom: (selected.length > 0 ? 120 : 40) + insets.bottom,
            gap: spacing.xs,
          }}
          columnWrapperStyle={{ gap: spacing.xs }}
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.sm, gap: spacing.sm }}>
              <Text style={[styles.title, { color: colors.text, fontSize: fs(26) }]}>
                Compress & Resize
              </Text>
              <Text style={[styles.subtitle, { color: colors.muted, fontSize: fs(12) }]}>
                Shrink photos and videos to the exact size you choose. They stay on your phone.
              </Text>
              <View style={styles.chipRow}>
                <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
                <Chip
                  label="Photos"
                  selected={filter === 'photo'}
                  onPress={() => setFilter('photo')}
                />
                <Chip
                  label="Videos"
                  selected={filter === 'video'}
                  onPress={() => setFilter('video')}
                />
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <MediaTile
              item={item}
              size={tile}
              selected={selected.some((x) => x.id === item.id)}
              selectionMode
              onPress={() => toggle(item)}
            />
          )}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.6}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
            ) : (
              <EmptyState
                icon={error ? 'alert-circle-outline' : 'images-outline'}
                title={error ? 'Could not load' : 'Nothing to compress'}
                message={error ?? 'Your library is empty, or access was not granted.'}
              />
            )
          }
        />

        {selected.length > 0 ? (
          <View
            style={[
              styles.bar,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                paddingBottom: insets.bottom + spacing.sm,
              },
            ]}>
            <Text style={[styles.barText, { color: colors.text, fontSize: fs(13) }]}>
              {plural(selected.length, 'item')} selected
            </Text>
            <View style={{ flex: 1 }} />
            <Button title="Configure" icon="options-outline" onPress={() => setStage('configure')} />
          </View>
        ) : null}
      </View>
    );
  }

  if (stage === 'configure') {
    return (
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{
          padding: spacing.md,
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + 40,
          gap: spacing.md,
        }}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => setStage('pick')} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text, fontSize: fs(20) }]}>Settings</Text>
          <View style={{ width: 24 }} />
        </View>

        {previewItem ? (
          <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Image source={{ uri: previewItem.uri }} style={styles.previewImage} contentFit="cover" />
            <View style={{ flex: 1, gap: 3 }}>
              <Text
                style={[styles.previewName, { color: colors.text, fontSize: fs(13) }]}
                numberOfLines={1}>
                {previewItem.filename}
              </Text>
              <Text style={[styles.previewMeta, { color: colors.muted, fontSize: fs(11) }]}>
                {previewItem.width}×{previewItem.height}
                {previewItem.mediaType === 'video' ? ` · ${formatDuration(previewItem.duration)}` : ''}
              </Text>
              {previewDims ? (
                <Text style={[styles.previewMeta, { color: colors.primary, fontSize: fs(11) }]}>
                  → {previewDims.width}×{previewDims.height} px
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <Section title="Presets" colors={colors} fs={fs}>
          <View style={styles.chipRow}>
            {PRESETS.map((preset) => (
              <Chip
                key={preset.name}
                label={preset.name}
                onPress={() => setSettings((prev) => ({ ...prev, ...preset.settings }))}
              />
            ))}
          </View>
        </Section>

        <Section title="Resize by" colors={colors} fs={fs}>
          <Segmented
            options={[
              { value: 'longest', label: 'Longest' },
              { value: 'width', label: 'Width' },
              { value: 'height', label: 'Height' },
              { value: 'percent', label: '%' },
            ]}
            value={settings.resizeMode}
            onChange={(resizeMode: ResizeMode) => setSettings((prev) => ({ ...prev, resizeMode }))}
          />
        </Section>

        <Section
          title={settings.resizeMode === 'percent' ? 'Scale' : 'Target size'}
          value={
            settings.resizeMode === 'percent' ? `${settings.targetPx}%` : `${settings.targetPx} px`
          }
          colors={colors}
          fs={fs}>
          <Slider
            minimumValue={settings.resizeMode === 'percent' ? 10 : 240}
            maximumValue={settings.resizeMode === 'percent' ? 100 : 8192}
            step={settings.resizeMode === 'percent' ? 5 : 40}
            value={settings.targetPx}
            onValueChange={(targetPx) => setSettings((prev) => ({ ...prev, targetPx }))}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
          />
          <Text style={[styles.hint, { color: colors.muted, fontSize: fs(11) }]}>
            Up to 8192 px keeps 8K detail. NOOK only ever shrinks, never enlarges.
          </Text>
        </Section>

        <SettingRow
          label="Keep original dimensions"
          hint="Re-encode at the same pixel size, smaller file only"
          value={settings.keepDimensions}
          onToggle={() => setSettings((p) => ({ ...p, keepDimensions: !p.keepDimensions }))}
          colors={colors}
          fs={fs}
        />

        {hasPhotos ? (
          <>
            <Section
              title="Photo quality"
              value={`${Math.round(settings.quality * 100)}%`}
              colors={colors}
              fs={fs}>
              <Slider
                minimumValue={0.1}
                maximumValue={1}
                step={0.02}
                value={settings.quality}
                onValueChange={(quality) => setSettings((prev) => ({ ...prev, quality }))}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
            </Section>
            <Section title="Photo format" colors={colors} fs={fs}>
              <Segmented
                options={[
                  { value: 'jpeg', label: 'JPEG' },
                  { value: 'webp', label: 'WebP' },
                  { value: 'png', label: 'PNG' },
                ]}
                value={settings.format}
                onChange={(format) => setSettings((prev) => ({ ...prev, format }))}
              />
            </Section>
          </>
        ) : null}

        {hasVideos ? (
          <>
            <Section
              title="Video bitrate"
              value={`${(settings.videoBitrate / 1_000_000).toFixed(1)} Mbps`}
              colors={colors}
              fs={fs}>
              <Slider
                minimumValue={400_000}
                maximumValue={40_000_000}
                step={200_000}
                value={settings.videoBitrate}
                onValueChange={(videoBitrate) => setSettings((prev) => ({ ...prev, videoBitrate }))}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
              <Text style={[styles.hint, { color: colors.muted, fontSize: fs(11) }]}>
                About {formatBytes((settings.videoBitrate / 8) * 60)} per minute of video
              </Text>
            </Section>
            <SettingRow
              label="Remove audio"
              hint="Muted videos are usually far smaller"
              value={settings.stripAudio}
              onToggle={() => setSettings((p) => ({ ...p, stripAudio: !p.stripAudio }))}
              colors={colors}
              fs={fs}
            />
          </>
        ) : null}

        <Button
          title={`Compress ${plural(selected.length, 'item')}`}
          icon="contract-outline"
          onPress={() => void run()}
        />
      </ScrollView>
    );
  }

  if (stage === 'working') {
    const overall =
      (current + (selected[current]?.mediaType === 'video' ? progress : 0)) /
      Math.max(1, selected.length);
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: spacing.lg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text
          style={[styles.title, { color: colors.text, fontSize: fs(18), marginTop: spacing.md }]}>
          Compressing {Math.min(current + 1, selected.length)} of {selected.length}
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted, fontSize: fs(12) }]}>
          {selected[current]?.mediaType === 'video'
            ? `Video · ${Math.round(progress * 100)}%`
            : 'Photo'}
        </Text>
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.primary, width: `${Math.round(overall * 100)}%` },
            ]}
          />
        </View>
        <Text style={[styles.hint, { color: colors.muted, fontSize: fs(11), textAlign: 'center' }]}>
          Keep NOOK open while a video is encoding. Large 4K or 8K files take a while.
        </Text>
      </View>
    );
  }

  const savedRatio = totalOriginal > 0 ? Math.max(0, 1 - totalNew / totalOriginal) : 0;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: spacing.md,
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + 40,
        gap: spacing.md,
      }}>
      <Text style={[styles.title, { color: colors.text, fontSize: fs(24) }]}>Compressed</Text>

      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={[styles.summaryLabel, { color: colors.muted, fontSize: fs(11) }]}>Before</Text>
            <Text style={[styles.summaryValue, { color: colors.text, fontSize: fs(18) }]}>
              {formatBytes(totalOriginal)}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={colors.muted} />
          <View>
            <Text style={[styles.summaryLabel, { color: colors.muted, fontSize: fs(11) }]}>After</Text>
            <Text style={[styles.summaryValue, { color: colors.primary, fontSize: fs(18) }]}>
              {formatBytes(totalNew)}
            </Text>
          </View>
        </View>
        {totalOriginal > 0 ? (
          <Text style={[styles.savedText, { color: colors.success, fontSize: fs(13) }]}>
            Saved {Math.round(savedRatio * 100)}% ({formatBytes(totalOriginal - totalNew)})
          </Text>
        ) : null}
        <Text style={[styles.hint, { color: colors.muted, fontSize: fs(11) }]}>
          {plural(results.length, 'file')} compressed
        </Text>
      </View>

      {failure ? (
        <View style={[styles.warnCard, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
          <Ionicons name="warning-outline" size={16} color={colors.warning} />
          <Text style={[styles.hint, { color: colors.text, fontSize: fs(12), flex: 1 }]}>{failure}</Text>
        </View>
      ) : null}

      {results.map((result, index) => (
        <View
          key={`${result.uri}-${index}`}
          style={[styles.resultRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Image source={{ uri: result.uri }} style={styles.resultThumb} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.previewName, { color: colors.text, fontSize: fs(13) }]}>
              {result.width}×{result.height}
            </Text>
            <Text style={[styles.previewMeta, { color: colors.muted, fontSize: fs(11) }]}>
              {formatBytes(result.originalBytes)} → {formatBytes(result.bytes)}
            </Text>
          </View>
          {result.originalBytes && result.bytes > 0 ? (
            <Text
              style={[styles.previewMeta, { color: colors.success, fontSize: fs(12), fontWeight: '700' }]}>
              -{Math.round(Math.max(0, 1 - result.bytes / result.originalBytes) * 100)}%
            </Text>
          ) : null}
        </View>
      ))}

      {saved > 0 ? (
        <View style={[styles.warnCard, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={[styles.hint, { color: colors.text, fontSize: fs(12), flex: 1 }]}>
            {plural(saved, 'file')} saved to your phone's gallery.
          </Text>
        </View>
      ) : null}

      {results.length > 0 && saved === 0 ? (
        <Button title="Save all to gallery" icon="download-outline" onPress={() => void saveAll()} />
      ) : null}
      <Button title="Compress more" variant="secondary" onPress={reset} />
    </ScrollView>
  );
}

function Section({
  title,
  value,
  children,
  colors,
  fs,
}: {
  title: string;
  value?: string;
  children: React.ReactNode;
  colors: { text: string; muted: string };
  fs: (n: number) => number;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(13) }]}>{title}</Text>
        {value ? (
          <Text style={[styles.sectionTitle, { color: colors.muted, fontSize: fs(13) }]}>{value}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function SettingRow({
  label,
  hint,
  value,
  onToggle,
  colors,
  fs,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onToggle: () => void;
  colors: { text: string; muted: string; primary: string; onPrimary: string; border: string };
  fs: (n: number) => number;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.settingRow} hitSlop={4}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: fs(13), fontWeight: '600' }}>{label}</Text>
        {hint ? (
          <Text style={{ color: colors.muted, fontSize: fs(11), marginTop: 1 }}>{hint}</Text>
        ) : null}
      </View>
      <View
        style={[
          styles.switch,
          {
            backgroundColor: value ? colors.primary : colors.border,
            alignItems: value ? 'flex-end' : 'flex-start',
          },
        ]}>
        <View style={[styles.knob, { backgroundColor: value ? colors.onPrimary : '#FFFFFF' }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  title: { fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { lineHeight: 17 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  bar: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  barText: { fontWeight: '600' },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  previewImage: { width: 62, height: 62, borderRadius: 10 },
  previewName: { fontWeight: '700' },
  previewMeta: { marginTop: 1 },
  sectionTitle: { fontWeight: '700' },
  hint: { lineHeight: 15 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  switch: { width: 44, height: 26, borderRadius: 13, justifyContent: 'center', padding: 3 },
  knob: { width: 20, height: 20, borderRadius: 10 },
  progressTrack: { height: 6, borderRadius: 3, width: '100%', marginVertical: spacing.md },
  progressFill: { height: 6, borderRadius: 3 },
  summaryCard: {
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { textTransform: 'uppercase', letterSpacing: 0.6 },
  summaryValue: { fontWeight: '800', marginTop: 2 },
  savedText: { fontWeight: '700' },
  warnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  resultThumb: { width: 46, height: 46, borderRadius: 8 },
});
