import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ConfirmDialog, EmptyState } from '@/components/ui';
import { spacing, useTheme } from '@/constants/theme';
import { formatDate, plural } from '@/lib/format';
import { itemsByIds } from '@/lib/media';
import { newId, toSaved, useFolders, type Folder } from '@/lib/store';

export default function FavouritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, fs } = useTheme();
  const params = useLocalSearchParams<{ add?: string }>();

  const [folders, setFolders, status] = useFolders();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Folder | null>(null);

  // Items handed over from the gallery's selection bar.
  useEffect(() => {
    if (params.add) {
      setPendingIds(params.add.split(',').filter(Boolean));
      setCreating(true);
    }
  }, [params.add]);

  const totalItems = useMemo(
    () => folders.reduce((sum, folder) => sum + folder.items.length, 0),
    [folders],
  );

  const createFolder = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Give the folder a name.');
      return;
    }
    if (folders.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
      setNameError('A folder with that name already exists.');
      return;
    }
    setBusy(true);
    try {
      const items = pendingIds.length > 0 ? await itemsByIds(pendingIds) : [];
      const folder: Folder = {
        id: newId(),
        name: trimmed,
        createdAt: Date.now(),
        items: items.map(toSaved),
      };
      setFolders((prev) => [folder, ...prev]);
      setName('');
      setNameError(null);
      setPendingIds([]);
      setCreating(false);
    } finally {
      setBusy(false);
    }
  };

  const closeSheet = () => {
    setCreating(false);
    setName('');
    setNameError(null);
    setPendingIds([]);
  };

  if (status === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={folders}
        keyExtractor={(folder) => folder.id}
        contentContainerStyle={{
          padding: spacing.md,
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + 100,
          gap: spacing.sm,
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
            <Text style={[styles.title, { color: colors.text, fontSize: fs(26) }]}>Favourites</Text>
            <Text style={[styles.subtitle, { color: colors.muted, fontSize: fs(12) }]}>
              {plural(folders.length, 'folder')} · {plural(totalItems, 'item')}
            </Text>
          </View>
        }
        renderItem={({ item: folder }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/folder/[id]', params: { id: folder.id } })}
            onLongPress={() => setToDelete(folder)}
            style={({ pressed }) => [
              styles.folderRow,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && { opacity: 0.75 },
            ]}>
            <View style={[styles.cover, { backgroundColor: colors.background }]}>
              {folder.items[0] ? (
                <Image
                  source={{ uri: folder.items[0].uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              ) : (
                <Ionicons name="heart-outline" size={22} color={colors.muted} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.folderName, { color: colors.text, fontSize: fs(15) }]}>
                {folder.name}
              </Text>
              <Text style={[styles.folderMeta, { color: colors.muted, fontSize: fs(12) }]}>
                {plural(folder.items.length, 'item')} · {formatDate(folder.createdAt)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="heart-outline"
            title="No favourites yet"
            message="Heart a photo or video and it moves here, out of the main grid. Each favourite needs a folder name."
            actionTitle="New folder"
            onAction={() => setCreating(true)}
          />
        }
      />

      <Pressable
        onPress={() => setCreating(true)}
        style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + 24 }]}
        accessibilityRole="button"
        accessibilityLabel="New favourite folder">
        <Ionicons name="add" size={26} color={colors.onPrimary} />
      </Pressable>

      <Modal visible={creating} transparent animationType="fade" onRequestClose={closeSheet}>
        <Pressable style={styles.backdrop} onPress={closeSheet}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.card }]}
            onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: colors.text, fontSize: fs(18) }]}>
              Name this folder
            </Text>
            <Text style={[styles.sheetBody, { color: colors.muted, fontSize: fs(13) }]}>
              {pendingIds.length > 0
                ? `${plural(pendingIds.length, 'item')} will be moved into it.`
                : 'You can add items to it later.'}
            </Text>
            <TextInput
              value={name}
              onChangeText={(v) => {
                setName(v);
                setNameError(null);
              }}
              placeholder="e.g. Wallpapers"
              placeholderTextColor={colors.muted}
              autoFocus
              maxLength={40}
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.background,
                  borderColor: nameError ? colors.danger : colors.border,
                  fontSize: fs(15),
                },
              ]}
            />
            {nameError ? (
              <Text style={[styles.error, { color: colors.danger, fontSize: fs(12) }]}>
                {nameError}
              </Text>
            ) : null}
            <View style={styles.sheetActions}>
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="secondary" onPress={closeSheet} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Create" onPress={() => void createFolder()} loading={busy} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={toDelete !== null}
        title={`Delete “${toDelete?.name ?? ''}”?`}
        message="The folder is removed. The photos stay on your phone."
        confirmTitle="Delete"
        cancelTitle="Keep"
        destructive
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) setFolders((prev) => prev.filter((f) => f.id !== toDelete.id));
          setToDelete(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { marginTop: 1 },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cover: {
    width: 54,
    height: 54,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderName: { fontWeight: '700' },
  folderMeta: { marginTop: 2 },
  fab: {
    position: 'absolute',
    end: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: { width: '100%', maxWidth: 420, borderRadius: 18, padding: spacing.lg, gap: spacing.sm },
  sheetTitle: { fontWeight: '700' },
  sheetBody: { lineHeight: 19 },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  error: { marginTop: -2 },
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
