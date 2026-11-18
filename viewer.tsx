import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ConfirmDialog } from '@/components/ui';
import { spacing, useTheme } from '@/constants/theme';
import { formatBytes, formatDateTime, formatDuration } from '@/lib/format';
import { itemsByIds, localUriFor, sizeOf, type MediaItem } from '@/lib/media';
import { TRASH_DAYS, newId, toSaved, useFolders, useTrash, useVault } from '@/lib/store';

export default function ViewerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, fs } = useTheme();
  const params = useLocalSearchParams<{ id?: string; share?: string }>();

  const [item, setItem] = useState<MediaItem | null>(null);
  const [bytes, setBytes] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [showFolders, setShowFolders] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderError, setFolderError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [folders, setFolders] = useFolders();
  const [, setTrash] = useTrash();
  const [, setVault] = useVault();

  useEffect(() => {
    (async () => {
      if (!params.id) {
        setLoading(false);
        return;
      }
      const found = await itemsByIds([params.id]);
      setItem(found[0] ?? null);
      setLoading(false);
      if (found[0]) {
        const size = await sizeOf(found[0]);
        setBytes(size);
        if (params.share === '1') void share(found[0]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const player = useVideoPlayer(
    item?.mediaType === 'video' ? item.uri : null,
    (p) => {
      p.loop = false;
      p.muted = false;
    },
  );

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 1800);
  };

  const share = async (target: MediaItem) => {
    try {
      const uri = await localUriFor(target);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        flash('Sharing is not available on this device.');
      }
    } catch {
      flash('Could not share this item.');
    }
  };

  const addToFolder = () => {
    const trimmed = folderName.trim();
    if (!trimmed) {
      setFolderError('Give the folder a name.');
      return;
    }
    if (!item) return;
    const existing = folders.find((f) => f.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      setFolders((prev) =>
        prev.map((f) =>
          f.id === existing.id && !f.items.some((i) => i.id === item.id)
            ? { ...f, items: [toSaved(item), ...f.items] }
            : f,
        ),
      );
    } else {
      setFolders((prev) => [
        { id: newId(), name: trimmed, createdAt: Date.now(), items: [toSaved(item)] },
        ...prev,
      ]);
    }
    setShowFolders(false);
    setFolderName('');
    setFolderError(null);
    flash(`Moved to “${trimmed}”`);
  };

  const moveToTrash = () => {
    if (!item) return;
    const now = Date.now();
    setTrash((prev) => [
      {
        ...toSaved(item),
        deletedAt: now,
        expiresAt: now + TRASH_DAYS * 86400000,
        from: 'Gallery',
      },
      ...prev,
    ]);
    setConfirmDelete(false);
    router.back();
  };

  const moveToVault = () => {
    if (!item) return;
    setVault((prev) =>
      prev.some((v) => v.id === item.id) ? prev : [{ ...toSaved(item), addedAt: Date.now() }, ...prev],
    );
    flash('Moved to the vault');
  };

  const screen = Dimensions.get('window');

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: '#000' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.center, { backgroundColor: '#000', padding: spacing.lg }]}>
        <Ionicons name="image-outline" size={44} color="#666" />
        <Text style={{ color: '#DDD', fontSize: fs(15), marginTop: spacing.sm }}>
          This item is no longer on your phone.
        </Text>
        <Button title="Close" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: '#000' }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="close" size={26} color="#FFFFFF" />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => setShowInfo(true)} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="information-circle-outline" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.stage}>
        {item.mediaType === 'video' ? (
          <VideoView
            player={player}
            style={{ width: screen.width, height: screen.height * 0.62 }}
            nativeControls
            contentFit="contain"
          />
        ) : (
          <Image
            source={{ uri: item.uri }}
            style={{ width: screen.width, height: screen.height * 0.72 }}
            contentFit="contain"
          />
        )}
      </View>

      {toast ? (
        <View style={[styles.toast, { backgroundColor: colors.primary }]}>
          <Text style={{ color: colors.onPrimary, fontSize: fs(12), fontWeight: '700' }}>{toast}</Text>
        </View>
      ) : null}

      {/* Bottom action bar: Favourite, Share, Info, Adjust */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <BarButton icon="heart-outline" label="Favourite" onPress={() => setShowFolders(true)} />
        <BarButton icon="share-outline" label="Share" onPress={() => void share(item)} />
        <BarButton icon="information-circle-outline" label="Info" onPress={() => setShowInfo(true)} />
        <BarButton
          icon="options-outline"
          label="Adjust"
          onPress={() => router.push({ pathname: '/adjust', params: { id: item.id } })}
        />
        <BarButton icon="lock-closed-outline" label="Vault" onPress={moveToVault} />
        <BarButton icon="trash-outline" label="Delete" onPress={() => setConfirmDelete(true)} />
      </View>

      {/* Favourite folder sheet */}
      <Modal visible={showFolders} transparent animationType="fade" onRequestClose={() => setShowFolders(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowFolders(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: colors.text, fontSize: fs(17) }]}>
              Favourite into a folder
            </Text>
            <Text style={[styles.sheetBody, { color: colors.muted, fontSize: fs(12) }]}>
              It leaves the main grid and lives in Favourites.
            </Text>
            <ScrollView style={{ maxHeight: 180 }} contentContainerStyle={{ gap: spacing.sm }}>
              {folders.map((folder) => (
                <Pressable
                  key={folder.id}
                  onPress={() => {
                    if (!item) return;
                    setFolders((prev) =>
                      prev.map((f) =>
                        f.id === folder.id && !f.items.some((i) => i.id === item.id)
                          ? { ...f, items: [toSaved(item), ...f.items] }
                          : f,
                      ),
                    );
                    setShowFolders(false);
                    flash(`Moved to “${folder.name}”`);
                  }}
                  style={[styles.folderPick, { borderColor: colors.border }]}>
                  <Ionicons name="heart" size={15} color={colors.primary} />
                  <Text style={{ color: colors.text, fontSize: fs(13), flex: 1 }}>{folder.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: fs(11) }}>{folder.items.length}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="New folder"
                  variant="secondary"
                  onPress={() => {
                    setShowFolders(false);
                    setFolderName('');
                    setFolderError(null);
                    setShowFolders(true);
                  }}
                />
              </View>
            </View>
            <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
              <Text style={{ color: colors.muted, fontSize: fs(11) }}>Or name a new one</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <View
                    style={[
                      styles.inputWrap,
                      { backgroundColor: colors.background, borderColor: folderError ? colors.danger : colors.border },
                    ]}>
                    <TextInputInline
                      value={folderName}
                      onChangeText={(v) => {
                        setFolderName(v);
                        setFolderError(null);
                      }}
                      placeholder="Folder name"
                      color={colors.text}
                      placeholderColor={colors.muted}
                      fontSize={fs(14)}
                    />
                  </View>
                  {folderError ? (
                    <Text style={{ color: colors.danger, fontSize: fs(11), marginTop: 2 }}>
                      {folderError}
                    </Text>
                  ) : null}
                </View>
                <Button title="Add" onPress={addToFolder} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Info sheet */}
      <Modal visible={showInfo} transparent animationType="fade" onRequestClose={() => setShowInfo(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowInfo(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: colors.text, fontSize: fs(17) }]}>Details</Text>
            <InfoRow label="Name" value={item.filename} colors={colors} fs={fs} />
            <InfoRow label="Type" value={item.mediaType === 'video' ? 'Video' : 'Photo'} colors={colors} fs={fs} />
            <InfoRow label="Dimensions" value={`${item.width} × ${item.height}`} colors={colors} fs={fs} />
            {item.mediaType === 'video' ? (
              <InfoRow label="Length" value={formatDuration(item.duration)} colors={colors} fs={fs} />
            ) : null}
            <InfoRow label="Size" value={formatBytes(bytes)} colors={colors} fs={fs} />
            <InfoRow label="Taken" value={formatDateTime(item.creationTime)} colors={colors} fs={fs} />
            <View style={{ marginTop: spacing.sm }}>
              <Button title="Close" variant="secondary" onPress={() => setShowInfo(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this item?"
        message={`It moves to the trash and is removed after ${TRASH_DAYS} days.`}
        confirmTitle="Delete"
        cancelTitle="Cancel"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={moveToTrash}
      />
    </View>
  );
}

function TextInputInline({
  value,
  onChangeText,
  placeholder,
  color,
  placeholderColor,
  fontSize,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  color: string;
  placeholderColor: string;
  fontSize: number;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={placeholderColor}
      style={{ color, fontSize, paddingVertical: 10, paddingHorizontal: 12 }}
    />
  );
}

function BarButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { fs } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.barBtn} hitSlop={6}>
      <Ionicons name={icon} size={21} color="#FFFFFF" />
      <Text style={{ color: '#C9C9D1', fontSize: fs(9), fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({
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
    <View style={styles.infoRow}>
      <Text style={{ color: colors.muted, fontSize: fs(12) }}>{label}</Text>
      <Text
        numberOfLines={2}
        style={{ color: colors.text, fontSize: fs(12), fontWeight: '600', flex: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  topBar: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  iconBtn: { padding: spacing.sm },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  barBtn: { alignItems: 'center', gap: 3, paddingHorizontal: 4 },
  toast: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: { width: '100%', maxWidth: 420, borderRadius: 18, padding: spacing.lg, gap: spacing.xs },
  sheetTitle: { fontWeight: '700' },
  sheetBody: { lineHeight: 17, marginBottom: spacing.xs },
  folderPick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: { borderRadius: 10, borderWidth: 1 },
  infoRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: 5 },
});
