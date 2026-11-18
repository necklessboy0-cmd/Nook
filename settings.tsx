import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { Segmented } from '@/components/segmented';
import { Button, ConfirmDialog } from '@/components/ui';
import {
  ACCENTS,
  ACCENT_IDS,
  DEFAULT_APPEARANCE,
  spacing,
  useTheme,
  type AccentId,
  type ThemeMode,
  type TileShape,
} from '@/constants/theme';
import { plural } from '@/lib/format';
import { useAppearance, useFolders, useTrash, useVault } from '@/lib/store';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, appearance, fs, scheme } = useTheme();
  const [, setAppearance] = useAppearance();
  const [folders] = useFolders();
  const [trash] = useTrash();
  const [vault] = useVault();

  const [confirmReset, setConfirmReset] = useState(false);

  const update = (patch: Partial<typeof appearance>) =>
    setAppearance((prev) => ({ ...prev, ...patch }));

  const favouriteCount = folders.reduce((sum, f) => sum + f.items.length, 0);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: spacing.md,
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + 40,
        gap: spacing.lg,
      }}>
      <View style={{ gap: 2 }}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(26) }]}>Settings</Text>
        <Text style={[styles.sub, { color: colors.muted, fontSize: fs(12) }]}>
          Make NOOK look and behave the way you want.
        </Text>
      </View>

      {/* ---------- Appearance ---------- */}
      <Group title="Appearance" colors={colors} fs={fs}>
        <Row label="Theme" colors={colors} fs={fs}>
          <Segmented
            options={[
              { value: 'system', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={appearance.mode}
            onChange={(mode: ThemeMode) => update({ mode })}
          />
        </Row>

        <Row label="Accent colour" colors={colors} fs={fs}>
          <View style={styles.swatchRow}>
            {ACCENT_IDS.map((id: AccentId) => {
              const active = appearance.accent === id;
              const swatch = ACCENTS[id][scheme];
              return (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={ACCENTS[id].name}
                  accessibilityState={{ selected: active }}
                  onPress={() => update({ accent: id })}
                  style={[
                    styles.swatch,
                    { backgroundColor: swatch, borderColor: active ? colors.text : 'transparent' },
                  ]}>
                  {active ? (
                    <Ionicons
                      name="checkmark"
                      size={15}
                      color={scheme === 'dark' ? '#0A0A0C' : '#FFFFFF'}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.hint, { color: colors.muted, fontSize: fs(11) }]}>
            {ACCENTS[appearance.accent].name}
          </Text>
        </Row>

        <Row label="Tile shape" colors={colors} fs={fs}>
          <Segmented
            options={[
              { value: 'square', label: 'Square' },
              { value: 'rounded', label: 'Rounded' },
              { value: 'circle', label: 'Circle' },
            ]}
            value={appearance.tileShape}
            onChange={(tileShape: TileShape) => update({ tileShape })}
          />
        </Row>

        <Row label="Grid columns" value={`${appearance.columns}`} colors={colors} fs={fs}>
          <View style={styles.chipRow}>
            {[2, 3, 4, 5, 6].map((n) => (
              <Chip
                key={n}
                label={`${n}`}
                selected={appearance.columns === n}
                onPress={() => update({ columns: n })}
              />
            ))}
          </View>
          <Text style={[styles.hint, { color: colors.muted, fontSize: fs(11) }]}>
            You can also pinch the gallery to change this.
          </Text>
        </Row>

        <Row label="Corner radius" value={`${appearance.radius} px`} colors={colors} fs={fs}>
          <View style={styles.chipRow}>
            {[0, 6, 10, 14, 20, 26].map((r) => (
              <Chip
                key={r}
                label={`${r}`}
                selected={appearance.radius === r}
                onPress={() => update({ radius: r })}
              />
            ))}
          </View>
        </Row>

        <Row
          label="Text size"
          value={`${Math.round(appearance.fontScale * 100)}%`}
          colors={colors}
          fs={fs}>
          <View style={styles.chipRow}>
            {[0.9, 1, 1.1, 1.25].map((scale) => (
              <Chip
                key={scale}
                label={`${Math.round(scale * 100)}%`}
                selected={appearance.fontScale === scale}
                onPress={() => update({ fontScale: scale })}
              />
            ))}
          </View>
          <Text style={{ color: colors.text, fontSize: fs(15), marginTop: spacing.xs }}>
            Preview text at {Math.round(appearance.fontScale * 100)}%
          </Text>
        </Row>

        <Toggle
          label="Compact grid"
          hint="Tighter spacing, more on screen"
          value={appearance.compact}
          onChange={(compact) => update({ compact })}
          colors={colors}
          fs={fs}
        />
        <Toggle
          label="Video length badges"
          value={appearance.showBadges}
          onChange={(showBadges) => update({ showBadges })}
          colors={colors}
          fs={fs}
        />
        <Toggle
          label="Haptic feedback"
          hint="A small vibration on selection"
          value={appearance.haptics}
          onChange={(haptics) => update({ haptics })}
          colors={colors}
          fs={fs}
        />
      </Group>

      {/* ---------- Vault ---------- */}
      <Group title="Hidden vault" colors={colors} fs={fs}>
        <Pressable onPress={() => router.push('/vault')} style={styles.linkRow}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
          <Text style={[styles.linkText, { color: colors.text, fontSize: fs(13) }]}>
            Open the vault
          </Text>
          <Text style={[styles.hint, { color: colors.muted, fontSize: fs(11) }]}>
            {plural(vault.length, 'item')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
        <Text style={[styles.hint, { color: colors.muted, fontSize: fs(11) }]}>
          Pull down from the top of the gallery to reach the vault. Protect it with a PIN and your
          fingerprint on the vault screen.
        </Text>
      </Group>

      {/* ---------- Storage ---------- */}
      <Group title="Storage" colors={colors} fs={fs}>
        <StatRow
          label="Favourites"
          value={`${plural(favouriteCount, 'item')} in ${plural(folders.length, 'folder')}`}
          colors={colors}
          fs={fs}
        />
        <StatRow label="Vault" value={plural(vault.length, 'item')} colors={colors} fs={fs} />
        <Pressable onPress={() => router.push('/trash')} style={styles.linkRow}>
          <Ionicons name="trash-outline" size={18} color={colors.primary} />
          <Text style={[styles.linkText, { color: colors.text, fontSize: fs(13) }]}>Trash</Text>
          <Text style={[styles.hint, { color: colors.muted, fontSize: fs(11) }]}>
            {plural(trash.length, 'item')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
        <Text style={[styles.hint, { color: colors.muted, fontSize: fs(11) }]}>
          Deleted items are kept for 30 days and then removed automatically.
        </Text>
      </Group>

      {/* ---------- About ---------- */}
      <Group title="About" colors={colors} fs={fs}>
        <Pressable onPress={() => router.push('/about')} style={styles.linkRow}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <Text style={[styles.linkText, { color: colors.text, fontSize: fs(13) }]}>About NOOK</Text>
          <Text style={[styles.hint, { color: colors.muted, fontSize: fs(11) }]}>
            v{Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
      </Group>

      <Button
        title="Reset appearance"
        variant="secondary"
        icon="refresh-outline"
        onPress={() => setConfirmReset(true)}
      />

      <ConfirmDialog
        visible={confirmReset}
        title="Reset appearance?"
        message="Theme, accent, grid and text settings return to their defaults. Your photos, folders and vault are untouched."
        confirmTitle="Reset"
        cancelTitle="Cancel"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setAppearance(DEFAULT_APPEARANCE);
          setConfirmReset(false);
        }}
      />
    </ScrollView>
  );
}

function Group({
  title,
  children,
  colors,
  fs,
}: {
  title: string;
  children: React.ReactNode;
  colors: { text: string };
  fs: (n: number) => number;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[styles.groupTitle, { color: colors.text, fontSize: fs(12) }]}>
        {title.toUpperCase()}
      </Text>
      <View style={{ gap: spacing.md }}>{children}</View>
    </View>
  );
}

function Row({
  label,
  value,
  children,
  colors,
  fs,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
  colors: { text: string; muted: string };
  fs: (n: number) => number;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={styles.rowHead}>
        <Text style={{ color: colors.text, fontSize: fs(13), fontWeight: '600' }}>{label}</Text>
        {value ? <Text style={{ color: colors.muted, fontSize: fs(12) }}>{value}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
  colors,
  fs,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  colors: { text: string; muted: string; primary: string; onPrimary: string; border: string };
  fs: (n: number) => number;
}) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggleRow} hitSlop={4}>
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

function StatRow({
  label,
  value,
  colors,
  fs,
}: {
  label: string;
  value: string;
  colors: { text: string; muted: string };
  fs: (n: number) => number;
}) {
  return (
    <View style={styles.rowHead}>
      <Text style={{ color: colors.text, fontSize: fs(13), fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: colors.muted, fontSize: fs(12) }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: '800', letterSpacing: -0.5 },
  sub: { marginTop: 1 },
  groupTitle: { fontWeight: '800', letterSpacing: 1.1 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  swatchRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { lineHeight: 15 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switch: { width: 44, height: 26, borderRadius: 13, justifyContent: 'center', padding: 3 },
  knob: { width: 20, height: 20, borderRadius: 10 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  linkText: { flex: 1, fontWeight: '600' },
});
