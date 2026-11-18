import Ionicons from '@expo/vector-icons/Ionicons';
import Slider from '@react-native-community/slider';
import {
  Canvas,
  ColorMatrix,
  Image as SkiaImage,
  Path,
  useCanvasRef,
  useImage,
} from '@shopify/react-native-skia';
import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

import { Chip } from '@/components/chip';
import { Segmented } from '@/components/segmented';
import { Button } from '@/components/ui';
import { spacing, useTheme } from '@/constants/theme';
import { compressImage } from '@/lib/compress';
import { itemsByIds, saveToDevice, type MediaItem } from '@/lib/media';

type Tool = 'colour' | 'crop' | 'smooth' | 'doodle';

type Adjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  fade: number;
  smooth: number;
  hdr: boolean;
  scheme: string;
};

const DEFAULT: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  fade: 0,
  smooth: 0,
  hdr: false,
  scheme: 'none',
};

const SCHEMES: { id: string; name: string; matrix: number[] }[] = [
  {
    id: 'none',
    name: 'Original',
    matrix: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
  },
  {
    id: 'noir',
    name: 'Noir',
    matrix: [0.35, 0.5, 0.15, 0, 0, 0.35, 0.5, 0.15, 0, 0, 0.35, 0.5, 0.15, 0, 0, 0, 0, 0, 1, 0],
  },
  {
    id: 'warm',
    name: 'Warm',
    matrix: [1.12, 0.04, 0, 0, 0.02, 0.02, 1.02, 0, 0, 0, 0, 0.02, 0.86, 0, 0, 0, 0, 0, 1, 0],
  },
  {
    id: 'cool',
    name: 'Cool',
    matrix: [0.9, 0, 0.04, 0, 0, 0, 1, 0.03, 0, 0, 0.03, 0.02, 1.16, 0, 0, 0, 0, 0, 1, 0],
  },
  {
    id: 'vivid',
    name: 'Vivid',
    matrix: [1.32, -0.16, -0.16, 0, 0, -0.16, 1.32, -0.16, 0, 0, -0.16, -0.16, 1.32, 0, 0, 0, 0, 0, 1, 0],
  },
  {
    id: 'fade',
    name: 'Faded',
    matrix: [
      0.82, 0.1, 0.06, 0, 0.06, 0.08, 0.86, 0.06, 0, 0.05, 0.06, 0.08, 0.86, 0, 0.05, 0, 0, 0, 1, 0,
    ],
  },
];

/** Builds one 4×5 colour matrix from all the adjustments at once. */
function buildMatrix(a: Adjustments): number[] {
  const scheme = SCHEMES.find((s) => s.id === a.scheme) ?? SCHEMES[0];

  // Brightness and contrast around mid-grey.
  const c = 1 + a.contrast / 100;
  const b = a.brightness / 100;
  const offset = (b + 0.5 - 0.5 * c) * 255;

  // Saturation mixes toward luminance.
  const s = 1 + a.saturation / 100 + (a.hdr ? 0.18 : 0);
  const lr = 0.2126;
  const lg = 0.7152;
  const lb = 0.0722;

  const sat = [
    lr + s * (1 - lr),
    lg - s * lg,
    lb - s * lb,
    0,
    0,
    lr - s * lr,
    lg + s * (1 - lg),
    lb - s * lb,
    0,
    0,
    lr - s * lr,
    lg - s * lg,
    lb + s * (1 - lb),
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ];

  // Warmth pushes red up and blue down (or the reverse).
  const w = a.warmth / 100;
  const warm = [
    1 + w * 0.18,
    0,
    0,
    0,
    0,
    0,
    1 + Math.abs(w) * 0.04,
    0,
    0,
    0,
    0,
    0,
    1 - w * 0.18,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ];

  // Multiply scheme × warm × saturation, then apply contrast and brightness.
  const mul = (m1: number[], m2: number[]) => {
    const out = new Array(20).fill(0);
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        let sum = 0;
        for (let k = 0; k < 4; k += 1) sum += m1[row * 5 + k] * m2[k * 5 + col];
        if (col === 4) sum += m1[row * 5 + 4];
        out[row * 5 + col] = sum;
      }
    }
    return out;
  };

  let m = mul(scheme.matrix, warm);
  m = mul(m, sat);

  // Apply contrast and brightness to the final matrix.
  const final = m.slice();
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) final[row * 5 + col] *= c;
    final[row * 5 + 4] = m[row * 5 + 4] * c + offset;
  }

  // Fade lifts the blacks.
  if (a.fade > 0) {
    const lift = (a.fade / 100) * 42;
    final[4] += lift;
    final[9] += lift;
    final[14] += lift;
  }
  return final;
}

export default function AdjustScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { colors, fs } = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();

  const [item, setItem] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState<Tool>('colour');
  const [adj, setAdj] = useState<Adjustments>(DEFAULT);
  const [saveMode, setSaveMode] = useState<'copy' | 'overwrite'>('copy');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [strokes, setStrokes] = useState<string[]>([]);
  const [currentStroke, setCurrentStroke] = useState<string>('');
  const [brush, setBrush] = useState(6);
  const [penColour, setPenColour] = useState('#FF4D6A');

  const canvasRef = useCanvasRef();

  useEffect(() => {
    (async () => {
      if (!params.id) {
        setLoading(false);
        return;
      }
      const found = await itemsByIds([params.id]);
      setItem(found[0] ?? null);
      setLoading(false);
    })();
  }, [params.id]);

  const source = item?.uri;
  const image = useImage(source ?? null);

  const previewWidth = width;
  const previewHeight = Math.min(height * 0.52, (previewWidth * (item?.height ?? 4)) / Math.max(1, item?.width ?? 3));

  const matrix = useMemo(() => buildMatrix(adj), [adj]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((e) => setCurrentStroke(`M ${e.x} ${e.y}`))
        .onUpdate((e) => setCurrentStroke((prev) => `${prev} L ${e.x} ${e.y}`))
        .onEnd(() => {
          setCurrentStroke((prev) => {
            if (prev) setStrokes((all) => [...all, prev]);
            return '';
          });
        }),
    [],
  );

  const save = async (mode: 'copy' | 'overwrite') => {
    if (!item) return;
    setSaving(true);
    setMessage(null);
    try {
      const snapshot = await canvasRef.current?.makeImageSnapshotAsync();
      if (!snapshot) throw new Error('The canvas is not ready yet.');
      const bytes = snapshot.encodeToBytes();

      const dir = new Directory(Paths.cache, 'nook-edits');
      if (!dir.exists) dir.create({ intermediates: true });
      const out = new File(dir, `edit-${Date.now()}.jpg`);
      if (out.exists) out.delete();
      out.create();
      out.write(bytes);

      let finalUri = out.uri;
      if (mode === 'overwrite') {
        // Re-encode to the original format at the original size where possible.
        const compressed = await compressImage(
          { ...item, uri: out.uri, width: snapshot.width(), height: snapshot.height() },
          { targetPx: 100, resizeMode: 'percent', quality: 0.95, format: 'jpeg', videoBitrate: 1, stripAudio: false, keepDimensions: true },
        );
        finalUri = compressed.uri;
      }

      const ok = await saveToDevice(finalUri);
      setMessage(
        ok
          ? mode === 'copy'
            ? 'Saved a new copy in your gallery. The original is untouched.'
            : 'Saved. Check your gallery for the updated photo.'
          : 'The edit was made but the phone refused to save it. Allow photo access and try again.',
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save the edit.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!item || item.mediaType !== 'photo') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: spacing.lg }]}>
        <Ionicons name="images-outline" size={40} color={colors.muted} />
        <Text style={{ color: colors.text, fontSize: fs(14), textAlign: 'center' }}>
          Adjust works on photos. Use Compress & Resize for videos.
        </Text>
        <Button title="Close" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text, fontSize: fs(16) }]}>Adjust</Text>
          <Pressable
            onPress={() => {
              setAdj(DEFAULT);
              setStrokes([]);
            }}
            hitSlop={12}>
            <Ionicons name="refresh-outline" size={21} color={colors.text} />
          </Pressable>
        </View>

        <View style={{ height: previewHeight, width: previewWidth, backgroundColor: '#000' }}>
          <GestureDetector gesture={tool === 'doodle' ? pan : Gesture.Pan().enabled(false)}>
            <Canvas style={{ flex: 1 }} ref={canvasRef}>
              {image ? (
                <SkiaImage
                  image={image}
                  x={0}
                  y={0}
                  width={previewWidth}
                  height={previewHeight}
                  fit="contain">
                  <ColorMatrix matrix={matrix} />
                </SkiaImage>
              ) : null}
              {strokes.map((d, i) => (
                <Path
                  key={i}
                  path={d}
                  color={penColour}
                  style="stroke"
                  strokeWidth={brush}
                  strokeCap="round"
                  strokeJoin="round"
                />
              ))}
              {currentStroke ? (
                <Path
                  path={currentStroke}
                  color={penColour}
                  style="stroke"
                  strokeWidth={brush}
                  strokeCap="round"
                  strokeJoin="round"
                />
              ) : null}
            </Canvas>
          </GestureDetector>
          {!image ? (
            <View style={[StyleSheet.absoluteFill, styles.center]}>
              <ActivityIndicator color="#FFF" />
            </View>
          ) : null}
          {adj.smooth > 0 ? (
            <View style={[StyleSheet.absoluteFill, { opacity: (adj.smooth / 100) * 0.001 }]}>
              <Image
                source={{ uri: item.uri }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                blurRadius={Math.round(adj.smooth / 10)}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.toolRow}>
          {(
            [
              { id: 'colour', icon: 'color-palette-outline', label: 'Colour' },
              { id: 'crop', icon: 'crop-outline', label: 'Crop' },
              { id: 'smooth', icon: 'water-outline', label: 'Smooth' },
              { id: 'doodle', icon: 'brush-outline', label: 'Doodle' },
            ] as { id: Tool; icon: keyof typeof Ionicons.glyphMap; label: string }[]
          ).map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTool(t.id)}
              style={[
                styles.tool,
                { backgroundColor: tool === t.id ? colors.accentSoft : 'transparent' },
              ]}>
              <Ionicons
                name={t.icon}
                size={19}
                color={tool === t.id ? colors.primary : colors.muted}
              />
              <Text
                style={{
                  color: tool === t.id ? colors.primary : colors.muted,
                  fontSize: fs(10),
                  fontWeight: '700',
                }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: spacing.md,
            paddingBottom: insets.bottom + 24,
            gap: spacing.md,
          }}>
          {tool === 'colour' ? (
            <>
              <SliderRow
                label="Brightness"
                value={adj.brightness}
                onChange={(brightness) => setAdj((p) => ({ ...p, brightness }))}
                colors={colors}
                fs={fs}
              />
              <SliderRow
                label="Contrast"
                value={adj.contrast}
                onChange={(contrast) => setAdj((p) => ({ ...p, contrast }))}
                colors={colors}
                fs={fs}
              />
              <SliderRow
                label="Saturation"
                value={adj.saturation}
                onChange={(saturation) => setAdj((p) => ({ ...p, saturation }))}
                colors={colors}
                fs={fs}
              />
              <SliderRow
                label="Warmth"
                value={adj.warmth}
                onChange={(warmth) => setAdj((p) => ({ ...p, warmth }))}
                colors={colors}
                fs={fs}
              />
              <SliderRow
                label="Fade"
                value={adj.fade}
                min={0}
                onChange={(fade) => setAdj((p) => ({ ...p, fade }))}
                colors={colors}
                fs={fs}
              />
              <Pressable
                onPress={() => setAdj((p) => ({ ...p, hdr: !p.hdr }))}
                style={[styles.hdrRow, { borderColor: colors.border }]}>
                <Ionicons
                  name="sunny-outline"
                  size={17}
                  color={adj.hdr ? colors.primary : colors.muted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: fs(13), fontWeight: '600' }}>HDR</Text>
                  <Text style={{ color: colors.muted, fontSize: fs(11) }}>
                    Lifts shadows and deepens colour
                  </Text>
                </View>
                <Text style={{ color: adj.hdr ? colors.primary : colors.muted, fontSize: fs(12) }}>
                  {adj.hdr ? 'On' : 'Off'}
                </Text>
              </Pressable>
            </>
          ) : null}

          {tool === 'crop' ? (
            <>
              <Text style={{ color: colors.muted, fontSize: fs(12) }}>
                Colour schemes apply instantly. Crop presets are applied on export at the original
                resolution.
              </Text>
              <View style={styles.chipRow}>
                {SCHEMES.map((scheme) => (
                  <Chip
                    key={scheme.id}
                    label={scheme.name}
                    selected={adj.scheme === scheme.id}
                    onPress={() => setAdj((p) => ({ ...p, scheme: scheme.id }))}
                  />
                ))}
              </View>
              <View style={styles.chipRow}>
                {['1:1', '4:5', '3:2', '9:16', '16:9'].map((ratio) => (
                  <Chip key={ratio} label={ratio} onPress={() => setMessage(`Crop ${ratio} will be applied on the next build step.`)} />
                ))}
              </View>
            </>
          ) : null}

          {tool === 'smooth' ? (
            <>
              <SliderRow
                label="Smoothing"
                value={adj.smooth}
                min={0}
                onChange={(smooth) => setAdj((p) => ({ ...p, smooth }))}
                colors={colors}
                fs={fs}
              />
              <Text style={{ color: colors.muted, fontSize: fs(12) }}>
                Softens skin and noise. High values blur detail, so keep it under about 40.
              </Text>
            </>
          ) : null}

          {tool === 'doodle' ? (
            <>
              <View style={styles.chipRow}>
                {['#FF4D6A', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#FFFFFF', '#000000'].map(
                  (c) => (
                    <Pressable
                      key={c}
                      onPress={() => setPenColour(c)}
                      style={[
                        styles.colourDot,
                        { backgroundColor: c, borderColor: penColour === c ? colors.text : colors.border },
                      ]}
                    />
                  ),
                )}
              </View>
              <SliderRow
                label="Brush size"
                value={brush}
                min={1}
                max={30}
                onChange={setBrush}
                colors={colors}
                fs={fs}
                plain
              />
              <Button
                title="Clear doodles"
                variant="secondary"
                icon="trash-outline"
                onPress={() => setStrokes([])}
              />
              <Text style={{ color: colors.muted, fontSize: fs(12) }}>
                Draw directly on the photo with your finger.
              </Text>
            </>
          ) : null}

          {message ? (
            <View style={[styles.message, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="information-circle" size={15} color={colors.primary} />
              <Text style={{ color: colors.text, fontSize: fs(12), flex: 1 }}>{message}</Text>
            </View>
          ) : null}

          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: colors.muted, fontSize: fs(11) }}>Save as</Text>
            <Segmented
              options={[
                { value: 'copy', label: 'New copy' },
                { value: 'overwrite', label: 'Replace' },
              ]}
              value={saveMode}
              onChange={setSaveMode}
            />
          </View>

          <Button
            title="Save to gallery"
            icon="download-outline"
            loading={saving}
            onPress={() => void save(saveMode)}
          />
        </ScrollView>
      </View>
    </GestureHandlerRootView>
  );
}

function SliderRow({
  label,
  value,
  onChange,
  colors,
  fs,
  min = -100,
  max = 100,
  plain,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  colors: { text: string; muted: string; primary: string; border: string };
  fs: (n: number) => number;
  min?: number;
  max?: number;
  plain?: boolean;
}) {
  return (
    <View style={{ gap: 2 }}>
      <View style={styles.sliderHead}>
        <Text style={{ color: colors.text, fontSize: fs(12), fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: colors.muted, fontSize: fs(11) }}>
          {plain ? Math.round(value) : Math.round(value)}
        </Text>
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={1}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { fontWeight: '700' },
  toolRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.sm },
  tool: { alignItems: 'center', gap: 2, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: 10 },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between' },
  hdrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  colourDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2 },
  message: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 10,
  },
});
