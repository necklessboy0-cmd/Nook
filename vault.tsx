import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as LocalAuthentication from 'expo-local-authentication';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ConfirmDialog, EmptyState } from '@/components/ui';
import { spacing, useTheme } from '@/constants/theme';
import { formatDuration, plural } from '@/lib/format';
import { itemsByIds, type MediaItem } from '@/lib/media';
import { toSaved, useVault } from '@/lib/store';

const PIN_KEY = 'nook.vault.pin';

type Gate = 'checking' | 'locked' | 'open' | 'setup';

export default function VaultScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, appearance, fs } = useTheme();
  const params = useLocalSearchParams<{ add?: string; setpin?: string }>();

  const [vault, setVault] = useVault();
  const [gate, setGate] = useState<Gate>('checking');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [biometrics, setBiometrics] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toRemove, setToRemove] = useState<MediaItem | null>(null);

  const columns = appearance.columns;
  const gap = 3;
  const tile = Math.floor((width - gap * (columns + 1)) / columns);

  const unlockWithBiometrics = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock your vault',
        fallbackLabel: 'Use PIN',
      });
      if (result.success) setGate('open');
    } catch {
      // Stay locked; the PIN field is still there.
    }
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(PIN_KEY).catch(() => null);
      setHasPin(!!stored);
      const hardware = await LocalAuthentication.hasHardwareAsync().catch(() => false);
      const enrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
      setBiometrics(hardware && enrolled);

      if (params.setpin === '1' || !stored) {
        setGate('setup');
        return;
      }
      setGate('locked');
      if (hardware && enrolled) void unlockWithBiometrics();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Items handed over from the gallery.
  useEffect(() => {
    if (!params.add) return;
    (async () => {
      const found = await itemsByIds(params.add!.split(',').filter(Boolean));
      setVault((prev) => {
        const existing = new Set(prev.map((v) => v.id));
        const additions = found
          .filter((item) => !existing.has(item.id))
          .map((item) => ({ ...toSaved(item), addedAt: Date.now() }));
        return [...additions, ...prev];
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.add]);

  const savePin = async () => {
    if (pin.length < 4) {
      setError('Use at least 4 digits.');
      return;
    }
    if (pin !== confirmPin) {
      setError('The two PINs do not match.');
      return;
    }
    setBusy(true);
    try {
      await SecureStore.setItemAsync(PIN_KEY, pin);
      setHasPin(true);
      setPin('');
      setConfirmPin('');
      setError(null);
      setGate('open');
    } catch {
      setError('Could not save the PIN on this device.');
    } finally {
      setBusy(false);
    }
  };

  const tryUnlock = async () => {
    const stored = await SecureStore.getItemAsync(PIN_KEY).catch(() => null);
    if (stored && stored === pin) {
      setPin('');
      setError(null);
      setGate('open');
    } else {
      setError('Wrong PIN.');
      setPin('');
    }
  };

  if (gate === 'checking') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (gate === 'setup' || gate === 'locked') {
    const settingUp = gate === 'setup';
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: spacing.lg }]}>
        <Pressable
          onPress={() => router.back()}
          style={{ position: 'absolute', top: insets.top + spacing.sm, start: spacing.md }}
          hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>

        <View style={[styles.lockCircle, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name="lock-closed" size={30} color={colors.primary} />
        </View>
        <Text style={[styles.gateTitle, { color: colors.text, fontSize: fs(20) }]}>
          {settingUp ? (hasPin ? 'Change your PIN' : 'Protect your vault') : 'Vault locked'}
        </Text>
        <Text style={[styles.gateBody, { color: colors.muted, fontSize: fs(12) }]}>
          {settingUp
            ? 'Choose a PIN. It is stored in this phone’s secure keystore, never in the app’s data.'
            : 'Enter your PIN, or use your fingerprint.'}
        </Text>

        <TextInput
          value={pin}
          onChangeText={(v) => {
            setPin(v.replace(/[^0-9]/g, '').slice(0, 8));
            setError(null);
          }}
          placeholder="PIN"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={8}
          style={[
            styles.pinInput,
            {
              color: colors.text,
              backgroundColor: colors.card,
              borderColor: error ? colors.danger : colors.border,
              fontSize: fs(20),
            },
          ]}
        />
        {settingUp ? (
          <TextInput
            value={confirmPin}
            onChangeText={(v) => {
              setConfirmPin(v.replace(/[^0-9]/g, '').slice(0, 8));
              setError(null);
            }}
            placeholder="Confirm PIN"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={8}
            style={[
              styles.pinInput,
              {
                color: colors.text,
                backgroundColor: colors.card,
                borderColor: error ? colors.danger : colors.border,
                fontSize: fs(20),
              },
            ]}
          />
        ) : null}

        {error ? (
          <Text style={{ color: colors.danger, fontSize: fs(12) }}>{error}</Text>
        ) : null}

        <View style={{ width: '100%', gap: spacing.sm, marginTop: spacing.sm }}>
          <Button
            title={settingUp ? 'Save PIN' : 'Unlock'}
            icon={settingUp ? 'keypad-outline' : 'lock-open-outline'}
            loading={busy}
            onPress={() => void (settingUp ? savePin() : tryUnlock())}
          />
          {!settingUp && biometrics ? (
            <Button
              title="Use fingerprint"
              variant="secondary"
              icon="finger-print-outline"
              onPress={() => void unlockWithBiometrics()}
            />
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={vault}
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
              <Text style={[styles.title, { color: colors.text, fontSize: fs(22) }]}>Vault</Text>
              <Text style={{ color: colors.muted, fontSize: fs(11) }}>
                {plural(vault.length, 'item')} · hidden from the gallery
              </Text>
            </View>
            <Pressable onPress={() => setGate('setup')} hitSlop={12}>
              <Ionicons name="key-outline" size={21} color={colors.text} />
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/viewer', params: { id: item.id } })}
            onLongPress={() => setToRemove(item)}
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
            icon="lock-closed-outline"
            title="The vault is empty"
            message="Select items in the gallery and choose Vault, or add them from inside here."
          />
        }
      />

      <ConfirmDialog
        visible={toRemove !== null}
        title="Remove from vault?"
        message="The item goes back to your normal gallery. It is not deleted."
        confirmTitle="Remove"
        cancelTitle="Cancel"
        onCancel={() => setToRemove(null)}
        onConfirm={() => {
          if (toRemove) setVault((prev) => prev.filter((v) => v.id !== toRemove.id));
          setToRemove(null);
        }}
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
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  title: { fontWeight: '800', letterSpacing: -0.4 },
  lockCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  gateTitle: { fontWeight: '800' },
  gateBody: { textAlign: 'center', lineHeight: 17, marginBottom: spacing.md, maxWidth: 300 },
  pinInput: {
    width: '100%',
    maxWidth: 300,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    textAlign: 'center',
    letterSpacing: 6,
    marginBottom: spacing.sm,
  },
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
