import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ConfirmDialog, EmptyState } from '@/components/ui';
import { spacing, useTheme } from '@/constants/theme';
import { daysLeft, formatDateTime, plural } from '@/lib/format';
import { deleteFromDevice, itemsByIds } from '@/lib/media';
import { TRASH_DAYS, purgeExpired, toSaved, useTrash, type TrashEntry } from '@/lib/store';

export default function TrashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, fs } = useTheme();
  const params = useLocalSearchParams<{ add?: string }>();

  const [trash, setTrash] = useTrash();
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmDeleteDevice, setConfirmDeleteDevice] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Purge anything past its 30 days, then take in newly deleted items.
  useEffect(() => {
    setTrash((prev) => purgeExpired(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!params.add) return;
    (async () => {
      const found = await itemsByIds(params.add!.split(',').filter(Boolean));
      const now = Date.now();
      setTrash((prev) => {
        const existing = new Set(prev.map((t) => t.id));
        const additions: TrashEntry[] = found
          .filter((item) => !existing.has(item.id))
          .map((item) => ({
            ...toSaved(item),
            deletedAt: now,
            expiresAt: now + TRASH_DAYS * 86400000,
            from: 'Gallery',
          }));
        return [...additions, ...prev];
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.add]);

  const totalDays = useMemo(
    () => trash.reduce((min, entry) => Math.min(min, daysLeft(entry.expiresAt)), TRASH_DAYS),
    [trash],
  );

  const restore = (entry: TrashEntry) => {
    setTrash((prev) => prev.filter((t) => t.id !== entry.id));
    setNotice(`“${entry.filename}” is back in your gallery.`);
    setTimeout(() => setNotice(null), 2000);
  };

  const emptyTrash = async (alsoDevice: boolean) => {
    if (alsoDevice) {
      const ids = trash.map((t) => t.id);
      const ok = await deleteFromDevice(ids);
      if (!ok) {
        setNotice('The phone refused the delete. Remove them from your gallery app instead.');
      }
    }
    setTrash([]);
    setConfirmEmpty(false);
    setConfirmDeleteDevice(false);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={trash}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={{
          padding: spacing.md,
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + 40,
          gap: spacing.sm,
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
            <View style={styles.headerRow}>
              <Pressable onPress={() => router.back()} hitSlop={12}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>
              <Text style={[styles.title, { color: colors.text, fontSize: fs(22) }]}>Trash</Text>
              <View style={{ width: 24 }} />
            </View>
            <Text style={{ color: colors.muted, fontSize: fs(12) }}>
              {trash.length > 0
                ? `${plural(trash.length, 'item')} · earliest removal in ${plural(totalDays, 'day')}`
                : `Deleted items stay here for ${TRASH_DAYS} days, then go automatically.`}
            </Text>
            {notice ? (
              <View style={[styles.notice, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="information-circle" size={15} color={colors.primary} />
                <Text style={{ color: colors.text, fontSize: fs(12), flex: 1 }}>{notice}</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item: entry }) => (
          <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Image source={{ uri: entry.uri }} style={styles.thumb} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{ color: colors.text, fontSize: fs(13), fontWeight: '600' }}>
                {entry.filename}
              </Text>
              <Text style={{ color: colors.muted, fontSize: fs(11), marginTop: 1 }}>
                Deleted {formatDateTime(entry.deletedAt)}
              </Text>
              <Text style={{ color: colors.warning, fontSize: fs(11), marginTop: 1 }}>
                Removed in {plural(daysLeft(entry.expiresAt), 'day')}
              </Text>
            </View>
            <Pressable onPress={() => restore(entry)} hitSlop={8} style={styles.restoreBtn}>
              <Ionicons name="arrow-undo-outline" size={18} color={colors.primary} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="trash-outline"
            title="Trash is empty"
            message="Items you delete land here first, so a mistake is never final."
          />
        }
      />

      {trash.length > 0 ? (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              paddingBottom: insets.bottom + spacing.sm,
            },
          ]}>
          <Button
            title="Empty trash"
            variant="danger"
            icon="trash"
            onPress={() => setConfirmEmpty(true)}
          />
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirmEmpty}
        title="Empty the trash?"
        message="These items leave NOOK for good. They stay in your phone's gallery unless you also delete them from the device."
        confirmTitle="Empty"
        cancelTitle="Cancel"
        destructive
        onCancel={() => setConfirmEmpty(false)}
        onConfirm={() => {
          setConfirmEmpty(false);
          setConfirmDeleteDevice(true);
        }}
      />

      <ConfirmDialog
        visible={confirmDeleteDevice}
        title="Also delete from the phone?"
        message="This removes the files from your device's gallery too. It cannot be undone."
        confirmTitle="Delete from phone"
        cancelTitle="Keep on phone"
        destructive
        onCancel={() => void emptyTrash(false)}
        onConfirm={() => void emptyTrash(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontWeight: '800', letterSpacing: -0.4 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 52, height: 52, borderRadius: 8 },
  restoreBtn: { padding: spacing.sm },
  footer: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
